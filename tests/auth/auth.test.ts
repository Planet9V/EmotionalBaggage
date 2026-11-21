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
  ADDRESS_FREE_FAILURES,
  clientAddress,
  delayAfter,
  MAX_ATTEMPT_ROWS,
  PAIR_FREE_FAILURES,
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

// Throttling counts per client address too, so every count this file makes is removed before and after.
beforeAll(async () => {
  await q("DELETE FROM users WHERE username LIKE $1", [`${PREFIX}%`]);
  await q("DELETE FROM sign_in_attempts");
});

afterAll(async () => {
  await q("DELETE FROM users WHERE username LIKE $1", [`${PREFIX}%`]);
  await q("DELETE FROM sign_in_attempts");
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

  // Robustness review S4: 5 wrong passwords for demo used to lock the owner out for 15 minutes, repeatably.
  it("the reviewer's repro: guesses from another address never delay the owner", async () => {
    const name = `${PREFIX}owner`;
    await makeUser(name, "right-password");
    const t0 = new Date();
    for (let i = 0; i < 40; i++) await signIn(name, "guess", "", { now: new Date(t0.getTime() + i * 1000), client: "203.0.113.66" });
    const r = await signIn(name, "right-password", "", { now: new Date(t0.getTime() + 41_000), client: "198.51.100.7" });
    expect(r.ok).toBe(true);
  });

  it("slows one name from one address with growing delays, and lets the right password in once its delay has passed", async () => {
    const name = `${PREFIX}slow`;
    await makeUser(name, "right-password");
    const t0 = new Date();
    const at = (ms: number) => ({ now: new Date(t0.getTime() + ms), client: "192.0.2.10" });
    for (let i = 0; i < PAIR_FREE_FAILURES; i++) {
      expect(await signIn(i % 2 ? name.toUpperCase() : name, "guess", "", at(i))).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await signIn(name, "guess", "", at(10))).toEqual({ ok: false, reason: "invalid" }); // the 4th sets a 1 s wait
    expect(await signIn(name, "right-password", "", at(500))).toEqual({ ok: false, reason: "wait", retryAfterSeconds: 1 });
    expect(await signIn(name, "guess", "", at(1010))).toEqual({ ok: false, reason: "invalid" }); // the 5th: 2 s
    expect(await signIn(name, "guess", "", at(2000))).toMatchObject({ reason: "wait", retryAfterSeconds: 2 });
    // a refused try does not count or extend the wait
    expect((await signIn(name, "right-password", "", at(3010))).ok).toBe(true);
    expect(await q("SELECT 1 FROM sign_in_attempts WHERE username_key = $1", [name])).toHaveLength(0);
  });

  it("caps the delay at 15 minutes", () => {
    expect([1, 3, 4, 5, 6, 13, 14, 50].map((f) => delayAfter(f, 3))).toEqual([0, 0, 1000, 2000, 4000, 512_000, 900_000, 900_000]);
  });

  it("slows an address that tries many names, whatever the names", async () => {
    const t0 = new Date();
    const at = (ms: number) => ({ now: new Date(t0.getTime() + ms), client: "192.0.2.20" });
    for (let i = 0; i < ADDRESS_FREE_FAILURES; i++) expect(await signIn(`${PREFIX}spray-${i}`, "guess", "", at(i))).toEqual({ ok: false, reason: "invalid" });
    expect(await signIn(`${PREFIX}spray-x`, "guess", "", at(100))).toEqual({ ok: false, reason: "invalid" });
    expect(await signIn(`${PREFIX}spray-y`, "guess", "", at(200))).toMatchObject({ ok: false, reason: "wait" });
    // another address is not affected
    expect(await signIn(`${PREFIX}spray-y`, "guess", "", { now: new Date(t0.getTime() + 200), client: "192.0.2.21" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("counts names that are not users too, so throttling does not reveal which names exist", async () => {
    const name = `${PREFIX}ghost`;
    const t0 = new Date();
    for (let i = 0; i <= PAIR_FREE_FAILURES; i++) expect((await signIn(name, "guess", "", { now: t0, client: "192.0.2.30" })).ok).toBe(false);
    expect(await signIn(name, "guess", "", { now: t0, client: "192.0.2.30" })).toMatchObject({ ok: false, reason: "wait" });
  });

  it("counts parallel guesses, so they cannot slip past", async () => {
    const name = `${PREFIX}burst`;
    await makeUser(name, "right-password");
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 8 }, () => signIn(name, "guess", "", { now, client: "192.0.2.40" })));
    expect(results.filter((r) => !r.ok && r.reason === "invalid")).toHaveLength(PAIR_FREE_FAILURES + 1);
    expect(results.filter((r) => !r.ok && r.reason === "wait")).toHaveLength(8 - PAIR_FREE_FAILURES - 1);
  });

  it("keeps the counts in the database, so a restart does not reset them, and keeps the table bounded", async () => {
    const name = `${PREFIX}persist`;
    await signIn(name, "guess", "", { client: "192.0.2.50" });
    const rows = await q<{ failures: number }>("SELECT failures FROM sign_in_attempts WHERE username_key = $1 AND client = $2", [name, "192.0.2.50"]);
    expect(rows[0].failures).toBe(1);
    await q(
      "INSERT INTO sign_in_attempts (username_key, client, failures, last_attempt_at, next_allowed_at) SELECT 'zz-auth-fill-' || g, '192.0.2.60', 1, now(), now() FROM generate_series(1, $1) g",
      [MAX_ATTEMPT_ROWS + 5]
    );
    await signIn(name, "guess", "", { client: "192.0.2.50" });
    const [{ n }] = await q<{ n: number }>("SELECT count(*)::int AS n FROM sign_in_attempts");
    expect(n).toBeLessThanOrEqual(MAX_ATTEMPT_ROWS);
    await q("DELETE FROM sign_in_attempts WHERE client = '192.0.2.60'");
  });

  it("reads the client address from the connection, and X-Forwarded-For only behind a proxy", () => {
    const req = (h: Record<string, string>) => new Request("http://test.local/", { headers: h });
    const before = process.env.TRUST_PROXY;
    try {
      delete process.env.TRUST_PROXY;
      expect(clientAddress(req({ "x-forwarded-for": "1.1.1.1", "x-c2r-client-address": "10.0.0.9" }))).toBe("10.0.0.9");
      expect(clientAddress(req({ "x-forwarded-for": "1.1.1.1" }))).toBe("unknown");
      process.env.TRUST_PROXY = "1";
      expect(clientAddress(req({ "x-forwarded-for": "6.6.6.6, 1.1.1.1", "x-c2r-client-address": "10.0.0.9" }))).toBe("1.1.1.1");
    } finally {
      if (before === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = before;
    }
  });
});

describe("sessions", () => {
  // Robustness review S9: a session used at least once a month lived for ever.
  it("end 90 days after signing in, however often they are used", async () => {
    const id = await makeUser(`${PREFIX}absolute`, "pw-absolute-1");
    const t0 = new Date();
    const token = await createSession(id, "", { now: t0 });
    for (const day of [20, 40, 60, 80, 89]) expect(await sessionFromToken(token, { now: new Date(t0.getTime() + day * DAY) }), `day ${day}`).not.toBeNull();
    const [row] = await q<{ expires_at: Date }>("SELECT expires_at FROM sessions WHERE user_id = $1", [id]);
    expect(new Date(row.expires_at).getTime()).toBeLessThanOrEqual(t0.getTime() + 90 * DAY);
    expect(await sessionFromToken(token, { now: new Date(t0.getTime() + 90 * DAY + 1000) })).toBeNull();
  });

  it("sign out everywhere ends every session of the user, this one included", async () => {
    const id = await makeUser(`${PREFIX}everywhere`, "pw-everywhere-1");
    const a = await createSession(id, "browser a");
    const b = await createSession(id, "browser b");
    const { POST } = await import("@/app/api/auth/sign-out-everywhere/route");
    const res = await POST(new Request("http://test.local/api/auth/sign-out-everywhere", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${a}`, origin: "http://test.local", host: "test.local" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ended: 2 });
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(await sessionFromToken(a)).toBeNull();
    expect(await sessionFromToken(b)).toBeNull();
    const again = await POST(new Request("http://test.local/api/auth/sign-out-everywhere", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${b}`, origin: "http://test.local", host: "test.local" } }));
    expect(again.status).toBe(401);
  });

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
