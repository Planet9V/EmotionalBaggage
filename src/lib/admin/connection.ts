// "Test connection" for Admin. Each test makes ONE cheap call with a time limit and answers
// { ok, message, detail? }. Every call is read-only except Perplexity's, which has no free call (see testPerplexity). A failed test is a normal answer, not an error. Secrets never appear in the answer:
// any text that comes back from outside is cleaned of the key that was sent before it is shown.
import { pool, ready } from "@/lib/db";
import { boundElsewhere, originOf, secretFor } from "@/lib/secretOrigin";
import { DEFAULT_BASE_URL } from "@/lib/settings";
import { AGENT_PATH, baseUrl as perplexityBase, DEFAULT_EFFORT, readResponse } from "@/lib/research/perplexity";
import { audit } from "./audit";
import { plannerUrl } from "./planner";
import { slicerUrl } from "@/lib/slicing/config";
import { getPrinterRow, requireFamily, resolveAccess, valuesOf } from "./printers";
import { createAdapter } from "@/lib/printers/factory";
import type { ConnectionTest } from "./schemas";
import { testChannel } from "@/lib/channels/connection";
import { blockedIn, blockedSentence, safeFetch } from "@/lib/net/outbound";
import { scrub } from "@/lib/secrets/scrub";
import { testMailMessage, testSmtp, testStripe, testVoice } from "./serviceTests";
import { recordCheck, serviceOfTest } from "./checks";

export type TestResult = { ok: boolean; message: string; detail?: Record<string, unknown> };

const DEFAULT_LIMIT_MS = 10_000;
let limitMs = DEFAULT_LIMIT_MS;

/** Changes the time limit of every connection test. For tests; the app always uses 10 seconds. */
export function setConnectionTestLimit(ms: number | null) {
  limitMs = ms ?? DEFAULT_LIMIT_MS;
}

const seconds = (ms = limitMs) => (ms >= 1000 ? `${Math.round(ms / 1000)} seconds` : `${ms} ms`);

function networkFailure(e: unknown, secrets: (string | null | undefined)[], ms = limitMs): TestResult {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { ok: false, message: `No answer within ${seconds(ms)}.` };
  const refused = blockedIn(e);
  if (refused) return { ok: false, message: blockedSentence(refused) };
  const code = err?.cause?.code;
  if (code === "ECONNREFUSED") return { ok: false, message: "Nothing answered at that address (connection refused). Check the address and that the service is running." };
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return { ok: false, message: "That host name could not be found. Check the address." };
  if (code === "ECONNRESET") return { ok: false, message: "The connection was dropped before an answer came back." };
  const why = scrub(err?.cause?.message ?? err?.message ?? String(e), secrets).slice(0, 300);
  return { ok: false, message: `Could not reach it: ${why}` };
}

async function upstreamSays(res: Response, secrets: (string | null | undefined)[]): Promise<string | undefined> {
  try {
    const text = await res.text();
    let said = text;
    try {
      const j = JSON.parse(text) as { error?: unknown; message?: unknown };
      const e = j.error as { message?: unknown } | string | undefined;
      said = typeof e === "string" ? e : typeof e?.message === "string" ? e.message : typeof j.message === "string" ? j.message : text;
    } catch {
      // not JSON: keep the text
    }
    const clean = scrub(said, secrets).trim().slice(0, 300);
    return clean || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The answer for a non-success status. `echo` false (model, embedding and planner tests, whose address any
 * signed-in user can type) gives only the status and our own sentence: the remote body is never shown, so the
 * test cannot be used to read an internal service (robustness review S3).
 */
export async function httpFailure(res: Response, who: string, secrets: (string | null | undefined)[], notFoundHint = "Check the address.", echo = true): Promise<TestResult> {
  const says = echo ? await upstreamSays(res, secrets) : (await res.body?.cancel().catch(() => undefined), undefined);
  const detail = { status: res.status, ...(says ? { says } : {}) };
  if (res.status === 401 || res.status === 403) return { ok: false, message: `${who} refused the key (HTTP ${res.status}). Check the key.`, detail };
  if (res.status === 404) return { ok: false, message: `${who} has nothing at that path (HTTP 404). ${notFoundHint}`, detail };
  if (res.status >= 500) return { ok: false, message: `${who} answered with a server error (HTTP ${res.status}).`, detail };
  return { ok: false, message: `${who} answered HTTP ${res.status}.`, detail };
}

type Call = { res: Response } | { fail: TestResult };

export async function call(url: string, init: RequestInit, secrets: (string | null | undefined)[], ms = limitMs): Promise<Call> {
  try {
    return { res: await safeFetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(ms) }) };
  } catch (e) {
    return { fail: networkFailure(e, secrets, ms) };
  }
}

export async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

const MODEL_PATH_HINT = "Check the address: Ollama and LM Studio usually end in /v1, OpenRouter in /api/v1.";

const MODEL_LABEL = { ollama: "Ollama", lmstudio: "LM Studio", openrouter: "OpenRouter" } as const;

/**
 * The key for a model test: the one typed in the request (used once, never saved), else the saved key,
 * but only when the address is on the host the saved key was saved for (src/lib/secretOrigin.ts).
 * When the saved key belongs to another host it is not read at all: `refusal` says why, and the test
 * goes no further for a provider that needs a key.
 */
async function modelKey(provider: "ollama" | "lmstudio" | "openrouter", baseUrl: string, given?: string): Promise<{ key: string | null; refusal?: TestResult }> {
  const g = given?.trim();
  if (g) return { key: g };
  const s = await secretFor(provider, "apiKey", baseUrl);
  if (s.refused) {
    const message = boundElsewhere(MODEL_LABEL[provider], s.boundTo, baseUrl);
    return { key: null, refusal: { ok: false, message, detail: { keyBoundTo: s.boundTo } } };
  }
  return { key: s.value?.trim() || null };
}

/** OpenRouter's own public address: the one host whose error text is shown, because it is not an address a user chose to probe. */
const isOpenRouterItself = (baseUrl: string) => originOf(baseUrl) === originOf(DEFAULT_BASE_URL.openrouter);

/**
 * OpenRouter answers GET /models to anyone, key or no key, so a model list proves nothing about the key.
 * GET /key is its call for "is this key good" (openrouter.ai/docs/api/api-reference/api-keys/get-current-key,
 * read 21 November 2026). Answers a failure when the key is missing or refused, else null. A host that has no
 * /key (a proxy in front of OpenRouter) is not held against the key.
 */
async function openRouterKeyProblem(baseUrl: string, key: string | null): Promise<TestResult | null> {
  if (!key) return { ok: false, message: "OpenRouter needs a key, and none is saved for this address. Add it in Admin, Credentials." };
  const c = await call(`${baseUrl}/key`, { headers: { authorization: `Bearer ${key}` } }, [key]);
  if ("fail" in c) return null;
  if (c.res.status === 401 || c.res.status === 403) {
    const says = isOpenRouterItself(baseUrl) ? await upstreamSays(c.res, [key]) : (await c.res.body?.cancel().catch(() => undefined), undefined);
    const ending = key.length >= 12 ? ` The key sent ends in ${key.slice(-4)}.` : "";
    return {
      ok: false,
      message: `OpenRouter does not accept this key (HTTP ${c.res.status})${says ? `: ${says.replace(/[.\s]+$/, "")}` : ""}.${ending} Compare it with the key on openrouter.ai, Keys, and paste it again in Admin, Credentials.`,
      detail: { status: c.res.status, ...(says ? { says } : {}) },
    };
  }
  await c.res.body?.cancel().catch(() => undefined);
  return null;
}

/** The ids in an OpenAI-style model list at `url`, or null when the list could not be read. */
async function modelIds(url: string, key: string | null): Promise<string[] | null> {
  const c = await call(url, { headers: key ? { authorization: `Bearer ${key}` } : {} }, [key]);
  if ("fail" in c) return null;
  if (c.res.status !== 200) {
    await c.res.body?.cancel().catch(() => undefined);
    return null;
  }
  const j = (await readJson(c.res)) as { data?: { id?: unknown }[] } | undefined;
  if (!j || !Array.isArray(j.data)) return null;
  return j.data.map((m) => m?.id).filter((x): x is string => typeof x === "string");
}

async function testModel(t: Extract<ConnectionTest, { kind: "model" }>): Promise<TestResult> {
  const { key, refusal } = await modelKey(t.provider, t.baseUrl, t.apiKey);
  if (refusal) return refusal;
  if (t.provider === "openrouter") {
    const bad = await openRouterKeyProblem(t.baseUrl, key);
    if (bad) return bad;
  }
  const c = await call(`${t.baseUrl}/models`, { headers: key ? { authorization: `Bearer ${key}` } : {} }, [key]);
  if ("fail" in c) return c.fail;
  if (c.res.status !== 200) return httpFailure(c.res, "The model host", [key], MODEL_PATH_HINT, false);
  const j = (await readJson(c.res)) as { data?: { id?: unknown }[] } | undefined;
  if (!j || !Array.isArray(j.data)) return { ok: false, message: "It answered, but not with a list of models. Check the address." };
  const ids = j.data.map((m) => m?.id).filter((x): x is string => typeof x === "string");
  const shown = ids.slice(0, 20);
  if (t.model && !ids.includes(t.model)) {
    // OpenRouter keeps its embedding models in a list of their own (GET /embeddings/models), not in /models.
    if (t.provider === "openrouter" && (await modelIds(`${t.baseUrl}/embeddings/models`, key))?.includes(t.model)) {
      return { ok: false, message: `${t.model} is an embedding model on OpenRouter. Choose it under Embedding model, not here.`, detail: { models: shown, total: ids.length } };
    }
    return { ok: false, message: "Reachable, but that model is not in its list.", detail: { models: shown, total: ids.length } };
  }
  const keyNote = t.provider === "openrouter" ? " OpenRouter accepts the key." : "";
  return {
    ok: true,
    message: (t.model ? `Reachable, and ${t.model} is in its list.` : `Reachable. It lists ${ids.length} model${ids.length === 1 ? "" : "s"}.`) + keyNote,
    detail: { models: shown, total: ids.length },
  };
}

async function testEmbedding(t: Extract<ConnectionTest, { kind: "embedding" }>): Promise<TestResult> {
  const { key, refusal } = await modelKey(t.provider, t.baseUrl, t.apiKey);
  if (refusal) return refusal;
  if (t.provider === "openrouter") {
    const bad = await openRouterKeyProblem(t.baseUrl, key);
    if (bad) return bad;
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const c = await call(`${t.baseUrl}/embeddings`, { method: "POST", headers, body: JSON.stringify({ model: t.model, input: "hello" }) }, [key]);
  if ("fail" in c) return c.fail;
  if (c.res.status !== 200) {
    if (t.provider !== "openrouter") return httpFailure(c.res, "The model host", [key], MODEL_PATH_HINT, false);
    // The key was accepted a moment ago, so this is about the model or the account, and OpenRouter's own words say which.
    const failed = await httpFailure(c.res, "OpenRouter", [key], MODEL_PATH_HINT, isOpenRouterItself(t.baseUrl));
    const says = typeof failed.detail?.says === "string" ? ` OpenRouter says: ${failed.detail.says.replace(/[.\s]+$/, "")}.` : "";
    const listed = await modelIds(`${t.baseUrl}/embeddings/models`, key);
    const inList = listed ? (listed.includes(t.model) ? ` ${t.model} is in OpenRouter's list of embedding models.` : ` ${t.model} is not in OpenRouter's list of embedding models (${listed.length} listed): check the name.`) : "";
    const message = c.res.status === 401 || c.res.status === 403 ? `OpenRouter accepted the key but refused the embedding call (HTTP ${c.res.status}).${says}${inList} Check the key's limits and allowed providers on openrouter.ai.` : `${failed.message}${says}${inList}`;
    return { ok: false, message, detail: { ...failed.detail, ...(listed ? { embeddingModels: listed.slice(0, 20), total: listed.length } : {}) } };
  }
  const j = (await readJson(c.res)) as { data?: { embedding?: unknown }[] } | undefined;
  const vec = j?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || !vec.length || !vec.every((n) => typeof n === "number")) {
    return { ok: false, message: "It answered, but no vector came back. Check that the model is an embedding model." };
  }
  if (vec.length !== t.dims) {
    return { ok: false, message: `The model returned vectors ${vec.length} wide, but the width given is ${t.dims}. Set the width to ${vec.length}.`, detail: { width: vec.length } };
  }
  return { ok: true, message: `A vector came back, ${vec.length} wide, as expected.`, detail: { width: vec.length } };
}

/**
 * Perplexity documents no free read-only call (no model list, no key check; docs/research/perplexity-api.md),
 * so the test asks the smallest documented question: only `input` and `effort` (fast, the cheapest effort),
 * no instructions and no tools. Perplexity bills it like any question, and the message says so.
 * A real answer can take longer than the other tests' 10 seconds, so it gets 30 unless a test shortens the limit.
 */
export const PERPLEXITY_TEST_INPUT = "Reply with the single word: ok";
const PERPLEXITY_LIMIT_MS = 30_000;
const BILLED = "Perplexity bills each call, so this test was charged as one short question.";

async function testPerplexity(t: Extract<ConnectionTest, { kind: "perplexity" }>): Promise<TestResult> {
  const given = t.apiKey?.trim();
  const saved = given ? null : await secretFor("perplexity", "apiKey", perplexityBase());
  if (saved?.refused) return { ok: false, message: boundElsewhere("Perplexity", saved.boundTo, perplexityBase()) };
  const key = given ? given : saved?.value;
  if (!key) return { ok: false, message: "No key is saved." };
  const ms = limitMs === DEFAULT_LIMIT_MS ? PERPLEXITY_LIMIT_MS : limitMs;
  const c = await call(
    `${perplexityBase()}${AGENT_PATH}`,
    { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ effort: DEFAULT_EFFORT, input: PERPLEXITY_TEST_INPUT }) },
    [key],
    ms
  );
  if ("fail" in c) return c.fail;
  const res = c.res;
  if (res.status === 402) {
    const says = await upstreamSays(res, [key]);
    return { ok: false, message: "Perplexity accepted the key, but says the account has no credit left (HTTP 402). Add credit in the Perplexity console.", detail: { status: 402, ...(says ? { says } : {}) } };
  }
  if (res.status === 429) {
    const says = await upstreamSays(res, [key]);
    const wait = res.headers.get("retry-after");
    return {
      ok: false,
      message: `Perplexity is limiting how fast this account can ask (HTTP 429).${wait && /^\d+$/.test(wait) ? ` Try again in ${wait} seconds.` : " Try again shortly."}`,
      detail: { status: 429, ...(says ? { says } : {}) },
    };
  }
  if (res.status !== 200) return httpFailure(res, "Perplexity", [key], "Check PERPLEXITY_BASE_URL, which should be https://api.perplexity.ai or empty.");
  const body = await readJson(res);
  const r = body === undefined ? { malformed: "not JSON" } : readResponse(body);
  if ("malformed" in r) return { ok: false, message: "Something answered at that address, but not in the shape of Perplexity's Agent API. Check PERPLEXITY_BASE_URL." };
  const detail = { model: r.model ?? null, effort: r.effort ?? null, costUsd: r.costUsd ?? null };
  if (r.status && r.status !== "completed" && !(r.status === "incomplete" && r.answer)) {
    const said = r.error ? scrub(r.error, [key]).trim().slice(0, 300) : "";
    const why = said ? ` Perplexity said: ${said}${/[.!?]$/.test(said) ? "" : "."}` : "";
    return { ok: false, message: `Perplexity accepted the key, but the test question did not complete (status ${r.status}).${why} ${BILLED}`, detail };
  }
  const cost = typeof r.costUsd === "number" ? ` Perplexity estimated it at $${r.costUsd.toFixed(4)}.` : "";
  return { ok: true, message: `Perplexity accepted the key and answered${r.model ? ` with ${r.model}` : ""}. ${BILLED}${cost}`, detail };
}

async function testPrinter(t: Extract<ConnectionTest, { kind: "printer" }>): Promise<{ result: TestResult; family: string }> {
  let familyId: string;
  let values: Record<string, string>;
  if (t.id !== undefined) {
    const row = await getPrinterRow(t.id);
    familyId = t.family ?? row.family;
    const fam = requireFamily(familyId);
    values = resolveAccess(fam, t.access, valuesOf(row), "test").values; // saved secrets stay behind if the address moved
  } else {
    familyId = t.family!;
    values = resolveAccess(requireFamily(familyId), t.access).values;
  }
  const fam = requireFamily(familyId);
  if (fam.id === "file-only") return { family: fam.id, result: { ok: true, message: "File-only printers need no connection: you download the file and print it yourself." } };
  if (fam.status !== "supported") return { family: fam.id, result: { ok: false, message: `A connection test for ${fam.label} is not built yet.` } };

  // Every family's own adapter makes its one cheap, read-only call (src/lib/printers). The time limit is the one set above.
  const adapter = createAdapter(fam.id, values, { timeoutMs: limitMs });
  try {
    return { family: fam.id, result: await adapter.test() };
  } finally {
    await adapter.close().catch(() => undefined);
  }
}

async function testPlanner(t: Extract<ConnectionTest, { kind: "planner" }>): Promise<TestResult> {
  const url = t.url ?? (await plannerUrl());
  if (!url) return { ok: false, message: "No planner address is saved and PLANNER_URL is not set." };
  const c = await call(`${url}/health`, {}, []);
  if ("fail" in c) return c.fail;
  if (c.res.status !== 200) return httpFailure(c.res, "The planner", [], "Check the address.", false);
  const j = (await readJson(c.res)) as { ok?: boolean; networkx?: string } | undefined;
  if (!j?.ok) return { ok: false, message: "Something answered, but not the planner. Check the address." };
  return { ok: true, message: `The planner answered (NetworkX ${j.networkx ?? "unknown"}).`, detail: { url, networkx: j.networkx ?? null } };
}

async function testSlicer(t: Extract<ConnectionTest, { kind: "slicer" }>): Promise<TestResult> {
  const url = t.url ?? (await slicerUrl());
  if (!url) return { ok: false, message: "No slicer address is saved and SLICER_URL is not set." };
  const c = await call(`${url}/health`, {}, []);
  if ("fail" in c) return c.fail;
  // echo off, as for the planner: the address is typed by a user, so the remote body is never shown (review B4)
  if (c.res.status !== 200) return httpFailure(c.res, "The slicer", [], "Check the address.", false);
  const j = (await readJson(c.res)) as { ok?: boolean; slicerInstalled?: boolean; orcaVersion?: string } | undefined;
  if (!j?.ok || j.orcaVersion === undefined) return { ok: false, message: "Something answered, but not the slicer service. Check the address." };
  if (j.slicerInstalled === false) return { ok: false, message: `The slicer service answered, but OrcaSlicer ${j.orcaVersion} is not installed in it.`, detail: { url, orcaVersion: j.orcaVersion } };
  return { ok: true, message: `The slicer answered (OrcaSlicer ${j.orcaVersion}).`, detail: { url, orcaVersion: j.orcaVersion } };
}

async function testDatabase(): Promise<TestResult> {
  const dbPassword = (() => {
    try {
      return decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").password);
    } catch {
      return "";
    }
  })();
  try {
    const { vector } = await ready();
    const v = await pool().query<{ server_version: string }>("SHOW server_version");
    const ext = await pool().query<{ extversion: string }>("SELECT extversion FROM pg_extension WHERE extname='vector'");
    const version = v.rows[0].server_version;
    const vectorVersion = ext.rows[0]?.extversion ?? null;
    const active = vector && !!vectorVersion;
    return {
      ok: true,
      message: active ? `Connected to PostgreSQL ${version}; pgvector ${vectorVersion} is active.` : `Connected to PostgreSQL ${version}; pgvector is not active, so search falls back to text.`,
      detail: { connected: true, version, vector: active, vectorVersion },
    };
  } catch (e) {
    return { ok: false, message: `Could not reach the database: ${scrub((e as Error).message, [dbPassword]).slice(0, 300)}`, detail: { connected: false } };
  }
}

/** Runs one test and records it in the credentials audit (the result only, never a value). */
export async function runConnectionTest(t: ConnectionTest, opts: { record: boolean }): Promise<TestResult> {
  let result: TestResult;
  let provider: string;
  let field: string | null = null;
  switch (t.kind) {
    case "model":
      result = await testModel(t);
      provider = t.provider;
      field = "model";
      break;
    case "embedding":
      result = await testEmbedding(t);
      provider = t.provider;
      field = "embedding";
      break;
    case "perplexity":
      result = await testPerplexity(t);
      provider = "perplexity";
      field = "apiKey";
      break;
    case "printer": {
      const r = await testPrinter(t);
      result = r.result;
      provider = `printer:${r.family}`;
      field = t.id !== undefined ? String(t.id) : null;
      break;
    }
    case "planner":
      result = await testPlanner(t);
      provider = "planner";
      break;
    case "slicer":
      result = await testSlicer(t);
      provider = "slicer";
      break;
    case "database":
      result = await testDatabase();
      provider = "database";
      break;
    case "amazon-sp":
    case "x":
    case "instagram":
      result = await testChannel(t.kind);
      provider = t.kind;
      break;
    case "stripe":
      result = await testStripe(limitMs);
      provider = "stripe";
      break;
    case "smtp":
      result = await testSmtp(limitMs);
      provider = "smtp";
      break;
    case "mail-message":
      result = await testMailMessage(t.to, limitMs);
      provider = "smtp";
      field = "message";
      break;
    case "voice":
      result = await testVoice(limitMs === DEFAULT_LIMIT_MS ? 30_000 : limitMs);
      provider = "voice";
      break;
  }
  // Every test goes to the install-wide audit log. Only the platform administrator's tests are kept in the short list
  // and as the Overview's "last checked" (the sentence only; a voice test's audio is not kept), review B5.
  await audit([{ action: "tested", provider, field, result: { ok: result.ok, message: result.message } }], { shortList: opts.record });
  if (opts.record) await recordCheck(serviceOfTest(t), result);
  return result;
}
