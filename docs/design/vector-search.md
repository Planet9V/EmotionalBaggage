# Vector search: PostgreSQL 19, pgvector and 4,096 numbers per vector

20 November 2026. This page records what was checked, what was measured, and the settings that follow. The owner's requirement: the most recent PostgreSQL, embeddings from Qwen3 Embedding 8B at 4,096 numbers per text, and the database tuned for it.

## What runs

| Part | Version | How it was confirmed |
|---|---|---|
| PostgreSQL | 19.0, released 19 November 2026, the current release | The PostgreSQL project's announcement; `select version()` in the stack's CI job and on the development server |
| pgvector | 0.8.7, the version its own install instructions give | pgvector README; `select extversion from pg_extension` in both places |
| Image | `pgvector/pgvector:0.8.7-pg19-trixie` | The CI "stack" job pulls it and starts it on every change |

## What PostgreSQL 19 does and does not change for vectors

PostgreSQL itself has no vector type. Vectors, their distance operators and their indexes come from the pgvector extension, so the limits below are pgvector's, not the server's, and are the same on PostgreSQL 19 as on 18. They come from PostgreSQL's 8 KB page: an index entry must fit in one page.

| pgvector type | Bytes per number | Largest width its HNSW index accepts |
|---|---|---|
| `vector` | 4 | 2,000 |
| `halfvec` | 2 | 4,000 |
| `bit` | 1/8 | 64,000 |

Tried on PostgreSQL 19.0 with pgvector 0.8.7 on 20 November, at width 4,096:

- `CREATE INDEX ... USING hnsw ((embedding::vector(4096)) vector_cosine_ops)` answers `column cannot have more than 2000 dimensions for hnsw index`.
- `CREATE INDEX ... USING hnsw ((embedding::halfvec(4096)) halfvec_cosine_ops)` answers `column cannot have more than 4000 dimensions for hnsw index`.
- The one-bit index, `USING hnsw ((binary_quantize(embedding::vector(4096))::bit(4096)) bit_hamming_ops)`, builds and is used.

So 4,096 is 96 numbers past the half-precision limit, and the route pgvector's README gives for it is the one-bit index with a second pass: fetch candidates by Hamming distance on the one-bit copy, then order those candidates by cosine distance on the full vectors.

What PostgreSQL 19 and 18 do bring that matters here, read from release coverage and confirmed with `pg_settings` on the 19.0 server:

| Setting | Value on 19.0 | Why it matters for this workload |
|---|---|---|
| `jit` | `off` (was `on` before 19) | Short searches no longer risk a compile pause. Left as it is. |
| `default_toast_compression` | `lz4` (was `pglz`) | Affects large text. Vectors are not compressed at all: pgvector stores them out of line, uncompressed (`typstorage = 'e'`, confirmed). Nothing to change. |
| `io_method` | `worker`, with `io_min_workers` 2 and `io_max_workers` 8 | Asynchronous reads (new in 18, self-scaling in 19) help the exact search, which reads every vector. Left as it is. |
| `effective_io_concurrency`, `maintenance_io_concurrency` | 16 | Left as they are. |

## Measurements

Server: PostgreSQL 19.0, pgvector 0.8.7, 2 cores, 7 GB. Data: 20,000 vectors of 4,096 numbers. Each is a cluster centre plus noise of its own size, scaled to length 1, so a query's neighbours are ranked from near to far and are not ties. The concepts hold whole clusters: one of 1,000 rows, one of 10,000, and 9,000 other rows. This is generated test data, not Qwen3 output: no model host is available where this was measured. It shows how each method behaves; it does not show how good Qwen3's rankings are. "Found" is the share of the true ten nearest rows (from comparing every full vector) that the method returned.

**A correction.** The first version of this page said the one-bit index found only 59% inside a concept. That figure came from a fault in the first test data: the concept held only five true neighbours per query, so half of each "true ten" were unrelated rows at near-identical distances, which no method can rank. On the corrected data below every method finds all ten. The first version's rule (search exactly up to 5,000 rows) was drawn partly from that figure and is replaced.

Storage: about 26 KB per row (16 KB of vector plus overhead), all of it outside the main table. The one-bit copy adds 512 bytes per row, inside the table.

| Inside a concept of 1,000 rows | Time per query | Found |
|---|---|---|
| Every full vector compared | 10 ms | all |
| Stored one-bit copies compared, best 50 re-ranked | 5 ms | all |
| Stored one-bit copies compared, best 200 re-ranked | 11 ms | all |
| One-bit HNSW index, 100 candidates | 16 to 17 ms | all |

| Inside a concept of 10,000 rows | Time per query | Found |
|---|---|---|
| Every full vector compared | 158 ms | all |
| Stored one-bit copies compared, best 50 re-ranked | 4 ms | all |
| Stored one-bit copies compared, best 200 re-ranked | 6 ms | all |
| One-bit HNSW index, 100 candidates, `hnsw.ef_search` 100 | 5 ms | all |
| One-bit HNSW index, 400 candidates, `hnsw.ef_search` 400 | 20 ms | all |

| All 20,000 rows, no concept | Time per query | Found |
|---|---|---|
| Every full vector compared | 298 ms | all |
| Stored one-bit copies compared, best 200 re-ranked | 8 ms | all |
| One-bit HNSW index, 100 candidates, `hnsw.ef_search` 100 | 4 ms | all |
| One-bit HNSW index, 100 candidates, `hnsw.ef_search` 40 (first data set) | 2 ms | 76% |

| Building the one-bit index over 20,000 rows | Time | Size |
|---|---|---|
| `maintenance_work_mem` 64MB (PostgreSQL's default) | 143 s | 32 MB |
| `maintenance_work_mem` 1GB | 11 s | 32 MB |

A half-precision index over the first 4,000 numbers, re-ranked on all 4,096, was also tried (first data set, 40,000 rows): it found all ten at 100 candidates in 13 ms, took 73 s to build and 625 MB. It is larger and slower than the one-bit routes and is not used.

## How a search runs

Every search in the app is for one concept, one model and one width; an ordinary index on those three columns (`embeddings_scope`) finds the concept's rows. The size of the concept decides the rest.

| Vectors in the concept | What runs | Why |
|---|---|---|
| Up to 2,000 | Every full vector is compared | About 20 ms at the top of the range, and nothing is approximated |
| 2,001 to 100,000 | The stored one-bit copy of every row is compared, and the best 200 to 1,000 are re-ranked by their full vectors | 4 to 6 ms at 10,000 rows against 158 ms; it still looks at every row of the concept, so the concept filter costs nothing and no index can miss a row |
| More than 100,000 | The width's HNSW index (ordinary up to 2,000 numbers, one-bit above), with `hnsw.ef_search` set to the candidate count and `hnsw.iterative_scan = relaxed_order` | The only route whose cost does not grow with the concept |

The one-bit copy is a column PostgreSQL maintains by itself (`bq`, generated from the vector by pgvector's `binary_quantize`). The same rules apply at every width, so a 768-number model is searched the same way.

**Words and meaning together.** Chat runs two searches and joins their rankings: by meaning, as above, and by words, using PostgreSQL's full-text search (a search vector on every row and research answer, with a GIN index; title above body above fields; English word forms folded, so "wires" finds "wire"). A source found by both rises; one found only by an exact word, such as a part number, still gets in. A question that names a section ("What is still open in Bill of materials?") also brings in that section's rows. The join is reciprocal rank fusion with the usual constant of 60, as in pgvector's own hybrid-search example. Without an embedding model the word search runs alone.

## What follows from the measurements

1. **`hnsw.ef_search` must be at least the number of candidates asked for.** With the default of 40, asking for 100 candidates returned the best 40 the index looked at, and 76% were found. The app sets it per search.
2. **Give index builds memory.** 1 GB of `maintenance_work_mem` made the build 13 times faster.
3. **Prefer the stored one-bit copies to the index inside a concept.** They are as fast up to 10,000 rows, need no tuning, and cannot miss a row.
4. **Do not force parallel scans.** On two cores it was slower than PostgreSQL's own choice.
5. **Leave vector storage alone.** It is already out of line and uncompressed.

## Settings in force

In `docker-compose.yml`, each changeable from `.env`:

| Setting | Value | PostgreSQL's default | Reason |
|---|---|---|---|
| `shared_buffers` | 1GB | 128MB | pgvector's guidance is about a quarter of the memory; 1GB suits Docker with 4 GB |
| `effective_cache_size` | 3GB | 4GB | Tells the planner how much the operating system caches; three quarters of 4 GB |
| `maintenance_work_mem` | 1GB | 64MB | Index builds, measured above |
| `max_parallel_maintenance_workers` | 4 | 2 | pgvector builds HNSW indexes in parallel |
| `work_mem` | 32MB | 4MB | Sorting the candidates; also the base for pgvector's iterative-scan memory |
| `random_page_cost` | 1.1 | 4 | The default assumes a spinning disk and steers the planner away from indexes; on solid-state storage 1.1 is the usual value. Not measured here |
| `shm_size` (Docker) | 1 GB | 64 MB | Parallel builds and scans share memory through `/dev/shm`; at Docker's default a large parallel build fails |

With more memory, raise `shared_buffers` to about a quarter of it and `effective_cache_size` to about three quarters. The CI "stack" job reads these back from the running database and fails if they are not in force, and it stores, indexes and searches a 4,096-number vector there on every change.

Indexes the app keeps:

| Table | Index | For |
|---|---|---|
| `embeddings` | `embeddings_scope` (concept, model, width) | Finding one concept's vectors |
| `embeddings` | `embeddings_hnsw_<width>` or `embeddings_bq_<width>` | Concepts above 100,000 vectors |
| `items`, `research` | GIN on `search` | Word search |
| `research`, `messages` | (concept, id) | Reading by concept, and deleting a concept |

## Other ways to index 4,096, and why they are not used now

| Option | What it offers | Why not now |
|---|---|---|
| pgvectorscale (DiskANN) | Indexes `vector` up to 16,000 numbers, on the existing column and operators; PostgreSQL licence | The versions found support PostgreSQL 14 to 18. No statement of PostgreSQL 19 support was found, and 19 is three days old. Needs a different image. |
| VectorChord | Indexes long vectors with its own index types; images exist for PostgreSQL 18, and a fork's page lists 19 | Licensed AGPL-3.0 or Elastic License 2.0. Legal sign-off covers OrcaSlicer and WireViz only, so this needs the owner's decision first. PostgreSQL 19 support was read on a fork's page only. |
| Shorter vectors from the same model | Qwen3 Embedding accepts a chosen output width from 32 to 4,096; at 2,000 or fewer the ordinary index applies | The owner asked for 4,096 |
| Index the first 4,000 numbers at half precision | Stays inside pgvector | Not tried. One index entry would nearly fill a page; the one-bit index is the route pgvector documents |

If concepts grow past tens of thousands of embedded rows and the one-bit index's recall on real Qwen3 vectors proves too low, pgvectorscale is the first to try, once it supports PostgreSQL 19.

## Not verified

- No real Qwen3 Embedding 8B vectors have been stored or searched. The model, its address and its key are set in Admin after install; the measurements above use generated vectors.
- How many of the true nearest rows the one-bit copies find depends on the data, and generated clusters are easier than real text. On real Qwen3 embeddings it should be measured again before relying on it for a concept above 2,000 vectors; below that every vector is compared and nothing is approximated.
- The settings were sized for a machine that gives Docker 4 GB. They have run on GitHub's Linux runners; they have not run on a Mac.
- PostgreSQL 19's release notes were read through news coverage and checked against `pg_settings`; the release-notes page itself could not be opened from the build environment.

## Sources

- PostgreSQL 19 release announcement, 19 November 2026: https://www.postgresql.org/about/news/postgresql-19-released-3449/
- PostgreSQL 19 Beta 1 announcement (changed defaults, asynchronous I/O workers): https://www.postgresql.org/about/news/postgresql-19-beta-1-released-3313/
- pgvector README (limits, binary quantization, tuning): https://github.com/pgvector/pgvector
- pgvectorscale releases (DiskANN up to 16,000; PostgreSQL 18 support): https://github.com/timescale/pgvectorscale/releases
- VectorChord (licence, images): https://github.com/tensorchord/VectorChord
- Qwen3 Embedding 8B on Ollama (width 4,096, chosen widths 32 to 4,096): https://ollama.com/library/qwen3-embedding:8b
