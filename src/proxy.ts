/**
 * Sends a signed-out browser to the sign-in page before a page renders.
 *
 * Next.js 16 calls this file `proxy.ts` (it was `middleware.ts`); in a project with a `src` folder
 * it sits in `src/`, next to `app/` (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * It runs on the Node.js runtime by default. As the docs advise, it makes only an optimistic check:
 * is the session cookie present? It never reads the database. The real check is in route()
 * (src/lib/api/route.ts), which every API handler goes through, so a forged or stale cookie gets
 * past this redirect but not past the API.
 */
import { NextResponse, type NextRequest } from "next/server";
import { pageGate, SESSION_COOKIE } from "@/app/sign-in/shared";
import { AUTH2_PAGES, auth2Enabled } from "@/lib/auth2/config";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // The new sign-in's screens (AUTH2 on) are open to a signed-out browser; each checks its own session. With AUTH2
  // off they are treated like any other page, as before.
  if (auth2Enabled() && pathname.startsWith(`${AUTH2_PAGES}/`)) return NextResponse.next();
  const target = pageGate(pathname, search, request.cookies.has(SESSION_COOKIE));
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  // Static build output, the favicon and the API never reach the proxy; pageGate() lets through the sign-in
  // page and files from public/. The API is left out because the proxy buffers every request body it sees
  // (and cuts it at proxyClientMaxBodySize), while route() checks each API body's size itself before reading
  // it and answers 413 (robustness review S8). pageGate() still lets /api through for any caller.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
