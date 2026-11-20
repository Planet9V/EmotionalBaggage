// The research route (GET and POST /api/research) against the Perplexity stand-in.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET, POST } from "@/app/api/research/route";
import { json, read, SEEDED } from "../api/helpers";
import * as perplexity from "../standins/perplexity";
import type { StandIn } from "../standins/core";

const KEY = "pplx-route-test-key-7890";
let s: StandIn<perplexity.PerplexityOptions>;
const savedEnvKey = process.env.PERPLEXITY_API_KEY;

type Entry = { id: number; query: string; answer: string; citations: string[]; sources: { url: string; title?: string }[]; model: string; createdAt: string };

beforeAll(async () => {
  delete process.env.PERPLEXITY_API_KEY;
  s = await perplexity.start({ apiKey: KEY, reply: "Routed answer[1].", citations: ["https://cite.example/x", "https://cite.example/y"], costUsd: 0.002 });
  process.env.PERPLEXITY_BASE_URL = s.url;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND field='apiKey'");
});

afterAll(async () => {
  delete process.env.PERPLEXITY_BASE_URL;
  if (savedEnvKey !== undefined) process.env.PERPLEXITY_API_KEY = savedEnvKey;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND value=$1", [KEY]);
  await q("DELETE FROM research WHERE query LIKE 'test:%'");
  await s.close();
  await pool().end();
});

const getState = async () => read<{ configured: boolean; model: string; entries: Entry[] }>(await GET(json("GET", undefined, `http://test.local/api/research?projectId=${SEEDED}`)));

describe("research route", () => {
  it("is not configured without a key, and refuses to ask with a 503", async () => {
    const g = await getState();
    expect(g.status).toBe(200);
    expect(g.body.configured).toBe(false);
    expect(g.body.model).toBe("fast");
    const r = await read<{ error: string }>(await POST(json("POST", { projectId: SEEDED, query: "test: not connected" })));
    expect(r).toEqual({ status: 503, body: { error: "Perplexity is not connected. Add a key in Admin, Credentials." } });
    expect(s.requests).toHaveLength(0);
  });

  it("stores the answer with its citations and answers in the shape the browser reads", async () => {
    await q("INSERT INTO credentials (provider, field, value) VALUES ('perplexity','apiKey',$1)", [KEY]);
    expect((await getState()).body.configured).toBe(true);

    const r = await read<{ entry: Entry; effort: string; costUsd: number }>(await POST(json("POST", { projectId: SEEDED, query: "test: stand-in question" })));
    expect(r.status).toBe(201);
    expect(r.body.entry).toMatchObject({
      query: "test: stand-in question",
      answer: "Routed answer[1].",
      citations: ["https://cite.example/x", "https://cite.example/y"],
      sources: [{ url: "https://cite.example/x", title: "Stand-in source 1" }, { url: "https://cite.example/y", title: "Stand-in source 2" }],
      model: "openai/gpt-6-luna",
    });
    expect(typeof r.body.entry.id).toBe("number");
    expect(typeof r.body.entry.createdAt).toBe("string");
    expect(r.body.effort).toBe("fast@2026-10-16.0");
    expect(r.body.costUsd).toBe(0.002);

    const sent = s.requests.at(-1)!;
    expect(sent.path).toBe("/v1/agent");
    expect(sent.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent.body).toMatchObject({ effort: "fast", input: "test: stand-in question" });

    const rows = await q<{ citations: string[]; model: string }>("SELECT citations, model FROM research WHERE id=$1", [r.body.entry.id]);
    expect(rows[0]).toEqual({ citations: ["https://cite.example/x", "https://cite.example/y"], model: "openai/gpt-6-luna" });
    const ev = await q<{ kind: string; data: { researchId: number } }>("SELECT kind, data FROM events WHERE project_id=$1 AND kind='research.asked' ORDER BY id DESC LIMIT 1", [SEEDED]);
    expect(ev[0].data.researchId).toBe(r.body.entry.id);

    const g = await getState();
    const listed = g.body.entries.find((e) => e.id === r.body.entry.id)!;
    expect(Object.keys(listed).sort()).toEqual(["answer", "citations", "createdAt", "id", "model", "query", "sources"]);
    expect(listed.citations).toEqual(["https://cite.example/x", "https://cite.example/y"]);
    expect(listed.sources).toEqual([{ url: "https://cite.example/x" }, { url: "https://cite.example/y" }]);
  });

  it("passes on upstream failures as plain messages and stores nothing", async () => {
    const before = await q<{ n: number }>("SELECT count(*)::int AS n FROM research WHERE project_id=$1", [SEEDED]);
    s.set({ failWith: 500 });
    const a = await read<{ error: string }>(await POST(json("POST", { projectId: SEEDED, query: "test: fails" })));
    expect(a.status).toBe(502);
    expect(a.body.error).toMatch(/HTTP 500/);
    s.set({ failWith: undefined, rateLimit: "request_rate_limit_exceeded" });
    const b = await read<{ error: string }>(await POST(json("POST", { projectId: SEEDED, query: "test: limited" })));
    expect(b.status).toBe(429);
    s.set({ rateLimit: undefined, apiKey: "something-else" });
    const c = await read<{ error: string }>(await POST(json("POST", { projectId: SEEDED, query: "test: wrong key" })));
    expect(c.status).toBe(502);
    expect(c.body.error).toMatch(/HTTP 401/);
    expect(c.body.error).not.toContain(KEY);
    s.set({ apiKey: KEY });
    const after = await q<{ n: number }>("SELECT count(*)::int AS n FROM research WHERE project_id=$1", [SEEDED]);
    expect(after[0].n).toBe(before[0].n);
  });
});
