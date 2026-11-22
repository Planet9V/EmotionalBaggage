// Who may open the platform admin area (/admin and /api/admin/*): ONE check, here, so the new sign-in can map it
// to its platform-admin flag in one place (isPlatformAdmin below is the only line that decides).
//
// Today (the old sign-in, src/lib/auth.ts) an install has one kind of account and every signed-in account is its
// administrator. That rule is unchanged here.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/app/sign-in/shared";
import { sessionFromToken, type Session } from "@/lib/auth";
import { HttpError, route, sessionOf, type RouteOptions } from "@/lib/api/route";

const NOT_PLATFORM_ADMIN = "Only the application's administrator can open the admin area. Sign in with the administrator's account.";

/** The decision itself. The new sign-in replaces this body with its platform-admin flag. */
function isPlatformAdmin(s: Session): boolean {
  return s.userId > 0;
}

/**
 * For a route handler wrapped in route() (which has already answered 401 without a session): the session when it
 * belongs to the platform administrator, else a 403.
 */
function requirePlatformAdmin(req: Request): Session {
  const s = sessionOf(req);
  if (!isPlatformAdmin(s)) throw new HttpError(403, NOT_PLATFORM_ADMIN);
  return s;
}

/** route() plus requirePlatformAdmin: every /api/admin handler is wrapped in this. */
export function adminRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>, opts?: RouteOptions) {
  return route(async (...args: A) => {
    requirePlatformAdmin((args as unknown[])[0] as Request);
    return handler(...args);
  }, opts);
}

/** For the /admin page (a server component): "admin", "signed-out" or "refused". Reads the session cookie. */
export async function platformAdminPage(): Promise<"admin" | "signed-out" | "refused"> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = token ? await sessionFromToken(token) : null;
  if (!s) return "signed-out";
  return isPlatformAdmin(s) ? "admin" : "refused";
}
