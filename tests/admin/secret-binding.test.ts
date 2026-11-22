// Robustness review S1: a saved secret is only ever sent to the host it was saved for.
// The reviewer's repro: POST /api/admin/test {"kind":"model","provider":"openrouter","baseUrl":"http://127.0.0.1:4455/x"}
// made a listener on 4455 receive "authorization: Bearer <the full saved key>". Each case below starts a
// recording listener on another port (another origin) and checks what reaches it.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as runTest } from "@/app/api/admin/test/route";
import { PUT as putCredentials } from "@/app/api/admin/credentials/[provider]/route";
import { GET as getCredentials } from "@/app/api/admin/credentials/route";
import { PUT as putSettings } from "@/app/api/admin/settings/route";
import { POST as addPrinter } from "@/app/api/admin/printers/route";
import { PATCH as patchPrinter } from "@/app/api/admin/printers/[id]/route";
import { getReasoning } from "@/lib/ai/models";
import { ask } from "@/lib/research/perplexity";
import { igCredentials } from "@/lib/channels/instagram";
import { setConnectionTestLimit } from "@/lib/admin/connection";
import { json as reply, startStandIn, type StandIn } from "../standins/core";
import * as openai from "../standins/openai";
import * as octoprint from "../standins/octoprint";
import { asAdministrator, json, read } from "../api/helpers";

// This file changes Admin settings or keys, which the public demo account (default password) may not.
asAdministrator();
import { clearAdmin, restore, snapshot } from "./fixture";

type Result = { ok: boolean; message: string; detail?: Record<string, unknown>; error?: string; issues?: { field: string; problem: string }[] };

const KEY = "sk-or-v1-the-full-saved-key-0123456789";
let snap: Awaited<ReturnType<typeof snapshot>>;
const running: StandIn<unknown>[] = [];
const envBefore = { pplx: process.env.PERPLEXITY_BASE_URL, ig: process.env.INSTAGRAM_GRAPH_BASE_URL };

/** A listener that records every request and answers 200 with an empty model list. */
async function listener() {
  const s = await startStandIn<object>({}, () => reply(200, { data: [] }));
  running.push(s as unknown as StandIn<unknown>);
  return s;
}
const sawKey = (s: StandIn<unknown>, key = KEY) => s.requests.some((r) => JSON.stringify(r.headers).includes(key) || r.rawBody.toString().includes(key));

const test = async (b: unknown) => read<Result>(await runTest(json("POST", b)));
const saveKey = (provider: string, fields: Record<string, string>, address?: string) =>
  putCredentials(json("PUT", { fields, ...(address ? { address } : {}) }), { params: Promise.resolve({ provider }) });

beforeAll(async () => {
  snap = await snapshot();
});
beforeEach(clearAdmin);
afterEach(async () => {
  setConnectionTestLimit(null);
  process.env.PERPLEXITY_BASE_URL = envBefore.pplx;
  if (envBefore.pplx === undefined) delete process.env.PERPLEXITY_BASE_URL;
  process.env.INSTAGRAM_GRAPH_BASE_URL = envBefore.ig;
  if (envBefore.ig === undefined) delete process.env.INSTAGRAM_GRAPH_BASE_URL;
  await Promise.all(running.splice(0).map((s) => s.close()));
});
afterAll(async () => {
  await restore(snap);
  await pool().end();
});

describe("model keys", () => {
  it("the reviewer's repro: a test at another host never receives the saved key", async () => {
    const good = await openai.start({ prefix: "/api/v1", apiKey: KEY });
    running.push(good as unknown as StandIn<unknown>);
    await saveKey("openrouter", { apiKey: KEY }, `${good.url}/api/v1`);
    const ok = await test({ kind: "model", provider: "openrouter", baseUrl: `${good.url}/api/v1` });
    expect(ok.body.ok).toBe(true);

    const evil = await listener();
    const r = await test({ kind: "model", provider: "openrouter", baseUrl: `${evil.url}/x` });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/only sent to http:\/\/127\.0\.0\.1:\d+/);
    expect(sawKey(evil)).toBe(false);
    expect(evil.requests).toHaveLength(0);

    const emb = await test({ kind: "embedding", provider: "openrouter", baseUrl: `${evil.url}/x`, model: "m", dims: 3 });
    expect(emb.body.ok).toBe(false);
    expect(evil.requests).toHaveLength(0);
  });

  it("a key typed in the test request is used once for that host and not saved", async () => {
    const evil = await listener();
    await saveKey("openrouter", { apiKey: KEY });
    const typed = "sk-typed-only-for-this-test-999999";
    await test({ kind: "model", provider: "openrouter", baseUrl: `${evil.url}/x`, apiKey: typed });
    expect(sawKey(evil, typed)).toBe(true);
    expect(sawKey(evil)).toBe(false);
    const saved = await q<{ value: string }>("SELECT value FROM credentials WHERE provider='openrouter'");
    expect(saved.map((r) => r.value)).toEqual([KEY]);
  });

  it("moving the model address to another host removes the key, says why, and the model layer sends no key there", async () => {
    const good = await listener();
    await putSettings(json("PUT", { reasoningModel: { provider: "openrouter", baseUrl: `${good.url}/api/v1`, model: "m" } }));
    await saveKey("openrouter", { apiKey: KEY });
    const bound = await q<{ bound_origin: string }>("SELECT bound_origin FROM credentials WHERE provider='openrouter'");
    expect(bound[0].bound_origin).toBe(good.url);

    const evil = await listener();
    const r = await read<{ notices: string[] }>(await putSettings(json("PUT", { reasoningModel: { provider: "openrouter", baseUrl: `${evil.url}/x`, model: "m" } })));
    expect(r.status).toBe(200);
    expect(r.body.notices.join(" ")).toMatch(/key was removed: it was saved for http:\/\/127\.0\.0\.1:\d+/);
    expect(await q("SELECT 1 FROM credentials WHERE provider='openrouter'")).toHaveLength(0);
    const m = await getReasoning();
    expect(m.ok).toBe(false);
  });

  it("keeps the key for the host the other model still uses, and does not send it to the new one", async () => {
    const good = await listener();
    const choice = { provider: "openrouter", baseUrl: `${good.url}/api/v1`, model: "m" };
    await putSettings(json("PUT", { reasoningModel: choice, embeddingModel: { ...choice, dims: 3 } }));
    await saveKey("openrouter", { apiKey: KEY });
    const evil = await listener();
    const r = await read<{ notices: string[] }>(await putSettings(json("PUT", { reasoningModel: { ...choice, baseUrl: `${evil.url}/x` } })));
    expect(r.body.notices.join(" ")).toMatch(/stays with/);
    const m = await getReasoning();
    expect(m.ok).toBe(false);
    if (!m.ok) expect(m.reason).toMatch(/not sent/);
  });

  it("a key saved before the binding existed is bound to the address in use on its first read", async () => {
    const good = await listener();
    await putSettings(json("PUT", { reasoningModel: { provider: "lmstudio", baseUrl: `${good.url}/v1`, model: "m" } }));
    await q("INSERT INTO credentials (provider, field, value) VALUES ('lmstudio','apiKey',$1)", [KEY]);
    const view = await read<{ providers: { id: string; fields: { boundTo?: string | null }[] }[] }>(await getCredentials(json("GET")));
    expect(view.body.providers.find((p) => p.id === "lmstudio")!.fields[0].boundTo).toBe(good.url);
    expect(JSON.stringify(view.body)).not.toContain(KEY);
  });

  it("refuses an address on a provider that is not a model host", async () => {
    const r = await read<Result>(await saveKey("perplexity", { apiKey: KEY }, "http://127.0.0.1:1/x"));
    expect(r.status).toBe(400);
  });
});

describe("Perplexity and channels", () => {
  it("the Perplexity key does not follow PERPLEXITY_BASE_URL to another host", async () => {
    const good = await listener();
    process.env.PERPLEXITY_BASE_URL = good.url;
    await saveKey("perplexity", { apiKey: KEY });
    const evil = await listener();
    process.env.PERPLEXITY_BASE_URL = evil.url;
    const r = await test({ kind: "perplexity" });
    expect(r.body.ok).toBe(false);
    expect(r.body.message).toMatch(/not sent/);
    const a = await ask({ question: "q" });
    expect(a.ok).toBe(false);
    expect(evil.requests).toHaveLength(0);
  });

  it("a channel token is not read for another API host", async () => {
    const good = await listener();
    process.env.INSTAGRAM_GRAPH_BASE_URL = good.url;
    await saveKey("instagram", { accessToken: KEY, accountId: "1784" });
    expect(await igCredentials()).toMatchObject({ token: KEY });
    process.env.INSTAGRAM_GRAPH_BASE_URL = "http://127.0.0.1:9";
    expect(await igCredentials()).toBeNull();
  });
});

describe("printers", () => {
  it("changing the address to another host needs the secret typed again, and a test at a new address leaves it behind", async () => {
    const op = await octoprint.start({ apiKey: KEY });
    running.push(op as unknown as StandIn<unknown>);
    const added = await read<{ printer: { id: number } }>(await addPrinter(json("POST", { name: "zz-bind", family: "octoprint", access: { address: op.url, apiKey: KEY } })));
    expect(added.status).toBe(201);
    const id = added.body.printer.id;
    const evil = await listener();

    const t = await test({ kind: "printer", id, access: { address: evil.url } });
    expect(t.status).toBe(400);
    expect(sawKey(evil)).toBe(false);
    expect(evil.requests).toHaveLength(0);

    const p = await read<Result>(await patchPrinter(json("PATCH", { access: { address: evil.url } }), { params: Promise.resolve({ id: String(id) }) }));
    expect(p.status).toBe(400);
    expect(p.body.issues?.[0]).toMatchObject({ field: "access.apiKey" });
    expect(p.body.issues?.[0].problem).toMatch(/type it again/);

    const same = await read<Result>(await patchPrinter(json("PATCH", { access: { address: `${op.url}/` } }), { params: Promise.resolve({ id: String(id) }) }));
    expect(same.status).toBe(200);

    const retyped = await read<Result>(await patchPrinter(json("PATCH", { access: { address: evil.url, apiKey: "new-key-for-new-host" } }), { params: Promise.resolve({ id: String(id) }) }));
    expect(retyped.status).toBe(200);
    await q("DELETE FROM printers WHERE id=$1", [id]);
  });
});
