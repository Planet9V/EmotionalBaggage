// The only place that talks to Perplexity.
//
// Built to the Agent API, POST /v1/agent, as documented on 20 Nov 2026. Every field read or sent
// here is listed with the page it came from in docs/research/perplexity-api.md. The Sonar interface
// (POST /v1/sonar) is not used: its support ended on 27 Sep 2026.
import { getCredential, getSetting } from "@/lib/settings";

/** Address of the Perplexity API; tests point it at the stand-in. */
export const DEFAULT_BASE_URL = "https://api.perplexity.ai";
export const AGENT_PATH = "/v1/agent";
/** Setting that holds the effort level (Perplexity's pre-configured model and search setup). */
export const MODEL_SETTING = "research.model";
/** `fast` is Perplexity's documented replacement for `sonar-pro`, which this app used before. */
export const DEFAULT_EFFORT = "fast";
export const TIMEOUT_MS = 60_000;

/**
 * The migration guide's instructions for numbered inline citations ("Inline citations" on
 * docs/agent-api/migrate-from-sonar/how-to), plus one sentence of ours.
 */
export const INSTRUCTIONS =
  "Base every factual statement on the numbered web search results provided. Before finalizing, verify each claim against the sources: re-read the cited results and confirm they actually support the statement; if a claim is not directly supported, drop it or soften it rather than guessing. After each sentence that uses information from those results, cite the exact source number(s) in square brackets right after the statement, like [1] or [1][2], with no space before the bracket. Cite the one to three sources that most directly support the statement, and only cite a source that actually contains that information. Do not cite a source you did not use, do not invent source numbers, and do not add a separate references section." +
  " Say plainly when sources disagree or when nothing reliable was found.";

export type Source = { url: string; title?: string; snippet?: string; date?: string; id?: number };

export type AskSuccess = {
  ok: true;
  answer: string;
  sources: Source[];
  /** the model Perplexity reports, for example openai/gpt-6-luna */
  model: string;
  /** the effort and version that ran, for example fast@2026-10-16.0, when reported */
  effort?: string;
  /** Perplexity's estimate of the cost in USD (usage.cost.total_cost), when reported */
  costUsd?: number;
  raw: unknown;
};

export type AskFailure = {
  ok: false;
  kind: "not_configured" | "http" | "rate_limited" | "timeout" | "network" | "malformed" | "failed" | "aborted";
  /** HTTP status of Perplexity's answer, when there was one */
  status?: number;
  /** a plain sentence for the user; never contains the key */
  message: string;
};

export type AskResult = AskSuccess | AskFailure;

export type AskOptions = {
  question: string;
  signal?: AbortSignal;
  /** defaults to the saved credential (Admin) or PERPLEXITY_API_KEY */
  apiKey?: string;
  /** defaults to the research.model setting, then DEFAULT_EFFORT */
  effort?: string;
  /** tests only: how long to wait */
  timeoutMs?: number;
};

const EFFORT_RE = /^[a-z][a-z0-9-]{0,39}(@[A-Za-z0-9._-]{1,60})?$/;

/** The effort level to use: the saved setting when it looks like an effort name, else the default. */
export async function currentEffort(): Promise<string> {
  const v = await getSetting<unknown>(MODEL_SETTING, DEFAULT_EFFORT);
  return typeof v === "string" && EFFORT_RE.test(v.trim()) ? v.trim() : DEFAULT_EFFORT;
}

export const baseUrl = () => (process.env.PERPLEXITY_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function redact(text: string, key: string) {
  let out = text;
  if (key) out = out.split(key).join("[key removed]");
  return out.replace(/\b(pplx-[A-Za-z0-9]{6,})\b/g, "[key removed]").slice(0, 300);
}

/** Reads answer text and sources from a parsed Agent API response, or explains why it cannot. */
export function readResponse(body: unknown): { answer: string; sources: Source[]; model?: string; effort?: string; costUsd?: number; status?: string; error?: string } | { malformed: string } {
  if (!isObj(body)) return { malformed: "the body is not a JSON object" };
  const output = body.output;
  if (!Array.isArray(output)) return { malformed: "it has no output array" };

  const texts: string[] = [];
  const byId = new Map<number, Source>();
  const noId: Source[] = [];
  for (const item of output) {
    if (!isObj(item)) continue;
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (isObj(part) && part.type === "output_text" && typeof part.text === "string") texts.push(part.text);
      }
    } else if (item.type === "search_results" && Array.isArray(item.results)) {
      for (const r of item.results) {
        if (!isObj(r) || typeof r.url !== "string" || !/^https?:\/\//i.test(r.url)) continue;
        const s: Source = { url: r.url };
        if (typeof r.title === "string" && r.title.trim()) s.title = r.title.trim();
        if (typeof r.snippet === "string" && r.snippet.trim()) s.snippet = r.snippet.trim();
        if (typeof r.date === "string" && r.date.trim()) s.date = r.date.trim();
        if (typeof r.id === "number" && Number.isInteger(r.id)) {
          s.id = r.id;
          if (!byId.has(r.id)) byId.set(r.id, s); // unverified: ids are assumed unique per response
        } else noId.push(s);
      }
    }
  }
  let answer = texts.join("\n\n");
  // Not in the HTTP schema (an SDK convenience); used only when the output array carries no text.
  if (!answer && typeof body.output_text === "string") answer = body.output_text;

  // Ordered by id, so that marker [n] is the n-th source whenever ids run 1..N as in every documented example.
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const s of [...[...byId.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)), ...noId]) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push(s);
  }

  const usage = isObj(body.usage) ? body.usage : undefined;
  const cost = usage && isObj(usage.cost) ? usage.cost : undefined;
  const err = isObj(body.error) && typeof body.error.message === "string" ? body.error.message : undefined;
  return {
    answer,
    sources,
    model: typeof body.model === "string" ? body.model : undefined,
    effort: typeof body.effort === "string" ? body.effort : undefined,
    costUsd: cost && typeof cost.total_cost === "number" ? cost.total_cost : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    error: err,
  };
}

function httpFailure(status: number, body: unknown, headers: Headers, key: string): AskFailure {
  const e = isObj(body) && isObj(body.error) ? body.error : {};
  const detail = typeof e.message === "string" && e.message.trim() ? redact(e.message.trim(), key) : "";
  const type = typeof e.type === "string" ? e.type : "";
  const rid = headers.get("x-request-id");
  const tail = `${detail ? ` Perplexity said: ${detail}` : ""}${rid ? ` (request ${redact(rid, key)})` : ""}`;
  if (status === 401) return { ok: false, kind: "http", status, message: `Perplexity refused the key (HTTP 401). Check the key in Admin, Credentials.${tail}` };
  if (status === 402) return { ok: false, kind: "http", status, message: `Perplexity says the account has no credit left (HTTP 402). Add credit in the Perplexity console.${tail}` };
  if (status === 403) return { ok: false, kind: "http", status, message: `Perplexity did not allow this request (HTTP 403).${tail}` };
  if (status === 429) {
    const wait = headers.get("retry-after");
    const what = type === "overloaded" ? "Perplexity's model is overloaded" : "Perplexity is limiting how fast this account can ask";
    return { ok: false, kind: "rate_limited", status, message: `${what} (HTTP 429).${wait && /^\d+$/.test(wait) ? ` Try again in ${wait} seconds.` : " Try again shortly."}${tail}` };
  }
  if (status >= 500) return { ok: false, kind: "http", status, message: `Perplexity had a server error (HTTP ${status}). Try again later.${tail}` };
  return { ok: false, kind: "http", status, message: `Perplexity did not accept the request (HTTP ${status}).${tail}` };
}

/** Asks Perplexity one research question with web search. Never throws for an upstream problem. */
export async function ask(opts: AskOptions): Promise<AskResult> {
  const question = opts.question.trim();
  const key = opts.apiKey ?? (await getCredential("perplexity", "apiKey"));
  if (!key) return { ok: false, kind: "not_configured", message: "Perplexity is not connected. Add a key in Admin, Credentials." };
  const effort = opts.effort ?? (await currentEffort());
  const limit = opts.timeoutMs ?? TIMEOUT_MS;
  const timer = AbortSignal.timeout(limit);
  const secs = limit % 1000 === 0 ? String(limit / 1000) : (limit / 1000).toFixed(1);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timer]) : timer;

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${AGENT_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ effort, instructions: INSTRUCTIONS, input: question, tools: [{ type: "web_search" }] }),
      signal,
    });
  } catch (e) {
    if (timer.aborted) return { ok: false, kind: "timeout", message: `Perplexity did not answer within ${secs} seconds.` };
    if (opts.signal?.aborted) return { ok: false, kind: "aborted", message: "The question was cancelled before Perplexity answered." };
    return { ok: false, kind: "network", message: `Could not reach Perplexity: ${redact((e as Error).message ?? String(e), key)}.` };
  }

  let text: string;
  try {
    text = await res.text();
  } catch {
    if (timer.aborted) return { ok: false, kind: "timeout", message: `Perplexity did not answer within ${secs} seconds.` };
    return { ok: false, kind: "network", status: res.status, message: `The connection to Perplexity broke while reading its answer (HTTP ${res.status}).` };
  }
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }

  if (!res.ok) return httpFailure(res.status, body, res.headers, key);
  if (body === undefined) return { ok: false, kind: "malformed", status: res.status, message: `Perplexity's answer could not be read (HTTP ${res.status}): it is not JSON.` };

  const r = readResponse(body);
  if ("malformed" in r) return { ok: false, kind: "malformed", status: res.status, message: `Perplexity's answer could not be read (HTTP ${res.status}): ${r.malformed}.` };
  if (r.status && r.status !== "completed" && !(r.status === "incomplete" && r.answer)) {
    return {
      ok: false,
      kind: "failed",
      status: res.status,
      message: `Perplexity did not complete the answer (status ${r.status}, HTTP ${res.status}).${r.error ? ` Perplexity said: ${redact(r.error, key)}` : ""}`,
    };
  }
  if (!r.answer.trim()) return { ok: false, kind: "malformed", status: res.status, message: `Perplexity's answer could not be read (HTTP ${res.status}): it contains no answer text.` };
  return { ok: true, answer: r.answer, sources: r.sources, model: r.model ?? effort, effort: r.effort, costUsd: r.costUsd, raw: body };
}
