# Perplexity API: what the research client is built on

Read from Perplexity's own documentation on **20 November 2026**. Every fact below names the page it
was read from. Nothing here was confirmed against the live service: there is no key in development
and tests never reach the internet. Pages were fetched as Markdown (the `.md` form of each docs URL,
which serves the same text as the HTML page).

## Short answer

- The earlier report is **confirmed**. The page for `POST /v1/sonar` now redirects (HTTP 308) to
  "Migrate from Sonar to the Agent API", which says: "Sonar Chat Completions support ended on
  September 27, 2026. Synchronous and streaming requests keep working: they are being reformulated
  as Agent API requests, rolling out gradually by model. Asynchronous Sonar requests are not
  reformulated and are no longer supported."
  Read from: https://docs.perplexity.ai/api-reference/sonar-post (redirect target
  https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview)
- One correction to the report: the old interface has **not** stopped answering, according to the
  same page. Support ended; synchronous calls still work by being translated. No end date for that
  translation is given anywhere I read.
- The current interface is the Agent API, `POST https://api.perplexity.ai/v1/agent`.
  Read from: https://docs.perplexity.ai/api-reference/agent-post

## Endpoint and authentication

| Fact | Read from |
|---|---|
| `POST /v1/agent`, server `https://api.perplexity.ai` | https://docs.perplexity.ai/api-reference/agent-post |
| `POST /v1/responses` is accepted as an alias; the canonical endpoint is `/v1/agent` | https://docs.perplexity.ai/docs/getting-started/quickstart |
| Authentication: HTTP bearer (`Authorization: Bearer <key>`); `Content-Type: application/json` | https://docs.perplexity.ai/api-reference/agent-post (security scheme `HTTPBearer`), cURL examples on https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview |
| The Agent API follows the OpenAI Responses format | https://docs.perplexity.ai/docs/getting-started/quickstart |

## Request

Only `input` is required. Fields this app uses:

| Field | Meaning | Read from |
|---|---|---|
| `input` | A string, or an array of input items | https://docs.perplexity.ai/api-reference/agent-post |
| `effort` | `name`, `name@latest` or `name@<version>`; a pre-configured model, system prompt and search parameters. Required if `model` is not given | https://docs.perplexity.ai/api-reference/agent-post |
| `instructions` | System instructions; replaces Sonar's `system` message | https://docs.perplexity.ai/api-reference/agent-post, https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to |
| `tools: [{ "type": "web_search" }]` | Perplexity's web search tool | https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to |

The exact request the app sends is the one the migration guide gives for numbered inline citations
(section "Inline citations"): `effort`, `instructions` (the guide's citation text, with one sentence
of ours added asking it to say when sources disagree), `input`, and `tools: [{ "type": "web_search" }]`.
Read from: https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to

## Response

| Fact | Read from |
|---|---|
| Required top-level fields: `id`, `object` (`"response"`), `created_at`, `status`, `model`, `output`; optional `error`, `usage`, `effort` | https://docs.perplexity.ai/api-reference/agent-post (schema `ResponsesResponse`) |
| `status` is one of `completed`, `failed`, `incomplete`, `in_progress`, `queued`, `cancelled` | https://docs.perplexity.ai/api-reference/agent-post (schema `Status`) |
| **Answer text**: items in `output` with `type: "message"`, then their `content` entries with `type: "output_text"`, field `text` | https://docs.perplexity.ai/docs/agent-api/quickstart ("Without an SDK, read the answer from the `output` array ..."), schemas `MessageOutputItem`, `ContentPart` on https://docs.perplexity.ai/api-reference/agent-post |
| `response.output_text` is a convenience property of the Python and TypeScript SDKs, not a field of the HTTP response schema | https://docs.perplexity.ai/docs/agent-api/quickstart; the field is absent from `ResponsesResponse` on https://docs.perplexity.ai/api-reference/agent-post |
| **Sources**: an `output` item with `type: "search_results"`, field `results`; each result has `id` (integer, required), `url` (required), `title` (required), `snippet` (required), `date`, `last_updated`, `source` | https://docs.perplexity.ai/api-reference/agent-post (schemas `SearchResultsOutputItem`, `SearchResult`), https://docs.perplexity.ai/docs/agent-api/tools/web-search ("Response Shape") |
| A `search_results` item may also carry `queries` (strings) | https://docs.perplexity.ai/api-reference/agent-post |
| Inline `[n]` markers are in the answer text; each maps to the result whose `id` is `n`. "Treat the `id` and `url` fields of each `search_results` entry as the source of truth for citations." | https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to, https://docs.perplexity.ai/docs/agent-api/tools/web-search |
| `fast` uses numbered markers like `[1]`; `low`, `medium`, `high` use `[web:1]` | https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to |
| A `content` entry may carry `annotations` (`url_citation`, with `url`, `title`, `start_index`, `end_index`) | https://docs.perplexity.ai/api-reference/agent-post (schema `Annotation`) |
| The response's `effort` holds the effort and version that ran, for example `fast@2026-10-16.0` | https://docs.perplexity.ai/docs/agent-api/effort |

Example from the migration page (abridged by Perplexity themselves with `// ...`):

```json
{
  "id": "resp_18690c07-...", "created_at": 1784292159, "model": "openai/gpt-5.6-luna", "object": "response",
  "output": [
    { "type": "search_results", "results": [ { "id": 1, "snippet": "...", "title": "State of AI Agents 2026: ...", "url": "https://www.prosus.com/...", "date": "2026-02-26", "last_updated": "2026-07-12", "source": "web" } ] },
    { "type": "message", "id": "msg_...", "role": "assistant", "status": "completed",
      "content": [ { "type": "output_text", "text": "... enterprise controls**[1][3] ...", "annotations": [] } ] }
  ],
  "status": "completed"
}
```

Read from: https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview

## Effort levels (the "model" setting)

| Fact | Read from |
|---|---|
| Effort levels: `fast`, `low`, `medium`, `high`, `xhigh` (migration page); the effort page adds `ultra` | https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview, https://docs.perplexity.ai/docs/agent-api/effort |
| Sonar → effort mapping: `sonar` → `fast`, `sonar-pro` → `fast`, `sonar-reasoning-pro` → `low`, `sonar-deep-research` → `high` | https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview |
| `fast` today: models `openai/gpt-6-luna` with fallback `openai/gpt-5.6-luna`, max steps 1, service tier `priority`, tool `web_search` with `search_type: "fast"`, `max_results: 10` | https://docs.perplexity.ai/docs/agent-api/effort ("Current effort level values") |
| Calling an effort level by name follows Perplexity's updates; a version pins it | https://docs.perplexity.ai/docs/agent-api/effort |
| `fast` enables web search by default | https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to |
| `preset` was renamed `effort` in October 2026; `preset` is a deprecated alias | https://docs.perplexity.ai/docs/resources/changelog |

**Default chosen: `fast`.** It is the documented replacement for `sonar-pro`, which this app used,
it numbers its citations the way the screen expects, and it is the cheapest search setting.
Stored as setting `research.model`; any effort name or `name@version` can be saved there instead.

## Errors and limits

| Fact | Read from |
|---|---|
| A 400 answers `{ "error": { "message", "type"?, "code"? } }` (schema `ErrorInfo`, only `message` required). An unresolvable `previous_response_id` is a 400 | https://docs.perplexity.ai/api-reference/agent-post |
| A failed response can carry `error` (same `ErrorInfo`) inside a 200 body with `status: "failed"` | https://docs.perplexity.ai/api-reference/agent-post (`ResponsesResponse.error`) |
| Status codes: 400 bad request, 401 authentication, 403 permission denied, 404, 429 rate limit, 500+ server error | https://docs.perplexity.ai/docs/sdk/error-handling |
| A 401 means the key is missing, wrong or deleted; an account out of credits "can return `402 Payment Required` instead" | https://docs.perplexity.ai/docs/resources/faq |
| 429 bodies: `{"error":{"message":"Request rate limit exceeded, please try again later.","type":"request_rate_limit_exceeded","code":429}}`; token limits use `type: "token_rate_limit_exceeded"`; `overloaded` is upstream capacity, not a rate limit. A 429 carries `Retry-After` and no `x-ratelimit-*` headers | https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers |
| Requests rejected with a 429 are not billed (stated for the Orchestrator API) | https://docs.perplexity.ai/docs/getting-started/pricing, https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers |
| Log the `X-Request-ID` response header when contacting support | https://docs.perplexity.ai/docs/resources/faq |

## Cost a user should see before asking

| Fact | Read from |
|---|---|
| The Agent API bills per token at the model's rates, plus tool fees. There is no fixed per-request price | https://docs.perplexity.ai/docs/getting-started/pricing |
| `web_search` costs $0.0025 per invocation (standard) or $0.001 per invocation with `search_type: "fast"` | https://docs.perplexity.ai/docs/getting-started/pricing, https://docs.perplexity.ai/docs/agent-api/tools/web-search |
| `openai/gpt-6-luna`: $0.10 per million input tokens and $0.50 per million output tokens (up to 272k); `priority` doubles token rates for models that list it, which this one does | https://docs.perplexity.ai/docs/agent-api/models |
| `usage.cost.total_cost` (USD) in the response "reports an estimate"; charged amounts are in the API Console | https://docs.perplexity.ai/docs/getting-started/pricing, schema `ResponsesCost` on https://docs.perplexity.ai/api-reference/agent-post |

What the screen says before asking: each question is billed to the Perplexity account by tokens plus
a fee per web search, and Perplexity reports an estimate after the answer. The app shows that
estimate when the response carries it; it does not invent a figure in advance.

## Unverified

- **No live call.** Nothing here was checked against `api.perplexity.ai`.
- **How long `/v1/sonar` keeps answering.** The migration page says synchronous requests "keep
  working" while being reformulated; it gives no end date.
- **The body of a 401, 402, 403 or 5xx answer.** Only the 400 body (`ErrorInfo`) and the 429 bodies
  are documented. The client assumes the same `{ "error": { "message" } }` shape and copes when it
  is absent.
- **Whether one response can hold several `search_results` items with overlapping `id`s.** Every
  example shows one item with ids from 1. The client keeps the first URL seen for each id.
- **Whether `[web:n]` markers (efforts `low` and above) map to result `id` `n`.** Implied by the
  migration guide, not stated. The client's instructions ask for plain `[n]` markers, as the guide
  recommends.
- **Billing when the request adds `tools: [{ "type": "web_search" }]` to `fast`, which already
  searches with `search_type: "fast"`.** The guide's own example does this; whether the explicit
  tool bills as standard ($0.0025) or Fast Search ($0.001) is not stated.
- **Whether `fast` with replaced `instructions` still always searches.** The guide presents this
  exact request as the way to get numbered citations; the effort level's own prompt (which insists
  on searching) is replaced by ours.
- **Latency.** No page gives a typical or maximum duration. The client stops waiting after 60 s.
- **The effort list.** The effort page lists `ultra`; the changelog says the undocumented `ultra`
  name was removed and `ultra-preview` added. The migration page lists five levels. The app's
  default (`fast`) is on every list.
- **Whether the HTTP JSON includes a top-level `output_text`.** It is not in the schema; the client
  reads the `output` array and uses a top-level `output_text` only if the array has no text.

## Pages read

- https://docs.perplexity.ai/api-reference/sonar-post (308 to the migration overview)
- https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview
- https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to
- https://docs.perplexity.ai/api-reference/agent-post
- https://docs.perplexity.ai/docs/agent-api/quickstart
- https://docs.perplexity.ai/docs/getting-started/quickstart
- https://docs.perplexity.ai/docs/agent-api/effort
- https://docs.perplexity.ai/docs/agent-api/models
- https://docs.perplexity.ai/docs/agent-api/tools/web-search
- https://docs.perplexity.ai/docs/getting-started/pricing
- https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers
- https://docs.perplexity.ai/docs/sdk/error-handling
- https://docs.perplexity.ai/docs/resources/faq
- https://docs.perplexity.ai/docs/resources/changelog
