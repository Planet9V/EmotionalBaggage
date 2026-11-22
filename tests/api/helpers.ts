/**
 * Route handlers are called directly with real Request objects against a real PostgreSQL.
 *
 * Every API route requires a signed-in session (src/lib/api/route.ts). The setup file
 * tests/auth/session.setup.ts signs the `demo` user in once per test file, for real, and hands
 * the token to setTestSession(); json() and form() then carry its cookie plus an Origin and Host
 * that match the URL, as a browser on this site would. anonymous() builds the same request with
 * no cookie.
 */
import { SESSION_COOKIE } from "@/app/sign-in/shared";

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let sessionToken = "";

/** Called by the setup file; tests do not need it. */
export function setTestSession(token: string) {
  sessionToken = token;
}

/** The cookie header json() and form() send, for tests that build their own headers. */
export function sessionCookieHeader() {
  return sessionToken ? `${SESSION_COOKIE}=${sessionToken}` : "";
}

function headersFor(url: string, extra: Record<string, string>, signedIn: boolean) {
  const u = new URL(url);
  const h: Record<string, string> = { origin: u.origin, host: u.host, ...extra };
  if (signedIn && sessionToken) h.cookie = sessionCookieHeader();
  return h;
}

function encode(payload: unknown) {
  return payload === undefined ? undefined : typeof payload === "string" ? payload : JSON.stringify(payload);
}

/** A signed-in JSON request (string payloads are sent as they are, for "not JSON" tests). */
export function json(method: string, payload?: unknown, url = "http://test.local/api") {
  return new Request(url, { method, headers: headersFor(url, { "content-type": "application/json" }, true), body: encode(payload) });
}

/** The same request as json() with no session cookie. */
export function anonymous(method: string, payload?: unknown, url = "http://test.local/api") {
  return new Request(url, { method, headers: headersFor(url, { "content-type": "application/json" }, false), body: encode(payload) });
}

/** A signed-in multipart request. The content type (with its boundary) comes from the FormData. */
export function form(method: string, data: FormData, url = "http://test.local/api") {
  return new Request(url, { method, headers: headersFor(url, {}, true), body: data });
}

export async function read<T = Record<string, unknown>>(res: Response) {
  return { status: res.status, body: (await res.json()) as T };
}

export const SEEDED = "baggage-claims";

