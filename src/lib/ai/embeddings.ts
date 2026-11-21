// Embeddings for search by meaning (plan 4.7, 8.6): build the text of a row or a saved research
// answer, embed it with the embedding model chosen in Admin, store it in the `embeddings` table, and
// find the nearest ones.
//
// The table exists only when PostgreSQL has pgvector (see vectorSupport() in src/lib/db.ts). Its
// vector column has no fixed width because the installer chooses the model, so the approximate
// index is made per width, on first use, as a partial expression index. Form taken from the
// pgvector README (FAQ "Can I store vectors with different dimensions in the same column?"):
//   CREATE INDEX ON embeddings USING hnsw ((embedding::vector(3)) vector_l2_ops) WHERE (model_id = 123);
//   SELECT * FROM embeddings WHERE model_id = 123 ORDER BY embedding::vector(3) <-> '[3,1,2]' LIMIT 5;
// with the cosine operator class (vector_cosine_ops, operator <=>; similarity = 1 - distance).
//
// The README limits HNSW indexes on `vector` to 2,000 dimensions. Above that, up to 64,000 (the
// README's limit for `bit`), the index is on a one-bit-per-number copy, and the candidates it finds
// are re-ranked by the full vectors (README, "Binary Quantization"):
//   CREATE INDEX ON items USING hnsw ((binary_quantize(embedding)::bit(3)) bit_hamming_ops);
//   SELECT * FROM (SELECT * FROM items ORDER BY binary_quantize(embedding)::bit(3) <~> binary_quantize('[1,-2,3]') LIMIT 20)
//     ORDER BY embedding <=> '[1,-2,3]' LIMIT 5;
// Qwen3 Embedding 8B gives 4,096 numbers per text, so it takes this path. Above 64,000 a width is
// searched exactly, without an index.
import { createHash } from "node:crypto";
import { ITEM_COLS, q, ready, toItem, tx, type ItemRow } from "@/lib/db";
import { embed, getEmbedding, ModelError, type EmbeddingInfo, type NotConfigured, type ReadyEmbedding } from "./models";

/** pgvector README: "vector - up to 2,000 dimensions" for HNSW and IVFFlat. */
export const MAX_INDEXED_DIMS = 2000;
/** pgvector README: "bit - up to 64,000 dimensions" for HNSW. The binary-quantized index covers widths up to this. */
export const MAX_BINARY_DIMS = 64_000;
// Search rules, from measurements on PostgreSQL 19 with pgvector 0.8.7 (20,000 clustered vectors
// 4,096 wide, 2 cores; measured by the lead on 20 November 2026):
// - Index path (binary-quantized HNSW, then re-rank by cosine): hnsw.ef_search must be at least the
//   candidate limit, or recall collapses. Recall@10 with 100 candidates: 0.76 at ef_search 40, 1.00
//   at ef_search 100 (4.2 ms a query). Exact search over the same 20,000 rows: 509 to 700 ms.
// - Filtered to one concept, the index is the wrong tool while the concept is small: with 1,000 of
//   the 20,000 rows in the concept, exact search took 25 ms with recall 1.00; the index path took
//   44 to 53 ms with recall 0.59, with or without iterative scan. Every search here is filtered to
//   one concept, so a concept with at most EXACT_SEARCH_MAX_ROWS vectors for the model is searched
//   exactly, at every width; the per-width index is still built at index time for when it grows.
// - Building the 4,096-bit index over 20,000 rows took 143 s at maintenance_work_mem 64MB and 11 s at
//   1GB, so ensureWidthIndex raises it to INDEX_BUILD_MEMORY for the build when it is lower.
// - pgvector already stores vector columns out of line and uncompressed (typstorage 'e'): no SET STORAGE.
// - Forcing a parallel scan for exact search was slower on 2 cores (817 ms against 509 ms): not done.

/** At or below this many vectors (one concept, one model) a search is exact; above it the index path runs. */
export const EXACT_SEARCH_MAX_ROWS = 5000;
/** pgvector's largest hnsw.ef_search. */
export const MAX_EF_SEARCH = 1000;
/** maintenance_work_mem for building a per-width index (when the server's is lower). */
export const INDEX_BUILD_MEMORY = "1GB";

/**
 * Candidates the binary index hands to the re-ranking step: ten per answer wanted, at least 100, at
 * most 1,000 (hnsw.ef_search is set to this, and 1,000 is its maximum). Mirrors
 * `least(greatest($4 * 10, 100), 1000)` in the SQL.
 */
export const candidateLimit = (limit: number) => Math.min(Math.max(limit * 10, 100), MAX_EF_SEARCH);

/** How a width is searched: its own HNSW index, a binary-quantized HNSW index with re-ranking, or exactly. */
export type SearchKind = "hnsw" | "binary" | "exact";
export const DEFAULT_BATCH_SIZE = 32;

export type Unavailable = { ok: false; missing: "pgvector" | "unindexed" | NotConfigured["missing"]; reason: string };

export const NO_PGVECTOR =
  "Search by meaning needs the pgvector extension in PostgreSQL, and this database does not have it. Text search still works.";

// ---------------------------------------------------------------------------------------------
// Pure parts (unit-tested without a database)

/** The text embedded for a row: title, body, then every string value inside `data`, in order. */
export function itemText(row: { title: string; body?: string | null; data?: unknown }): string {
  const parts: string[] = [];
  const add = (s: unknown) => {
    if (typeof s === "string" && s.trim()) parts.push(s.trim());
  };
  add(row.title);
  add(row.body);
  const walk = (v: unknown) => {
    if (typeof v === "string") add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(row.data);
  return parts.join("\n");
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export function batches<T>(list: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("batch size must be a positive whole number");
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** pgvector's text form, '[1,2,3]'. */
export function vectorLiteral(v: number[]) {
  if (!v.length || v.some((x) => !Number.isFinite(x))) throw new RangeError("a vector needs at least one finite number");
  return `[${v.join(",")}]`;
}

function width(dims: number) {
  if (!Number.isInteger(dims) || dims < 1 || dims > 100_000) throw new RangeError(`not a vector width: ${dims}`);
  return dims;
}

export const indexName = (dims: number) => `embeddings_hnsw_${width(dims)}`;
export const binaryIndexName = (dims: number) => `embeddings_bq_${width(dims)}`;

/** The per-width approximate index, or null when the width is over pgvector's indexing limit. */
export function hnswIndexSql(dims: number): string | null {
  const n = width(dims);
  if (n > MAX_INDEXED_DIMS) return null;
  return `CREATE INDEX IF NOT EXISTS ${indexName(n)} ON embeddings USING hnsw ((embedding::vector(${n})) vector_cosine_ops) WHERE dims = ${n}`;
}

/** The per-width binary-quantized index for widths above 2,000 and up to 64,000; null otherwise. */
export function binaryIndexSql(dims: number): string | null {
  const n = width(dims);
  if (n <= MAX_INDEXED_DIMS || n > MAX_BINARY_DIMS) return null;
  return `CREATE INDEX IF NOT EXISTS ${binaryIndexName(n)} ON embeddings USING hnsw ((binary_quantize(embedding::vector(${n}))::bit(${n})) bit_hamming_ops) WHERE dims = ${n}`;
}

/** Which kind of index a width gets (before trying to make it). */
export function plannedSearch(dims: number): SearchKind {
  const n = width(dims);
  return n <= MAX_INDEXED_DIMS ? "hnsw" : n <= MAX_BINARY_DIMS ? "binary" : "exact";
}

const ITEM_COLS_I = ITEM_COLS.split(",").map((c) => `i.${c.trim()}`).join(", ");

/**
 * "plain": order by the full vectors (the HNSW index can serve it up to 2,000 numbers).
 * "binary": candidates from the binary-quantized index, re-ranked by the full vectors.
 * "exact": every vector of the concept compared; the distance is computed under an OFFSET 0 fence,
 * so the planner cannot hand the ordering to an index.
 */
export type Scan = "plain" | "binary" | "exact";
/** "items": rows only (search). "all": rows and saved research answers (chat). */
export type Kinds = "items" | "all";

function where(n: number, kinds: Kinds) {
  return `e.project_id = $1 AND e.model = $2 AND e.dims = ${n}` + (kinds === "items" ? " AND e.item_id IS NOT NULL" : "");
}

const bqOrder = (n: number, col: string) => `binary_quantize(${col}::vector(${n}))::bit(${n}) <~> binary_quantize($3::vector(${n}))`;

/**
 * The nearest rows of one concept for one model. The width is written into the statement (it
 * cannot be a parameter of a cast) and repeated in the WHERE clause, so the planner can match the
 * partial index above. Parameters: $1 project id, $2 model, $3 query vector, $4 limit.
 *
 * With scan "binary" the inner select takes least(greatest($4 * 10, 100), 1000) candidates by Hamming distance
 * between the one-bit copies (the binary index's expression, written exactly as in the index), and
 * the outer select re-ranks them by cosine distance on the full vectors. The concept and model
 * filters are in the inner select, so the candidates are this concept's own.
 */
export function nearestSql(dims: number, scan: Scan = "plain") {
  const n = width(dims);
  if (scan === "exact") {
    return (
      `SELECT ${ITEM_COLS_I}, 1 - c.dist AS score FROM (` +
      `SELECT e.item_id, e.embedding::vector(${n}) <=> $3::vector(${n}) AS dist FROM embeddings e WHERE ${where(n, "items")} OFFSET 0` +
      `) c JOIN items i ON i.id = c.item_id ORDER BY c.dist LIMIT $4`
    );
  }
  if (scan === "binary") {
    const dist = `c.embedding::vector(${n}) <=> $3::vector(${n})`;
    return (
      `SELECT ${ITEM_COLS_I}, 1 - (${dist}) AS score FROM (` +
      `SELECT e.item_id, e.embedding FROM embeddings e WHERE ${where(n, "items")} ` +
      `ORDER BY ${bqOrder(n, "e.embedding")} LIMIT least(greatest($4 * 10, 100), 1000)` +
      `) c JOIN items i ON i.id = c.item_id ORDER BY ${dist} LIMIT $4`
    );
  }
  const dist = `e.embedding::vector(${n}) <=> $3::vector(${n})`;
  return (
    `SELECT ${ITEM_COLS_I}, 1 - (${dist}) AS score FROM embeddings e JOIN items i ON i.id = e.item_id ` +
    `WHERE ${where(n, "items")} ` +
    `ORDER BY ${dist} LIMIT $4`
  );
}

/**
 * The nearest rows and saved research answers of one concept for one model, as ids and scores
 * (one of item_id and research_id is set). Same parameters and scans as nearestSql.
 */
export function nearestSourcesSql(dims: number, scan: Scan = "plain") {
  const n = width(dims);
  if (scan === "exact") {
    return (
      `SELECT c.item_id, c.research_id, 1 - c.dist AS score FROM (` +
      `SELECT e.item_id, e.research_id, e.embedding::vector(${n}) <=> $3::vector(${n}) AS dist FROM embeddings e WHERE ${where(n, "all")} OFFSET 0` +
      `) c ORDER BY c.dist LIMIT $4`
    );
  }
  if (scan === "binary") {
    const dist = `c.embedding::vector(${n}) <=> $3::vector(${n})`;
    return (
      `SELECT c.item_id, c.research_id, 1 - (${dist}) AS score FROM (` +
      `SELECT e.item_id, e.research_id, e.embedding FROM embeddings e WHERE ${where(n, "all")} ` +
      `ORDER BY ${bqOrder(n, "e.embedding")} LIMIT least(greatest($4 * 10, 100), 1000)` +
      `) c ORDER BY ${dist} LIMIT $4`
    );
  }
  const dist = `e.embedding::vector(${n}) <=> $3::vector(${n})`;
  return `SELECT e.item_id, e.research_id, 1 - (${dist}) AS score FROM embeddings e WHERE ${where(n, "all")} ORDER BY ${dist} LIMIT $4`;
}

/** How many vectors a concept has for this model and width (decides between the binary scan and an exact one). */
export function countSql(dims: number, kinds: Kinds) {
  return `SELECT count(*)::int AS n FROM embeddings e WHERE ${where(width(dims), kinds)}`;
}

/** The text embedded for a saved research answer: the question, then the answer. */
export function researchText(r: { query: string; answer: string }) {
  return [r.query, r.answer].map((s) => (s ?? "").trim()).filter(Boolean).join("\n");
}

export const UPSERT_SQL =
  "INSERT INTO embeddings (project_id, item_id, model, dims, content_sha256, embedding) VALUES ($1, $2, $3, $4, $5, $6::vector) " +
  "ON CONFLICT (item_id, model) WHERE item_id IS NOT NULL DO UPDATE SET project_id = EXCLUDED.project_id, dims = EXCLUDED.dims, " +
  "content_sha256 = EXCLUDED.content_sha256, embedding = EXCLUDED.embedding, created_at = now()";

export const UPSERT_RESEARCH_SQL =
  "INSERT INTO embeddings (project_id, research_id, model, dims, content_sha256, embedding) VALUES ($1, $2, $3, $4, $5, $6::vector) " +
  "ON CONFLICT (research_id, model) WHERE research_id IS NOT NULL DO UPDATE SET project_id = EXCLUDED.project_id, dims = EXCLUDED.dims, " +
  "content_sha256 = EXCLUDED.content_sha256, embedding = EXCLUDED.embedding, created_at = now()";

// ---------------------------------------------------------------------------------------------
// Database parts

/** True when the `embeddings` table exists (PostgreSQL has pgvector). */
export async function vectorAvailable(): Promise<boolean> {
  const { vector } = await ready();
  if (!vector) return false;
  const rows = await q<{ ok: boolean }>("SELECT to_regclass('embeddings') IS NOT NULL AS ok");
  return !!rows[0]?.ok;
}

const g = globalThis as unknown as { __c2rWidthIndex?: Map<number, SearchKind> };

/**
 * Makes the approximate index for a width the first time it is used. Returns "hnsw" up to 2,000,
 * "binary" above that up to 64,000, and "exact" above 64,000 or when the index could not be made.
 */
export async function ensureWidthIndex(dims: number): Promise<SearchKind> {
  const kind = plannedSearch(dims);
  const sql = kind === "hnsw" ? hnswIndexSql(dims) : kind === "binary" ? binaryIndexSql(dims) : null;
  if (!sql) return "exact";
  g.__c2rWidthIndex ??= new Map();
  const known = g.__c2rWidthIndex.get(dims);
  if (known) return known;
  try {
    await tx(async (c) => {
      // A server that refuses the setting still builds the index, only slower.
      await c.query("SAVEPOINT build_memory");
      try {
        const low = await c.query<{ low: boolean }>(`SELECT pg_size_bytes(current_setting('maintenance_work_mem')) < pg_size_bytes('${INDEX_BUILD_MEMORY}') AS low`);
        if (low.rows[0]?.low) await c.query(`SET LOCAL maintenance_work_mem = '${INDEX_BUILD_MEMORY}'`);
      } catch {
        await c.query("ROLLBACK TO SAVEPOINT build_memory");
      }
      await c.query(sql);
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Two processes creating the same index at once: the loser sees a duplicate; the index is there.
    if (code !== "42P07" && code !== "23505") {
      const name = kind === "hnsw" ? indexName(dims) : binaryIndexName(dims);
      console.error(`[embeddings] could not create ${name}; searching exactly`, e);
      return "exact";
    }
  }
  g.__c2rWidthIndex.set(dims, kind);
  return kind;
}

type Ready = { ok: true; emb: ReadyEmbedding };

async function prerequisites(): Promise<Ready | Unavailable> {
  if (!(await vectorAvailable())) return { ok: false, missing: "pgvector", reason: NO_PGVECTOR };
  const emb = await getEmbedding();
  if (!emb.ok) return emb;
  return { ok: true, emb };
}

export type Counts = { indexed: number; skipped: number; failed: number };

export type IndexCounts = {
  ok: true;
  /** rows and research answers together */
  indexed: number;
  /** text unchanged since it was last embedded with this model, or nothing to embed */
  skipped: number;
  failed: number;
  /** the research answers' share of the three counts above */
  research: Counts;
  model: string;
  dims: number;
  /** the per-width index this model's width has: "hnsw", "binary", or "exact" when it has none */
  index: SearchKind;
  /** what a search of this concept runs now: "exact" while it has at most EXACT_SEARCH_MAX_ROWS vectors, else the index */
  search: SearchKind;
  /** the first failure, in plain words */
  error?: string;
};

export type IndexOptions = { batchSize?: number; signal?: AbortSignal; timeoutMs?: number; maxRetries?: number };

/** One thing to embed: a row of the concept or a saved research answer. */
type Target = { kind: "item" | "research"; id: string; projectId: string; text: string };

/** What a search of this concept would run now (see nearest()). */
async function searchFor(projectId: string | null, info: EmbeddingInfo, index: SearchKind): Promise<SearchKind> {
  if (index === "exact" || !projectId) return "exact";
  const r = await q<{ n: number }>(countSql(info.dims, "all"), [projectId, info.model]);
  return (r[0]?.n ?? 0) > EXACT_SEARCH_MAX_ROWS ? index : "exact";
}

async function indexTargets(projectId: string | null, targets: Target[], emb: ReadyEmbedding, o: IndexOptions): Promise<IndexCounts> {
  const out = await embedTargets(targets, emb, o);
  out.search = await searchFor(projectId, emb.info, out.index);
  return out;
}

async function embedTargets(targets: Target[], emb: ReadyEmbedding, o: IndexOptions): Promise<IndexCounts> {
  const info: EmbeddingInfo = emb.info;
  const index = await ensureWidthIndex(info.dims);
  const out: IndexCounts = { ok: true, indexed: 0, skipped: 0, failed: 0, research: { indexed: 0, skipped: 0, failed: 0 }, model: info.model, dims: info.dims, index, search: "exact" };
  if (!targets.length) return out;
  const bump = (t: Target, field: keyof Counts, n = 1) => {
    out[field] += n;
    if (t.kind === "research") out.research[field] += n;
  };

  const itemIds = targets.filter((t) => t.kind === "item").map((t) => t.id);
  const researchIds = targets.filter((t) => t.kind === "research").map((t) => t.id);
  const known = new Map<string, { content_sha256: string; dims: number }>();
  if (itemIds.length) {
    for (const r of await q<{ item_id: string; content_sha256: string; dims: number }>(
      "SELECT item_id, content_sha256, dims FROM embeddings WHERE model = $1 AND item_id = ANY($2::bigint[])",
      [info.model, itemIds]
    ))
      known.set(`item:${r.item_id}`, r);
  }
  if (researchIds.length) {
    for (const r of await q<{ research_id: string; content_sha256: string; dims: number }>(
      "SELECT research_id, content_sha256, dims FROM embeddings WHERE model = $1 AND research_id = ANY($2::bigint[])",
      [info.model, researchIds]
    ))
      known.set(`research:${r.research_id}`, r);
  }

  const todo: { t: Target; hash: string }[] = [];
  for (const t of targets) {
    const hash = sha256(t.text);
    const prev = known.get(`${t.kind}:${t.id}`);
    if (!t.text || (prev && prev.content_sha256 === hash && prev.dims === info.dims)) bump(t, "skipped");
    else todo.push({ t, hash });
  }

  const groups = batches(todo, o.batchSize ?? DEFAULT_BATCH_SIZE);
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    let vectors: number[][];
    try {
      vectors = (await embed(group.map((x) => x.t.text), { use: emb, signal: o.signal, timeoutMs: o.timeoutMs, maxRetries: o.maxRetries })).vectors;
    } catch (e) {
      // A failed batch is almost always the model host (down, wrong key, wrong width), which the
      // next batch would hit too: stop, and count this batch and the rest as failed.
      for (const g2 of groups.slice(gi)) for (const x of g2) bump(x.t, "failed");
      out.error = e instanceof Error ? e.message : String(e);
      break;
    }
    for (let k = 0; k < group.length; k++) {
      const { t, hash } = group[k];
      try {
        await q(t.kind === "item" ? UPSERT_SQL : UPSERT_RESEARCH_SQL, [t.projectId, t.id, info.model, info.dims, hash, vectorLiteral(vectors[k])]);
        bump(t, "indexed");
      } catch (e) {
        bump(t, "failed");
        out.error ??= e instanceof Error ? e.message : String(e);
      }
    }
  }
  return out;
}

const itemTarget = (r: ItemRow): Target => ({ kind: "item", id: String(r.id), projectId: r.project_id, text: itemText(r) });

/** Embeds one row (if its text changed for the current model). */
export async function indexItem(itemId: number, o: IndexOptions = {}): Promise<IndexCounts | Unavailable> {
  const p = await prerequisites();
  if (!p.ok) return p;
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id = $1`, [itemId]);
  return indexTargets(rows[0]?.project_id ?? null, rows.map(itemTarget), p.emb, o);
}

type ResearchRow = { id: string; project_id: string; query: string; answer: string; created_at?: string };

/** Embeds every row and every saved research answer of a concept whose text changed for the current model. */
export async function indexProject(projectId: string, o: IndexOptions = {}): Promise<IndexCounts | Unavailable> {
  const p = await prerequisites();
  if (!p.ok) return p;
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id = $1 ORDER BY sort, id`, [projectId]);
  const research = await q<ResearchRow>("SELECT id, project_id, query, answer FROM research WHERE project_id = $1 ORDER BY id", [projectId]);
  return indexTargets(
    projectId,
    [...rows.map(itemTarget), ...research.map((r): Target => ({ kind: "research", id: String(r.id), projectId: r.project_id, text: researchText(r) }))],
    p.emb,
    o
  );
}

/** Whether a concept has rows embedded with the current model (for search mode "auto"). */
export async function meaningReady(projectId: string): Promise<Ready | Unavailable> {
  const p = await prerequisites();
  if (!p.ok) return p;
  const rows = await q("SELECT 1 FROM embeddings WHERE project_id = $1 AND model = $2 AND dims = $3 LIMIT 1", [
    projectId,
    p.emb.info.model,
    p.emb.info.dims,
  ]);
  if (!rows.length) return { ok: false, missing: "unindexed", reason: "This concept has no rows indexed for the current embedding model. Re-index it first." };
  return p;
}

export type MeaningHit = ReturnType<typeof toItem> & { score: number };

export type SearchOptions = { signal?: AbortSignal; timeoutMs?: number; use?: ReadyEmbedding; exactThreshold?: number };

/**
 * Runs one nearest-neighbour statement with the scan settings it needs, in one transaction, and
 * says which search ran: "exact", "hnsw" or "binary".
 *
 * The concept's vectors for this model are counted first. At or below `exactThreshold` (default
 * EXACT_SEARCH_MAX_ROWS) the search is exact, at every width; above it the width's index runs
 * (HNSW up to 2,000 numbers, binary-quantized with re-ranking above), with hnsw.ef_search raised to
 * the candidate limit. A width with no index (over 64,000, or the index could not be made) is
 * always searched exactly.
 */
async function nearest<T>(
  projectId: string,
  emb: ReadyEmbedding,
  vector: number[],
  limit: number,
  kinds: Kinds,
  sqlFor: (dims: number, scan: Scan) => string,
  exactThreshold = EXACT_SEARCH_MAX_ROWS
): Promise<{ rows: T[]; search: SearchKind }> {
  const dims = emb.info.dims;
  const index = await ensureWidthIndex(dims);
  return tx(async (c) => {
    let search: SearchKind = "exact";
    if (index !== "exact") {
      const r = await c.query<{ n: number }>(countSql(dims, kinds), [projectId, emb.info.model]);
      if ((r.rows[0]?.n ?? 0) > exactThreshold) search = index;
    }
    const scan: Scan = search === "exact" ? "exact" : search === "binary" ? "binary" : "plain";
    if (scan !== "exact") {
      // The index covers every concept and the concept filter applies after the index scan;
      // iterative scans (pgvector 0.8+) keep reading until enough rows of this concept are found.
      // Relaxed order may return rows slightly out of order, so callers sort again. An HNSW scan
      // returns at most ef_search rows, so it is raised to the candidate limit (see the numbers above).
      await c.query("SAVEPOINT iterative");
      try {
        await c.query("SET LOCAL hnsw.iterative_scan = relaxed_order");
      } catch {
        await c.query("ROLLBACK TO SAVEPOINT iterative"); // older pgvector: plain scan
      }
      await c.query(`SET LOCAL hnsw.ef_search = ${candidateLimit(limit)}`);
    }
    const r = await c.query(sqlFor(dims, scan), [projectId, emb.info.model, vectorLiteral(vector), limit]);
    return { rows: r.rows as T[], search };
  });
}

async function embedQuery(query: string, emb: ReadyEmbedding, o: { signal?: AbortSignal; timeoutMs?: number }) {
  const { vectors } = await embed([query], { use: emb, signal: o.signal, timeoutMs: o.timeoutMs });
  if (vectors[0]?.length !== emb.info.dims) throw new ModelError(502, "The query vector has the wrong width.", "width");
  return vectors[0];
}

/** The rows of a concept nearest in meaning to the query, with cosine similarity (1 = same direction). */
export async function searchByMeaning(
  projectId: string,
  query: string,
  limit = 20,
  o: SearchOptions = {}
): Promise<{ ok: true; items: MeaningHit[]; model: string; dims: number; search: SearchKind } | Unavailable> {
  let emb = o.use;
  if (!emb) {
    const p = await prerequisites();
    if (!p.ok) return p;
    emb = p.emb;
  }
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  const vector = await embedQuery(query, emb, o);
  const { rows, search } = await nearest<ItemRow & { score: number }>(projectId, emb, vector, n, "items", nearestSql, o.exactThreshold);
  const items = rows.map((r) => ({ ...toItem(r), score: Number(r.score) })).sort((a, b) => b.score - a.score);
  return { ok: true, items, model: emb.info.model, dims: emb.info.dims, search };
}

export type ResearchHit = { id: number; projectId: string; query: string; answer: string; createdAt: string };

/** A source found for a question: a row of the concept or a saved research answer, with its score. */
export type SourceHit =
  | { kind: "item"; score: number; item: ReturnType<typeof toItem> }
  | { kind: "research"; score: number; research: ResearchHit };

const toResearch = (r: ResearchRow): ResearchHit => ({ id: Number(r.id), projectId: r.project_id, query: r.query, answer: r.answer, createdAt: String(r.created_at ?? "") });

/** Rows and research answers by id, in the order of the hits given. */
async function loadHits(projectId: string, hits: { item_id: string | null; research_id: string | null; score: number }[]): Promise<SourceHit[]> {
  const itemIds = hits.filter((h) => h.item_id !== null).map((h) => h.item_id);
  const researchIds = hits.filter((h) => h.research_id !== null).map((h) => h.research_id);
  const items = new Map(
    (itemIds.length ? await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id = $1 AND id = ANY($2::bigint[])`, [projectId, itemIds]) : []).map((r) => [String(r.id), r])
  );
  const research = new Map(
    (researchIds.length
      ? await q<ResearchRow>("SELECT id, project_id, query, answer, created_at FROM research WHERE project_id = $1 AND id = ANY($2::bigint[])", [projectId, researchIds])
      : []
    ).map((r) => [String(r.id), r])
  );
  const out: SourceHit[] = [];
  for (const h of hits) {
    const score = Number(h.score);
    if (h.item_id !== null) {
      const r = items.get(String(h.item_id));
      if (r) out.push({ kind: "item", score, item: toItem(r) });
    } else if (h.research_id !== null) {
      const r = research.get(String(h.research_id));
      if (r) out.push({ kind: "research", score, research: toResearch(r) });
    }
  }
  return out;
}

/** The rows and saved research answers of a concept nearest in meaning to the question. */
export async function searchSourcesByMeaning(
  projectId: string,
  query: string,
  limit: number,
  o: SearchOptions & { use: ReadyEmbedding }
): Promise<{ hits: SourceHit[]; search: SearchKind; model: string; dims: number }> {
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  const vector = await embedQuery(query, o.use, o);
  const { rows, search } = await nearest<{ item_id: string | null; research_id: string | null; score: number }>(projectId, o.use, vector, n, "all", nearestSourcesSql, o.exactThreshold);
  rows.sort((a, b) => Number(b.score) - Number(a.score));
  return { hits: await loadHits(projectId, rows), search, model: o.use.info.model, dims: o.use.info.dims };
}

// ---------------------------------------------------------------------------------------------
// Text search over the same sources (the fallback when search by meaning is not available)

/** The words of a question worth matching: letters and digits, three characters or more, common words left out, at most 12. */
export function questionWords(question: string): string[] {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 3 || STOP_WORDS.has(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length === 12) break;
  }
  return out;
}

const STOP_WORDS = new Set(
  "the and for are but not you all any can had her was one our out has have how its may new now see two way who did does what when where which why with this that from they them then than there their these those will would could should about into over such only also just more most some very your been being were here each much many like make made want need tell show give know does doing done".split(
    " "
  )
);

/**
 * Rows and research answers ranked by how many of the question's words they contain ($2, a text
 * array of plain words), best first; rows with none are left out. Score = share of words matched.
 */
export const TEXT_SOURCES_SQL =
  "SELECT * FROM (" +
  "SELECT i.id::text AS item_id, NULL::text AS research_id, " +
  "(SELECT count(*) FROM unnest($2::text[]) w WHERE i.title ILIKE '%' || w || '%' OR i.body ILIKE '%' || w || '%' OR i.data::text ILIKE '%' || w || '%')::float8 AS hits, i.sort AS sort " +
  "FROM items i WHERE i.project_id = $1 " +
  "UNION ALL " +
  "SELECT NULL::text, r.id::text, " +
  "(SELECT count(*) FROM unnest($2::text[]) w WHERE r.query ILIKE '%' || w || '%' OR r.answer ILIKE '%' || w || '%')::float8, 100000 " +
  "FROM research r WHERE r.project_id = $1" +
  ") s WHERE hits > 0 ORDER BY hits DESC, sort, item_id NULLS LAST, research_id LIMIT $3";

export async function searchSourcesByText(projectId: string, question: string, limit: number): Promise<SourceHit[]> {
  const words = questionWords(question);
  if (!words.length) return [];
  const rows = await q<{ item_id: string | null; research_id: string | null; hits: number }>(TEXT_SOURCES_SQL, [projectId, words, limit]);
  return loadHits(
    projectId,
    rows.map((r) => ({ item_id: r.item_id, research_id: r.research_id, score: Number(r.hits) / words.length }))
  );
}
