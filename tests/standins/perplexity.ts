// Stand-in for Perplexity's Sonar endpoint, POST /v1/sonar, as called by src/app/api/research/route.ts
// (the route reads choices[0].message.content, then citations, falling back to search_results[].url,
// and error.message on a non-2xx answer; its address is PERPLEXITY_URL).
//
// Documentation read (retrieved 20 Nov 2026):
//   [PPLX] https://docs.perplexity.ai/api-reference/sonar-post (now redirects to "Migrate from Sonar to the Agent API",
//          docs/agent-api/migrate-from-sonar/overview). It shows the Sonar request (POST https://api.perplexity.ai/v1/sonar,
//          "Authorization: Bearer", body {model, messages}) and a Sonar response example with: id, choices[].message
//          {content, role}, choices[].finish_reason, created, model, citations (array of URL strings), object
//          "chat.completion", search_results[] {title, url, date, last_updated, snippet, source}.
//          The same page says: "Sonar Chat Completions support ended on September 27, 2026. Synchronous and streaming
//          requests keep working: they are being reformulated as Agent API requests".
//
// Unverified: the status and body of a wrong-key answer (401 with {"error":{"message"}} is assumed; the route reads
// error.message), choices[].index, and streaming (not built here; the app does not stream).
import { bearer, json, startStandIn, type FailureOptions } from "./core";

export type PerplexityOptions = FailureOptions & {
  /** the key every request must carry as "Authorization: Bearer <apiKey>" */
  apiKey: string;
  /** answer text; default echoes the last user message */
  reply?: string;
  citations: string[];
  /** include search_results in the answer (true) or leave them out (false) */
  searchResults: boolean;
  /** leave the top-level citations array out, to test the route's search_results fallback */
  omitCitations?: boolean;
};

const DEFAULTS: PerplexityOptions = {
  apiKey: "pplx-stand-in-key",
  citations: ["https://example.com/source-1", "https://example.org/source-2"],
  searchResults: true,
};

export function start(options?: Partial<PerplexityOptions>) {
  return startStandIn<PerplexityOptions>(DEFAULTS, (req, o) => {
    if (bearer(req.headers) !== o.apiKey) {
      return json(401, { error: { message: "Invalid API key (stand-in)", type: "invalid_api_key", code: 401 } }); // unverified
    }
    if (!(req.method === "POST" && req.path === "/v1/sonar")) return json(404, { error: { message: `stand-in has no route ${req.method} ${req.path}` } }); // unverified
    const b = (req.body ?? {}) as { model?: string; messages?: { role: string; content: string }[] };
    if (!Array.isArray(b.messages)) return json(400, { error: { message: "messages is required (stand-in)" } }); // unverified
    const lastUser = [...b.messages].reverse().find((m) => m.role === "user");
    const content = o.reply ?? `Stand-in research answer to: ${lastUser?.content ?? ""}`;
    const body: Record<string, unknown> = {
      id: `standin-${Date.now()}`, // [PPLX]
      model: b.model ?? "sonar", // [PPLX]
      created: Math.floor(Date.now() / 1000), // [PPLX]
      object: "chat.completion", // [PPLX]
      choices: [
        {
          index: 0, // unverified (elided as "// ..." in the example)
          message: { role: "assistant", content }, // [PPLX]
          finish_reason: "stop", // [PPLX]
        },
      ],
    };
    if (!o.omitCitations) body.citations = o.citations; // [PPLX] top-level array of URLs
    if (o.searchResults) {
      body.search_results = o.citations.map((url, i) => ({
        title: `Stand-in source ${i + 1}`, // [PPLX]
        url, // [PPLX]
        date: "2026-11-01", // [PPLX]
        last_updated: "2026-11-02", // [PPLX]
        snippet: "Stand-in snippet.", // [PPLX]
        source: "web", // [PPLX]
      }));
    }
    return json(200, body);
  }, options);
}
