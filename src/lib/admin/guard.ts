// Who may use the platform admin area (/admin and /api/admin/*). Decided only here.
//
//  - Any signed-in account opens the area, reads it, and changes everything that existed before the platform admin
//    area (models, existing provider keys, planner and slicer addresses, default concept, printers, the old tests),
//    exactly as before (owner decision D2). docs/guide/admin.md lists those under "What any signed-in account can
//    change until the new sign-in is on".
//  - The NEW powers listed in PLATFORM_ADMIN_ONLY need the platform administrator, who exists only in the new
//    sign-in (platformAdminFromAuth2 in ./platformAdminHook.ts). Under the old sign-in nobody has them: no password
//    change, default or not, opens them.
//  - Reads of the new powers by anyone else say only configured or not configured (./credentials.ts, ./settings.ts,
//    ./overview.ts).
import { HttpError, route, sessionOf, type RouteOptions } from "@/lib/api/route";
import { platformAdminFromAuth2 } from "./platformAdminHook";

/** The new powers: every provider, settings key and test kind this area added. Everything else is open as before. */
const PLATFORM_ADMIN_ONLY = {
  /** credentials providers (src/lib/admin/providers.ts) */
  providers: new Set<string>(["stripe", "smtp", "kokoro"]),
  /** keys of PUT /api/admin/settings */
  settings: new Set<string>(["mail", "voice"]),
  /** kinds of POST /api/admin/test */
  tests: new Set<string>(["stripe", "smtp", "mail-message", "voice"]),
};

export const PLATFORM_ADMIN_NOTICE = "These settings are changed by the platform administrator. That account is created when the new sign-in is switched on.";

/** Is this provider, settings key or test kind one of the new powers? */
export const platformAdminOnly = {
  provider: (id: string) => PLATFORM_ADMIN_ONLY.providers.has(id),
  setting: (key: string) => PLATFORM_ADMIN_ONLY.settings.has(key),
  test: (kind: string) => PLATFORM_ADMIN_ONLY.tests.has(kind),
};

/** The platform administrator: only through the new sign-in. */
export async function isPlatformAdmin(req: Request): Promise<boolean> {
  sessionOf(req); // signed in first (route() has answered 401 otherwise)
  return platformAdminFromAuth2(req);
}

/** A 403 with the plain sentence unless the caller is the platform administrator. */
export async function requirePlatformAdmin(req: Request): Promise<void> {
  if (!(await isPlatformAdmin(req))) throw new HttpError(403, PLATFORM_ADMIN_NOTICE);
}

/** What the screens need, per capability. */
export async function adminAccess(req: Request) {
  const admin = await isPlatformAdmin(req);
  return { platformAdmin: admin, capabilities: { plans: admin, payments: admin, email: admin, voice: admin }, notice: admin ? null : PLATFORM_ADMIN_NOTICE };
}

/**
 * route() for /api/admin: a signed-in session (any account, as before). `platformAdmin: true` for a route that is a new
 * power as a whole (the plan catalogue, the voice-overs tool: generating, accepting and discarding takes and choosing
 * the cast); the shared settings, credentials and test routes decide per key inside.
 */
export function adminRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>, opts?: RouteOptions & { platformAdmin?: boolean }) {
  return route(async (...args: A) => {
    const req = (args as unknown[])[0] as Request;
    sessionOf(req);
    if (opts?.platformAdmin) await requirePlatformAdmin(req);
    return handler(...args);
  }, opts);
}
