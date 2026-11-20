// Stand-in for Perplexity's Agent API, POST /v1/agent, as called by src/lib/research/perplexity.ts
// (base address PERPLEXITY_BASE_URL). The Sonar interface (POST /v1/sonar) is not served: its
// support ended on 27 Sep 2026 and the app no longer calls it.
//
// Documentation read 20 Nov 2026 (details and the full unverified list: docs/research/perplexity-api.md):
//   [REF]   https://docs.perplexity.ai/api-reference/agent-post  (OpenAPI: ResponsesResponse, MessageOutputItem,
//           ContentPart, SearchResultsOutputItem, SearchResult, ErrorInfo, ResponsesUsage, ResponsesCost)
//   [MIG]   https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview  (example Agent API response)
//   [WEB]   https://docs.perplexity.ai/docs/agent-api/tools/web-search  ("Response Shape")
//   [EFF]   https://docs.perplexity.ai/docs/agent-api/effort  (response `effort` as name@version; fast's models)
//   [RATE]  https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers  (429 body and Retry-After)
//   [FAQ]   https://docs.perplexity.ai/docs/resources/faq  (401 for a bad key; X-Request-ID header)
import { bearer, json, startStandIn, type FailureOptions } from "./core";

export type PerplexityOptions = FailureOptions & {
  /** the key every request must carry as "Authorization: Bearer <apiKey>" [REF HTTPBearer] */
  apiKey: string;
  /** answer text; default echoes the input */
  reply?: string;
  /** the sources returned in the search_results item, in id order from 1 */
  citations: string[];
  /** leave the search_results item out (an answer without sources) */
  noSources?: boolean;
  /** answer 429 with this error.type and Retry-After [RATE] */
  rateLimit?: "request_rate_limit_exceeded" | "token_rate_limit_exceeded" | "overloaded";
  /** answer 200 with a body that is not a valid response */
  malformed?: "not-json" | "no-output";
  /** answer 200 with status "failed" and an error object [REF ResponsesResponse.error] */
  failedRun?: boolean;
  /** usage.cost.total_cost to report [REF ResponsesCost]; undefined leaves usage out */
  costUsd?: number;
};

const DEFAULTS: PerplexityOptions = {
  apiKey: "pplx-stand-in-key",
  citations: ["https://example.com/source-1", "https://example.org/source-2"],
};

const MODEL = "openai/gpt-6-luna"; // [EFF] fast's current model

export function start(options?: Partial<PerplexityOptions>) {
  return startStandIn<PerplexityOptions>(DEFAULTS, (req, o) => {
    const rid = { "x-request-id": `standin-${req.path.length}-${Date.now()}` }; // [FAQ] header name; value format unverified
    if (bearer(req.headers) !== o.apiKey) {
      // [FAQ] status 401 for a missing or wrong key; the body shape is unverified (assumed ErrorInfo as on the 400)
      return json(401, { error: { message: "Invalid API key (stand-in)", type: "invalid_api_key", code: "401" } }, rid);
    }
    if (!(req.method === "POST" && req.path === "/v1/agent")) {
      return json(404, { error: { message: `stand-in has no route ${req.method} ${req.path}` } }, rid); // unverified
    }
    if (o.rateLimit) {
      const message = o.rateLimit === "request_rate_limit_exceeded"
        ? "Request rate limit exceeded, please try again later." // [RATE] verbatim
        : o.rateLimit === "token_rate_limit_exceeded"
          ? "Token rate limit exceeded (TPM). Retry after the Retry-After interval." // [RATE] verbatim
          : "Upstream model overloaded (stand-in)"; // [RATE] names the type; message unverified
      return json(429, { error: { message, type: o.rateLimit, code: 429 } }, { "retry-after": "7", ...rid }); // [RATE]
    }
    const b = (req.body ?? {}) as { input?: unknown; effort?: string };
    if (b.input === undefined) {
      return json(400, { error: { message: "input is required (stand-in)", type: "invalid_request_error" } }, rid); // [REF] 400 → {error: ErrorInfo}; text unverified
    }
    if (o.malformed === "not-json") return { status: 200, headers: { "content-type": "application/json", ...rid }, raw: "<html>not json</html>" };
    if (o.malformed === "no-output") return json(200, { id: "resp_standin", object: "response", status: "completed" }, rid);

    const effortName = typeof b.effort === "string" ? b.effort.split("@")[0] : undefined;
    const body: Record<string, unknown> = {
      id: `resp_standin-${Date.now()}`, // [REF] required; "resp_" prefix as in [MIG]
      object: "response", // [REF] ResponsesObjectType
      created_at: Math.floor(Date.now() / 1000), // [REF] required, unix seconds
      model: MODEL, // [REF] required
      status: o.failedRun ? "failed" : "completed", // [REF] Status enum
      output: [] as unknown[], // [REF] required
    };
    if (effortName) body.effort = `${effortName}@2026-10-16.0`; // [EFF] "name@<version>", present only when the request used an effort
    if (o.failedRun) {
      body.error = { message: "The run failed (stand-in)", type: "server_error", code: "run_failed" }; // [REF] ErrorInfo; values unverified
      return json(200, body, rid);
    }
    const output = body.output as unknown[];
    if (!o.noSources) {
      output.push({
        type: "search_results", // [REF] SearchResultsOutputItem
        queries: ["stand-in query"], // [REF] optional
        results: o.citations.map((url, i) => ({
          id: i + 1, // [REF] required; [WEB] "Stable index used to reference the result in citations"
          url, // [REF] required
          title: `Stand-in source ${i + 1}`, // [REF] required
          snippet: "Stand-in snippet.", // [REF] required
          date: "2026-11-01", // [WEB] YYYY-MM-DD
          last_updated: "2026-11-02", // [WEB]
          source: "web", // [WEB]
        })),
      });
    }
    output.push({
      type: "message", // [REF] MessageOutputItem
      id: "msg_standin", // [REF] required
      role: "assistant", // [REF] required
      status: "completed", // [REF] required
      content: [
        {
          type: "output_text", // [REF] ContentPartType
          text: o.reply ?? `Stand-in research answer to: ${typeof b.input === "string" ? b.input : JSON.stringify(b.input)}`, // [REF] required
          annotations: [], // [MIG] example shows an empty array
        },
      ],
    });
    if (o.costUsd !== undefined) {
      body.usage = {
        input_tokens: 1200, // [REF] required in ResponsesUsage; [WEB] example value
        output_tokens: 300, // [REF] required; [WEB] example value
        total_tokens: 1500, // [REF] required; [WEB] example value
        tool_calls_details: { search_web: { invocation: 1 } }, // [WEB]
        cost: { currency: "USD", input_cost: 0, output_cost: 0, total_cost: o.costUsd }, // [REF] ResponsesCost required fields; currency value unverified
      };
    }
    return json(200, body, rid);
  }, options);
}
