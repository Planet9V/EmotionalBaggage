import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import {
  authCounters,
  changePassword,
  clearedSessionCookie,
  createSession,
  DEFAULT_PASSWORD,
  DEFAULT_USERNAME,
  ensureDefaultUser,
  hashPassword,
  LOCK_WINDOW_MS,
  sessionCookie,
  sessionFromRequest,
  sessionFromToken,
  signIn,
  signOut,
  verifyPassword,
} from "@/lib/auth";
import { SESSION_COOKIE } from "@/app/sign-in/shared";

// Test accounts are named zz-auth-*; the default `demo` account is never changed here, because
// every other test file signs in as `demo` (tests/auth/session.setup.ts).
const PREFIX = "zz-auth-";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function makeUser(name: string, password: string) {
  const [row] = await q<{ id: string }>("INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id", [
    name,
    await hashPassword(password),
  ]);
  return Number(row.id);
}

const withCookie = (token: string) => new Request("http://test.local/", { headers: { cookie: `other=1; ${SESSION_COOKIE}=${token}` } });

beforeAll(async () => {
  await q("DELETE FROM users WHERE username LIKE $1", [`${PREFIX}%`]);
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE $1", [`${PREFIX}%`]);
});

afterAll(async () => {
  await q("DELETE FROM users WHERE username LIKE $1", [`${PREFIX}%`]);
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE $1", [`${PREFIX}%`]);
  await pool().end();
});

describe("the default account", () => {
  it("is created once, as demo / demo, when there are no users", async () => {
    // Inside a transaction that is rolled back, so the real accounts are untouched.
    const c = await pool().connect();
    try {
      await c.query("BEGIN");
      await c.query("DELETE FROM users");
      expect(await ensureDefaultUser(c)).toBe(true);
      expect(await ensureDefaultUser(c)).toBe(false);
      const { rows } = await c.query("SELECT username, password_hash, password_changed_at FROM users");
      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe(DEFAULT_USERNAME);
      expect(rows[0].password_changed_at).toBeNull();
      expect(await verifyPassword(DEFAULT_PASSWORD, rows[0].password_hash)).toBe(true);
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });

  it("is not created when another account exists", async () => {
    const c = await pool().connect();
    try {
      await c.query("BEGIN");
      await c.query("DELETE FROM users");
      await c.query("INSERT INTO users (username, password_hash) VALUES ('owner', $1)", [await hashPassword("x")]);
      expect(await ensureDefaultUser(c)).toBe(false);
      const { rows } = await c.query("SELECT username FROM users");
      expect(rows.map((r) => r.username)).toEqual(["owner"]);
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });

  it("exists in the test database after start-up", async () => {
    const rows = await q("SELECT 1 FROM users WHERE username = $1", [DEFAULT_USERNAME]);
    expect(rows).toHaveLength(1);
  });

  it("refuses a second account whose name differs only in case", async () => {
    await makeUser(`${PREFIX}Case`, "password-1");
    await expect(makeUser(`${PREFIX}case`, "password-2")).rejects.toMatchObject({ code: "23505" });
  });
});

describe("signing in", () => {
  it("starts a session for the right password, whatever the case of the name", async () => {
    await makeUser(`${PREFIX}ok`, "right-password");
    const r = await signIn(`  ${PREFIX.toUpperCase()}OK `, "right-password", "test agent");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.session).toMatchObject({ username: `${PREFIX}ok`, usingDefaultPassword: true });
    // Only the hash of the token is stored.
    const rows = await q<{ token_sha256: string; user_agent: string }>("SELECT token_sha256, user_agent FROM sessions WHERE id = $1", [r.session.sessionId]);
    expect(rows[0].token_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token_sha256).not.toContain(r.token);
    expect(rows[0].user_agent).toBe("test agent");
    expect(await sessionFromRequest(withCookie(r.token))).toMatchObject({ username: `${PREFIX}ok` });
  });

  it("refuses a wrong password", async () => {
    await makeUser(`${PREFIX}wrong`, "right-password");
    expect(await signIn(`${PREFIX}wrong`, "wrong-password", "")).toEqual({ ok: false, reason: "invalid" });
  });

  it("answers an unknown name exactly as a wrong password, after the same scrypt work", async () => {
    await makeUser(`${PREFIX}known`, "right-password");
    const before = authCounters.dummyVerifications;
    const wrong = await signIn(`${PREFIX}known`, "nope", "");
    expect(authCounters.dummyVerifications).toBe(before); // a real user's hash was checked
    const unknown = await signIn(`${PREFIX}nobody-at-all`, "nope", "");
    expect(authCounters.dummyVerifications).toBe(before + 1); // the dummy hash was checked
    expect(unknown).toEqual(wrong);
  });

  it("locks a name after 5 failures in 15 minutes, and lets it in again after the window", async () => {
    const name = `${PREFIX}lock`;
    await makeUser(name, "right-password");
    const t0 = new Date();
    const at = (ms: number) => ({ now: new Date(t0.getTime() + ms) });
    for (let i = 0; i < 5; i++) {
      expect(await signIn(i % 2 ? name.toUpperCase() : name, "guess", "", at(i * 1000))).toEqual({ ok: false, reason: "invalid" });
    }
    const locked = await signIn(name, "guess", "", at(60_000));
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    if (!locked.ok && locked.reason === "locked") {
      expect(locked.retryAfterSeconds).toBe(14 * 60);
    }
    // The right password is refused too while the name is locked.
    expect(await signIn(name, "right-password", "", at(LOCK_WINDOW_MS - 1000))).toMatchObject({ ok: false, reason: "locked" });
    // The window counts from the first failure, and refused attempts do not extend it.
    const after = await signIn(name, "right-password", "", at(LOCK_WINDOW_MS + 1000));
    expect(after.ok).toBe(true);
    // Success clears the count.
    expect(await q("SELECT 1 FROM sign_in_attempts WHERE username_key = $1", [name])).toHaveLength(0);
  });

  it("locks names that are not users too, so locking does not reveal which names exist", async () => {
    const name = `${PREFIX}ghost`;
    for (let i = 0; i < 5; i++) expect((await signIn(name, "guess", "")).ok).toBe(false);
    expect(await signIn(name, "guess", "")).toMatchObject({ ok: false, reason: "locked" });
  });

  it("counts parallel guesses, so they cannot slip past the limit", async () => {
    const name = `${PREFIX}burst`;
    await makeUser(name, "right-password");
    const results = await Promise.all(Array.from({ length: 8 }, () => signIn(name, "guess", "")));
    expect(results.filter((r) => !r.ok && r.reason === "invalid")).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.reason === "locked")).toHaveLength(3);
  });

  it("keeps the failure count in the database, so a restart does not reset it", async () => {
    const name = `${PREFIX}persist`;
    await signIn(name, "guess", "");
    const rows = await q<{ failures: number }>("SELECT failures FROM sign_in_attempts WHERE username_key = $1", [name]);
    expect(rows[0].failures).toBe(1);
  });
});

describe("sessions", () => {
  it("expire after 30 days unused", async () => {
    const id = await makeUser(`${PREFIX}expiry`, "pw-expiry-1");
    const t0 = new Date();
    const token = await createSession(id, "", { now: t0 });
    expect(await sessionFromToken(token, { now: new Date(t0.getTime() + 29 * DAY) })).not.toBeNull();
    // A fresh token for the same user, so the use above does not extend this one.
    const token2 = await createSession(id, "", { now: t0 });
    expect(await sessionFromToken(token2, { now: new Date(t0.getTime() + 30 * DAY + 1000) })).toBeNull();
  });

  it("are extended when used, but written at most once an hour", async () => {
    const id = await makeUser(`${PREFIX}touch`, "pw-touch-1");
    const t0 = new Date();
    const token = await createSession(id, "", { now: t0 });
    const row = async () =>
      (await q<{ last_seen_at: Date; expires_at: Date }>("SELECT last_seen_at, expires_at FROM sessions WHERE user_id = $1", [id]))[0];
    const first = await row();
    await sessionFromToken(token, { now: new Date(t0.getTime() + 30 * 60 * 1000) });
    expect(await row()).toEqual(first); // half an hour later: no write
    const later = new Date(t0.getTime() + 2 * HOUR);
    await sessionFromToken(token, { now: later });
    const moved = await row();
    expect(moved.last_seen_at.getTime()).toBe(later.getTime());
    expect(moved.expires_at.getTime()).toBe(later.getTime() + 30 * DAY);
  });

  it("end when signed out", async () => {
    await makeUser(`${PREFIX}out`, "pw-out-1");
    const r = await signIn(`${PREFIX}out`, "pw-out-1", "");
    if (!r.ok) throw new Error("sign-in failed");
    await signOut(r.token);
    expect(await sessionFromToken(r.token)).toBeNull();
    await expect(signOut(r.token)).resolves.toBeUndefined(); // twice is fine
    await expect(signOut("not a token")).resolves.toBeUndefined();
  });

  it("ignore a malformed or unknown cookie", async () => {
    expect(await sessionFromRequest(new Request("http://t/"))).toBeNull();
    expect(await sessionFromRequest(withCookie("short"))).toBeNull();
    expect(await sessionFromRequest(withCookie("A".repeat(43)))).toBeNull();
    expect(await sessionFromRequest(withCookie("' OR 1=1 --AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))).toBeNull();
  });

  it("end when the user is deleted", async () => {
    const id = await makeUser(`${PREFIX}gone`, "pw-gone-1");
    const token = await createSession(id, "");
    await q("DELETE FROM users WHERE id = $1", [id]);
    expect(await sessionFromToken(token)).toBeNull();
  });
});

describe("changing the password", () => {
  it("checks the current password, refuses short and default passwords, and ends the other sessions", async () => {
    const name = `${PREFIX}change`;
    await makeUser(name, "first-password");
    const a = await signIn(name, "first-password", "browser A");
    const b = await signIn(name, "first-password", "browser B");
    if (!a.ok || !b.ok) throw new Error("sign-in failed");
    const uid = a.session.userId;

    expect(await changePassword(uid, "not-it", "second-password", a.session.sessionId)).toMatchObject({ ok: false, field: "current" });
    expect(await changePassword(uid, "first-password", "short", a.session.sessionId)).toMatchObject({ ok: false, field: "next" });
    const dflt = await changePassword(uid, "first-password", DEFAULT_PASSWORD, a.session.sessionId);
    expect(dflt).toMatchObject({ ok: false, field: "next" });
    expect(dflt.ok ? "" : dflt.error).toMatch(/default/);
    // Nothing changed so far: both sessions are alive and the old password works.
    expect(await sessionFromToken(b.token)).not.toBeNull();

    expect(await changePassword(uid, "first-password", "second-password", a.session.sessionId)).toEqual({ ok: true });
    expect(await sessionFromToken(a.token)).toMatchObject({ usingDefaultPassword: false });
    expect(await sessionFromToken(b.token)).toBeNull();
    expect((await signIn(name, "first-password", "")).ok).toBe(false);
    expect((await signIn(name, "second-password", "")).ok).toBe(true);
  });
});

describe("the cookie", () => {
  const token = "A".repeat(43);
  it("is HttpOnly, SameSite=Lax, Path=/, 30 days, and not Secure over plain http", () => {
    const c = sessionCookie(token, new Request("http://localhost:3000/api/auth/sign-in"));
    expect(c).toBe(`${SESSION_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`);
  });
  it("is Secure when the request arrived over https", () => {
    expect(sessionCookie(token, new Request("https://c2r.example/api/auth/sign-in"))).toMatch(/; Secure$/);
    expect(
      sessionCookie(token, new Request("http://127.0.0.1:3000/api/auth/sign-in", { headers: { "x-forwarded-proto": "https" } }))
    ).toMatch(/; Secure$/);
    expect(
      sessionCookie(token, new Request("http://127.0.0.1:3000/api/auth/sign-in", { headers: { "x-forwarded-proto": "http" } }))
    ).not.toMatch(/Secure/);
  });
  it("is removed with Max-Age=0 on sign-out", () => {
    expect(clearedSessionCookie(new Request("http://localhost/"))).toBe(`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  });
});
