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
import { isPublicPath, pageGate, safeNext, SESSION_COOKIE } from "@/app/sign-in/shared";
import { AUTH2_PAGES, auth2Enabled, SwitchUnavailable } from "@/lib/auth2/config";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // The new sign-in's screens (switch on) are open to a signed-out browser; each checks its own session. With it
  // off they are treated like any other page, as before. The switch is read from PostgreSQL with a short cache
  // (src/lib/auth2/config.ts), which also keeps the root layout's copy current.
  let on: boolean;
  try {
    on = await auth2Enabled();
  } catch (e) {
    if (e instanceof SwitchUnavailable) return unavailable(e.message);
    throw e;
  }
  if (on && pathname.startsWith(`${AUTH2_PAGES}/`)) return NextResponse.next();
  // A self-hosted install with no account yet: the front door leads to "create the owner" (src/lib/auth2/firstRun.ts).
  // The answer is cached once an account exists, so this costs nothing afterwards.
  if (on && (pathname === "/" || pathname === "/welcome") && (await firstRunOpenNow())) return NextResponse.redirect(new URL(`${AUTH2_PAGES}/first-run`, request.url));
  if (on) {
    // The cut-over: every page is reached through the new sign-in's session only; the old cookie means nothing.
    const target = await newSignInPageGate(request);
    return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
  }
  const target = pageGate(pathname, search, request.cookies.has(SESSION_COOKIE));
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

/**
 * Where a page request goes while the new sign-in is on, or null to let it through. The old sign-in's pages lead to
 * the new ones; a public page (the welcome page, short links, files) is open; any other page needs a session the
 * new sign-in accepts, checked here on the server (not only a cookie being present), and a person who owes two-step
 * sign-in is sent to set it up first.
 */
async function newSignInPageGate(request: NextRequest): Promise<string | null> {
  const { pathname, search } = request.nextUrl;
  const back = encodeURIComponent(safeNext(pathname + (search ?? "")));
  if (pathname === "/sign-in" || pathname.startsWith("/sign-in/")) {
    const next = request.nextUrl.searchParams.get("next");
    return `${AUTH2_PAGES}/sign-in${next ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;
  }
  if (pathname === "/account" || pathname.startsWith("/account/")) return `${AUTH2_PAGES}/account`;
  if (isPublicPath(pathname)) return null;
  try {
    const [{ auth2Session }, { ownerPool }, { owed }] = await Promise.all([import("@/lib/auth2/server"), import("@/lib/db"), import("@/lib/auth2/workspaces/twoFactor")]);
    const s = await auth2Session(request.headers);
    if (!s) return pathname === "/" ? "/welcome" : `${AUTH2_PAGES}/sign-in?next=${back}`;
    if (await owed(ownerPool(), s.user.id)) return `${AUTH2_PAGES}/two-factor/setup`;
    return null;
  } catch {
    // Fails closed: anything that goes wrong reading the session is treated as signed out.
    return `${AUTH2_PAGES}/sign-in?next=${back}`;
  }
}

/** A plain page for "the sign-in switch cannot be read yet" (cut-over review B2): never the old sign-in instead. */
function unavailable(message: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Temporarily unavailable</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>Temporarily unavailable</h1><p>${message}</p></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30", "cache-control": "no-store" } });
}

async function firstRunOpenNow(): Promise<boolean> {
  try {
    const [{ ownerPool, ready }, { firstRunOpen }] = await Promise.all([import("@/lib/db"), import("@/lib/auth2/firstRun")]);
    await ready();
    return await firstRunOpen(ownerPool());
  } catch {
    return false;
  }
}

export const config = {
  // Static build output, the favicon and the API never reach the proxy; pageGate() lets through the sign-in
  // page and files from public/. The API is left out because the proxy buffers every request body it sees
  // (and cuts it at proxyClientMaxBodySize), while route() checks each API body's size itself before reading
  // it and answers 413 (robustness review S8). pageGate() still lets /api through for any caller.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
