/**
 * Sign-in waits and the lock per account (accounts slice 2, step 5; review note N4; owner's ruling of 23 Nov:
 * "password lockouts after 7 tries"), on top of Better Auth's per-address throttle (../auth.ts THROTTLE: three tries
 * in ten seconds per network address). ONE RULE, written down in docs/guide/admin.md, "Failed sign-ins":
 *
 * 1. The lock, per address name across every network address. Each password try at a name is counted before the
 *    password is checked. When `signIn.maxFailures` (default 7) wrong passwords in a row have been given, the name
 *    is locked for `signIn.lockMinutes` (default 15, owner's answer of 23 Nov; 0 means until an administrator unlocks
 *    it, except that a platform administrator's name is always unlocked after 15 minutes, so an installation can never lock out
 *    its administrators). A right password sets the count back to 0. The count is forgotten after 24 hours with
 *    no try. While locked, every try is refused without checking the password, with one sentence that says neither
 *    whether the address has an account nor for how long. A password reset by email link, an administrator's new
 *    password or an administrator's unlock lift the lock.
 * 2. The growing wait, per (name, network address): after PAIR_FREE tries, each further try from that address waits
 *    1 s, 2 s, 4 s ... up to 15 minutes. It only slows the tries that lead up to the lock; it is the old sign-in's
 *    rule. Counts are forgotten after an hour with no try. A right password clears it.
 *
 * Unknown names are counted, locked and answered exactly as real ones, and every name is stored as its SHA-256
 * only, so neither the answer nor its timing tells whether an address has an account.
 *
 * Review B5 (a lock lets an attacker hold an account): a browser that has signed in to this account before shows a
 * tag for it (a cookie made with the sign-in secret, knownDeviceTag below). Its tries are not counted towards the
 * lock and it is not held by it; the per-address wait still applies to it. So someone guessing from elsewhere
 * locks out new browsers only, never the owner's own one.
 *
 * Earlier (slice 2) the name-wide row carried a growing wait capped at a minute instead of a lock; the lock
 * replaced it on 23 Nov, so the two never apply together. Addresses are counted by /64 for IPv6 (./clientAddress.ts).
 */
import { createHash, createHmac } from "node:crypto";
import { APIError } from "better-auth/api";
import type { Pool, PoolClient } from "pg";
import { auditIn } from "@/lib/db";
import { sendLockAlert } from "./lockAlerts";
import { readRules } from "./rules";

export const PAIR_FREE = 3;
const PAIR_MAX_MS = 15 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;
const NAME_RESET_MS = 24 * 60 * 60 * 1000;
/** A platform administrator's lock always ends after this long, whatever the setting says (owner, 23 Nov: 15). */
const ADMIN_LOCK_MINUTES = 15;
const ALL = "";

export const nameKey = (email: string) => createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("base64url");

/** The wait as SQL for a failure count `f`, given the free tries and the cap. */
const delaySql = (free: number, capMs: number, f: string) =>
  `make_interval(secs => CASE WHEN ${f} <= ${free} THEN 0 ELSE LEAST(${capMs / 1000}, power(2, LEAST(30, ${f} - ${free} - 1))) END)`;

/** What claimTry answers: go ahead (null), wait this many seconds, or the name is locked. */
export type Claim = null | number | "locked";

/**
 * Claims one try for (name, client): null when it may go ahead (it is then counted), the seconds to wait, or
 * "locked". Both rows are checked and counted in one transaction, so parallel tries cannot slip past.
 */
export async function claimTry(db: Pool, email: string, client: string, now = new Date(), opts: { knownDevice?: boolean } = {}): Promise<Claim> {
  const key = nameKey(email);
  const addr = (client || "unknown").slice(0, 100);
  const resetBefore = new Date(now.getTime() - RESET_MS);
  const nameResetBefore = new Date(now.getTime() - NAME_RESET_MS);
  const max = (await readRules(db)).maxFailures;
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `DELETE FROM auth2_sign_in_waits WHERE next_allowed_at <= $2 AND (locked_until IS NULL OR locked_until <= $2)
          AND ((client <> '' AND last_attempt_at <= $1) OR (client = '' AND last_attempt_at <= $3))`,
      [resetBefore, now, nameResetBefore]
    );
    // Lock both rows (made if missing) in a fixed order: the name across addresses first.
    for (const cl of [ALL, addr]) {
      await c.query(
        `INSERT INTO auth2_sign_in_waits (name_key, client, failures, last_attempt_at, next_allowed_at) VALUES ($1, $2, 0, $3, $3) ON CONFLICT DO NOTHING`,
        [key, cl, now]
      );
    }
    const rows = await c.query<{ client: string; next_allowed_at: Date; failures: number; locked_until: Date | null }>(
      "SELECT client, next_allowed_at, failures, locked_until FROM auth2_sign_in_waits WHERE name_key = $1 AND client = ANY($2::text[]) ORDER BY client FOR UPDATE",
      [key, [ALL, addr]]
    );
    const name = rows.rows.find((r) => r.client === ALL)!;
    const pair = rows.rows.find((r) => r.client === addr)!;
    if (!opts.knownDevice) {
      const locked = name.locked_until !== null && new Date(name.locked_until).getTime() > now.getTime();
      if (name.locked_until !== null && !locked) {
        // A lock that has run out: a fresh start.
        await c.query("UPDATE auth2_sign_in_waits SET failures = 0, locked_until = NULL WHERE name_key = $1 AND client = ''", [key]);
        name.failures = 0;
      } else if (locked || name.failures >= max) {
        // Locked, or as many tries in flight as may be: refused without checking the password, and not counted.
        await c.query("COMMIT");
        return "locked";
      }
    }
    const until = new Date(pair.next_allowed_at).getTime();
    if (until > now.getTime()) {
      await c.query("COMMIT");
      return Math.max(1, Math.ceil((until - now.getTime()) / 1000));
    }
    if (!opts.knownDevice) {
      await c.query(
        `UPDATE auth2_sign_in_waits SET failures = CASE WHEN last_attempt_at <= $3::timestamptz THEN 1 ELSE failures + 1 END, last_attempt_at = $2::timestamptz
          WHERE name_key = $1 AND client = ''`,
        [key, now, nameResetBefore]
      );
    }
    const counted = "(CASE WHEN last_attempt_at <= $4::timestamptz THEN 1 ELSE failures + 1 END)";
    await c.query(
      `UPDATE auth2_sign_in_waits SET failures = ${counted}, last_attempt_at = $3::timestamptz, next_allowed_at = $3::timestamptz + ${delaySql(PAIR_FREE, PAIR_MAX_MS, counted)}
        WHERE name_key = $1 AND client = $2`,
      [key, addr, now, resetBefore]
    );
    await c.query("COMMIT");
    return null;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

/**
 * A wrong password was given (after claimTry let the try through): when the count has reached the limit, the name
 * is locked. The lock of an existing account is written to the audit log (its own address as the actor, so only
 * an administrator ever reads it); an unknown name is locked the same way with no line.
 */
export async function failedTry(db: Pool, email: string, now = new Date()): Promise<void> {
  const key = nameKey(email);
  const rules = await readRules(db);
  const account = await db.query<{ email: string; platformAdmin: boolean }>('SELECT email, "platformAdmin" FROM "user" WHERE lower(email) = $1', [email.trim().toLowerCase()]);
  const a = account.rows[0];
  // A platform administrator is never locked for longer than ADMIN_LOCK_MINUTES, so the install keeps its administrators.
  const minutes = a?.platformAdmin ? (rules.lockMinutes === 0 ? ADMIN_LOCK_MINUTES : Math.min(rules.lockMinutes, ADMIN_LOCK_MINUTES)) : rules.lockMinutes;
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query<{ failures: number }>(
      `UPDATE auth2_sign_in_waits SET locked_until = CASE WHEN $3::int = 0 THEN 'infinity'::timestamptz ELSE $2::timestamptz + make_interval(mins => $3::int) END
        WHERE name_key = $1 AND client = '' AND failures >= $4 AND (locked_until IS NULL OR locked_until <= $2) RETURNING failures`,
      [key, now, minutes, rules.maxFailures]
    );
    const failures = r.rows[0]?.failures ?? 0;
    const how = minutes === 0 ? "until an administrator unlocks it" : `for ${minutes} minutes`;
    // Every lock is in Admin, Audit log (owner, 23 Nov: "this is logged in the admin console"). An address with no
    // account is not named, nor its hash.
    if (r.rowCount) {
      await auditIn(c, a
        ? { actor: a.email, action: "account.locked", summary: `Account locked after ${failures} failed sign-ins: ${a.email} (${how})`, detail: { failures, minutes } }
        : { actor: "", action: "account.locked_unknown", summary: `An address with no account was locked after ${failures} failed sign-ins (${how})`, detail: { failures, minutes } });
    }
    await c.query("COMMIT");
    // Then the alert email, once per lock; never holds up the answer (./lockAlerts.ts).
    if (r.rowCount) void sendLockAlert(db, { email: a?.email ?? null, failures, minutes, at: now });
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

/**
 * A correct password: the count for this name from this address goes, and the name's count goes back to 0 (owner's
 * rule: "in a row"). A lock in force is not lifted by a known browser getting in: only a reset or an administrator
 * lifts it (unlock below).
 */
export async function clearTries(db: Pool, email: string, client: string) {
  const key = nameKey(email);
  await db.query("DELETE FROM auth2_sign_in_waits WHERE name_key = $1 AND client = $2", [key, (client || "unknown").slice(0, 100)]);
  await db.query("UPDATE auth2_sign_in_waits SET failures = 0 WHERE name_key = $1 AND client = '' AND (locked_until IS NULL OR locked_until <= now())", [key]);
}

/** Lifts the lock and every count of a name (a reset by link, an administrator's password or unlock). */
export async function unlock(db: Pool | PoolClient, email: string): Promise<boolean> {
  const r = await db.query("DELETE FROM auth2_sign_in_waits WHERE name_key = $1 RETURNING locked_until", [nameKey(email)]);
  return r.rows.some((x: { locked_until: Date | null }) => x.locked_until !== null && new Date(x.locked_until).getTime() > Date.now());
}

/** When each of these addresses is locked until (absent: not locked); 'infinity' comes back as null "until unlocked". */
export async function lockedUntil(db: Pool | PoolClient, emails: string[]): Promise<Map<string, Date | "until-unlocked">> {
  const keys = new Map(emails.map((e) => [nameKey(e), e.toLowerCase()]));
  const r = await db.query<{ name_key: string; until: Date | null; forever: boolean }>(
    "SELECT name_key, CASE WHEN locked_until = 'infinity' THEN NULL ELSE locked_until END AS until, locked_until = 'infinity' AS forever FROM auth2_sign_in_waits WHERE client = '' AND name_key = ANY($1::text[]) AND locked_until > now()",
    [[...keys.keys()]]
  );
  return new Map(r.rows.map((x) => [keys.get(x.name_key)!, x.forever ? "until-unlocked" : new Date(x.until!)]));
}

/** The refusal for a try at a locked name: the same words whatever the name, with no time in it. */
export function lockRefusal() {
  return new APIError("TOO_MANY_REQUESTS", {
    code: "SIGN_IN_LOCKED",
    message: "Too many failed sign-ins for this address, so it is locked for now. To get in at once, choose a new password with \"Forgotten your password?\", or ask an administrator to unlock it.",
  });
}

/** The refusal claimTry's answer calls for, or nothing. */
export function claimRefusal(c: Claim): APIError | null {
  if (c === null) return null;
  return c === "locked" ? lockRefusal() : waitRefusal(c);
}

/** The cookie that marks a browser as having signed in to an account before; one tag per account, at most ten. */
export const KNOWN_DEVICE_COOKIE = "c2r2_known";
const MAX_TAGS = 10;

/** The tag for one account in that cookie: an HMAC with the sign-in secret, so it cannot be made without it. */
const knownDeviceTag = (secret: string, email: string) => createHmac("sha256", secret).update(`known-device:${nameKey(email)}`).digest("base64url").slice(0, 22);

/** Whether a cookie value holds the tag for this account. */
export const hasTag = (cookie: string | null | undefined, secret: string, email: string) => !!cookie && cookie.split(".").includes(knownDeviceTag(secret, email));

/** The cookie value with this account's tag added (newest first, at most MAX_TAGS). */
export const withTag = (cookie: string | null | undefined, secret: string, email: string) => {
  const tag = knownDeviceTag(secret, email);
  return [tag, ...(cookie ?? "").split(".").filter((t) => /^[\w-]{22}$/.test(t) && t !== tag)].slice(0, MAX_TAGS).join(".");
};

export function waitRefusal(seconds: number) {
  return new APIError(
    "TOO_MANY_REQUESTS",
    { code: "SIGN_IN_WAIT", message: `Too many tries for this account. Wait ${seconds} ${seconds === 1 ? "second" : "seconds"}, then try again.`, retryAfter: seconds },
    { "Retry-After": String(seconds) }
  );
}
