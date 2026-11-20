// The Perplexity client against the stand-in written to the documented Agent API.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { ask, AGENT_PATH, DEFAULT_EFFORT, INSTRUCTIONS, readResponse } from "@/lib/research/perplexity";
import * as perplexity from "../standins/perplexity";
import type { StandIn } from "../standins/core";

let s: StandIn<perplexity.PerplexityOptions>;
const KEY = "pplx-client-test-key-123456";

beforeAll(async () => {
  s = await perplexity.start({ apiKey: KEY });
  process.env.PERPLEXITY_BASE_URL = s.url;
});
afterEach(() => {
  s.requests.length = 0;
  s.set({ reply: undefined, noSources: false, rateLimit: undefined, malformed: undefined, failedRun: false, failWith: undefined, delayMs: 0, costUsd: undefined, citations: ["https://example.com/source-1", "https://example.org/source-2"] });
});
afterAll(async () => {
  delete process.env.PERPLEXITY_BASE_URL;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND value=$1", [KEY]);
  await q("DELETE FROM settings WHERE key='research.model'");
  await s.close();
  await pool().end();
});

describe("ask", () => {
  it("returns the answer and its sources, and sends exactly the documented request", async () => {
    s.set({ reply: "Answer with a cite[1][2].", citations: ["https://a.example/1", "https://b.example/2"], costUsd: 0.0031 });
    const r = await ask({ question: "  How heavy is a carry-on?  ", apiKey: KEY, effort: "fast" });
    expect(r).toMatchObject({
      ok: true,
      answer: "Answer with a cite[1][2].",
      sources: [
        { url: "https://a.example/1", title: "Stand-in source 1", id: 1 },
        { url: "https://b.example/2", title: "Stand-in source 2", id: 2 },
      ],
      model: "openai/gpt-6-luna",
      effort: "fast@2026-10-16.0",
      costUsd: 0.0031,
    });
    expect(s.requests).toHaveLength(1);
    const sent = s.requests[0];
    expect(sent.method).toBe("POST");
    expect(sent.path).toBe(AGENT_PATH);
    expect(sent.path).toBe("/v1/agent");
    expect(sent.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent.headers["content-type"]).toMatch(/^application\/json/);
    expect(sent.body).toEqual({ effort: "fast", instructions: INSTRUCTIONS, input: "How heavy is a carry-on?", tools: [{ type: "web_search" }] });
  });

  it("reads the key from credentials and the effort from the setting when not given", async () => {
    await q("DELETE FROM credentials WHERE provider='perplexity' AND field='apiKey'");
    await q("INSERT INTO credentials (provider, field, value) VALUES ('perplexity','apiKey',$1)", [KEY]);
    await q("DELETE FROM settings WHERE key='research.model'");
    expect((await ask({ question: "q" })).ok).toBe(true);
    expect((s.requests[0].body as { effort: string }).effort).toBe(DEFAULT_EFFORT);
    await q("INSERT INTO settings (key, value) VALUES ('research.model', $1)", [JSON.stringify("low")]);
    await ask({ question: "q" });
    expect((s.requests[1].body as { effort: string }).effort).toBe("low");
    await q("UPDATE settings SET value=$1 WHERE key='research.model'", [JSON.stringify("Not An Effort!")]);
    await ask({ question: "q" });
    expect((s.requests[2].body as { effort: string }).effort).toBe(DEFAULT_EFFORT);
    await q("DELETE FROM credentials WHERE provider='perplexity' AND field='apiKey'");
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      expect(await ask({ question: "q" })).toEqual({ ok: false, kind: "not_configured", message: "Perplexity is not connected. Add a key in Admin, Credentials." });
    } finally {
      if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
    }
  });

  it("returns an answer with no sources", async () => {
    s.set({ noSources: true, reply: "Nothing reliable was found." });
    const r = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    expect(r).toMatchObject({ ok: true, answer: "Nothing reliable was found.", sources: [] });
  });

  it("turns a wrong key into a plain 401 sentence without the key", async () => {
    const r = await ask({ question: "q", apiKey: "pplx-wrong-key-abcdef", effort: "fast" });
    expect(r).toMatchObject({ ok: false, kind: "http", status: 401 });
    if (r.ok) throw new Error("unreachable");
    expect(r.message).toMatch(/^Perplexity refused the key \(HTTP 401\)/);
    expect(r.message).not.toContain("pplx-wrong-key-abcdef");
    expect(r.message).not.toContain(KEY);
  });

  it("reports a 429 with the wait Perplexity asks for", async () => {
    s.set({ rateLimit: "token_rate_limit_exceeded" });
    const r = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    expect(r).toMatchObject({ ok: false, kind: "rate_limited", status: 429 });
    if (r.ok) throw new Error("unreachable");
    expect(r.message).toContain("Try again in 7 seconds");
    expect(r.message).toContain("Token rate limit exceeded");
    s.set({ rateLimit: "overloaded" });
    const o = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    if (o.ok) throw new Error("unreachable");
    expect(o.message).toMatch(/overloaded \(HTTP 429\)/);
  });

  it("reports a 500 as a server error with its status", async () => {
    s.set({ failWith: 500 });
    const r = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    expect(r).toMatchObject({ ok: false, kind: "http", status: 500 });
    if (r.ok) throw new Error("unreachable");
    expect(r.message).toMatch(/server error \(HTTP 500\)/);
  });

  it("gives up after the time limit", async () => {
    s.set({ delayMs: 3000 });
    const t0 = Date.now();
    const r = await ask({ question: "q", apiKey: KEY, effort: "fast", timeoutMs: 200 });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r).toEqual({ ok: false, kind: "timeout", message: "Perplexity did not answer within 0.2 seconds." });
  });

  it("stops when the caller cancels", async () => {
    s.set({ delayMs: 3000 });
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 100);
    const r = await ask({ question: "q", apiKey: KEY, effort: "fast", signal: ac.signal });
    expect(r).toMatchObject({ ok: false, kind: "aborted" });
  });

  it("refuses malformed answers", async () => {
    s.set({ malformed: "not-json" });
    const a = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    expect(a).toMatchObject({ ok: false, kind: "malformed", status: 200 });
    s.set({ malformed: "no-output" });
    const b = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    expect(b).toMatchObject({ ok: false, kind: "malformed" });
    if (b.ok) throw new Error("unreachable");
    expect(b.message).toContain("no output array");
    s.set({ malformed: undefined, failedRun: true });
    const c = await ask({ question: "q", apiKey: KEY, effort: "fast" });
    expect(c).toMatchObject({ ok: false, kind: "failed" });
    if (c.ok) throw new Error("unreachable");
    expect(c.message).toContain("status failed");
  });

  it("cannot reach a closed address", async () => {
    process.env.PERPLEXITY_BASE_URL = "http://127.0.0.1:9";
    try {
      const r = await ask({ question: "q", apiKey: KEY, effort: "fast" });
      expect(r).toMatchObject({ ok: false, kind: "network" });
    } finally {
      process.env.PERPLEXITY_BASE_URL = s.url;
    }
  });
});

describe("readResponse", () => {
  it("orders sources by id, drops duplicates and non-web addresses, joins message texts", () => {
    const r = readResponse({
      output: [
        { type: "search_results", results: [{ id: 2, url: "https://b.example" }, { id: 1, url: "https://a.example", title: " A " }, { id: 3, url: "ftp://x" }, { id: 4, url: "https://a.example" }] },
        { type: "message", content: [{ type: "output_text", text: "one" }] },
        { type: "message", content: [{ type: "output_text", text: "two" }, { type: "refusal", text: "no" }] },
      ],
    });
    expect(r).toMatchObject({ answer: "one\n\ntwo", sources: [{ url: "https://a.example", title: "A", id: 1 }, { url: "https://b.example", id: 2 }] });
  });

  it("falls back to a top-level output_text only when the output array has no text", () => {
    expect(readResponse({ output: [], output_text: "sdk-style" })).toMatchObject({ answer: "sdk-style" });
    expect(readResponse([])).toEqual({ malformed: "the body is not a JSON object" });
  });
});
