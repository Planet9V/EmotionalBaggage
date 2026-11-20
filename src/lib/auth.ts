/**
 * Sign-in for a single-owner install (plan item 2.3, decision D2).
 *
 * Why it is built here rather than with an auth framework: one install has one owner and one
 * default account, `demo` / `demo`. A framework would bring its own tables, migrations and a
 * password-length policy that refuses the owner's published default password. What is needed is
 * small: a password hash, a session table and a cookie.
 *
 * - Passwords are hashed with scrypt from node:crypto, with a random salt per password, stored as
 *   one self-describing string `scrypt$ln=17,r=8,p=1$<salt>$<hash>` so the parameters can be raised
 *   later: old hashes keep verifying with the parameters written in them.
 * - A session is a row in `sessions` addressed by a random 256-bit token. The browser holds the
 *   token in an HttpOnly cookie; the database holds only its SHA-256, so a copy of the database
 *   cannot be used to sign in.
 * - Nothing in this file logs a password, a token or a hash.
 *
 * Every function that depends on the time takes an optional `now`, so tests can move the clock.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { q, tx } from "@/lib/db";
import { SESSION_COOKIE } from "@/app/sign-in/shared";

export const DEFAULT_USERNAME = "demo";
export const DEFAULT_PASSWORD = "demo";
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 1024;
export const MAX_USERNAME_LENGTH = 200;

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
/** A session's expiry moves forward when it is used, but at most once an hour, so reads are not writes. */
const TOUCH_MS = 60 * 60 * 1000;

export const MAX_FAILURES = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Password hashing

/**
 * scrypt cost: N = 2^17, r = 8, p = 1, the minimum the OWASP Password Storage Cheat Sheet gives
 * for scrypt. Each hash uses 128 MiB of memory (128 * N * r bytes) and takes a few hundred
 * milliseconds; that is paid once per sign-in, never per request (sessions are not re-hashed).
 * Node's default scrypt memory ceiling is 32 MiB, so maxmem is raised explicitly.
 */
export const SCRYPT = { ln: 17, r: 8, p: 1, keyLength: 32, saltLength: 16 } as const;
// Bounds on what a stored string may ask for, so a damaged or hostile row cannot make one
// verification allocate gigabytes.
const LIMITS = { lnMin: 10, lnMax: 20, rMax: 32, pMax: 16 };

type Params = { ln: number; r: number; p: number };

function derive(password: string, salt: Buffer, params: Params, keyLength: number): Promise<Buffer> {
  const N = 2 ** params.ln;
  const maxmem = 128 * N * params.r * params.p + 32 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, keyLength, { N, r: params.r, p: params.p, maxmem }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

/** Hashes a password into the stored form `scrypt$ln=..,r=..,p=..$<salt>$<hash>` (base64url). */
export async function hashPassword(password: string, params: Params = SCRYPT): Promise<string> {
  const salt = randomBytes(SCRYPT.saltLength);
  const key = await derive(password, salt, params, SCRYPT.keyLength);
  return `scrypt$ln=${params.ln},r=${params.r},p=${params.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

const STORED = /^scrypt\$ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9_-]{16,128})\$([A-Za-z0-9_-]{16,256})$/;

/** Reads a stored hash; anything malformed or out of bounds is null, never an exception. */
export function parseStoredHash(stored: unknown): { params: Params; salt: Buffer; key: Buffer } | null {
  if (typeof stored !== "string") return null;
  const m = STORED.exec(stored);
  if (!m) return null;
  const params = { ln: Number(m[1]), r: Number(m[2]), p: Number(m[3]) };
  if (params.ln < LIMITS.lnMin || params.ln > LIMITS.lnMax) return null;
  if (params.r < 1 || params.r > LIMITS.rMax || params.p < 1 || params.p > LIMITS.pMax) return null;
  const salt = Buffer.from(m[4], "base64url");
  const key = Buffer.from(m[5], "base64url");
  if (salt.length < 8 || key.length < 16) return null;
  return { params, salt, key };
}

/** True when `password` matches `stored`. A malformed stored string answers false. Constant-time compare. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.params, parsed.key.length);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

/**
 * Counters the tests read to prove that a sign-in for an unknown name still did the full scrypt
 * work (so it takes as long as a wrong password). Holds counts only, never secrets.
 */
export const authCounters = { dummyVerifications: 0 };

let dummy: Promise<string> | undefined;
/** A hash of a random password nobody knows, computed once, verified against when the name is unknown. */
function dummyHash() {
  dummy ??= hashPassword(randomBytes(32).toString("base64url")).catch((e) => {
    dummy = undefined;
    throw e;
  });
  return dummy;
}

// ---------------------------------------------------------------------------------------------
// The default account

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

/**
 * Creates `demo` / `demo` when the users table is empty (decision D2). Called once from ready() in
 * src/lib/db.ts after the migrations, so it takes the pool directly instead of going through q().
 * Two processes starting at once cannot create two accounts: the second insert meets the unique
 * name and does nothing. Returns true when it created the account.
 */
export async function ensureDefaultUser(db: Queryable): Promise<boolean> {
  const { rows } = await db.query("SELECT EXISTS (SELECT 1 FROM users) AS has");
  if (rows[0].has) return false;
  const hash = await hashPassword(DEFAULT_PASSWORD);
  const r = await db.query(
    `INSERT INTO users (username, password_hash)
     SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM users)
     ON CONFLICT DO NOTHING`,
    [DEFAULT_USERNAME, hash]
  );
  return (r.rowCount ?? 0) > 0;
}

/** True while any account still has the published default password (it has never been changed). */
export async function defaultPasswordInUse(): Promise<boolean> {
  const rows = await q<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE password_changed_at IS NULL");
  return rows[0].n > 0;
}

// ---------------------------------------------------------------------------------------------
// Sessions

export type Session = {
  sessionId: number;
  userId: number;
  username: string;
  /** The account has never had its password changed, so it still uses the published default. */
  usingDefaultPassword: boolean;
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

/** Starts a session for a user and returns the token for the cookie. Only its hash is stored. */
export async function createSession(userId: number, userAgent: string, opts: { now?: Date } = {}): Promise<string> {
  const now = opts.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  await q(
    "INSERT INTO sessions (user_id, token_sha256, created_at, last_seen_at, expires_at, user_agent) VALUES ($1,$2,$3,$3,$4,$5)",
    [userId, sha256(token), now, new Date(now.getTime() + SESSION_MS), (userAgent ?? "").slice(0, 400)]
  );
  return token;
}

/** The session token in a Cookie header, or null. Only a well-formed token is returned. */
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return TOKEN.test(value) ? value : null;
  }
  return null;
}

/**
 * The signed-in session for a request, or null. An expired session is null.
 * A session in use is extended to 30 days from now, at most once an hour.
 */
export async function sessionFromRequest(req: Request, opts: { now?: Date } = {}): Promise<Session | null> {
  const token = tokenFromRequest(req);
  if (!token) return null;
  return sessionFromToken(token, opts);
}

export async function sessionFromToken(token: string, opts: { now?: Date } = {}): Promise<Session | null> {
  if (!TOKEN.test(token)) return null;
  const now = opts.now ?? new Date();
  const rows = await q<{ id: string; user_id: string; last_seen_at: Date; username: string; password_changed_at: Date | null }>(
    `SELECT s.id, s.user_id, s.last_seen_at, u.username, u.password_changed_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_sha256 = $1 AND s.expires_at > $2`,
    [sha256(token), now]
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (now.getTime() - new Date(r.last_seen_at).getTime() >= TOUCH_MS) {
    await q("UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1", [
      r.id,
      now,
      new Date(now.getTime() + SESSION_MS),
    ]);
  }
  return {
    sessionId: Number(r.id),
    userId: Number(r.user_id),
    username: r.username,
    usingDefaultPassword: r.password_changed_at === null,
  };
}

/** Ends the session the token belongs to. An unknown or malformed token is not an error. */
export async function signOut(token: string | null | undefined): Promise<void> {
  if (!token || !TOKEN.test(token)) return;
  await q("DELETE FROM sessions WHERE token_sha256 = $1", [sha256(token)]);
}

// ---------------------------------------------------------------------------------------------
// Sign-in

export type SignInResult =
  | { ok: true; token: string; session: Session }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterSeconds: number };

const usernameKey = (username: string) => username.trim().toLowerCase();

/**
 * Checks a username and password and starts a session.
 *
 * - Takes the same work whether or not the name exists: an unknown name is checked against a
 *   dummy hash, so the answer time does not tell a guesser which names are real.
 * - After 5 failed attempts for one name inside 15 minutes, further attempts for that name are
 *   refused until the 15 minutes from the first failure are over. The attempt is counted before
 *   the password is checked, in one statement, so parallel guesses cannot slip past the limit;
 *   a successful sign-in clears the count. Names that are not users are counted too.
 * - Expired sessions and stale attempt counts are deleted here, opportunistically.
 */
export async function signIn(username: string, password: string, userAgent: string, opts: { now?: Date } = {}): Promise<SignInResult> {
  const now = opts.now ?? new Date();
  const windowStart = new Date(now.getTime() - LOCK_WINDOW_MS);
  const key = usernameKey(String(username ?? "")).slice(0, MAX_USERNAME_LENGTH);
  const pw = String(password ?? "");

  await q("DELETE FROM sessions WHERE expires_at <= $1", [now]);
  await q("DELETE FROM sign_in_attempts WHERE window_started_at <= $1", [windowStart]);

  const [attempt] = await q<{ failures: number; window_started_at: Date }>(
    `INSERT INTO sign_in_attempts AS a (username_key, failures, window_started_at) VALUES ($1, 1, $2)
     ON CONFLICT (username_key) DO UPDATE SET
       failures = CASE WHEN a.window_started_at <= $3 THEN 1 ELSE a.failures + 1 END,
       window_started_at = CASE WHEN a.window_started_at <= $3 THEN $2 ELSE a.window_started_at END
     RETURNING failures, window_started_at`,
    [key, now, windowStart]
  );
  if (attempt.failures > MAX_FAILURES) {
    const until = new Date(attempt.window_started_at).getTime() + LOCK_WINDOW_MS;
    return { ok: false, reason: "locked", retryAfterSeconds: Math.max(1, Math.ceil((until - now.getTime()) / 1000)) };
  }

  const fallback = await dummyHash();
  const users = await q<{ id: string; username: string; password_hash: string; password_changed_at: Date | null }>(
    "SELECT id, username, password_hash, password_changed_at FROM users WHERE lower(username) = $1",
    [key]
  );
  const user = users[0];
  let ok: boolean;
  if (user) {
    ok = await verifyPassword(pw, user.password_hash);
  } else {
    authCounters.dummyVerifications++;
    await verifyPassword(pw, fallback);
    ok = false;
  }
  if (!ok || !user) return { ok: false, reason: "invalid" };

  await q("DELETE FROM sign_in_attempts WHERE username_key = $1", [key]);
  const token = await createSession(Number(user.id), userAgent, { now });
  const session = await sessionFromToken(token, { now });
  if (!session) throw new Error("A session that was just created could not be read back.");
  return { ok: true, token, session };
}

// ---------------------------------------------------------------------------------------------
// Changing the password

export type ChangePasswordResult = { ok: true } | { ok: false; field: "current" | "next"; error: string };

/**
 * Changes a user's password after checking the current one, and ends every other session of that
 * user (a browser someone else signed in with the old password is signed out). The session that
 * asked, `keepSessionId`, stays signed in.
 *
 * The published default `demo` may exist (a fresh install has it) but may not be chosen again.
 */
export async function changePassword(
  userId: number,
  current: string,
  next: string,
  keepSessionId?: number,
  opts: { now?: Date } = {}
): Promise<ChangePasswordResult> {
  const now = opts.now ?? new Date();
  if (typeof next !== "string") return { ok: false, field: "next", error: "Enter a new password." };
  if (next === DEFAULT_PASSWORD) {
    return { ok: false, field: "next", error: "That is the published default password. Choose a different one." };
  }
  if ([...next].length < MIN_PASSWORD_LENGTH) {
    return { ok: false, field: "next", error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (next.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, field: "next", error: `The new password can be at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  const rows = await q<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!rows.length || !(await verifyPassword(String(current ?? ""), rows[0].password_hash))) {
    return { ok: false, field: "current", error: "The current password is not right." };
  }
  const hash = await hashPassword(next);
  await tx(async (c) => {
    await c.query("UPDATE users SET password_hash = $2, password_changed_at = $3 WHERE id = $1", [userId, hash, now]);
    await c.query("DELETE FROM sessions WHERE user_id = $1 AND id IS DISTINCT FROM $2", [userId, keepSessionId ?? null]);
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// The cookie

/**
 * True when the request reached the app over https, directly or through a reverse proxy that
 * says so in X-Forwarded-Proto. A client that fakes the header only stops its own cookie being
 * stored over plain http; it gains nothing.
 */
export function arrivedOverHttps(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded === "https") return true;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The Set-Cookie value for a new session. HttpOnly keeps it from page scripts; SameSite=Lax keeps
 * other sites' forms and scripts from sending it (see the origin check in src/lib/api/route.ts).
 * Secure only over https: the app is normally reached over plain http on localhost, where a
 * Secure cookie would not be stored at all.
 */
export function sessionCookie(token: string, req: Request): string {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/", `Max-Age=${SESSION_MS / 1000}`, "HttpOnly", "SameSite=Lax"];
  if (arrivedOverHttps(req)) parts.push("Secure");
  return parts.join("; ");
}

/** The Set-Cookie value that removes the session cookie from the browser. */
export function clearedSessionCookie(req: Request): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (arrivedOverHttps(req)) parts.push("Secure");
  return parts.join("; ");
}
