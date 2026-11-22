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
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { sha256 } from "@/lib/hash";
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
/** However often it is used, a session ends this long after it began (robustness review S9). */
export const ABSOLUTE_SESSION_DAYS = 90;
const ABSOLUTE_MS = ABSOLUTE_SESSION_DAYS * 24 * 60 * 60 * 1000;
/** A session's expiry moves forward when it is used, but at most once an hour, so reads are not writes. */
const TOUCH_MS = 60 * 60 * 1000;

// Sign-in throttling (robustness review S4). There is no lockout: wrong passwords earn growing delays,
// counted per (username, client address) and, separately, per client address. Someone guessing from
// another address cannot delay the owner, and a correct password is always accepted once the delay
// that applies to it has passed.
/** Failures for one name from one address before delays start; then 1 s, 2 s, 4 s ... up to the cap. */
export const PAIR_FREE_FAILURES = 3;
/** Failures from one address, for any names, before that address is slowed down too. */
export const ADDRESS_FREE_FAILURES = 20;
export const MAX_DELAY_MS = 15 * 60 * 1000;
/** A count is forgotten when nothing was tried for this long. */
export const ATTEMPT_RESET_MS = 60 * 60 * 1000;
/** The attempts table never holds more rows than this; the oldest go first. */
export const MAX_ATTEMPT_ROWS = 10_000;

/** The wait after `failures` failures, given the number that are free. */
export function delayAfter(failures: number, free: number): number {
  if (failures <= free) return 0;
  return Math.min(MAX_DELAY_MS, 1000 * 2 ** Math.min(30, failures - free - 1));
}

/** The request header the server start script fills with the socket's address (scripts/client-address.cjs). */
export const CLIENT_ADDRESS_HEADER = "x-c2r-client-address";

/**
 * The client's network address for throttling. X-Forwarded-For is trusted only when TRUST_PROXY is set
 * (the app is behind a reverse proxy, which appends the address it saw: the right-most entry). Otherwise
 * the address comes from the connection itself, put in CLIENT_ADDRESS_HEADER by scripts/client-address.cjs,
 * which overwrites anything a client sends under that name. Without either, every request counts as one
 * address ("unknown").
 */
export function clientAddress(req: Request): string {
  if (/^(1|true|yes|on)$/i.test(process.env.TRUST_PROXY?.trim() ?? "")) {
    const parts = (req.headers.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 100);
  }
  return (req.headers.get(CLIENT_ADDRESS_HEADER) ?? "").trim().slice(0, 100) || "unknown";
}

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
 * name and does nothing. Returns true when it created the account. It never changes an existing
 * account's password.
 *
 * While the new sign-in is on (the AUTH2 override, else the stored switch) it does nothing at all, so
 * the old sign-in is not prepared behind it (cut-over review F3). A switch that cannot be read counts
 * as on here.
 */
export async function ensureDefaultUser(db: Queryable): Promise<boolean> {
  const { override, storedSwitch } = await import("./auth2/config");
  if (override() ?? (await storedSwitch(db).catch(() => true))) return false;
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
  const rows = await q<{ id: string; user_id: string; created_at: Date; last_seen_at: Date; username: string; password_changed_at: Date | null }>(
    `SELECT s.id, s.user_id, s.created_at, s.last_seen_at, u.username, u.password_changed_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_sha256 = $1 AND s.expires_at > $2 AND s.created_at > $3`,
    [sha256(token), now, new Date(now.getTime() - ABSOLUTE_MS)]
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (now.getTime() - new Date(r.last_seen_at).getTime() >= TOUCH_MS) {
    // sliding 30 days, never past 90 days from the sign-in
    const end = Math.min(now.getTime() + SESSION_MS, new Date(r.created_at).getTime() + ABSOLUTE_MS);
    await q("UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1", [r.id, now, new Date(end)]);
  }
  return {
    sessionId: Number(r.id),
    userId: Number(r.user_id),
    username: r.username,
    usingDefaultPassword: r.password_changed_at === null,
  };
}

/** Ends every session of a user, this one included ("Sign out everywhere"). Answers how many ended. */
export async function signOutEverywhere(userId: number): Promise<number> {
  const rows = await q("DELETE FROM sessions WHERE user_id = $1 RETURNING id", [userId]);
  return rows.length;
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
  | { ok: false; reason: "wait"; retryAfterSeconds: number };

const usernameKey = (username: string) => username.trim().toLowerCase();

/** The wait as SQL, for a failure count expression `f` (the same rule as delayAfter). */
const sqlDelay = (free: number, f: string) =>
  `make_interval(secs => CASE WHEN ${f} <= ${free} THEN 0 ELSE LEAST(${MAX_DELAY_MS / 1000}, power(2, LEAST(30, ${f} - ${free} - 1))) END)`;

/**
 * Counts one try in `sign_in_attempts` under (key, client) and sets the wait before the next one, in one
 * statement, so parallel tries cannot slip past. Answers null when the try may go ahead, or the time the
 * key and client are waiting until (the try is then not counted). A count is forgotten after
 * ATTEMPT_RESET_MS with no try.
 */
async function claimTry(c: PoolClient, key: string, client: string, free: number, now: Date, resetBefore: Date): Promise<Date | null> {
  const counted = "(CASE WHEN a.last_attempt_at <= $4::timestamptz THEN 1 ELSE a.failures + 1 END)";
  const r = await c.query(
    `INSERT INTO sign_in_attempts AS a (username_key, client, failures, last_attempt_at, next_allowed_at)
     VALUES ($1, $2, 1, $3::timestamptz, $3::timestamptz + ${sqlDelay(free, "1")})
     ON CONFLICT (username_key, client) DO UPDATE SET
       failures = ${counted},
       last_attempt_at = $3::timestamptz,
       next_allowed_at = $3::timestamptz + ${sqlDelay(free, counted)}
     WHERE a.next_allowed_at <= $3::timestamptz`,
    [key, client, now, resetBefore]
  );
  if (r.rowCount) return null;
  const w = await c.query<{ next_allowed_at: Date }>("SELECT next_allowed_at FROM sign_in_attempts WHERE username_key = $1 AND client = $2", [key, client]);
  return w.rows[0] ? new Date(w.rows[0].next_allowed_at) : now;
}

/**
 * The sign-in throttle, for another open form (the access request on /welcome). Every try counts, not only
 * failures: after `free` tries from one client address within the hour, each further try must wait 1 s,
 * 2 s, 4 s ... (at most 15 minutes) after the one before, the same rule as wrong passwords. `bucket` names
 * the form; it is stored with a leading space, and sign-in names are trimmed before they are counted, so a
 * bucket can never share a row with a username.
 */
export async function throttleOpenForm(bucket: string, client: string, free: number, opts: { now?: Date } = {}): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const now = opts.now ?? new Date();
  const resetBefore = new Date(now.getTime() - ATTEMPT_RESET_MS);
  const key = ` ${bucket}`;
  const addr = (client || "unknown").slice(0, 100);
  await q("DELETE FROM sign_in_attempts WHERE last_attempt_at <= $1 AND next_allowed_at <= $2", [resetBefore, now]);
  const until = await tx((c) => claimTry(c, key, addr, free, now, resetBefore));
  if (!until) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000)) };
}

/**
 * Checks a username and password and starts a session.
 *
 * - Takes the same work whether or not the name exists: an unknown name is checked against a
 *   dummy hash, so the answer time does not tell a guesser which names are real.
 * - Throttling, with no lockout: after PAIR_FREE_FAILURES wrong passwords for one name from one
 *   client address, each further try from that address must wait 1 s, 2 s, 4 s ... (at most
 *   15 minutes) after the one before; after ADDRESS_FREE_FAILURES failures from one address for any
 *   names, that address waits the same way. A try made during its wait is refused without checking
 *   the password and without counting. The try is counted, and its wait set, before the password is
 *   checked, in one statement, so parallel guesses cannot slip past; a correct password clears the
 *   count for its name and address. Names that are not users are counted too.
 * - Expired sessions and stale attempt counts are deleted here, and the table is kept under
 *   MAX_ATTEMPT_ROWS rows.
 */
export async function signIn(username: string, password: string, userAgent: string, opts: { now?: Date; client?: string } = {}): Promise<SignInResult> {
  const now = opts.now ?? new Date();
  const key = usernameKey(String(username ?? "")).slice(0, MAX_USERNAME_LENGTH);
  const client = (opts.client ?? "unknown").slice(0, 100) || "unknown";
  const pw = String(password ?? "");
  const resetBefore = new Date(now.getTime() - ATTEMPT_RESET_MS);

  await q("DELETE FROM sessions WHERE expires_at <= $1", [now]);
  await q("DELETE FROM sign_in_attempts WHERE last_attempt_at <= $1 AND next_allowed_at <= $2", [resetBefore, now]);
  await q(
    `DELETE FROM sign_in_attempts WHERE ctid IN (
       SELECT ctid FROM sign_in_attempts ORDER BY last_attempt_at DESC OFFSET $1)`,
    [MAX_ATTEMPT_ROWS - 2] // room for the two rows this try may add
  );

  // Claim this try: refused while the address or the pair is waiting; otherwise counted, with its wait set.
  const waitUntil = await tx(async (c): Promise<Date | null> => {
    const addr = await c.query<{ next_allowed_at: Date }>("SELECT next_allowed_at FROM sign_in_attempts WHERE username_key = '' AND client = $1", [client]);
    const addrUntil = addr.rows[0] ? new Date(addr.rows[0].next_allowed_at) : null;
    if (addrUntil && addrUntil.getTime() > now.getTime()) return addrUntil;
    return claimTry(c, key, client, PAIR_FREE_FAILURES, now, resetBefore);
  });
  if (waitUntil) return { ok: false, reason: "wait", retryAfterSeconds: Math.max(1, Math.ceil((waitUntil.getTime() - now.getTime()) / 1000)) };

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
  if (!ok || !user) {
    // the address's own count: every failure from it, whatever the name
    await q(
      `INSERT INTO sign_in_attempts AS a (username_key, client, failures, last_attempt_at, next_allowed_at)
       VALUES ('', $1, 1, $2::timestamptz, $2::timestamptz + ${sqlDelay(ADDRESS_FREE_FAILURES, "1")})
       ON CONFLICT (username_key, client) DO UPDATE SET
         failures = CASE WHEN a.last_attempt_at <= $3::timestamptz THEN 1 ELSE a.failures + 1 END,
         last_attempt_at = $2::timestamptz,
         next_allowed_at = GREATEST(a.next_allowed_at, $2::timestamptz + ${sqlDelay(ADDRESS_FREE_FAILURES, "(CASE WHEN a.last_attempt_at <= $3::timestamptz THEN 1 ELSE a.failures + 1 END)")})`,
      [client, now, resetBefore]
    );
    return { ok: false, reason: "invalid" };
  }

  await q("DELETE FROM sign_in_attempts WHERE username_key = $1 AND client = $2", [key, client]);
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
