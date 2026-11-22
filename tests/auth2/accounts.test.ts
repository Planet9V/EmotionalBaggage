// The new sign-in through its real route, with AUTH2 on: sign-up with email confirmation, sign-in, password change and
// reset, cross-site refusal, throttling, and what is stored (hashed tokens, the app's password hashing, a workspace).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { hashToken } from "@/lib/auth2/tokenHash";
import { browser, cleanUp, email, lastMail, newAccount, PASSWORD, sent, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];

beforeAll(async () => {
  ({ db, route } = await useAuth2());
  await cleanUp(db);
});

afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

describe("sign-up and confirmation", () => {
  it("creates an unconfirmed account, starts no session and sends one confirmation email", async () => {
    const address = email("ada");
    const b = browser(route);
    const before = sent.length;
    const up = await b.post<{ token: string | null }>("/sign-up/email", { name: "Ada", email: address, password: PASSWORD });
    expect(up.status).toBe(200);
    expect(up.body.token).toBeNull();
    expect(b.sessionToken()).toBeNull();
    expect(sent.length).toBe(before + 1);
    const mail = lastMail("confirm-email", address);
    expect(mail.link.startsWith("http://localhost:3322/auth/confirm?token=")).toBe(true);
    const u = await db.query<{ emailVerified: boolean }>('SELECT "emailVerified" FROM "user" WHERE email=$1', [address]);
    expect(u.rows[0].emailVerified).toBe(false);
  });

  it("a sign-up cannot sign in before confirming; after confirming it can", async () => {
    const address = email("bea");
    const b = browser(route);
    await b.post("/sign-up/email", { name: "Bea", email: address, password: PASSWORD });
    const early = await b.post<{ code: string }>("/sign-in/email", { email: address, password: PASSWORD });
    expect(early.status).toBe(403);
    expect(early.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(b.sessionToken()).toBeNull();

    expect((await b.get(`/verify-email?token=not-a-token`)).status).toBeGreaterThanOrEqual(400);
    const ok = await b.get(`/verify-email?token=${encodeURIComponent(lastMail("confirm-email", address).token)}`);
    expect(ok.status).toBe(200);
    // Confirming does not sign in by itself.
    expect(b.sessionToken()).toBeNull();

    const inn = await b.post("/sign-in/email", { email: address, password: PASSWORD });
    expect(inn.status).toBe(200);
    const s = await b.get<{ user: { email: string } }>("/get-session");
    expect(s.body.user.email).toBe(address);
  });

  it("a second sign-up for the same address does not say the address is taken and makes no second account", async () => {
    const a = await newAccount(route, "cal");
    const again = await browser(route).post("/sign-up/email", { name: "Someone", email: a.email, password: "another password" });
    expect(again.status).toBe(200);
    expect((await db.query('SELECT 1 FROM "user" WHERE email=$1', [a.email])).rowCount).toBe(1);
  });

  it("refuses a password under eight characters", async () => {
    const res = await browser(route).post<{ code: string }>("/sign-up/email", { name: "Short", email: email("short"), password: "demo" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PASSWORD_TOO_SHORT");
  });

  it("gives every new account a workspace it owns, and starts each session in it", async () => {
    const a = await newAccount(route, "dee");
    expect(a.workspaceId).toBeTruthy();
    const m = await db.query<{ role: string }>('SELECT role FROM member WHERE "userId"=$1 AND "organizationId"=$2', [a.userId, a.workspaceId]);
    expect(m.rows).toEqual([{ role: "owner" }]);
  });
});

describe("what is stored", () => {
  it("stores the session token only as its hash", async () => {
    const a = await newAccount(route, "eve");
    const token = a.b.sessionToken()!;
    expect(token).toBeTruthy();
    const rows = await db.query<{ token: string }>('SELECT token FROM "session" WHERE "userId"=$1', [a.userId]);
    expect(rows.rows.map((r) => r.token)).toEqual([hashToken(token)]);
    expect(rows.rows[0].token).not.toContain(token);
    // A cookie holding the stored value instead of the token is not a session.
    const forged = browser(route);
    forged.jar.set([...a.b.jar.keys()].find((k) => k.endsWith("session_token"))!, encodeURIComponent(`${rows.rows[0].token}.x`));
    expect((await forged.get("/get-session")).body).toBeNull();
  });

  it("stores the password with this app's scrypt", async () => {
    const a = await newAccount(route, "fay");
    const r = await db.query<{ password: string }>(`SELECT password FROM account WHERE "userId"=$1 AND "providerId"='credential'`, [a.userId]);
    expect(r.rows[0].password).toMatch(/^scrypt\$ln=17,r=8,p=1\$/);
  });

  it("stores reset tokens hashed", async () => {
    const a = await newAccount(route, "gus");
    await browser(route).post("/request-password-reset", { email: a.email });
    const token = lastMail("reset-password", a.email).token;
    const r = await db.query<{ identifier: string }>("SELECT identifier FROM verification");
    expect(r.rows.some((x) => x.identifier.includes(token))).toBe(false);
  });

  it("writes sign-up and sign-in to the audit log", async () => {
    const a = await newAccount(route, "hal");
    const r = await db.query<{ action: string }>("SELECT action FROM audit_log WHERE actor=$1 ORDER BY id", [a.email]);
    expect(r.rows.map((x) => x.action)).toEqual(expect.arrayContaining(["account.signed_up", "account.signed_in"]));
  });
});

describe("session lifetime", () => {
  it("slides to 30 days from use, but never past 90 days from sign-in", async () => {
    const a = await newAccount(route, "pia");
    const day = 24 * 60 * 60 * 1000;
    // As if signed in 89.5 days ago and last refreshed 29 days ago.
    await db.query(`UPDATE "session" SET "createdAt" = now() - interval '89 days 12 hours', "expiresAt" = now() + interval '1 day' WHERE "userId"=$1`, [a.userId]);
    expect((await a.b.get("/get-session")).body).not.toBeNull();
    const r = await db.query<{ expiresAt: Date; createdAt: Date }>(`SELECT "expiresAt", "createdAt" FROM "session" WHERE "userId"=$1`, [a.userId]);
    const end = new Date(r.rows[0].expiresAt).getTime();
    expect(Math.abs(end - (new Date(r.rows[0].createdAt).getTime() + 90 * day))).toBeLessThan(1000);
    // Past that, the session is over.
    await db.query(`UPDATE "session" SET "createdAt" = now() - interval '91 days', "expiresAt" = now() - interval '1 day' WHERE "userId"=$1`, [a.userId]);
    expect((await a.b.get("/get-session")).body).toBeNull();
  });

  it("sets the session cookie HttpOnly, SameSite=Lax, under its own name", async () => {
    const b = browser(route);
    const a = await newAccount(route, "quin");
    const res = await b.post("/sign-in/email", { email: a.email, password: PASSWORD });
    const line = res.headers.getSetCookie().find((l) => l.startsWith("c2r2.session_token="))!;
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    expect(line).toMatch(/Max-Age=2592000/);
  });
});

describe("password change and reset", () => {
  it("change needs the current password and can sign out the other browsers", async () => {
    const a = await newAccount(route, "ivy");
    const other = browser(route);
    await other.post("/sign-in/email", { email: a.email, password: PASSWORD });
    expect((await other.get("/get-session")).body).not.toBeNull();

    const wrong = await a.b.post("/change-password", { currentPassword: "not it at all", newPassword: "a new password", revokeOtherSessions: true });
    expect(wrong.status).toBe(400);
    const ok = await a.b.post("/change-password", { currentPassword: PASSWORD, newPassword: "a new password", revokeOtherSessions: true });
    expect(ok.status).toBe(200);
    expect((await a.b.get("/get-session")).body).not.toBeNull();
    expect((await other.get("/get-session")).body).toBeNull();
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: "a new password" })).status).toBe(200);
  });

  it("signing out the other browsers keeps this one", async () => {
    const a = await newAccount(route, "jo");
    const other = browser(route);
    await other.post("/sign-in/email", { email: a.email, password: PASSWORD });
    expect((await a.b.post("/revoke-other-sessions", {})).status).toBe(200);
    expect((await a.b.get("/get-session")).body).not.toBeNull();
    expect((await other.get("/get-session")).body).toBeNull();
  });

  it("a reset link works once and ends every session", async () => {
    const a = await newAccount(route, "kit");
    const asker = browser(route);
    expect((await asker.post("/request-password-reset", { email: a.email })).status).toBe(200);
    const token = lastMail("reset-password", a.email).token;
    expect(lastMail("reset-password", a.email).link).toBe(`http://localhost:3322/auth/reset/new?token=${encodeURIComponent(token)}`);
    const first = await asker.post("/reset-password", { token, newPassword: "reset password one" });
    expect(first.status).toBe(200);
    expect((await a.b.get("/get-session")).body).toBeNull();
    const second = await asker.post("/reset-password", { token, newPassword: "reset password two" });
    expect(second.status).toBe(400);
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: "reset password one" })).status).toBe(200);
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: "reset password two" })).status).toBe(401);
  });

  it("asking a reset for an address nobody has answers the same and sends nothing", async () => {
    const before = sent.length;
    const res = await browser(route).post("/request-password-reset", { email: email("nobody") });
    expect(res.status).toBe(200);
    expect(sent.length).toBe(before);
  });
});

describe("cross-site requests and throttling", () => {
  it("refuses a state-changing request from another site, signed in or not", async () => {
    const a = await newAccount(route, "lee");
    const out = await a.b.post("/sign-out", {}, "https://evil.example");
    expect(out.status).toBe(403);
    expect((await a.b.get("/get-session")).body).not.toBeNull();
    const up = await browser(route, { origin: "https://evil.example" }).post("/sign-up/email", { name: "X", email: email("evil"), password: PASSWORD });
    expect(up.status).toBe(403);
  });

  it("Better Auth's own origin check is on, behind the app's check", async () => {
    // Straight to Better Auth's handler, without route.open in front: its check alone must refuse.
    const { auth } = await useAuth2();
    const a = await newAccount(route, "nia");
    const res = await auth.handler(
      new Request(`http://localhost:3322/api/auth2/sign-out`, {
        method: "POST",
        headers: { origin: "https://evil.example", host: "localhost:3322", cookie: a.b.cookieHeader(), "content-type": "application/json", "x-c2r-client-address": a.b.address },
        body: "{}",
      })
    );
    expect(res.status).toBe(403);
    expect((await a.b.get("/get-session")).body).not.toBeNull();
    // And a request whose Host was made to match its Origin passes the app's check but not Better Auth's list.
    const spoofed = await auth.handler(
      new Request(`http://evil.example/api/auth2/sign-up/email`, {
        method: "POST",
        headers: { origin: "https://evil.example", host: "evil.example", "content-type": "application/json", "x-c2r-client-address": "203.0.113.7" },
        body: JSON.stringify({ name: "X", email: email("spoof"), password: PASSWORD }),
      })
    );
    expect(spoofed.status).toBe(403);
  });

  it("refuses the request when the Origin is this host on another scheme or port", async () => {
    const a = await newAccount(route, "max");
    expect((await a.b.post("/sign-out", {}, "http://localhost:4000")).status).toBe(403);
  });

  it("allows three sign-in tries in ten seconds from one address, then answers 429; another address is not held up", async () => {
    const a = await newAccount(route, "ned");
    const b = browser(route);
    for (let i = 0; i < 3; i++) expect((await b.post("/sign-in/email", { email: a.email, password: "wrong password" })).status).toBe(401);
    expect((await b.post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(429);
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(200);
  });

  it("does not offer the endpoints that would need a stored token handed back", async () => {
    const a = await newAccount(route, "oli");
    expect((await a.b.get("/list-sessions")).status).toBe(404);
    expect((await a.b.post("/revoke-session", { token: "x" })).status).toBe(404);
    expect((await a.b.post("/two-factor/send-otp", {})).status).toBe(404);
  });
});
