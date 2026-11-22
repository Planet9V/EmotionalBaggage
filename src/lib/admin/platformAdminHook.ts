// Is the caller the platform administrator? The platform administrator exists only in the new sign-in; with it off
// nobody is, so this answers false and the new powers of Admin stay closed. This is the only place that decides;
// src/lib/admin/guard.ts calls nothing else.
//
// Rules (second review of the admin area): only the new sign-in's own session counts, validated by Better Auth on
// the server for this request (src/lib/auth2/platformAdmin.ts requirePlatformAdmin); never a header, a cookie flag,
// a query, a body or the old `sessions` table. The flag is read from the database on every call, so removing it
// takes effect at once. Anything that throws, or takes longer than TIMEOUT_MS, answers false (fails closed). The
// only memory is per request (a WeakMap keyed by the Request object), so two checks in one request read once.
import { auth2Enabled } from "@/lib/auth2/config";

const TIMEOUT_MS = 5_000;
const perRequest = new WeakMap<Request, Promise<boolean>>();

async function decide(req: Request): Promise<boolean> {
  if (!(await auth2Enabled())) return false;
  const { requirePlatformAdmin } = await import("@/lib/auth2/platformAdmin");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((done) => {
    timer = setTimeout(() => done(false), TIMEOUT_MS);
  });
  try {
    return await Promise.race([requirePlatformAdmin(req.headers).then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function platformAdminFromAuth2(req: Request): Promise<boolean> {
  let p = perRequest.get(req);
  if (!p) {
    p = decide(req).catch(() => false);
    perRequest.set(req, p);
  }
  return p;
}
