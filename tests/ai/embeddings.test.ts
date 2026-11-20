// Embeddings: the parts that need no pgvector, and the routes' answer when pgvector is missing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import {
  batches,
  hnswIndexSql,
  indexItem,
  indexName,
  indexProject,
  itemText,
  MAX_INDEXED_DIMS,
  nearestSql,
  NO_PGVECTOR,
  searchByMeaning,
  sha256,
  UPSERT_SQL,
  vectorLiteral,
  vectorAvailable,
} from "@/lib/ai/embeddings";
import { POST as reindex } from "@/app/api/index/route";
import { GET as search } from "@/app/api/search/route";
import { json, read, SEEDED } from "../api/helpers";
import { chooseEmbedding, clearModelRows } from "./setup";

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
