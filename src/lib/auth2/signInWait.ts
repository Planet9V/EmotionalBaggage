/**
 * Sign-in waits per account (accounts slice 2, step 5; review note N4), on top of Better Auth's per-address
 * throttle (../auth.ts THROTTLE: three tries in ten seconds per network address).
 *
 * Each password try at an address name is counted, before the password is checked, in two rows:
 * - the name from this network address: after PAIR_FREE tries, each further try waits 1 s, 2 s, 4 s ... up to
 *   PAIR_MAX_MS (15 minutes), the old sign-in's rule (src/lib/auth.ts);
 * - the name from every address together: after NAME_FREE tries, each further try waits 1 s, 2 s, 4 s ... but
 *   never more than NAME_MAX_MS (one minute). This is what slows guessing spread over many addresses: at most
 *   about one guess a minute at any one account.
 *
 * A delay, never a lock: whatever anyone else does, the account's owner waits at most NAME_MAX_MS from an address
 * that has not itself been failing, and a correct password is accepted as soon as the wait has passed. A try made
 * during a wait is refused without checking the password and without counting (429, SIGN_IN_WAIT, Retry-After). A
 * correct password clears both rows. Counts are forgotten after an hour with no try. Names are stored as their
 * SHA-256; unknown names are counted the same as real ones, so the answers do not tell them apart.
 */
import { createHash } from "node:crypto";
import { APIError } from "better-auth/api";
import type { Pool } from "pg";

export const PAIR_FREE = 3;
export const NAME_FREE = 10;
const PAIR_MAX_MS = 15 * 60 * 1000;
export const NAME_MAX_MS = 60 * 1000;
const RESET_MS = 60 * 60 * 1000;
const ALL = "";

export const nameKey = (email: string) => createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("base64url");

/** The wait as SQL for a failure count `f`, given the free tries and the cap. */
const delaySql = (free: number, capMs: number, f: string) =>
  `make_interval(secs => CASE WHEN ${f} <= ${free} THEN 0 ELSE LEAST(${capMs / 1000}, power(2, LEAST(30, ${f} - ${free} - 1))) END)`;

/**
 * Claims one try for (name, client): answers null when it may go ahead (it is then counted in both rows), or the
 * seconds to wait. Both rows are checked and counted in one transaction, so parallel tries cannot slip past.
 */
export async function claimTry(db: Pool, email: string, client: string, now = new Date()): Promise<number | null> {
  const key = nameKey(email);
  const addr = (client || "unknown").slice(0, 100);
  const resetBefore = new Date(now.getTime() - RESET_MS);
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM auth2_sign_in_waits WHERE last_attempt_at <= $1 AND next_allowed_at <= $2", [resetBefore, now]);
    // Lock both rows (made if missing) in a fixed order: the name across addresses first.
    for (const cl of [ALL, addr]) {
      await c.query(
        `INSERT INTO auth2_sign_in_waits (name_key, client, failures, last_attempt_at, next_allowed_at) VALUES ($1, $2, 0, $3, $3) ON CONFLICT DO NOTHING`,
        [key, cl, now]
      );
    }
    const rows = await c.query<{ client: string; next_allowed_at: Date }>(
      "SELECT client, next_allowed_at FROM auth2_sign_in_waits WHERE name_key = $1 AND client IN ($2, $3) ORDER BY client FOR UPDATE",
      [key, ALL, addr]
    );
    const until = Math.max(...rows.rows.map((r) => new Date(r.next_allowed_at).getTime()));
    if (until > now.getTime()) {
      await c.query("COMMIT");
      return Math.max(1, Math.ceil((until - now.getTime()) / 1000));
    }
    const counted = "(CASE WHEN last_attempt_at <= $4::timestamptz THEN 1 ELSE failures + 1 END)";
    await c.query(
      `UPDATE auth2_sign_in_waits SET failures = ${counted}, last_attempt_at = $3::timestamptz, next_allowed_at = $3::timestamptz + ${delaySql(NAME_FREE, NAME_MAX_MS, counted)}
        WHERE name_key = $1 AND client = $2`,
      [key, ALL, now, resetBefore]
    );
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

/** A correct password: both counts for the name go. */
export async function clearTries(db: Pool, email: string) {
  await db.query("DELETE FROM auth2_sign_in_waits WHERE name_key = $1", [nameKey(email)]);
}

export function waitRefusal(seconds: number) {
  return new APIError(
    "TOO_MANY_REQUESTS",
    { code: "SIGN_IN_WAIT", message: `Too many tries for this account. Wait ${seconds} ${seconds === 1 ? "second" : "seconds"}, then try again.`, retryAfter: seconds },
    { "Retry-After": String(seconds) }
  );
}
