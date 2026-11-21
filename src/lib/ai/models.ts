// The model layer: the only place in the app that constructs a model client (decision D7).
//
// The installer chooses, in Admin, a reasoning model and an embedding model, each served by
// Ollama, LM Studio or OpenRouter. All three speak the OpenAI-compatible interface, so one
// client (the AI SDK's openai-compatible provider) serves all three; only the base address
// differs ("/v1" for Ollama and LM Studio, "/api/v1" for OpenRouter). Nothing here names a
// vendor's model, and nothing reads a model name from the environment.
//
// AI SDK 7 functions used (confirmed in node_modules/ai/dist/index-*.d.ts and node_modules/ai/docs):
//   generateText (`instructions`, `messages`, `maxOutputTokens`, `maxRetries`, `abortSignal`, `output`)
//   streamText (its `stream` of parts: 'text-delta', 'error', 'finish' with totalUsage)
//   Output.object({ schema }) for structured output, NoObjectGeneratedError when the answer does not fit
//   embedMany({ model, values }) returning `embeddings`
//   APICallError (statusCode, responseBody, url, cause) and RetryError (lastError)
// and createOpenAICompatible({ name, baseURL, apiKey, includeUsage, supportsStructuredOutputs })
// with .chatModel() and .embeddingModel() from @ai-sdk/openai-compatible (its dist/index.d.ts and docs/index.mdx).
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  APICallError,
  embedMany,
  generateText,
  NoObjectGeneratedError,
  Output,
  RetryError,
  streamText,
  type EmbeddingModel,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import { HttpError } from "@/lib/api/route";
import { DEFAULT_BASE_URL, embeddingModel, getCredential, reasoningModel, type ModelChoice } from "@/lib/settings";
import { boundElsewhere, secretFor } from "@/lib/secretOrigin";
import { blockedIn, blockedSentence, safeFetch } from "@/lib/net/outbound";
import { savedModelChoice } from "./schemas";
import { scrub } from "@/lib/secrets/scrub";

export type ProviderId = ModelChoice["provider"];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
  openrouter: "OpenRouter",
};

/** Providers that refuse requests without a key. Local Ollama and LM Studio usually have none. */
const KEY_REQUIRED: Record<ProviderId, boolean> = { ollama: false, lmstudio: false, openrouter: true };

const COMPLETION_TIMEOUT_MS = 60_000;
const EMBEDDING_TIMEOUT_MS = 30_000;
/** Retries on a network error, 429 or 5xx (the SDK decides what is retryable). Adjustable per call. */
const DEFAULT_MAX_RETRIES = 1;

/** Which model answers, and where. Never carries the key. */
type ModelInfo = { provider: ProviderId; model: string; baseUrl: string };
export type EmbeddingInfo = ModelInfo & { dims: number };

export type NotConfigured = { ok: false; missing: "model" | "key" | "dims" | "setting"; reason: string };
export type ReadyReasoning = { ok: true; model: LanguageModel; info: ModelInfo; hasKey: boolean };
export type ReadyEmbedding = { ok: true; model: EmbeddingModel; info: EmbeddingInfo; hasKey: boolean };

/**
 * A failure of the model layer, as a plain sentence and the HTTP status a route should answer with.
 * It is an HttpError, so the route wrapper turns it into JSON with that status on its own.
 * Messages never contain a key.
 */
export class ModelError extends HttpError {
  constructor(
    status: number,
    message: string,
    /** what went wrong, for callers that branch on it */
    public kind: "not-configured" | "unreachable" | "provider" | "timeout" | "cancelled" | "width" | "invalid-json" | "failed",
    /** the provider's own HTTP status, when it answered */
    public providerStatus?: number
  ) {
    super(status, message);
    this.name = "ModelError";
  }
}

// ---------------------------------------------------------------------------------------------
// Reading the choice

type Role = "reasoning" | "embedding";

async function readChoice(role: Role): Promise<{ ok: true; choice: z.infer<typeof savedModelChoice>; baseUrl: string; key: string | null } | NotConfigured> {
  const raw = role === "reasoning" ? await reasoningModel() : await embeddingModel();
  if (raw === null || raw === undefined) {
    return { ok: false, missing: "model", reason: `No ${role} model is chosen. Choose one in Admin, Models.` };
  }
  const parsed = savedModelChoice.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") || "the setting";
    return {
      ok: false,
      missing: "setting",
      reason: `The saved ${role} model is incomplete (${field} is not valid). Choose it again in Admin, Models.`,
    };
  }
  const choice = parsed.data;
  const baseUrl = (choice.baseUrl || DEFAULT_BASE_URL[choice.provider]).replace(/\/+$/, "");
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol");
  } catch {
    return { ok: false, missing: "setting", reason: `The ${role} model's address "${baseUrl}" is not a web address. Correct it in Admin, Models.` };
  }
  // A saved key is only sent to the host it was saved for (src/lib/secretOrigin.ts).
  const secret = await secretFor(choice.provider, "apiKey", baseUrl);
  const key = secret.value?.trim() || null;
  if (!key && secret.refused && KEY_REQUIRED[choice.provider]) {
    return { ok: false, missing: "key", reason: `${boundElsewhere(PROVIDER_LABEL[choice.provider], secret.boundTo, baseUrl)} Do that in Admin, Credentials.` };
  }
  if (!key && KEY_REQUIRED[choice.provider]) {
    return { ok: false, missing: "key", reason: `${PROVIDER_LABEL[choice.provider]} needs a key. Add it in Admin, Credentials.` };
  }
  return { ok: true, choice, baseUrl, key };
}

function client(provider: ProviderId, baseUrl: string, key: string | null) {
  return createOpenAICompatible({
    name: provider,
    baseURL: baseUrl,
    // Sent as "Authorization: Bearer <key>" only when a key is saved.
    ...(key ? { apiKey: key } : {}),
    // Every call goes through the shared outbound rule (no link-local or metadata addresses, no rebinding).
    fetch: safeFetch,
    // Usage counts in streamed answers (stream_options.include_usage).
    includeUsage: true,
    // Lets Output.object send response_format json_schema; plain text calls are unaffected.
    supportsStructuredOutputs: true,
  });
}

/** The chosen reasoning model, ready to call, or what is missing in plain words. */
export async function getReasoning(): Promise<ReadyReasoning | NotConfigured> {
  const c = await readChoice("reasoning");
  if (!c.ok) return c;
  return {
    ok: true,
    model: client(c.choice.provider, c.baseUrl, c.key).chatModel(c.choice.model),
    info: { provider: c.choice.provider, model: c.choice.model, baseUrl: c.baseUrl },
    hasKey: !!c.key,
  };
}

/** The chosen embedding model with its vector width, ready to call, or what is missing in plain words. */
export async function getEmbedding(): Promise<ReadyEmbedding | NotConfigured> {
  const c = await readChoice("embedding");
  if (!c.ok) return c;
  if (!c.choice.dims) {
    return { ok: false, missing: "dims", reason: "The embedding model has no vector width. Set its dimensions in Admin, Models." };
  }
  return {
    ok: true,
    model: client(c.choice.provider, c.baseUrl, c.key).embeddingModel(c.choice.model),
    info: { provider: c.choice.provider, model: c.choice.model, baseUrl: c.baseUrl, dims: c.choice.dims },
    hasKey: !!c.key,
  };
}

// ---------------------------------------------------------------------------------------------
// Errors in plain words

function formatMs(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${Number((ms / 1000).toFixed(1))} s`;
}

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|::1)$/i;

function providerDetail(e: APICallError): string {
  const body = e.responseBody ?? "";
  try {
    const j = JSON.parse(body) as { error?: { message?: unknown } | string; message?: unknown };
    const m = typeof j.error === "string" ? j.error : typeof j.error?.message === "string" ? j.error.message : typeof j.message === "string" ? j.message : "";
    if (m) return m;
  } catch {
    // not JSON
  }
  return body.trim().slice(0, 300) || e.message;
}

type Ctx = { info: ModelInfo; key: string | null; timeoutMs: number; timedOut: () => boolean; cancelled: () => boolean };

/** Turns anything a provider call can throw into a ModelError with a plain sentence. */
export function explain(error: unknown, ctx: Ctx): ModelError {
  if (error instanceof ModelError) return error;
  const name = PROVIDER_LABEL[ctx.info.provider];
  const where = `${name} at ${ctx.info.baseUrl}`;
  if (ctx.timedOut()) {
    return new ModelError(504, `${where} did not answer within ${formatMs(ctx.timeoutMs)}. The model may be loading or too slow for this request.`, "timeout");
  }
  if (ctx.cancelled()) return new ModelError(499, "The request was cancelled.", "cancelled");

  const refused = blockedIn(error);
  if (refused) return new ModelError(400, `${where} cannot be called: ${blockedSentence(refused)}`, "unreachable");

  let e = error;
  if (RetryError.isInstance(e)) e = e.lastError;

  if (APICallError.isInstance(e)) {
    const status = e.statusCode;
    if (status === undefined) {
      let host = "";
      try {
        host = new URL(ctx.info.baseUrl).hostname;
      } catch {
        // the address was checked when the model was read
      }
      const docker = LOCAL_HOST.test(host)
        ? ` If the app runs in Docker, localhost there is the app's own container: to reach ${name} on this computer use host.docker.internal in place of ${host}.`
        : "";
      return new ModelError(502, `Could not reach ${where}: is it running, and is that the right address?${docker}`, "unreachable");
    }
    const detail = scrub(providerDetail(e), ctx.key).replace(/\s+/g, " ").trim();
    const hint =
      status === 401 || status === 403
        ? ` Check the ${name} key in Admin, Credentials.`
        : status === 404
          ? ` Check the model name "${ctx.info.model}" and the address in Admin, Models.`
          : status === 429
            ? " Too many requests or no credit left; try again later."
            : "";
    const sentence = detail ? `${detail.replace(/[.\s]+$/, "")}.` : "no detail.";
    return new ModelError(502, `${name} answered HTTP ${status}: ${sentence}${hint}`, "provider", status);
  }
  const msg = scrub(error instanceof Error ? error.message : String(error), ctx.key);
  return new ModelError(502, `The call to ${where} failed: ${msg}`, "failed");
}

/** One deadline per call, joined with the caller's signal. */
function deadline(timeoutMs: number, signal?: AbortSignal) {
  const timer = AbortSignal.timeout(timeoutMs);
  return {
    signal: signal ? AbortSignal.any([timer, signal]) : timer,
    timedOut: () => timer.aborted,
    cancelled: () => !!signal?.aborted,
  };
}

async function keyFor(info: ModelInfo) {
  return (await getCredential(info.provider, "apiKey"))?.trim() || null;
}

// ---------------------------------------------------------------------------------------------
// Completions

export type ChatMessage = { role: "user" | "assistant"; content: string };
type Usage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };

export type CompleteOptions = {
  /** instructions for the model (sent as the system message) */
  system?: string;
  messages: ChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  /** cancels the call when the caller goes away */
  signal?: AbortSignal;
  /** default 60 s */
  timeoutMs?: number;
  /** default 1 */
  maxRetries?: number;
  /** an already resolved reasoning model, to save a second read of the settings */
  use?: ReadyReasoning;
};

export type CompleteResult = { text: string; usage: Usage; finishReason: string; info: ModelInfo };

function toUsage(u: LanguageModelUsage | undefined): Usage {
  const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const input = n(u?.inputTokens);
  const output = n(u?.outputTokens);
  const total = n(u?.totalTokens) ?? (input !== null && output !== null ? input + output : null);
  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

async function readyReasoning(use?: ReadyReasoning): Promise<ReadyReasoning> {
  const r = use ?? (await getReasoning());
  if (!r.ok) throw new ModelError(503, r.reason, "not-configured");
  return r;
}

const toModelMessages = (messages: ChatMessage[]): ModelMessage[] =>
  messages.map((m) => (m.role === "assistant" ? { role: "assistant" as const, content: m.content } : { role: "user" as const, content: m.content }));

/** One answer from the reasoning model, with token usage. */
export async function complete(o: CompleteOptions): Promise<CompleteResult> {
  const r = await readyReasoning(o.use);
  const timeoutMs = o.timeoutMs ?? COMPLETION_TIMEOUT_MS;
  const d = deadline(timeoutMs, o.signal);
  try {
    const res = await generateText({
      model: r.model,
      ...(o.system ? { instructions: o.system } : {}),
      messages: toModelMessages(o.messages),
      maxOutputTokens: o.maxOutputTokens,
      temperature: o.temperature,
      maxRetries: o.maxRetries ?? DEFAULT_MAX_RETRIES,
      abortSignal: d.signal,
    });
    return { text: res.text.trim(), usage: toUsage(res.usage), finishReason: res.finishReason, info: r.info };
  } catch (e) {
    throw explain(e, { info: r.info, key: await keyFor(r.info), timeoutMs, ...d });
  }
}

export type StreamResult = {
  info: ModelInfo;
  /** the answer's text as it arrives; errors mid-stream end it with a ModelError */
  textStream: ReadableStream<string>;
  /** the same text as UTF-8 bytes in a text/plain Response, for a route to return as is */
  toResponse(init?: ResponseInit): Response;
  /** the whole text and usage once the stream has been read to the end */
  done: Promise<{ text: string; usage: Usage; finishReason: string }>;
};

/**
 * A streamed answer. It waits for the first piece of text before returning, so a model that is
 * unreachable, refuses the key or times out before answering is a thrown ModelError (a proper
 * status for the route), not a broken stream. The time limit covers the whole stream.
 */
export async function completeStream(o: CompleteOptions): Promise<StreamResult> {
  const r = await readyReasoning(o.use);
  const timeoutMs = o.timeoutMs ?? COMPLETION_TIMEOUT_MS;
  const d = deadline(timeoutMs, o.signal);
  const key = await keyFor(r.info);
  const ctx: Ctx = { info: r.info, key, timeoutMs, ...d };

  const result = streamText({
    model: r.model,
    ...(o.system ? { instructions: o.system } : {}),
    messages: toModelMessages(o.messages),
    maxOutputTokens: o.maxOutputTokens,
    temperature: o.temperature,
    maxRetries: o.maxRetries ?? DEFAULT_MAX_RETRIES,
    abortSignal: d.signal,
    // Errors arrive as 'error' parts below; this only stops the SDK from logging them to the console.
    onError: () => undefined,
  });
  const parts = result.stream[Symbol.asyncIterator]();

  let text = "";
  let usage: Usage = toUsage(undefined);
  let finishReason = "unknown";
  let settle!: (v: { text: string; usage: Usage; finishReason: string }) => void;
  let fail!: (e: unknown) => void;
  const done = new Promise<{ text: string; usage: Usage; finishReason: string }>((res, rej) => {
    settle = res;
    fail = rej;
  });
  done.catch(() => undefined); // a caller that never awaits it must not see an unhandled rejection

  /** next piece of text, or null at the end; throws a ModelError on an error part */
  const next = async (): Promise<string | null> => {
    for (;;) {
      let step: Awaited<ReturnType<typeof parts.next>>;
      try {
        step = await parts.next();
      } catch (e) {
        throw explain(e, ctx);
      }
      if (step.done) return null;
      const p = step.value;
      if (p.type === "text-delta") {
        if (p.text) return p.text;
      } else if (p.type === "error") {
        throw explain(p.error, ctx);
      } else if (p.type === "abort") {
        throw explain(new Error("aborted"), ctx);
      } else if (p.type === "finish") {
        usage = toUsage(p.totalUsage);
        finishReason = p.finishReason;
      }
    }
  };

  let first: string | null;
  try {
    first = await next();
  } catch (e) {
    fail(e);
    throw e;
  }

  const textStream = new ReadableStream<string>({
    start(controller) {
      if (first !== null) {
        text += first;
        controller.enqueue(first);
      }
    },
    async pull(controller) {
      try {
        const piece = first === null ? null : await next();
        if (piece === null) {
          controller.close();
          settle({ text, usage, finishReason });
          return;
        }
        text += piece;
        controller.enqueue(piece);
      } catch (e) {
        fail(e);
        controller.error(e);
      }
    },
    async cancel() {
      await parts.return?.();
      fail(new ModelError(499, "The request was cancelled.", "cancelled"));
    },
  });

  return {
    info: r.info,
    textStream,
    done,
    toResponse(init) {
      const enc = new TextEncoder();
      const bytes = textStream.pipeThrough(new TransformStream<string, Uint8Array>({ transform: (s, c) => c.enqueue(enc.encode(s)) }));
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) headers.set("content-type", "text/plain; charset=utf-8");
      return new Response(bytes, { ...init, headers });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Structured answers

type JsonPath = "structured" | "prompted";

export type CompleteJsonOptions<S extends z.ZodType> = Omit<CompleteOptions, "temperature"> & {
  schema: S;
  temperature?: number;
  /**
   * "structured": the provider's JSON-schema response format only. "prompted": ask for JSON in the
   * instructions and validate here. "auto" (default): structured first; if the host rejects the
   * response format (HTTP 400, 404, 422 or 501) or its answer does not fit the schema, prompted.
   */
  mode?: "auto" | JsonPath;
};

export type CompleteJsonResult<T> = {
  object: T;
  /** which path produced the object */
  path: JsonPath;
  /** why the structured path was left, when it was */
  fallbackReason?: string;
  usage: Usage;
  info: ModelInfo;
};

const FALLBACK_STATUSES = new Set([400, 404, 422, 501]);

/** Finds the JSON value in a model's answer: a bare value, or one inside a code fence or prose. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)?.[1]?.trim();
  const candidates = [t, fenced];
  const firstBrace = t.search(/[{[]/);
  if (firstBrace >= 0) {
    const close = t[firstBrace] === "{" ? "}" : "]";
    const last = t.lastIndexOf(close);
    if (last > firstBrace) candidates.push(t.slice(firstBrace, last + 1));
  }
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      // try the next form
    }
  }
  throw new SyntaxError("no JSON value found");
}

function jsonInstruction(schema: z.ZodType) {
  return `Answer with one JSON value only: no prose, no code fence. It must match this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

/** An answer as an object validated against a zod schema. Says which path produced it. */
export async function completeJson<S extends z.ZodType>(o: CompleteJsonOptions<S>): Promise<CompleteJsonResult<z.infer<S>>> {
  const r = await readyReasoning(o.use);
  const timeoutMs = o.timeoutMs ?? COMPLETION_TIMEOUT_MS;
  // One deadline for both attempts.
  const d = deadline(timeoutMs, o.signal);
  const key = await keyFor(r.info);
  const ctx: Ctx = { info: r.info, key, timeoutMs, ...d };
  const mode = o.mode ?? "auto";
  const common = {
    model: r.model,
    messages: toModelMessages(o.messages),
    maxOutputTokens: o.maxOutputTokens,
    temperature: o.temperature,
    maxRetries: o.maxRetries ?? DEFAULT_MAX_RETRIES,
    abortSignal: d.signal,
  };

  let fallbackReason: string | undefined;
  if (mode !== "prompted") {
    try {
      const res = await generateText({ ...common, ...(o.system ? { instructions: o.system } : {}), output: Output.object({ schema: o.schema }) });
      return { object: res.output as z.infer<S>, path: "structured", usage: toUsage(res.usage), info: r.info };
    } catch (e) {
      const inner = RetryError.isInstance(e) ? e.lastError : e;
      const rejected = APICallError.isInstance(inner) && inner.statusCode !== undefined && FALLBACK_STATUSES.has(inner.statusCode);
      const unfit = NoObjectGeneratedError.isInstance(inner);
      if (mode === "structured" || d.timedOut() || d.cancelled() || !(rejected || unfit)) {
        if (unfit) throw new ModelError(502, `The model's answer was not valid JSON of the requested shape (structured output).`, "invalid-json");
        throw explain(e, ctx);
      }
      fallbackReason = rejected
        ? `${PROVIDER_LABEL[r.info.provider]} refused the JSON-schema response format (HTTP ${(inner as APICallError).statusCode}).`
        : "The structured answer did not fit the schema.";
    }
  }

  let text: string;
  let usage: Usage;
  try {
    const res = await generateText({ ...common, instructions: [o.system, jsonInstruction(o.schema)].filter(Boolean).join("\n\n") });
    text = res.text;
    usage = toUsage(res.usage);
  } catch (e) {
    throw explain(e, ctx);
  }
  let value: unknown;
  try {
    value = extractJson(text);
  } catch {
    throw new ModelError(502, "The model's answer was not valid JSON (asked for JSON in the instructions).", "invalid-json");
  }
  const checked = o.schema.safeParse(value);
  if (!checked.success) {
    const i = checked.error.issues[0];
    throw new ModelError(
      502,
      `The model's JSON did not match the requested shape: ${i?.path.join(".") || "(value)"}: ${i?.message ?? "invalid"}.`,
      "invalid-json"
    );
  }
  return { object: checked.data as z.infer<S>, path: "prompted", ...(fallbackReason ? { fallbackReason } : {}), usage, info: r.info };
}

// ---------------------------------------------------------------------------------------------
// Embeddings

export type EmbedOptions = {
  signal?: AbortSignal;
  /** default 30 s */
  timeoutMs?: number;
  /** default 1 */
  maxRetries?: number;
  use?: ReadyEmbedding;
};

export type EmbedResult = { vectors: number[][]; tokens: number | null; info: EmbeddingInfo };

/** Vectors for the given texts, each checked against the configured width. */
export async function embed(texts: string[], o: EmbedOptions = {}): Promise<EmbedResult> {
  const r = o.use ?? (await getEmbedding());
  if (!r.ok) throw new ModelError(503, r.reason, "not-configured");
  if (texts.length === 0) return { vectors: [], tokens: 0, info: r.info };
  const timeoutMs = o.timeoutMs ?? EMBEDDING_TIMEOUT_MS;
  const d = deadline(timeoutMs, o.signal);
  let res: Awaited<ReturnType<typeof embedMany>>;
  try {
    // No `dimensions` is sent: the width is what the model returns, and Admin records it.
    res = await embedMany({ model: r.model, values: texts, maxRetries: o.maxRetries ?? DEFAULT_MAX_RETRIES, abortSignal: d.signal });
  } catch (e) {
    throw explain(e, { info: r.info, key: await keyFor(r.info), timeoutMs, ...d });
  }
  checkWidths(res.embeddings, r.info);
  if (res.embeddings.length !== texts.length) {
    throw new ModelError(502, `${PROVIDER_LABEL[r.info.provider]} returned ${res.embeddings.length} vectors for ${texts.length} texts.`, "failed");
  }
  return { vectors: res.embeddings, tokens: typeof res.usage?.tokens === "number" ? res.usage.tokens : null, info: r.info };
}

/** Fails plainly, naming both widths, when any vector is not as wide as Admin says. */
export function checkWidths(vectors: number[][], info: Pick<EmbeddingInfo, "dims" | "model">) {
  const bad = vectors.find((v) => v.length !== info.dims);
  if (bad) {
    throw new ModelError(
      502,
      `The embedding model "${info.model}" returned vectors ${bad.length} wide, but Admin says its width is ${info.dims}. Correct the width in Admin, Models, or choose another model.`,
      "width"
    );
  }
  const notFinite = vectors.find((v) => v.some((x) => typeof x !== "number" || !Number.isFinite(x)));
  if (notFinite) throw new ModelError(502, `The embedding model "${info.model}" returned a vector with values that are not numbers.`, "failed");
}
