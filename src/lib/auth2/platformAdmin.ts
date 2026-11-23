/**
 * The platform administrator (owner's ruling of 22 Nov): an application-wide administrator above every workspace
 * role, with full power over accounts and workspaces through ./adminOps.ts. The flag is "user"."platformAdmin"
 * (migration 0038). It is given by the first-run page to the owner it creates (./firstRun.ts) and by another
 * platform administrator; never by signing up, whatever the address.
 *
 * requirePlatformAdmin() is the one check for routes and pages: it reads the session from the request's headers
 * and the flag from the database on every call (never from the session), and refuses a disabled account.
 */
import type { Pool } from "pg";

export class NotPlatformAdmin extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Sign in first." : "Only a platform administrator may do this.");
  }
}

/** Whether the account is a platform administrator and not disabled. */
export async function isPlatformAdmin(db: Pool, userId: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>('SELECT "platformAdmin" AND "disabledAt" IS NULL AS ok FROM "user" WHERE id = $1', [userId]);
  return r.rows[0]?.ok === true;
}

/**
 * The signed-in platform administrator of a request, or NotPlatformAdmin (401 signed out, 403 anyone else). For a
 * page: `await requirePlatformAdmin(await headers())`, and show not-found on NotPlatformAdmin.
 */
export async function requirePlatformAdmin(headers: Headers) {
  const { auth2Session } = await import("./server");
  const { ownerPool } = await import("@/lib/db");
  const s = await auth2Session(headers);
  if (!s) throw new NotPlatformAdmin(401);
  // A "view as" session is the person's, never an administrator's, whoever started it (./viewAs.ts).
  if ((s.session as { impersonatedBy?: string | null }).impersonatedBy) throw new NotPlatformAdmin(403);
  if (!(await isPlatformAdmin(ownerPool(), s.user.id))) throw new NotPlatformAdmin(403);
  return s;
}
