/**
 * The first-run "create the owner" step for a self-hosted install (accounts slice 2, step 6; owner's rulings of
 * 22 Nov; hardened after the review of slice 2, items B1 to B3).
 *
 * Open means: no platform administrator exists and the install has not been completed (auth2_install.completed_at).
 * An ordinary account made earlier does not close it. While it is open, / and /welcome lead to /auth/first-run
 * (src/proxy.ts), and sign-up, password reset and accepting invitations answer 503 SETUP_REQUIRED (the catch-all
 * route), so nobody can slip in before the owner. Once the owner exists it is closed for good.
 *
 * A set-up code guards it (B2): whoever reaches a fresh install first must also be able to read its server log. At
 * start while first run is open (and on the first visit to the page if the switch was turned on later), the app makes
 * a random code, keeps only its SHA-256 (auth2_setup_code, owner-only), and prints the code once to the server log
 * (`docker compose logs web`). It is the only secret ever logged. A restart while still open makes a new one; the
 * owner's creation deletes it. A wrong code earns a growing wait (1 s, 2 s, 4 s ... up to 15 minutes); codes are
 * compared in constant time.
 *
 * Everything is checked before anything is written (B1): name and email (well-formed text), password, set-up code,
 * and, in production with no base address yet, the address, which must be the scheme and host the form was sent
 * from (Origin and Host). Then one transaction creates the account (confirmed, platform administrator), its
 * workspace, the stored address and administrator address, and marks the install complete: all of it, or nothing.
 * Two submissions at once create one owner (an advisory lock around that transaction).
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { hashPassword } from "@/lib/auth";
import { newPasswordProblem } from "./newPassword";
import { PASSWORD_RULE } from "./passwordPolicy";
import { readRules } from "./rules";
import { auditIn } from "@/lib/db";
import { AUTH2_PAGES, AUTH2_SETTING, readAuth2Setting, resolveAuth2Config, writeAuth2Setting } from "./config";
import { cleanEmail, cleanName } from "./guards";
import { createPersonal, newId } from "./workspaces/store";

const g = globalThis as unknown as { __c2rFirstRunClosed?: boolean; __c2rSetupCodeIssued?: Pool };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const closed = () => json(404, { code: "FIRST_RUN_CLOSED", message: "This installation has its owner already. Sign in instead." });
const bad = (code: string, message: string) => json(400, { code, message });

const OPEN_SQL = `NOT EXISTS (SELECT 1 FROM "user" WHERE "platformAdmin") AND NOT EXISTS (SELECT 1 FROM auth2_install WHERE completed_at IS NOT NULL)`;

/** Whether the first-run step is open (see the top). Cached as closed only once an owner exists. */
export async function firstRunOpen(db: Pool): Promise<boolean> {
  if (g.__c2rFirstRunClosed) return false;
  const open = (await db.query<{ open: boolean }>(`SELECT ${OPEN_SQL} AS open`)).rows[0].open;
  // Closed here means an administrator exists or the install was completed: it cannot open again (review N12).
  if (!open) g.__c2rFirstRunClosed = true;
  return open;
}

/** Forgets the cached answer (tests that empty the install). */
export function forgetFirstRun() {
  g.__c2rFirstRunClosed = undefined;
}

/** As if the process restarted: the next ensureSetupCode makes a new code (tests). */
export function forgetSetupCode() {
  g.__c2rSetupCodeIssued = undefined;
}

// --- the set-up code (B2) ------------------------------------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
const codeHash = (code: string) => createHash("sha256").update(code.replace(/[\s-]+/g, "").toUpperCase(), "utf8").digest();
const MAX_WAIT_S = 15 * 60;

/** Makes a new set-up code, keeps its hash, and prints the code once to the server log. */
async function issueSetupCode(db: Pool): Promise<void> {
  const raw = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const code = raw.match(/.{4}/g)!.join("-");
  await db.query(
    `INSERT INTO auth2_setup_code (id, code_hash, created_at, failures, next_allowed_at) VALUES (true, $1, now(), 0, now())
     ON CONFLICT (id) DO UPDATE SET code_hash = EXCLUDED.code_hash, created_at = now(), failures = 0, next_allowed_at = now()`,
    [codeHash(code).toString("base64url")]
  );
  g.__c2rSetupCodeIssued = db;
  console.info(
    `[auth2] This installation has no owner yet. Open ${AUTH2_PAGES}/first-run in the browser and enter this set-up code: ${code}\n` +
      "[auth2] The code works until the owner is created, and a restart replaces it. Anyone who can read this log can use it."
  );
}

/** Makes sure this process has issued a code while first run is open (at start, or on the first visit later). */
export async function ensureSetupCode(db: Pool): Promise<void> {
  if (g.__c2rSetupCodeIssued === db) return;
  if (await firstRunOpen(db)) await issueSetupCode(db);
}

// --- the page and the endpoint ---------------------------------------------------------------------------------------

/** What the page needs: the address to offer, and whether the base address still has to be confirmed. */
export async function firstRunForm(db: Pool): Promise<{ email: string; needsAddress: boolean }> {
  await ensureSetupCode(db);
  const email = await readAuth2Setting<unknown>(db, AUTH2_SETTING.platformAdminAddress);
  return { email: typeof email === "string" ? email : "", needsAddress: !(await resolveAuth2Config(db)).baseURL };
}

/** The sign-in instance's parts this needs (src/lib/auth2/server.ts builds it). */
type OwnerAuth = { api: { signInEmail: (a: { body: { email: string; password: string; rememberMe: boolean }; headers: Headers; asResponse: true }) => Promise<Response> } };

/**
 * POST /api/auth2/first-run/owner, answered by the catch-all route before the sign-in instance is built (it may not
 * exist yet). Body: name, email, password, setupCode, and address when the install has no base address.
 */
export async function createOwner(db: Pool, req: Request, deps: { build: () => Promise<OwnerAuth> }): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("INVALID_BODY", "Send the name, email address, password and set-up code.");
  }
  if (!body || typeof body !== "object" || !(await firstRunOpen(db))) return closed();
  await ensureSetupCode(db);

  // 1. Everything is checked before anything is written.
  let name: string;
  let email: string;
  try {
    name = cleanName(body.name);
    email = cleanEmail(body.email);
  } catch (e) {
    const err = e as { body?: { code?: string; message?: string } };
    return bad(err.body?.code ?? "INVALID_BODY", err.body?.message ?? "Check the name and email address.");
  }
  const password = body.password;
  // The same password rules as everywhere else (./passwordPolicy.ts).
  const problem = newPasswordProblem((await readRules(db)).password, password, { email, name });
  if (problem || typeof password !== "string") return bad(PASSWORD_RULE, problem ?? "Choose a password.");
  const code = typeof body.setupCode === "string" && body.setupCode.isWellFormed() ? body.setupCode : "";
  if (!code || code.length > 40) return bad("SETUP_CODE_WRONG", "Enter the set-up code from the server log.");

  let confirmedOrigin: string | null = null;
  if (!(await resolveAuth2Config(db)).baseURL) {
    let given: URL;
    try {
      given = new URL(String(body.address ?? ""));
      if (given.protocol !== "https:" && given.protocol !== "http:") throw new Error("scheme");
    } catch {
      return bad("INVALID_ADDRESS", "Confirm the address this installation is opened at, for example https://app.example.com.");
    }
    // Scheme and host both: the address must be exactly where this form was sent from.
    if (given.origin !== req.headers.get("origin") || given.host !== req.headers.get("host")) {
      return bad("ADDRESS_MISMATCH", "The address must be the one this page is open at. Open the page at the address people will use, then try again.");
    }
    confirmedOrigin = given.origin;
  }
  const hash = await hashPassword(password);

  // 2. One transaction: the code, then the owner, the workspace, the stored addresses and the completed install.
  const c = await db.connect();
  let userId = "";
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.first_run'))");
    if (!(await c.query<{ open: boolean }>(`SELECT ${OPEN_SQL} AS open`)).rows[0].open) {
      await c.query("ROLLBACK");
      g.__c2rFirstRunClosed = true;
      return closed();
    }
    const row = (await c.query<{ code_hash: string; failures: number; wait: number }>(
      "SELECT code_hash, failures, GREATEST(0, ceil(extract(epoch FROM next_allowed_at - now())))::int AS wait FROM auth2_setup_code WHERE id FOR UPDATE"
    )).rows[0];
    if (row && row.wait > 0) {
      await c.query("ROLLBACK");
      return json(429, { code: "SETUP_CODE_WAIT", message: `Too many wrong set-up codes. Wait ${row.wait} seconds, then try again.` }, { "Retry-After": String(row.wait) });
    }
    const stored = row ? Buffer.from(row.code_hash, "base64url") : Buffer.alloc(32);
    const ok = !!row && timingSafeEqual(codeHash(code), stored);
    if (!ok) {
      if (row) {
        await c.query(`UPDATE auth2_setup_code SET failures = failures + 1, next_allowed_at = now() + make_interval(secs => LEAST($1, power(2, LEAST(failures, 20)))) WHERE id`, [MAX_WAIT_S]);
      }
      await c.query("COMMIT");
      return bad("SETUP_CODE_WRONG", "That set-up code is not right. It is in the server log, on the line that starts \"[auth2] This installation has no owner yet\".");
    }
    const taken = await c.query('SELECT 1 FROM "user" WHERE lower(email) = $1', [email]);
    if (taken.rowCount) {
      await c.query("ROLLBACK");
      return json(409, { code: "USER_EXISTS", message: "An account with that address exists already. Choose another address for the owner." });
    }
    userId = newId();
    await c.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled", "platformAdmin") VALUES ($1, $2, $3, true, now(), now(), false, true)`,
      [userId, name, email]
    );
    await c.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [newId(), userId, hash]);
    await createPersonal(c, { id: userId, name, email });
    if (confirmedOrigin) await writeAuth2Setting(c, AUTH2_SETTING.baseUrl, confirmedOrigin, email);
    await writeAuth2Setting(c, AUTH2_SETTING.platformAdminAddress, email, email);
    await c.query(
      `INSERT INTO auth2_install (id, claimed_at, owner_user_id, completed_at) VALUES (true, now(), $1, now())
       ON CONFLICT (id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id, completed_at = now()`,
      [userId]
    );
    await c.query("DELETE FROM auth2_setup_code");
    await auditIn(c, { actor: email, action: "platform.owner_created", summary: "Created the owner of this installation on the first-run page (confirmed, platform administrator)", detail: { userId, address: confirmedOrigin } });
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
  g.__c2rFirstRunClosed = true;
  const auth = await deps.build();
  return auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers: req.headers, asResponse: true });
}
