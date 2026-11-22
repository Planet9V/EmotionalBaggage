/**
 * The first-run "create the owner" step for a self-hosted install (accounts slice 2, step 6; owner's rulings of
 * 22 Nov). While the new sign-in is on and no account exists, / and /welcome lead to /auth/first-run (src/proxy.ts);
 * once any account exists the page is not found and the endpoint refuses, for good.
 *
 * The person there chooses the owner's name, address and password (the address is prefilled from the setting
 * `auth2.platformAdminAddress`, seeded to admin@oxot.nl, and may be changed there). The account is created
 * confirmed (no mail is needed), is a platform administrator, gets its own workspace, and is signed in. No password
 * is ever generated, logged or shown.
 *
 * In production with no base address stored yet, the page shows the address the browser is using and the owner
 * confirms it; it must be the origin the form was sent from. It is stored as `auth2.baseUrl`.
 *
 * Two submissions at once create one owner: the first takes the claim row (auth2_install) under an advisory lock;
 * the other finds it taken and is refused. A claim left by a crash with no owner is taken again after five minutes.
 */
import type { Pool } from "pg";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { audit } from "@/lib/db";
import { AUTH2_SETTING, resolveAuth2Config } from "./config";
import { cleanName } from "./guards";

const STALE_CLAIM = "5 minutes";
const g = globalThis as unknown as { __c2rFirstRunClosed?: boolean };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const closed = () => json(404, { code: "FIRST_RUN_CLOSED", message: "This installation has its owner already. Sign in instead." });
const bad = (code: string, message: string) => json(400, { code, message });

/** Whether the first-run step is open: no account, and no claim being worked on. Once closed it stays closed. */
export async function firstRunOpen(db: Pool): Promise<boolean> {
  if (g.__c2rFirstRunClosed) return false;
  const r = await db.query<{ open: boolean }>(
    `SELECT NOT EXISTS (SELECT 1 FROM "user") AND NOT EXISTS (SELECT 1 FROM auth2_install WHERE owner_user_id IS NOT NULL OR claimed_at > now() - interval '${STALE_CLAIM}') AS open`
  );
  if (!r.rows[0].open) g.__c2rFirstRunClosed = true;
  return r.rows[0].open;
}

/** Forgets the cached answer (tests that empty the accounts table). */
export function forgetFirstRun() {
  g.__c2rFirstRunClosed = undefined;
}

/** What the page needs: the address to offer, and whether the base address still has to be confirmed. */
export async function firstRunForm(db: Pool): Promise<{ email: string; needsAddress: boolean }> {
  const r = await db.query<{ value: unknown }>("SELECT value FROM settings WHERE key = $1", [AUTH2_SETTING.platformAdminAddress]);
  const email = typeof r.rows[0]?.value === "string" ? r.rows[0].value : "";
  return { email, needsAddress: !(await resolveAuth2Config(db)).baseURL };
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/**
 * POST /api/auth2/first-run/owner, answered by the catch-all route before the sign-in instance is built (it may
 * not exist yet). `signIn` is given the finished account and answers the sign-in response (cookies set).
 */
export async function createOwner(db: Pool, req: Request, deps: { build: () => Promise<OwnerAuth> }): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("INVALID_BODY", "Send the name, email address and password.");
  }
  if (!(await firstRunOpen(db))) return closed();
  let name: string;
  try {
    name = cleanName(body.name);
  } catch (e) {
    const err = e as { body?: { code?: string; message?: string } };
    return bad(err.body?.code ?? "INVALID_NAME", err.body?.message ?? "Enter your name.");
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) return bad("INVALID_EMAIL", "Enter a whole email address, such as name@example.com.");
  const password = body.password;
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) return bad("PASSWORD_TOO_SHORT", `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > 128) return bad("PASSWORD_TOO_LONG", "The password must be at most 128 characters.");

  // The base address, when none is stored yet: the one the owner confirmed, which must be where the form came from.
  let confirmedOrigin: string | null = null;
  if (!(await resolveAuth2Config(db)).baseURL) {
    let given: string;
    try {
      given = new URL(String(body.address ?? "")).origin;
    } catch {
      return bad("INVALID_ADDRESS", "Confirm the address this installation is opened at, for example https://app.example.com.");
    }
    if (given !== req.headers.get("origin")) return bad("ADDRESS_MISMATCH", "The address must be the one this page is open at. Open the page at the address people will use, then try again.");
    confirmedOrigin = given;
  }

  // The claim: one request wins; any other, now or later, is refused.
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.first_run'))");
    const open = await c.query<{ open: boolean }>(
      `SELECT NOT EXISTS (SELECT 1 FROM "user") AND NOT EXISTS (SELECT 1 FROM auth2_install WHERE owner_user_id IS NOT NULL OR claimed_at > now() - interval '${STALE_CLAIM}') AS open`
    );
    if (!open.rows[0].open) {
      await c.query("ROLLBACK");
      g.__c2rFirstRunClosed = true;
      return closed();
    }
    await c.query("INSERT INTO auth2_install (id, claimed_at, owner_user_id) VALUES (true, now(), NULL) ON CONFLICT (id) DO UPDATE SET claimed_at = now(), owner_user_id = NULL");
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }

  let userId: string | null = null;
  try {
    const upsert = "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()";
    if (confirmedOrigin) await db.query(upsert, [AUTH2_SETTING.baseUrl, JSON.stringify(confirmedOrigin)]);
    await db.query(upsert, [AUTH2_SETTING.platformAdminAddress, JSON.stringify(email)]);
    const auth = await deps.build();
    const ac = await auth.$context;
    // The user-created hook (./auth.ts) gives the account its workspace and writes the sign-up line.
    const user = await ac.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "email-password" });
    userId = user.id;
    await ac.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await hashPassword(password) });
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [user.id]);
    await db.query("UPDATE auth2_install SET owner_user_id = $1", [user.id]);
    g.__c2rFirstRunClosed = true;
    await audit({ actor: email, action: "platform.owner_created", summary: "Created the owner of this installation on the first-run page (confirmed, platform administrator)", detail: { userId: user.id } });
    return await auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers: req.headers, asResponse: true });
  } catch (e) {
    // Leave the step open again, as if nothing had happened.
    if (userId) await db.query('DELETE FROM "user" WHERE id = $1', [userId]).catch(() => undefined);
    await db.query("DELETE FROM auth2_install WHERE owner_user_id IS NULL").catch(() => undefined);
    throw e;
  }
}

/** The parts of the sign-in instance this needs (src/lib/auth2/server.ts builds it). */
type OwnerAuth = {
  $context: Promise<{
    internalAdapter: {
      createUser: (u: { email: string; name: string; emailVerified: boolean }, source: { method: "email-password" }) => Promise<{ id: string }>;
      linkAccount: (a: { userId: string; providerId: string; accountId: string; password: string }) => Promise<unknown>;
    };
  }>;
  api: { signInEmail: (a: { body: { email: string; password: string; rememberMe: boolean }; headers: Headers; asResponse: true }) => Promise<Response> };
};
