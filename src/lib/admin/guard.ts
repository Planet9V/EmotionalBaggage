// Who may use the platform admin area (/admin and /api/admin/*). Two levels, decided only here:
//
//  - canViewAdmin: open the area and read every section. Under the old sign-in (src/lib/auth.ts) that is any
//    signed-in account, as before.
//  - isPlatformAdmin: change a setting or key, and run the tests of the new sections that send a saved secret to an
//    outside service. Under the old sign-in only an account that no longer uses the published default password
//    (Session.usingDefaultPassword, the rule behind "Change the default password"): the public demo signs in as
//    demo / demo, and must not be able to change the prices on the public page or enter payment keys.
//    Under the new sign-in (AUTH2) it is platformAdminFromAuth2(), which refuses until accounts slice 2 maps it.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/app/sign-in/shared";
import { sessionFromToken, type Session } from "@/lib/auth";
import { auth2Enabled } from "@/lib/auth2/config";
import { HttpError, route, sessionOf, type RouteOptions } from "@/lib/api/route";

const NOT_VIEWER = "Only the application's administrator can open the admin area. Sign in with the administrator's account.";
export const DEMO_REFUSED = "Change the default password before changing settings: this account is the public demo account.";
const AUTH2_REFUSED = "Settings cannot be changed yet with the new sign-in: its platform administrator role is not connected to Admin.";

/** Open the area and read it. */
function canViewAdmin(s: Session): boolean {
  return s.userId > 0;
}

/**
 * HOOK for the new sign-in. TODO(accounts slice 2): answer from its `requirePlatformAdmin` (the platform-admin flag
 * of the signed-in Better Auth user). Until then it is false, so nothing is open by accident while AUTH2 is on.
 */
function platformAdminFromAuth2(s: Session): boolean {
  void s;
  return false;
}

/** Change settings and keys, and run the tests that send a saved secret outward. */
function isPlatformAdmin(s: Session): boolean {
  if (!canViewAdmin(s)) return false;
  if (auth2Enabled()) return platformAdminFromAuth2(s);
  return !s.usingDefaultPassword;
}

/** Why this session may not change settings, or null when it may. The sentence the 403 and the screens show. */
function writeRefusal(s: Session): string | null {
  if (isPlatformAdmin(s)) return null;
  return auth2Enabled() ? AUTH2_REFUSED : DEMO_REFUSED;
}

/** For a handler inside adminRoute(): a 403 with the plain sentence unless this session may change settings. */
export function requirePlatformAdmin(req: Request): Session {
  const s = sessionOf(req);
  const why = writeRefusal(s);
  if (why) throw new HttpError(403, why);
  return s;
}

/** What the screens need: may this session change settings, and if not, why. */
export function adminAccess(req: Request): { canWrite: boolean; reason: string | null } {
  const why = writeRefusal(sessionOf(req));
  return { canWrite: !why, reason: why };
}

/**
 * route() plus the admin check: every /api/admin handler is wrapped in this. Reads need canViewAdmin; a route that
 * changes settings or keys passes { write: true } and needs isPlatformAdmin.
 */
export function adminRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>, opts?: RouteOptions & { write?: boolean }) {
  return route(async (...args: A) => {
    const req = (args as unknown[])[0] as Request;
    if (!canViewAdmin(sessionOf(req))) throw new HttpError(403, NOT_VIEWER);
    if (opts?.write) requirePlatformAdmin(req);
    return handler(...args);
  }, opts);
}

/** For the /admin page (a server component): "admin", "signed-out" or "refused". Reads the session cookie. */
export async function platformAdminPage(): Promise<"admin" | "signed-out" | "refused"> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = token ? await sessionFromToken(token) : null;
  if (!s) return "signed-out";
  return canViewAdmin(s) ? "admin" : "refused";
}
