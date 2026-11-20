// "Test connection" for Admin. Each test makes ONE cheap read-only call with a time limit and answers
// { ok, message, detail? }. A failed test is a normal answer, not an error. Secrets never appear in the answer:
// any text that comes back from outside is cleaned of the key that was sent before it is shown.
import { pool, ready } from "@/lib/db";
import { getCredential } from "@/lib/settings";
import { audit } from "./audit";
import { plannerUrl } from "./planner";
import { getPrinterRow, requireFamily, resolveAccess, valuesOf } from "./printers";
import type { ConnectionTest } from "./schemas";

export type TestResult = { ok: boolean; message: string; detail?: Record<string, unknown> };

const DEFAULT_LIMIT_MS = 10_000;
let limitMs = DEFAULT_LIMIT_MS;

/** Changes the time limit of every connection test. For tests; the app always uses 10 seconds. */
export function setConnectionTestLimit(ms: number | null) {
  limitMs = ms ?? DEFAULT_LIMIT_MS;
}

const seconds = () => (limitMs >= 1000 ? `${Math.round(limitMs / 1000)} seconds` : `${limitMs} ms`);

/** Replaces every secret in a text with [hidden]. */
export function scrub(text: string, secrets: (string | null | undefined)[]): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 4) out = out.split(s).join("[hidden]");
  }
  return out;
}

function networkFailure(e: unknown, secrets: (string | null | undefined)[]): TestResult {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return { ok: false, message: `No answer within ${seconds()}.` };
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

async function httpFailure(res: Response, who: string, secrets: (string | null | undefined)[], notFoundHint = "Check the address."): Promise<TestResult> {
  const says = await upstreamSays(res, secrets);
  const detail = { status: res.status, ...(says ? { says } : {}) };
  if (res.status === 401 || res.status === 403) return { ok: false, message: `${who} refused the key (HTTP ${res.status}). Check the key.`, detail };
  if (res.status === 404) return { ok: false, message: `${who} has nothing at that path (HTTP 404). ${notFoundHint}`, detail };
  if (res.status >= 500) return { ok: false, message: `${who} answered with a server error (HTTP ${res.status}).`, detail };
  return { ok: false, message: `${who} answered HTTP ${res.status}.`, detail };
}

type Call = { res: Response } | { fail: TestResult };

async function call(url: string, init: RequestInit, secrets: (string | null | undefined)[]): Promise<Call> {
  try {
    return { res: await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(limitMs) }) };
  } catch (e) {
    return { fail: networkFailure(e, secrets) };
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

const MODEL_PATH_HINT = "Check the address: Ollama and LM Studio usually end in /v1, OpenRouter in /api/v1.";

async function modelKey(provider: "ollama" | "lmstudio" | "openrouter", given?: string) {
  const g = given?.trim();
  return g ? g : await getCredential(provider, "apiKey");
}

async function testModel(t: Extract<ConnectionTest, { kind: "model" }>): Promise<TestResult> {
  const key = await modelKey(t.provider, t.apiKey);
  const c = await call(`${t.baseUrl}/models`, { headers: key ? { authorization: `Bearer ${key}` } : {} }, [key]);
  if ("fail" in c) return c.fail;
  if (c.res.status !== 200) return httpFailure(c.res, "The model host", [key], MODEL_PATH_HINT);
  const j = (await readJson(c.res)) as { data?: { id?: unknown }[] } | undefined;
  if (!j || !Array.isArray(j.data)) return { ok: false, message: "It answered, but not with a list of models. Check the address." };
  const ids = j.data.map((m) => m?.id).filter((x): x is string => typeof x === "string");
  const shown = ids.slice(0, 20);
  if (t.model && !ids.includes(t.model)) {
    return { ok: false, message: "Reachable, but that model is not in its list.", detail: { models: shown, total: ids.length } };
  }
  return {
    ok: true,
    message: t.model ? `Reachable, and ${t.model} is in its list.` : `Reachable. It lists ${ids.length} model${ids.length === 1 ? "" : "s"}.`,
    detail: { models: shown, total: ids.length },
  };
}

async function testEmbedding(t: Extract<ConnectionTest, { kind: "embedding" }>): Promise<TestResult> {
  const key = await modelKey(t.provider, t.apiKey);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const c = await call(`${t.baseUrl}/embeddings`, { method: "POST", headers, body: JSON.stringify({ model: t.model, input: "hello" }) }, [key]);
  if ("fail" in c) return c.fail;
  if (c.res.status !== 200) return httpFailure(c.res, "The model host", [key], MODEL_PATH_HINT);
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

async function testPerplexity(t: Extract<ConnectionTest, { kind: "perplexity" }>): Promise<TestResult> {
  const given = t.apiKey?.trim();
  const key = given ? given : await getCredential("perplexity", "apiKey");
  if (!key) return { ok: false, message: "No key is saved." };
  return { ok: false, message: "A connection test for Perplexity is not built yet." };
}

async function testPrinter(t: Extract<ConnectionTest, { kind: "printer" }>): Promise<{ result: TestResult; family: string }> {
  let familyId: string;
  let values: Record<string, string>;
  if (t.id !== undefined) {
    const row = await getPrinterRow(t.id);
    familyId = t.family ?? row.family;
    const fam = requireFamily(familyId);
    values = resolveAccess(fam, t.access, valuesOf(row)).values;
  } else {
    familyId = t.family!;
    values = resolveAccess(requireFamily(familyId), t.access).values;
  }
  const fam = requireFamily(familyId);
  if (fam.id === "file-only") return { family: fam.id, result: { ok: true, message: "File-only printers need no connection: you download the file and print it yourself." } };
  if (fam.status !== "supported") return { family: fam.id, result: { ok: false, message: `A connection test for ${fam.label} is not built yet.` } };

  const address = values.address;
  const key = values.apiKey ?? null;
  const headers: Record<string, string> = key ? { "x-api-key": key } : {};
  if (fam.id === "octoprint") {
    const c = await call(`${address}/api/version`, { headers }, [key]);
    if ("fail" in c) return { family: fam.id, result: c.fail };
    if (c.res.status !== 200) return { family: fam.id, result: await httpFailure(c.res, "OctoPrint", [key]) };
    const j = (await readJson(c.res)) as { server?: string; text?: string; api?: string } | undefined;
    return { family: fam.id, result: { ok: true, message: `OctoPrint answered: ${j?.text ?? `server ${j?.server ?? "unknown"}`}.`, detail: { server: j?.server ?? null, api: j?.api ?? null } } };
  }
  // moonraker
  const c = await call(`${address}/printer/info`, { headers }, [key]);
  if ("fail" in c) return { family: fam.id, result: c.fail };
  if (c.res.status !== 200) return { family: fam.id, result: await httpFailure(c.res, "Moonraker", [key]) };
  const j = (await readJson(c.res)) as { result?: { state?: string; software_version?: string; hostname?: string } } | undefined;
  const state = j?.result?.state ?? "unknown";
  return {
    family: fam.id,
    result: { ok: true, message: `Moonraker answered; Klipper is ${state}.`, detail: { state, softwareVersion: j?.result?.software_version ?? null, hostname: j?.result?.hostname ?? null } },
  };
}

async function testPlanner(t: Extract<ConnectionTest, { kind: "planner" }>): Promise<TestResult> {
  const url = t.url ?? (await plannerUrl());
  if (!url) return { ok: false, message: "No planner address is saved and PLANNER_URL is not set." };
  const c = await call(`${url}/health`, {}, []);
  if ("fail" in c) return c.fail;
  if (c.res.status !== 200) return httpFailure(c.res, "The planner", []);
  const j = (await readJson(c.res)) as { ok?: boolean; networkx?: string } | undefined;
  if (!j?.ok) return { ok: false, message: "Something answered, but not the planner. Check the address." };
  return { ok: true, message: `The planner answered (NetworkX ${j.networkx ?? "unknown"}).`, detail: { url, networkx: j.networkx ?? null } };
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
export async function runConnectionTest(t: ConnectionTest): Promise<TestResult> {
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
    case "database":
      result = await testDatabase();
      provider = "database";
      break;
  }
  await audit([{ action: "tested", provider, field, result: { ok: result.ok, message: result.message } }]);
  return result;
}
