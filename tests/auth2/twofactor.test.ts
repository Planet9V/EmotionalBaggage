// Two-factor with an authenticator app and recovery codes, through the real route with AUTH2 on. Codes are computed
// in ./helpers.ts from RFC 6238, as an authenticator app does. Includes the replay guard: a code works once.
import QRCode from "qrcode";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { authenticatorCode, browser, cleanUp, forgetLastCode, newAccount, PASSWORD, useAuth2, type Browser } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let address = "";
let userId = "";
let me: Browser;
let uri = "";
let recovery: string[] = [];

beforeAll(async () => {
  ({ db, route } = await useAuth2());
  await cleanUp(db);
  const a = await newAccount(route, "grace");
  address = a.email;
  userId = a.userId;
  me = a.b;
});

afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

const flag = async () => (await db.query<{ twoFactorEnabled: boolean | null }>(`SELECT "twoFactorEnabled" FROM "user" WHERE id=$1`, [userId])).rows[0].twoFactorEnabled;
/** A browser that has given the password and now owes the code. */
async function halfSignedIn() {
  const b = browser(route);
  const first = await b.post<{ twoFactorRedirect?: boolean }>("/sign-in/email", { email: address, password: PASSWORD });
  expect(first.body.twoFactorRedirect).toBe(true);
  return b;
}

describe("enrolment", () => {
  it("needs the password and answers an otpauth address and ten recovery codes", async () => {
    expect((await me.post("/two-factor/enable", { password: "not it at all" })).status).toBe(400);
    const res = await me.post<{ totpURI: string; backupCodes: string[] }>("/two-factor/enable", { password: PASSWORD });
    expect(res.status).toBe(200);
    uri = res.body.totpURI;
    recovery = res.body.backupCodes;
    const u = new URL(uri);
    expect(u.protocol).toBe("otpauth:");
    expect(u.searchParams.get("issuer")).toBe("Shipwright");
    expect(decodeURIComponent(u.pathname)).toContain(address);
    expect(recovery).toHaveLength(10);
    expect(new Set(recovery).size).toBe(10);
  });

  it("the address draws as a QR code", async () => {
    expect(await QRCode.toString(uri, { type: "svg" })).toContain("<svg");
  });

  it("is not on until a first correct code; a wrong code leaves it off", async () => {
    expect(await flag()).not.toBe(true);
    expect((await me.post("/two-factor/verify-totp", { code: "000000" })).status).toBe(401);
    expect(await flag()).not.toBe(true);
    expect((await me.post("/two-factor/verify-totp", { code: authenticatorCode(uri) })).status).toBe(200);
    expect(await flag()).toBe(true);
    expect((await me.get("/get-session")).body).not.toBeNull();
  });

  it("keeps the secret and the recovery codes encrypted", async () => {
    const r = await db.query<{ secret: string; backupCodes: string }>(`SELECT secret, "backupCodes" FROM "twoFactor" WHERE "userId"=$1`, [userId]);
    expect(r.rows[0].secret).not.toContain(new URL(uri).searchParams.get("secret")!);
    for (const code of recovery) expect(r.rows[0].backupCodes).not.toContain(code);
  });
});

describe("signing in with a code", () => {
  it("the password alone starts no session; the right code completes it", async () => {
    await forgetLastCode(db, userId);
    const b = await halfSignedIn();
    expect(b.sessionToken()).toBeNull();
    expect((await b.get("/get-session")).body).toBeNull();
    expect((await b.post("/two-factor/verify-totp", { code: "123456" })).status).toBe(401);
    expect((await b.post("/two-factor/verify-totp", { code: authenticatorCode(uri) })).status).toBe(200);
    expect((await b.get<{ user: { email: string } }>("/get-session")).body.user.email).toBe(address);
  });

  it("a code cannot be used twice, even within its 30 seconds", async () => {
    await forgetLastCode(db, userId);
    const code = authenticatorCode(uri);
    const first = await halfSignedIn();
    expect((await first.post("/two-factor/verify-totp", { code })).status).toBe(200);
    const second = await halfSignedIn();
    const again = await second.post<{ code: string; message: string }>("/two-factor/verify-totp", { code });
    expect(again.status).toBe(401);
    expect(again.body.code).toBe("CODE_ALREADY_USED");
    expect((await second.get("/get-session")).body).toBeNull();
    // An earlier step's code is refused as well once a later one was used.
    const third = await halfSignedIn();
    expect((await third.post("/two-factor/verify-totp", { code: authenticatorCode(uri, Date.now() - 30_000) })).status).toBe(401);
    // The next step's code still works.
    expect((await third.post("/two-factor/verify-totp", { code: authenticatorCode(uri, Date.now() + 30_000) })).status).toBe(200);
  });

  it("two requests with the same code at the same moment: only one signs in", async () => {
    await forgetLastCode(db, userId);
    const code = authenticatorCode(uri);
    const a = await halfSignedIn();
    const b = await halfSignedIn();
    const [ra, rb] = await Promise.all([a.post("/two-factor/verify-totp", { code }), b.post("/two-factor/verify-totp", { code })]);
    expect([ra.status, rb.status].sort()).toEqual([200, 401]);
  });

  it("a code from another time window is refused", async () => {
    await forgetLastCode(db, userId);
    const b = await halfSignedIn();
    expect((await b.post("/two-factor/verify-totp", { code: authenticatorCode(uri, Date.now() - 10 * 60 * 1000) })).status).toBe(401);
  });

  it("the second step cannot be done without the first", async () => {
    await forgetLastCode(db, userId);
    expect((await browser(route).post("/two-factor/verify-totp", { code: authenticatorCode(uri) })).status).toBe(401);
  });
});

describe("recovery codes", () => {
  it("a recovery code completes sign-in once and is then spent", async () => {
    const b = await halfSignedIn();
    expect((await b.post("/two-factor/verify-backup-code", { code: recovery[0] })).status).toBe(200);
    expect((await b.get<{ user: { email: string } }>("/get-session")).body.user.email).toBe(address);
    const again = await halfSignedIn();
    expect((await again.post("/two-factor/verify-backup-code", { code: recovery[0] })).status).toBe(401);
    expect((await again.post("/two-factor/verify-backup-code", { code: recovery[1] })).status).toBe(200);
  });

  it("new recovery codes replace the old ones", async () => {
    const res = await me.post<{ backupCodes: string[] }>("/two-factor/generate-backup-codes", { password: PASSWORD });
    expect(res.status).toBe(200);
    const b = await halfSignedIn();
    expect((await b.post("/two-factor/verify-backup-code", { code: recovery[2] })).status).toBe(401);
    expect((await b.post("/two-factor/verify-backup-code", { code: res.body.backupCodes[0] })).status).toBe(200);
  });
});

describe("turning it off", () => {
  it("needs the password; sign-in is then one step again", async () => {
    expect((await me.post("/two-factor/disable", { password: "not it at all" })).status).toBe(400);
    expect((await me.post("/two-factor/disable", { password: PASSWORD })).status).toBe(200);
    expect(await flag()).toBe(false);
    const inn = await browser(route).post<{ twoFactorRedirect?: boolean; token?: string }>("/sign-in/email", { email: address, password: PASSWORD });
    expect(inn.body.twoFactorRedirect).toBeUndefined();
    expect(typeof inn.body.token).toBe("string");
  });
});
