// Embeddings against a PostgreSQL that has pgvector. These run only when the extension exists
// (GitHub Actions uses a pgvector image); without it every test here is skipped.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q, ready, tx } from "@/lib/db";
import { indexItem, indexProject, itemText, nearestSql, searchByMeaning, vectorLiteral } from "@/lib/ai/embeddings";
import { POST as reindex } from "@/app/api/index/route";
import { GET as search } from "@/app/api/search/route";
import { embeddingFor, start } from "../standins/openai";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { json, read } from "../api/helpers";
import { chooseEmbedding, clearModelRows } from "./setup";

await ready();
const hasVector = (await q("SELECT 1 FROM pg_extension WHERE extname='vector'")).length > 0;

const PROJECT = "zz-ai-vector";
const ROWS = [
  { title: "Load cell under the handle", body: "Weighs the bag when lifted", data: { ref: "LC1", note: "50 kg max" } },
  { title: "Battery pack", body: "Two 18650 cells", data: { ref: "BT1" } },
  { title: "Luggage tag", body: "", data: {} },
];

afterAll(async () => {
  if (hasVector) {
    await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
    await q("DROP INDEX IF EXISTS embeddings_hnsw_16");
  }
  await clearModelRows();
  await pool().end();
});

describe.runIf(hasVector)("embeddings with pgvector", () => {
  let s: StandIn<OpenAIOptions>;
  let ids: number[] = [];
  const choose = (model: string, dims: number) => chooseEmbedding({ provider: "ollama", baseUrl: `${s.url}/v1`, model, dims });
  const searchUrl = (term: string, mode: string) => `http://t/api/search?projectId=${PROJECT}&q=${encodeURIComponent(term)}&mode=${mode}`;
  const textOf = (i: number) => itemText(ROWS[i]);

  beforeAll(async () => {
    s = await start({ prefix: "/v1", dimensions: 8 });
    await clearModelRows();
    await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
    await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ AI Vector', 'test')", [PROJECT]);
    ids = [];
    for (const [n, r] of ROWS.entries()) {
      const row = await q<{ id: string }>(
        "INSERT INTO items (project_id, section, title, body, data, sort) VALUES ($1, 'design/bom', $2, $3, $4, $5) RETURNING id",
        [PROJECT, r.title, r.body, JSON.stringify(r.data), n]
      );
      ids.push(Number(row[0].id));
    }
    await choose("vec-embed-a", 8);
  });

  afterAll(async () => {
    await s.close();
  });

  beforeEach(() => {
    s.requests.length = 0;
  });

  it("indexes every row of the concept in one batch and stores the model's vectors", async () => {
    const r = await indexProject(PROJECT);
    expect(r).toEqual({ ok: true, indexed: 3, skipped: 0, failed: 0, model: "vec-embed-a", dims: 8, search: "hnsw" });
    expect(s.requests).toHaveLength(1);
    expect((s.requests[0].body as { input: string[] }).input).toEqual([textOf(0), textOf(1), textOf(2)]);

    const stored = await q<{ item_id: string; dims: number; w: number; v: string; project_id: string }>(
      "SELECT item_id, dims, vector_dims(embedding) AS w, embedding::text AS v, project_id FROM embeddings WHERE model='vec-embed-a' AND item_id = ANY($1::bigint[]) ORDER BY item_id",
      [ids]
    );
    expect(stored).toHaveLength(3);
    for (const [n, row] of stored.entries()) {
      expect(row.dims).toBe(8);
      expect(row.w).toBe(8);
      expect(row.project_id).toBe(PROJECT);
      const got = JSON.parse(row.v) as number[];
      const want = embeddingFor(textOf(n), 8);
      got.forEach((x, k) => expect(x).toBeCloseTo(want[k], 5)); // stored as float4
    }
  });

  it("skips rows whose text is unchanged for this model", async () => {
    expect(await indexProject(PROJECT)).toMatchObject({ indexed: 0, skipped: 3, failed: 0 });
    expect(s.requests).toHaveLength(0);
    expect(await indexItem(ids[1])).toMatchObject({ indexed: 0, skipped: 1 });
  });

  it("re-embeds only the row that changed", async () => {
    await q("UPDATE items SET title='Battery pack, 2S' WHERE id=$1", [ids[1]]);
    ROWS[1].title = "Battery pack, 2S";
    expect(await indexProject(PROJECT)).toMatchObject({ indexed: 1, skipped: 2, failed: 0 });
    expect((s.requests[0].body as { input: string[] }).input).toEqual([textOf(1)]);
  });

  it("created the per-width partial HNSW index, and the query can use it", async () => {
    const idx = await q<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE indexname='embeddings_hnsw_8'");
    expect(idx).toHaveLength(1);
    expect(idx[0].indexdef).toMatch(/USING hnsw/);
    expect(idx[0].indexdef).toMatch(/vector\(8\)/);
    expect(idx[0].indexdef).toMatch(/vector_cosine_ops/);
    expect(idx[0].indexdef).toMatch(/dims = 8/);

    const plan = await tx(async (c) => {
      await c.query("SET LOCAL enable_seqscan = off");
      const r = await c.query<{ "QUERY PLAN": string }>(`EXPLAIN ${nearestSql(8)}`, [PROJECT, "vec-embed-a", vectorLiteral(embeddingFor("x", 8)), 5]);
      return r.rows.map((x) => x["QUERY PLAN"]).join("\n");
    });
    expect(plan).toContain("embeddings_hnsw_8");
  });

  it("finds the nearest rows by meaning, with a similarity score", async () => {
    const r = await searchByMeaning(PROJECT, textOf(0), 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items).toHaveLength(3);
    expect(r.items[0].id).toBe(ids[0]);
    expect(r.items[0].score).toBeGreaterThan(0.9999);
    for (let k = 1; k < r.items.length; k++) expect(r.items[k].score).toBeLessThanOrEqual(r.items[k - 1].score);
    // the query was embedded with the configured model
    expect((s.requests.at(-1)!.body as { model: string; input: string[] })).toMatchObject({ model: "vec-embed-a", input: [textOf(0)] });
  });

  it("search mode=meaning and mode=auto answer by meaning with a score per row", async () => {
    const m = await read<{ mode: string; items: { id: number; score: number }[] }>(await search(json("GET", undefined, searchUrl(textOf(0), "meaning"))));
    expect(m.status).toBe(200);
    expect(m.body.mode).toBe("meaning");
    expect(m.body.items[0].id).toBe(ids[0]);
    expect(typeof m.body.items[0].score).toBe("number");
    const a = await read<{ mode: string }>(await search(json("GET", undefined, searchUrl("bag", "auto"))));
    expect(a.body.mode).toBe("meaning");
    const t = await read<{ mode: string; items: { score?: number }[] }>(await search(json("GET", undefined, searchUrl("Battery", "text"))));
    expect(t.body.mode).toBe("text");
    expect(t.body.items[0].score).toBeUndefined();
  });

  it("POST /api/index answers the counts", async () => {
    const r = await read<{ indexed: number; skipped: number; failed: number }>(await reindex(json("POST", { projectId: PROJECT })));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ indexed: 0, skipped: 3, failed: 0 });
  });

  it("after the model changes, old rows stay, queries use only the current model, and auto falls back until re-indexed", async () => {
    await choose("vec-embed-b", 8);
    const auto = await read<{ mode: string; note: string }>(await search(json("GET", undefined, searchUrl("bag", "auto"))));
    expect(auto.body.mode).toBe("text");
    expect(auto.body.note).toMatch(/Re-index/);
    expect((await search(json("GET", undefined, searchUrl("bag", "meaning")))).status).toBe(503);

    expect(await indexProject(PROJECT)).toMatchObject({ indexed: 3, model: "vec-embed-b" });
    const counts = await q<{ model: string; n: number }>(
      "SELECT model, count(*)::int AS n FROM embeddings WHERE project_id=$1 GROUP BY model ORDER BY model",
      [PROJECT]
    );
    expect(counts).toEqual([
      { model: "vec-embed-a", n: 3 },
      { model: "vec-embed-b", n: 3 },
    ]);
    const r = await searchByMeaning(PROJECT, "bag", 10);
    expect(r.ok && r.items.length).toBe(3);
  });

  it("counts every row as failed, with a plain reason, when the model's width is not the configured one", async () => {
    await choose("vec-embed-c", 16); // the stand-in answers 8 wide
    const r = await indexProject(PROJECT);
    expect(r).toMatchObject({ ok: true, indexed: 0, failed: 3, dims: 16 });
    if (r.ok) expect(r.error).toMatch(/8 wide, but Admin says its width is 16/);
    expect(await q("SELECT 1 FROM embeddings WHERE model='vec-embed-c'")).toHaveLength(0);
  });

  it("searches exactly, without an index, above 2,000 dimensions", async () => {
    s.set({ dimensions: 2001 });
    try {
      await choose("vec-wide", 2001);
      const r = await indexProject(PROJECT);
      expect(r).toMatchObject({ ok: true, indexed: 3, failed: 0, dims: 2001, search: "exact" });
      expect(await q("SELECT 1 FROM pg_indexes WHERE indexname='embeddings_hnsw_2001'")).toHaveLength(0);
      const hits = await searchByMeaning(PROJECT, textOf(2), 3);
      expect(hits.ok && hits.items[0].id).toBe(ids[2]);
    } finally {
      s.set({ dimensions: 8 });
    }
  });
});
