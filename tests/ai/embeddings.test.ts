// Embeddings: the parts that need no pgvector, and the routes' answer when pgvector is missing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import {
  batches,
  binaryIndexName,
  binaryIndexSql,
  candidateLimit,
  BIT_SCAN_MAX_ROWS,
  bitCandidates,
  EXACT_SEARCH_MAX_ROWS,
  fuseRanked,
  sectionsNamed,
  countSql,
  MAX_BINARY_DIMS,
  nearestSourcesSql,
  plannedSearch,
  questionWords,
  researchText,
  TEXT_SOURCES_SQL,
  UPSERT_RESEARCH_SQL,
  hnswIndexSql,
  indexItem,
  indexName,
  indexProject,
  itemText,
  MAX_INDEXED_DIMS,
  nearestSql,
  NO_PGVECTOR,
  searchByMeaning,
  UPSERT_SQL,
  vectorLiteral,
  vectorAvailable,
} from "@/lib/ai/embeddings";
import { POST as reindex } from "@/app/api/index/route";
import { GET as search } from "@/app/api/search/route";
import { json, read, SEEDED } from "../api/helpers";
import { chooseEmbedding, clearModelRows } from "./setup";
import { sha256 } from "@/lib/hash";

let hasVector = false;

beforeAll(async () => {
  await ready();
  hasVector = (await q("SELECT 1 FROM pg_extension WHERE extname='vector'")).length > 0;
  await clearModelRows();
});

afterAll(async () => {
  await clearModelRows();
  await pool().end();
});

describe("text of a row", () => {
  it("is the title, the body and every string inside data, in order", () => {
    expect(
      itemText({
        title: "Load cell",
        body: " Measures weight ",
        data: { ref: "LC1", qty: 2, pins: ["VCC", "GND"], nested: { note: "50 kg max", ok: true }, empty: "  " },
      })
    ).toBe("Load cell\nMeasures weight\nLC1\nVCC\nGND\n50 kg max");
    expect(itemText({ title: "Only a title", body: "", data: {} })).toBe("Only a title");
    expect(itemText({ title: "", body: null, data: null })).toBe("");
  });

  it("is hashed with SHA-256, so an unchanged text is recognised", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256(itemText({ title: "a", data: { x: "b" } }))).toBe(sha256("a\nb"));
  });
});

describe("batching and literals", () => {
  it("splits into batches of the given size", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 32)).toEqual([]);
    expect(() => batches([1], 0)).toThrow();
  });

  it("writes vectors in pgvector's text form", () => {
    expect(vectorLiteral([0.5, -1, 2e-7])).toBe("[0.5,-1,2e-7]");
    expect(() => vectorLiteral([])).toThrow();
    expect(() => vectorLiteral([NaN])).toThrow();
  });
});

describe("generated SQL", () => {
  it("makes one partial HNSW index per width, in the form the pgvector README gives", () => {
    expect(hnswIndexSql(768)).toBe(
      "CREATE INDEX IF NOT EXISTS embeddings_hnsw_768 ON embeddings USING hnsw ((embedding::vector(768)) vector_cosine_ops) WHERE dims = 768"
    );
    expect(indexName(8)).toBe("embeddings_hnsw_8");
  });

  it("skips the index above pgvector's 2,000-dimension limit", () => {
    expect(MAX_INDEXED_DIMS).toBe(2000);
    expect(hnswIndexSql(2000)).not.toBeNull();
    expect(hnswIndexSql(2001)).toBeNull();
    expect(hnswIndexSql(3072)).toBeNull();
  });

  it("refuses a width that is not a positive whole number (it is written into the statement)", () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      expect(() => hnswIndexSql(bad)).toThrow();
      expect(() => nearestSql(bad)).toThrow();
    }
  });

  it("queries with the same cast and width condition as the index, filtered by concept and model", () => {
    const sql = nearestSql(8);
    expect(sql).toContain("1 - (e.embedding::vector(8) <=> $3::vector(8)) AS score");
    expect(sql).toContain("WHERE e.project_id = $1 AND e.model = $2 AND e.dims = 8");
    expect(sql).toContain("ORDER BY e.embedding::vector(8) <=> $3::vector(8) LIMIT $4");
    expect(sql).toContain("i.id, i.project_id, i.section");
  });

  it("above 2,000 and up to 64,000 numbers, makes a binary-quantized index in the form the pgvector README gives", () => {
    expect(MAX_BINARY_DIMS).toBe(64_000);
    expect(binaryIndexSql(4096)).toBe(
      "CREATE INDEX IF NOT EXISTS embeddings_bq_4096 ON embeddings USING hnsw ((binary_quantize(embedding::vector(4096))::bit(4096)) bit_hamming_ops) WHERE dims = 4096"
    );
    expect(binaryIndexName(4096)).toBe("embeddings_bq_4096");
    expect(binaryIndexSql(2000)).toBeNull();
    expect(binaryIndexSql(2001)).not.toBeNull();
    expect(binaryIndexSql(64_000)).not.toBeNull();
    expect(binaryIndexSql(64_001)).toBeNull();
    expect(plannedSearch(768)).toBe("hnsw");
    expect(plannedSearch(2000)).toBe("hnsw");
    expect(plannedSearch(2001)).toBe("binary");
    expect(plannedSearch(4096)).toBe("binary");
    expect(plannedSearch(64_001)).toBe("exact");
    expect(() => binaryIndexSql(0)).toThrow();
  });

  it("the binary scan takes candidates by Hamming distance with the index's own expression, then re-ranks by cosine distance", () => {
    const sql = nearestSql(4096, "binary");
    // inner select: this concept, this model, this width, rows only; candidates ordered by the index expression
    expect(sql).toContain(
      "SELECT e.item_id, e.embedding FROM embeddings e WHERE e.project_id = $1 AND e.model = $2 AND e.dims = 4096 AND e.item_id IS NOT NULL " +
        "ORDER BY binary_quantize(e.embedding::vector(4096))::bit(4096) <~> binary_quantize($3::vector(4096)) LIMIT least(greatest($4 * 10, 100), 1000)"
    );
    // outer select: re-ranked on the full vectors, real limit
    expect(sql).toContain(") c JOIN items i ON i.id = c.item_id ORDER BY c.embedding::vector(4096) <=> $3::vector(4096) LIMIT $4");
    expect(sql).toContain("1 - (c.embedding::vector(4096) <=> $3::vector(4096)) AS score");
    expect(sql).toContain("i.id, i.project_id, i.section");
    // the plain form is unchanged
    expect(nearestSql(4096)).toBe(nearestSql(4096, "plain"));
    expect(nearestSql(4096)).not.toContain("binary_quantize");
    expect(candidateLimit(8)).toBe(100);
    expect(candidateLimit(20)).toBe(200);
    expect(candidateLimit(100)).toBe(1000); // pgvector's largest ef_search
    expect(candidateLimit(500)).toBe(1000);
    expect(EXACT_SEARCH_MAX_ROWS).toBe(2000);
  });

  it("the exact scan computes the distance under an OFFSET 0 fence, so no index can serve the ordering", () => {
    for (const n of [8, 768, 4096]) {
      const sql = nearestSql(n, "exact");
      expect(sql).toContain(
        `SELECT e.item_id, e.embedding::vector(${n}) <=> $3::vector(${n}) AS dist FROM embeddings e WHERE e.project_id = $1 AND e.model = $2 AND e.dims = ${n} AND e.item_id IS NOT NULL OFFSET 0`
      );
      expect(sql).toContain(") c JOIN items i ON i.id = c.item_id ORDER BY c.dist LIMIT $4");
      expect(sql).toContain("1 - c.dist AS score");
      expect(sql).not.toContain("binary_quantize");
    }
    expect(nearestSourcesSql(4096, "exact")).toBe(
      "SELECT c.item_id, c.research_id, 1 - c.dist AS score FROM (SELECT e.item_id, e.research_id, e.embedding::vector(4096) <=> $3::vector(4096) AS dist FROM embeddings e " +
        "WHERE e.project_id = $1 AND e.model = $2 AND e.dims = 4096 OFFSET 0) c ORDER BY c.dist LIMIT $4"
    );
  });

  it("chat's sources query covers rows and research answers, in both scans", () => {
    const plain = nearestSourcesSql(8);
    expect(plain).toBe(
      "SELECT e.item_id, e.research_id, 1 - (e.embedding::vector(8) <=> $3::vector(8)) AS score FROM embeddings e " +
        "WHERE e.project_id = $1 AND e.model = $2 AND e.dims = 8 ORDER BY e.embedding::vector(8) <=> $3::vector(8) LIMIT $4"
    );
    const bq = nearestSourcesSql(4096, "binary");
    expect(bq).toContain("SELECT e.item_id, e.research_id, e.embedding FROM embeddings e WHERE e.project_id = $1 AND e.model = $2 AND e.dims = 4096 ORDER BY binary_quantize(");
    expect(bq).toContain("LIMIT least(greatest($4 * 10, 100), 1000)) c ORDER BY c.embedding::vector(4096) <=> $3::vector(4096) LIMIT $4");
    expect(bq).not.toContain("item_id IS NOT NULL");
    expect(countSql(4096, "all")).toBe("SELECT count(*)::int AS n FROM embeddings e WHERE e.project_id = $1 AND e.model = $2 AND e.dims = 4096");
    expect(countSql(4096, "items")).toContain("AND e.item_id IS NOT NULL");
  });

  it("embeds a research answer as its question and answer, and upserts on the (research, model) unique index", () => {
    expect(researchText({ query: " Weight limits? ", answer: "23 kg. " })).toBe("Weight limits?\n23 kg.");
    expect(researchText({ query: "Only a question", answer: "" })).toBe("Only a question");
    expect(UPSERT_RESEARCH_SQL).toContain("(project_id, research_id, model, dims, content_sha256, embedding)");
    expect(UPSERT_RESEARCH_SQL).toContain("ON CONFLICT (research_id, model) WHERE research_id IS NOT NULL DO UPDATE");
  });

  it("text search for chat matches a question's useful words in rows and research answers", () => {
    expect(questionWords("What does the load-cell weigh, and what is the 50 kg limit? What?")).toEqual(["load", "cell", "weigh", "limit"]);
    expect(questionWords("is it ok")).toEqual([]);
    expect(questionWords("Batería ÜBER")).toEqual(["batería", "über"]);
    expect(TEXT_SOURCES_SQL).toContain("i.search @@ t.query OR i.section = ANY($4::text[])");
    expect(TEXT_SOURCES_SQL).toContain("r.search @@ t.query");
    expect(TEXT_SOURCES_SQL).toContain("ORDER BY rank DESC");
  });

  it("recognises a section named in the question", () => {
    expect(sectionsNamed("What is still open in Bill of materials?")).toEqual(["design/bom"]);
    // the Schematic section keeps its rows under the wiring store
    expect(sectionsNamed("what does the SCHEMATIC say")).toEqual(["design/wiring"]);
    expect(sectionsNamed("How heavy is it?")).toEqual([]);
  });

  it("joins two rankings: found by both rises, found by one still gets in", () => {
    const item = (id: number) => ({ kind: "item" as const, score: 0, item: { id } as never });
    const fused = fuseRanked([[item(1), item(2), item(3)], [item(3), item(4)]], 4);
    const ids = fused.map((h) => (h.kind === "item" ? h.item.id : 0));
    expect(ids.slice(0, 2)).toEqual([3, 1]);
    expect(ids).toContain(4);
    expect(fuseRanked([[item(1), item(2), item(3)], [item(3), item(4)]], 2)).toHaveLength(2);
    expect(fused[0].score).toBeCloseTo(1 / 63 + 1 / 61, 10);
  });

  it("compares the stored one-bit copies under a fence, then re-ranks the best by the full vectors", () => {
    const sql = nearestSql(4096, "bits");
    expect(sql).toContain("e.bq::bit(4096) <~> binary_quantize($3::vector(4096)) AS h");
    expect(sql).toContain("OFFSET 0) x ORDER BY x.h LIMIT least(greatest($4 * 20, 200), 1000)");
    expect(sql).toContain("ORDER BY c.embedding::vector(4096) <=> $3::vector(4096) LIMIT $4");
    expect(nearestSourcesSql(8, "bits")).toContain("e.research_id, e.embedding, e.bq::bit(8)");
    expect([bitCandidates(1), bitCandidates(8), bitCandidates(20), bitCandidates(100)]).toEqual([200, 200, 400, 1000]);
    expect(BIT_SCAN_MAX_ROWS).toBe(100_000);
  });

  it("upserts on the (item, model) unique index", () => {
    expect(UPSERT_SQL).toContain("ON CONFLICT (item_id, model) WHERE item_id IS NOT NULL DO UPDATE");
    expect(UPSERT_SQL).toContain("$6::vector");
  });
});

describe("without pgvector", () => {
  it("indexing and search say pgvector is missing instead of throwing", async (t) => {
    if (hasVector) t.skip();
    expect(await vectorAvailable()).toBe(false);
    await chooseEmbedding({ provider: "ollama", baseUrl: "http://127.0.0.1:9/v1", model: "e", dims: 8 });
    expect(await indexProject(SEEDED)).toEqual({ ok: false, missing: "pgvector", reason: NO_PGVECTOR });
    expect(await indexItem(1)).toEqual({ ok: false, missing: "pgvector", reason: NO_PGVECTOR });
    expect(await searchByMeaning(SEEDED, "weight")).toEqual({ ok: false, missing: "pgvector", reason: NO_PGVECTOR });
  });

  it("POST /api/index answers 503 with the reason", async (t) => {
    if (hasVector) t.skip();
    const r = await read<{ error: string; missing: string }>(await reindex(json("POST", { projectId: SEEDED })));
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: NO_PGVECTOR, missing: "pgvector" });
  });

  it("search mode=meaning answers 503; mode=auto falls back to text and says why", async (t) => {
    if (hasVector) t.skip();
    const meaning = await read<{ error: string }>(await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=weight&mode=meaning`)));
    expect(meaning.status).toBe(503);
    expect(meaning.body.error).toBe(NO_PGVECTOR);
    const auto = await read<{ mode: string; note: string; items: unknown[] }>(await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=weight&mode=auto`)));
    expect(auto.status).toBe(200);
    expect(auto.body.mode).toBe("text");
    expect(auto.body.note).toBe(NO_PGVECTOR);
  });
});

describe("routes, either way", () => {
  it("POST /api/index validates its body and the concept", async () => {
    expect((await reindex(json("POST", {}))).status).toBe(400);
    expect((await reindex(json("POST", "not json"))).status).toBe(400);
    expect((await reindex(json("POST", { projectId: "nope" }))).status).toBe(404);
  });

  it("search keeps today's text answer by default, and refuses an unknown mode", async () => {
    const r = await read<{ mode: string; items: { title: string }[]; note?: string }>(
      await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=a`))
    );
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("text");
    expect(r.body.note).toBeUndefined();
    expect(r.body.items.length).toBeGreaterThan(0);
    expect((await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=a&mode=vibes`))).status).toBe(400);
  });

  it("search by meaning without an embedding model says so", async () => {
    await clearModelRows();
    const r = await read<{ error?: string; note?: string; mode?: string }>(
      await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=a&mode=meaning`))
    );
    expect(r.status).toBe(503);
    expect(r.body.error).toBe(hasVector ? "No embedding model is chosen. Choose one in Admin, Models." : NO_PGVECTOR);
  });
});
