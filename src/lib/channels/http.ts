// Outbound calls for the channel connections (Amazon, X, Instagram): one place for the time limit,
// the addresses (overridable by environment for the stand-ins in tests/standins), and for turning a
// failed answer into a sentence that never contains a key or token.
import { HttpError } from "@/lib/api/route";
import { scrub } from "@/lib/secrets/scrub";

const env = (name: string) => process.env[name]?.trim().replace(/\/+$/, "") || null;

/** Login with Amazon token endpoint. https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api */
export const lwaTokenUrl = () => env("AMAZON_LWA_TOKEN_URL") ?? "https://api.amazon.com/auth/o2/token";

/** SP-API regional endpoints. https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints */
const SP_REGION_HOST = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
} as const;
export type SpRegion = keyof typeof SP_REGION_HOST;
export const spApiBase = (region: SpRegion) => env("AMAZON_SP_BASE_URL") ?? SP_REGION_HOST[region];

/** X API v2 host. https://docs.x.com/x-api/posts/create-post */
export const xApiBase = () => env("X_API_BASE_URL") ?? "https://api.x.com";
/** OAuth 2.0 authorize page. https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code */
export const xAuthorizeUrl = () => env("X_AUTHORIZE_URL") ?? "https://x.com/i/oauth2/authorize";

/**
 * Instagram API with Instagram Login host and version. v27.0 is the version in Meta's examples on
 * https://developers.facebook.com/documentation/instagram-platform/content-publishing (read 21 Nov 2026).
 */
export const igGraphBase = () => env("INSTAGRAM_GRAPH_BASE_URL") ?? "https://graph.instagram.com/v27.0";

const CALL_LIMIT_MS = 30_000;

export class ChannelError extends HttpError {
  /** true when the call may have reached the service before it failed (a time-out, a dropped connection) */
  unknownOutcome = false;
}

/** A fetch with a time limit; network failures become a 502 or 504 with a cleaned sentence. */
export async function channelFetch(service: string, url: string, init: RequestInit, secrets: (string | null | undefined)[], ms = CALL_LIMIT_MS): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: "manual", signal: init.signal ?? AbortSignal.timeout(ms) });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      const t = new ChannelError(504, `${service} did not answer within ${Math.round(ms / 1000)} seconds.`);
      t.unknownOutcome = true; // the request may have been received and acted on
      throw t;
    }
    const code = err?.cause?.code;
    const why = scrub(code ?? err?.cause?.message ?? err?.message ?? String(e), secrets).slice(0, 200);
    const f = new ChannelError(502, `${service} could not be reached (${why}).`);
    // refused or not found: nothing was sent; anything else (a reset mid-request) may have been received
    f.unknownOutcome = !(code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN");
    throw f;
  }
}

/** What a failed answer says, cleaned of every secret, at most 300 characters. */
export async function saysOf(res: Response, secrets: (string | null | undefined)[]): Promise<string> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return "";
  }
  let said = text;
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const e = j.error as { message?: unknown } | string | undefined;
    const errors = j.errors as { message?: unknown; detail?: unknown }[] | undefined;
    said =
      typeof e === "string"
        ? `${e}${typeof j.error_description === "string" ? `: ${j.error_description}` : ""}`
        : typeof e?.message === "string"
          ? e.message
          : Array.isArray(errors) && errors[0]
            ? String(errors[0].message ?? errors[0].detail ?? "")
            : typeof j.detail === "string"
              ? j.detail
              : typeof j.title === "string"
                ? j.title
                : text;
  } catch {
    // not JSON
  }
  return scrub(said, secrets).replace(/\s+/g, " ").trim().slice(0, 300);
}

export async function readJson<T>(res: Response): Promise<T | undefined> {
  try {
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

/** A 4xx or 5xx from a service as an HttpError the route wrapper answers with. */
export async function upstreamError(service: string, res: Response, secrets: (string | null | undefined)[]): Promise<ChannelError> {
  const says = await saysOf(res, secrets);
  const tail = says ? ` ${service} said: ${says}${/[.!?]$/.test(says) ? "" : "."}` : "";
  if (res.status === 401 || res.status === 403) return new ChannelError(502, `${service} refused the saved credentials (HTTP ${res.status}).${tail}`);
  if (res.status === 429) return new ChannelError(429, `${service} is limiting how fast this account can call it (HTTP 429). Try again later.${tail}`);
  return new ChannelError(502, `${service} answered HTTP ${res.status}.${tail}`);
}
