// Stand-in for an OpenAI-compatible server: Ollama (prefix /v1), LM Studio (prefix /v1) and
// OpenRouter (prefix /api/v1).
//
// Documentation read (retrieved 20 Nov 2026):
//   [OAI-CHAT]   https://developers.openai.com/api/reference/python/resources/chat/subresources/completions/methods/create
//                (non-streaming response example: id, object "chat.completion", created, model, choices[].index,
//                 choices[].message.role/content/refusal/annotations, logprobs, finish_reason, usage)
//   [OAI-STREAM] https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events.md
//                (chunk example: id, object "chat.completion.chunk", created, model, choices[].index/delta/logprobs/finish_reason)
//   [OR-STREAM]  https://openrouter.ai/docs/api/reference/streaming.md
//                (events are "data: " lines; the stream ends with "data: [DONE]"; ": OPENROUTER PROCESSING" comments)
//   [OAI-EMB]    https://developers.openai.com/api/reference/resources/embeddings.md
//                (response example: object "list", data[].object "embedding", data[].embedding, data[].index, model, usage)
//   [OAI-MODELS] https://developers.openai.com/api/reference/resources/models.md
//                (list example: object "list", data[].id, object "model", created, owned_by)
//   [OLLAMA]     https://docs.ollama.com/api/openai-compatibility (endpoints /v1/models, /v1/chat/completions with
//                stream, /v1/embeddings with input string or array of strings and dimensions; local server ignores the key;
//                owned_by defaults to "library")
//   [LMSTUDIO]   https://lmstudio.ai/docs/developer/openai-compat (+ /models, /chat-completions, /embeddings sub-pages:
//                same three endpoints under /v1; response shapes deferred to OpenAI's reference)
//   [OR-API]     https://openrouter.ai/docs/api/reference/overview.md (base https://openrouter.ai/api/v1, Bearer key)
//
// Unverified (not found in the pages above, chosen to look like OpenAI and labelled so in place):
//   - the body and exact status of a wrong-key answer (401 with {"error":{message,type,code}})
//   - OpenRouter's embeddings endpoint (not on the pages read; served under the prefix like the others)
import { createHash } from "node:crypto";
import { bearer, json, startStandIn, type FailureOptions, type Reply } from "./core";

export type OpenAIOptions = FailureOptions & {
  /** path prefix: "/v1" for Ollama and LM Studio, "/api/v1" for OpenRouter */
  prefix: string;
  /** when set, requests must carry "Authorization: Bearer <apiKey>"; unset accepts any key, as local Ollama does [OLLAMA] */
  apiKey?: string;
  /** model ids returned by GET {prefix}/models */
  models: string[];
  /** length of every embedding vector, unless the request sends "dimensions" */
  dimensions: number;
  /** assistant reply; default echoes the last user message */
  reply?: string | ((messages: { role: string; content: unknown }[]) => string);
  /**
   * Behave as OpenRouter does: GET {prefix}/models and GET {prefix}/embeddings/models answer without a key,
   * GET {prefix}/key answers only to the right key, and the embedding models are in their own list
   * [OR-KEY] https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key (GET /key, 401 without a key)
   * [OR-EMB-LIST] https://openrouter.ai/docs/api/api-reference/embeddings/list-embeddings-models (GET /embeddings/models)
   * Both read 21 November 2026. That /models needs no key is from the public endpoint answering search crawlers; unverified by a call from here.
   */
  openRouter?: { embeddingModels: string[] };
  /** a test's own vectors (for search by meaning between texts that share no word); default embeddingFor */
  embed?: (text: string, dimensions: number) => number[];
};

const DEFAULTS: OpenAIOptions = { prefix: "/v1", models: ["stand-in-chat", "stand-in-embed"], dimensions: 8 };

/**
 * The vector the stand-in returns for a text: deterministic (same text and dimension, same vector) and
 * unit length, so a test can compute the expected value with this same function.
 */
export function embeddingFor(text: string, dimensions: number): number[] {
  const out: number[] = [];
  for (let block = 0; out.length < dimensions; block++) {
    const h = createHash("sha256").update(`${text}#${block}`).digest();
    for (let i = 0; i + 4 <= h.length && out.length < dimensions; i += 4) out.push(h.readUInt32BE(i) / 0xffffffff * 2 - 1);
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

const created = () => Math.floor(Date.now() / 1000);

function unauthorized(): Reply {
  // unverified: status and body of a wrong-key answer (OpenAI-style error object)
  return json(401, { error: { message: "Incorrect API key provided (stand-in)", type: "invalid_request_error", code: "invalid_api_key" } });
}

export function start(options?: Partial<OpenAIOptions>) {
  return startStandIn<OpenAIOptions>(DEFAULTS, (req, o) => {
    const prefix = o.prefix.replace(/\/$/, "");
    const route = `${req.method} ${req.path}`;
    const open = !!o.openRouter && (route === `GET ${prefix}/models` || route === `GET ${prefix}/embeddings/models`);
    if (!open && o.apiKey !== undefined && bearer(req.headers) !== o.apiKey) {
      // [OR-KEY] the documented 401 body
      return o.openRouter ? json(401, { error: { code: 401, message: bearer(req.headers) ? "User not found." : "Missing Authentication header" } }) : unauthorized();
    }
    if (o.openRouter && route === `GET ${prefix}/key`) return json(200, { data: { label: "sk-or-v1-sta...din", limit: null, usage: 0, is_provisioning_key: false } }); // [OR-KEY]
    if (o.openRouter && route === `GET ${prefix}/embeddings/models`) return json(200, { data: o.openRouter.embeddingModels.map((id) => ({ id, name: id })) }); // [OR-EMB-LIST]

    if (route === `GET ${prefix}/models`) {
      return json(200, {
        object: "list", // [OAI-MODELS]
        data: o.models.map((id) => ({
          id, // [OAI-MODELS]
          object: "model", // [OAI-MODELS]
          created: 1686935002, // [OAI-MODELS] (Ollama: when the model was last modified [OLLAMA])
          owned_by: "library", // [OAI-MODELS]; "library" is Ollama's default [OLLAMA]
        })),
      });
    }

    if (route === `POST ${prefix}/chat/completions`) {
      const b = (req.body ?? {}) as { model?: string; messages?: { role: string; content: unknown }[]; stream?: boolean };
      if (!Array.isArray(b.messages)) return json(400, { error: { message: "messages is required (stand-in)", type: "invalid_request_error" } }); // unverified
      const lastUser = [...b.messages].reverse().find((m) => m.role === "user");
      const text = typeof o.reply === "function" ? o.reply(b.messages) : o.reply ?? `Echo: ${typeof lastUser?.content === "string" ? lastUser.content : JSON.stringify(lastUser?.content ?? "")}`;
      const id = `chatcmpl-standin-${Date.now()}`;
      const model = b.model ?? o.models[0];
      if (b.stream) {
        const chunk = (delta: Record<string, unknown>, finish: string | null) =>
          JSON.stringify({
            id, // [OAI-STREAM]
            object: "chat.completion.chunk", // [OAI-STREAM]
            created: created(), // [OAI-STREAM]
            model, // [OAI-STREAM]
            choices: [{ index: 0, delta, logprobs: null, finish_reason: finish }], // [OAI-STREAM]
          });
        const words = text.match(/\s*\S+\s*/g) ?? [text]; // keep spaces so the joined deltas equal the reply
        return {
          status: 200,
          sse: [
            chunk({ role: "assistant", content: "" }, null), // first chunk carries the role [OAI-STREAM example]
            ...words.map((w) => chunk({ content: w }, null)), // delta.content [OAI-STREAM]
            chunk({}, "stop"), // finish_reason on the last chunk [OAI-STREAM] [OR-STREAM]
            "[DONE]", // stream terminator [OR-STREAM]
          ],
        };
      }
      return json(200, {
        id, // [OAI-CHAT]
        object: "chat.completion", // [OAI-CHAT]
        created: created(), // [OAI-CHAT]
        model, // [OAI-CHAT]
        choices: [
          {
            index: 0, // [OAI-CHAT]
            message: { role: "assistant", content: text, refusal: null, annotations: [] }, // [OAI-CHAT]
            logprobs: null, // [OAI-CHAT]
            finish_reason: "stop", // [OAI-CHAT]
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, // [OAI-CHAT] (counts are not computed)
      });
    }

    if (route === `POST ${prefix}/embeddings`) {
      const b = (req.body ?? {}) as { model?: string; input?: unknown; dimensions?: number };
      // input: string or array of strings [OLLAMA]; token arrays are not supported by Ollama either
      const inputs = typeof b.input === "string" ? [b.input] : Array.isArray(b.input) && b.input.every((s) => typeof s === "string") ? (b.input as string[]) : null;
      if (!inputs) return json(400, { error: { message: "input must be a string or an array of strings (stand-in)", type: "invalid_request_error" } }); // unverified
      if (o.openRouter && !o.openRouter.embeddingModels.includes(b.model ?? "")) return json(404, { error: { code: 404, message: "No endpoints found (stand-in)" } }); // unverified wording
      const dim = typeof b.dimensions === "number" && b.dimensions > 0 ? b.dimensions : o.dimensions; // dimensions [OAI-EMB] [OLLAMA]
      return json(200, {
        object: "list", // [OAI-EMB]
        data: inputs.map((text, index) => ({
          object: "embedding", // [OAI-EMB]
          embedding: (o.embed ?? embeddingFor)(text, dim), // [OAI-EMB] (values are the stand-in's own)
          index, // [OAI-EMB]
        })),
        model: b.model ?? o.models[1] ?? o.models[0], // [OAI-EMB]
        usage: { prompt_tokens: 0, total_tokens: 0 }, // [OAI-EMB] (counts are not computed)
      });
    }

    return json(404, { error: { message: `stand-in has no route ${route}` } }); // unverified
  }, options);
}
