/**
 * Small rules shared by the proxy (src/proxy.ts), the sign-in page and the server.
 * Nothing here touches the database or node:crypto, so the browser and the proxy can import it.
 */

/** The cookie that carries the session token. */
export const SESSION_COOKIE = "c2r_session";

export const SIGN_IN_PATH = "/sign-in";

/**
 * Where to go after signing in, from the `next` parameter. Only a path on this site is accepted:
 * one leading `/`, not `//` (a protocol-relative address on another host), no backslash (browsers
 * read `/\evil.example` as `//evil.example`), no control characters, and not the sign-in page
 * itself. Anything else answers `/`.
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2000) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";
  try {
    // Resolving against a fixed base must land on that same base, or the path was not local.
    const u = new URL(next, "http://same.invalid");
    if (u.origin !== "http://same.invalid") return "/";
    if (u.pathname === SIGN_IN_PATH || u.pathname.startsWith(`${SIGN_IN_PATH}/`)) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

/** Paths a signed-out browser may open: the sign-in page, the API (route() answers 401 itself) and static files. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`)) return true;
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
  // Files from public/ (images, fonts, models): a last path segment with an extension.
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (/^[^/]+\.[A-Za-z0-9]{1,8}$/.test(last)) return true;
  return false;
}

/**
 * The proxy's decision for one request: the address to redirect to, or null to let it through.
 * This only looks at whether the cookie is present; whether the session is real is checked by
 * route() in src/lib/api/route.ts on every API call (the Next.js docs say not to rely on the proxy
 * for the real check). A page that loads with a stale cookie then gets 401 from its first API
 * call, and src/lib/http.ts sends the browser here.
 */
export function pageGate(pathname: string, search: string, hasSessionCookie: boolean): string | null {
  if (hasSessionCookie || isPublicPath(pathname)) return null;
  const back = safeNext(pathname + (search ?? ""));
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(back)}`;
}
