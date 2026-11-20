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

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const target = pageGate(pathname, search, request.cookies.has(SESSION_COOKIE));
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  // Static build output and the favicon never reach the proxy. Everything else does, and
  // pageGate() lets through the sign-in page, the API and files from public/.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
