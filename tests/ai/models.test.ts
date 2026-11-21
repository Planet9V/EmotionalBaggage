// The model layer against the OpenAI-compatible stand-in, for each provider's base-path convention.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { APICallError } from "ai";
import { z } from "zod";
import { pool } from "@/lib/db";
import {
  checkWidths,
  complete,
  completeJson,
  completeStream,
  embed,
  explain,
  extractJson,
  getEmbedding,
  getReasoning,
  ModelError,
  scrub,
} from "@/lib/ai/models";
import { embeddingFor, start } from "../standins/openai";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { chooseEmbedding, chooseReasoning, clearModelRows, closedPort, PROVIDERS, saveKey } from "./setup";

const savedEnv = process.env.OPENROUTER_API_KEY;

beforeAll(async () => {
  delete process.env.OPENROUTER_API_KEY; // settings.ts falls back to it; these tests need it absent
  await clearModelRows();
});

afterAll(async () => {
  await clearModelRows();
  if (savedEnv !== undefined) process.env.OPENROUTER_API_KEY = savedEnv;
  await pool().end();
});

async function caught(p: Promise<unknown>): Promise<ModelError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ModelError);
    return e as ModelError;
  }
  throw new Error("expected a ModelError, got success");
}

type ChatBody = { model: string; messages: { role: string; content: string }[]; stream?: boolean; response_format?: { type: string } };

describe.each(PROVIDERS)("$provider ($prefix)", ({ provider, prefix, key }) => {
  let s: StandIn<OpenAIOptions>;
  const model = `${provider}-chat-model`;

  beforeAll(async () => {
    s = await start({ prefix, ...(key ? { apiKey: key } : {}) });
  });
  afterAll(async () => {
    await s.close();
  });
  beforeEach(async () => {
    s.requests.length = 0;
    s.set({ failWith: undefined, failPath: undefined, delayMs: 0, reply: undefined, dimensions: 8 });
    await clearModelRows();
    await chooseReasoning({ provider, baseUrl: `${s.url}${prefix}`, model });
    await chooseEmbedding({ provider, baseUrl: `${s.url}${prefix}`, model: `${provider}-embed`, dims: 8 });
    await saveKey(provider, key);
  });

  it("completes: path, model, messages, and Authorization only when a key is saved", async () => {
    const r = await complete({ system: "Be brief.", messages: [{ role: "user", content: "hello there" }], maxOutputTokens: 50, maxRetries: 0 });
    expect(r.text).toBe("Echo: hello there");
    expect(r.info).toEqual({ provider, model, baseUrl: `${s.url}${prefix}` });
    expect(r.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    expect(s.requests).toHaveLength(1);
    const req = s.requests[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe(`${prefix}/chat/completions`);
    const b = req.body as ChatBody & { max_tokens?: number };
    expect(b.model).toBe(model);
    expect(b.max_tokens).toBe(50);
    expect(b.messages).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "hello there" },
    ]);
    if (key) expect(req.headers.authorization).toBe(`Bearer ${key}`);
    else expect(req.headers.authorization).toBeUndefined();
  });

  it("streams a completion that equals the whole answer", async () => {
    const r = await completeStream({ messages: [{ role: "user", content: "one two three" }], maxRetries: 0 });
    let text = "";
    const reader = r.textStream.getReader();
    for (let c = await reader.read(); !c.done; c = await reader.read()) text += c.value;
    expect(text).toBe("Echo: one two three");
    const done = await r.done;
    expect(done.text).toBe("Echo: one two three");
    expect(done.finishReason).toBe("stop");
    const b = s.requests[0].body as ChatBody;
    expect(s.requests[0].path).toBe(`${prefix}/chat/completions`);
    expect(b.stream).toBe(true);
  });

  it("streams through a Response a route can return", async () => {
    const r = await completeStream({ messages: [{ role: "user", content: "pass it on" }], maxRetries: 0 });
    const res = r.toResponse();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Echo: pass it on");
  });

  it("a stream that fails before any text throws a plain error instead of returning a broken stream", async () => {
    s.set({ failWith: 500 });
    const e = await caught(completeStream({ messages: [{ role: "user", content: "x" }], maxRetries: 0 }));
    expect(e.status).toBe(502);
    expect(e.message).toMatch(/answered HTTP 500/);
  });

  const Verdict = z.object({ weakest: z.string(), score: z.number().int().min(0).max(10) });

  it("returns a JSON object validated by the schema, through the structured path", async () => {
    s.set({ reply: () => JSON.stringify({ weakest: "who buys it", score: 3 }) });
    const r = await completeJson({ schema: Verdict, messages: [{ role: "user", content: "rate it" }], maxRetries: 0 });
    expect(r.path).toBe("structured");
    expect(r.object).toEqual({ weakest: "who buys it", score: 3 });
    const b = s.requests[0].body as ChatBody;
    expect(b.response_format?.type).toBe("json_schema");
  });

  it("falls back to asking for JSON when the structured answer does not fit, and says so", async () => {
    s.set({ reply: () => 'Here it is:\n```json\n{"weakest": "price", "score": 6}\n```' });
    const r = await completeJson({ schema: Verdict, messages: [{ role: "user", content: "rate it" }], maxRetries: 0 });
    expect(r.path).toBe("prompted");
    expect(r.fallbackReason).toMatch(/did not fit/);
    expect(r.object).toEqual({ weakest: "price", score: 6 });
    expect(s.requests).toHaveLength(2);
    const second = s.requests[1].body as ChatBody;
    expect(second.response_format).toBeUndefined();
    expect(second.messages[0].role).toBe("system");
    expect(second.messages[0].content).toMatch(/JSON Schema/);
  });

  it("fails plainly when the model returns invalid JSON on both paths", async () => {
    s.set({ reply: () => "I would rather not." });
    const e = await caught(completeJson({ schema: Verdict, messages: [{ role: "user", content: "rate it" }], maxRetries: 0 }));
    expect(e.status).toBe(502);
    expect(e.kind).toBe("invalid-json");
    expect(e.message).toMatch(/not valid JSON/);
    expect(s.requests).toHaveLength(2);
  });

  it("fails plainly when the JSON is valid but has the wrong shape (prompted mode)", async () => {
    s.set({ reply: () => JSON.stringify({ weakest: "x", score: 42 }) });
    const e = await caught(completeJson({ schema: Verdict, mode: "prompted", messages: [{ role: "user", content: "rate it" }], maxRetries: 0 }));
    expect(e.kind).toBe("invalid-json");
    expect(e.message).toMatch(/score/);
    expect(s.requests).toHaveLength(1);
  });

  it("embeds, with every vector the configured width", async () => {
    const r = await embed(["alpha", "beta"], { maxRetries: 0 });
    expect(r.vectors).toEqual([embeddingFor("alpha", 8), embeddingFor("beta", 8)]);
    expect(r.info.dims).toBe(8);
    expect(s.requests[0].path).toBe(`${prefix}/embeddings`);
    const b = s.requests[0].body as { model: string; input: string[]; dimensions?: number };
    expect(b.model).toBe(`${provider}-embed`);
    expect(b.input).toEqual(["alpha", "beta"]);
    expect(b.dimensions).toBeUndefined();
    if (key) expect(s.requests[0].headers.authorization).toBe(`Bearer ${key}`);
    else expect(s.requests[0].headers.authorization).toBeUndefined();
  });

  it("fails plainly, naming both widths, when the model's vectors are not the configured width", async () => {
    await chooseEmbedding({ provider, baseUrl: `${s.url}${prefix}`, model: `${provider}-embed`, dims: 16 });
    const e = await caught(embed(["alpha"], { maxRetries: 0 }));
    expect(e.kind).toBe("width");
    expect(e.message).toContain("8 wide");
    expect(e.message).toContain("width is 16");
  });

  it("answers 401 as a plain sentence without the key", async () => {
    const wrong = "sk-wrong-key-abcdef0123456789";
    await saveKey(provider, wrong);
    s.set({ apiKey: "the-right-key" });
    try {
      const e = await caught(complete({ messages: [{ role: "user", content: "x" }], maxRetries: 0 }));
      expect(e.status).toBe(502);
      expect(e.providerStatus).toBe(401);
      expect(e.message).toMatch(/answered HTTP 401/);
      expect(e.message).toMatch(/Admin, Credentials/);
      expect(e.message).not.toContain(wrong);
      expect(e.message).not.toContain("the-right-key");
    } finally {
      s.set({ apiKey: key });
    }
  });

  it("answers a provider 500 as a plain sentence", async () => {
    s.set({ failWith: 500 });
    const e = await caught(complete({ messages: [{ role: "user", content: "x" }], maxRetries: 0 }));
    expect(e.status).toBe(502);
    expect(e.providerStatus).toBe(500);
    expect(e.message).toBe(`${{ ollama: "Ollama", lmstudio: "LM Studio", openrouter: "OpenRouter" }[provider]} answered HTTP 500: stand-in forced failure 500.`);
  });

  it("stops at the time limit", async () => {
    s.set({ delayMs: 3000 });
    const t0 = Date.now();
    const e = await caught(complete({ messages: [{ role: "user", content: "x" }], timeoutMs: 250, maxRetries: 0 }));
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(e.status).toBe(504);
    expect(e.kind).toBe("timeout");
    expect(e.message).toContain("did not answer within 250 ms");
    const e2 = await caught(embed(["x"], { timeoutMs: 250, maxRetries: 0 }));
    expect(e2.status).toBe(504);
  });

  it("reports connection refused with the localhost hint", async () => {
    const port = await closedPort();
    for (const host of ["127.0.0.1", "localhost"]) {
      await chooseReasoning({ provider, baseUrl: `http://${host}:${port}${prefix}`, model });
      await saveKey(provider, key); // a saved key is only sent to the host it is bound to (secretOrigin.ts)
      const e = await caught(complete({ messages: [{ role: "user", content: "x" }], maxRetries: 0 }));
      expect(e.kind).toBe("unreachable");
      expect(e.message).toContain(`Could not reach`);
      expect(e.message).toContain(`at http://${host}:${port}${prefix}: is it running, and is that the right address?`);
      expect(e.message).toContain("host.docker.internal");
    }
  });
});

describe("not configured", () => {
  beforeEach(clearModelRows);

  it("says no reasoning or embedding model is chosen", async () => {
    expect(await getReasoning()).toEqual({ ok: false, missing: "model", reason: "No reasoning model is chosen. Choose one in Admin, Models." });
    expect(await getEmbedding()).toEqual({ ok: false, missing: "model", reason: "No embedding model is chosen. Choose one in Admin, Models." });
    const e = await caught(complete({ messages: [{ role: "user", content: "x" }] }));
    expect(e.status).toBe(503);
    expect(e.message).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
    expect((await caught(embed(["x"]))).status).toBe(503);
  });

  it("says OpenRouter needs a key when none is saved, and is ready once one is", async () => {
    await chooseReasoning({ provider: "openrouter", baseUrl: "", model: "some/model" });
    expect(await getReasoning()).toEqual({ ok: false, missing: "key", reason: "OpenRouter needs a key. Add it in Admin, Credentials." });
    await saveKey("openrouter", "sk-or-abc12345678");
    const r = await getReasoning();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.info).toEqual({ provider: "openrouter", model: "some/model", baseUrl: "https://openrouter.ai/api/v1" });
  });

  it("does not need a key for Ollama or LM Studio", async () => {
    for (const provider of ["ollama", "lmstudio"] as const) {
      await chooseReasoning({ provider, baseUrl: "", model: "m" });
      const r = await getReasoning();
      expect(r.ok && r.hasKey).toBe(false);
      expect(r.ok).toBe(true);
    }
  });

  it("asks for the width when the embedding model has none, and rejects a malformed setting", async () => {
    await chooseEmbedding({ provider: "ollama", baseUrl: "", model: "nomic-embed-text" });
    expect(await getEmbedding()).toMatchObject({ ok: false, missing: "dims" });
    await chooseReasoning({ provider: "ollama", baseUrl: "", model: "" });
    expect(await getReasoning()).toMatchObject({ ok: false, missing: "setting" });
    await chooseReasoning({ provider: "ollama", baseUrl: "ftp://x", model: "m" });
    expect(await getReasoning()).toMatchObject({ ok: false, missing: "setting" });
  });
});

describe("pure helpers", () => {
  const ctx = (baseUrl: string, key: string | null = null) => ({
    info: { provider: "openrouter" as const, model: "m", baseUrl },
    key,
    timeoutMs: 1000,
    timedOut: () => false,
    cancelled: () => false,
  });

  it("removes keys from provider messages", () => {
    const key = "sk-or-v1-supersecretvalue";
    const e = new APICallError({
      message: "x",
      url: "https://openrouter.ai/api/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 401,
      responseBody: JSON.stringify({ error: { message: `Key ${key} is not valid (Bearer ${key})` } }),
    });
    const out = explain(e, ctx("https://openrouter.ai/api/v1", key));
    expect(out.message).not.toContain(key);
    expect(out.message).toContain("HTTP 401");
    expect(scrub("token sk-abcdefghijkl and Bearer xyz")).toBe("token [key] and Bearer [key]");
  });

  it("gives the localhost hint only for local addresses", () => {
    const refused = (url: string) => new APICallError({ message: "Cannot connect to API: connect ECONNREFUSED", url, requestBodyValues: {}, isRetryable: true });
    expect(explain(refused("http://10.1.2.3:11434/v1/chat"), ctx("http://10.1.2.3:11434/v1")).message).not.toContain("host.docker.internal");
    expect(explain(refused("http://localhost:11434/v1/chat"), ctx("http://localhost:11434/v1")).message).toContain("host.docker.internal");
  });

  it("finds JSON in an answer", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Sure.\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Answer: {"a":3} done')).toEqual({ a: 3 });
    expect(() => extractJson("no json")).toThrow();
  });

  it("checks widths", () => {
    expect(() => checkWidths([[1, 2, 3]], { dims: 3, model: "m" })).not.toThrow();
    expect(() => checkWidths([[1, 2]], { dims: 3, model: "m" })).toThrow(/2 wide, but Admin says its width is 3/);
  });
});


describe("retries", () => {
  it("retries a 5xx once by default, then reports it", async () => {
    const s = await start({ prefix: "/v1", failWith: 503 });
    try {
      await clearModelRows();
      await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "m" });
      const e = await caught(complete({ messages: [{ role: "user", content: "x" }] }));
      expect(e.providerStatus).toBe(503);
      expect(s.requests).toHaveLength(2);
      s.requests.length = 0;
      s.set({ failWith: 401 });
      await caught(complete({ messages: [{ role: "user", content: "x" }] }));
      expect(s.requests).toHaveLength(1); // a refused key is not retried
    } finally {
      await s.close();
    }
  });
});
