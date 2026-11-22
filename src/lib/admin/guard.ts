// Who may use the platform admin area (/admin and /api/admin/*). Decided only here.
//
//  - Any signed-in account opens the area, reads it, and changes everything that existed before the platform admin
//    area (models, existing provider keys, planner and slicer addresses, default concept, printers, the old tests),
//    exactly as before (owner decision D2). docs/guide/admin.md lists those under "What any signed-in account can
//    change until the new sign-in is on".
//  - Everything not listed OPEN in GUARD_LISTS needs the platform administrator, who exists only in the new
//    sign-in (platformAdminFromAuth2 in ./platformAdminHook.ts). Under the old sign-in nobody has them: no password
//    change, default or not, opens them.
//  - Reads of the new powers by anyone else say only configured or not configured (./credentials.ts, ./settings.ts,
//    ./overview.ts).
import { HttpError, route, sessionOf, type RouteOptions } from "@/lib/api/route";
import { platformAdminFromAuth2 } from "./platformAdminHook";

/**
 * An allow-list (review S5 of the admin area): what existed before the platform admin area is OPEN to any signed-in
 * account, as before; everything else, including anything added later, needs the platform administrator. Each
 * provider, settings key and test kind the app knows is placed in exactly one of the two lists below;
 * tests/admin/guardLists.test.ts fails while one is in neither.
 */
export const GUARD_LISTS = {
  open: {
    /** credentials providers (src/lib/settings.ts PROVIDERS) */
    providers: ["ollama", "lmstudio", "openrouter", "perplexity", "amazon-sp", "x", "instagram"],
    /** keys of PUT /api/admin/settings (src/lib/admin/schemas.ts adminSettingsPut) */
    settings: ["reasoningModel", "embeddingModel", "plannerUrl", "slicerUrl", "defaultConcept", "confirmEmbedding"],
    /** kinds of POST /api/admin/test (src/lib/admin/schemas.ts connectionTest) */
    tests: ["model", "embedding", "perplexity", "printer", "planner", "amazon-sp", "x", "instagram", "slicer", "database"],
  },
  platformAdmin: {
    providers: ["stripe", "smtp", "kokoro", "voice"],
    settings: ["mail", "voice"],
    tests: ["stripe", "smtp", "mail-message", "voice"],
  },
} as const;

const OPEN = {
  providers: new Set<string>(GUARD_LISTS.open.providers),
  settings: new Set<string>(GUARD_LISTS.open.settings),
  tests: new Set<string>(GUARD_LISTS.open.tests),
};
/** Subjects of the credentials short list that are not providers (src/lib/admin/audit.ts). */
const OPEN_AUDIT_SUBJECTS = new Set(["planner", "slicer", "database"]);

export const PLATFORM_ADMIN_NOTICE = "These settings are changed by the platform administrator. That account is created when the new sign-in is switched on.";

/** Does this provider, settings key or test kind need the platform administrator? Anything not listed open does. */
export const platformAdminOnly = {
  provider: (id: string) => !OPEN.providers.has(id),
  setting: (key: string) => !OPEN.settings.has(key),
  test: (kind: string) => !OPEN.tests.has(kind),
  /** a subject of the credentials short list: a provider, "printer:<family>", the planner, the slicer or the database (S6) */
  auditSubject: (subject: string) => !(OPEN.providers.has(subject) || OPEN_AUDIT_SUBJECTS.has(subject) || subject.startsWith("printer:")),
};

/**
 * The platform administrator: only through the new sign-in. route() has already decided who is signed in: with the
 * new sign-in on that is its session (an old demo session is not accepted there, src/lib/api/route.ts), with it off
 * the old one, under which nobody is the platform administrator.
 */
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
