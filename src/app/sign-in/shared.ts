/**
 * Small rules shared by the proxy (src/proxy.ts), the sign-in page and the server.
 * Nothing here touches the database or node:crypto, so the browser and the proxy can import it.
 */

/** The cookie that carries the session token. */
export const SESSION_COOKIE = "c2r_session";

const SIGN_IN_PATH = "/sign-in";
/** The public page about the workbench. A signed-out visit to `/` lands here instead of the sign-in form. */
const WELCOME_PATH = "/welcome";

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

/**
 * The folders in public/ (tests/auth/proxy.test.ts fails while public/ has a folder this list does not name). Only a
 * file inside one of them is static; any other path with a dot in it is a page and is checked (cut-over review N1).
 */
export const PUBLIC_FOLDERS = ["landing", "vendor"] as const;
/** Files the app serves at the top level (src/app/favicon.ico; robots.txt and sitemap.xml if they are ever added). */
const PUBLIC_FILES = new Set(["/favicon.ico", "/robots.txt", "/sitemap.xml"]);
const FILE_NAME = /^[^/]+\.[A-Za-z0-9]{1,8}$/;

/** Paths a signed-out browser may open: the sign-in page, the welcome page, the API (route() answers 401 itself), short tracked links and static files. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === SIGN_IN_PATH || pathname.startsWith(`${SIGN_IN_PATH}/`)) return true;
  // the welcome page and its early-access confirmation page (/welcome/early)
  if (pathname === WELCOME_PATH || pathname.startsWith(`${WELCOME_PATH}/`)) return true;
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  // Next.js's build output and image optimiser; in development also its hot reload and error overlay
  if (pathname.startsWith("/_next/static/") || pathname === "/_next/image" || pathname.startsWith("/_next/image/")) return true;
  if (process.env.NODE_ENV === "development" && (pathname.startsWith("/_next/") || pathname.startsWith("/__nextjs"))) return true;
  // Short tracked links (src/app/l/[code]/route.ts): a visitor to a campaign link has no session.
  // The handler redirects only to a destination a signed-in user saved, and stores no personal data.
  if (pathname.startsWith("/l/") && !pathname.slice(3).includes("/") && pathname.length > 3) return true;
  if (PUBLIC_FILES.has(pathname)) return true;
  // Files from public/: a file name with an extension inside one of its folders, nothing else.
  const parts = pathname.split("/");
  if (parts.length >= 3 && (PUBLIC_FOLDERS as readonly string[]).includes(parts[1]) && FILE_NAME.test(parts[parts.length - 1]) && !parts.includes("..")) return true;
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
  // The bare address is the front door: a visitor with no session sees what the workbench is first.
  if (pathname === "/") return WELCOME_PATH;
  const back = safeNext(pathname + (search ?? ""));
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(back)}`;
}
