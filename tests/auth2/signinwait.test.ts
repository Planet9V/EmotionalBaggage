// The per-account sign-in wait (accounts slice 2, step 5; review note N4), through the real route. Better Auth's
// per-address throttle is off in this file so the account rule is seen on its own; tests/auth2/accounts.test.ts and
// review.test.ts cover the per-address one.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { PAIR_FREE, claimTry, clearTries, nameKey } from "@/lib/auth2/signInWait";
import { adminOps } from "@/lib/auth2/adminOps";
import { clientBucket } from "@/lib/auth2/clientAddress";
import { browser, cleanUp, email, lastMail, newAccount, PASSWORD, useAuth2, waitForMail } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let auth: Awaited<ReturnType<typeof useAuth2>>["auth"];

beforeAll(async () => {
  ({ db, route, auth } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
  await db.query("DELETE FROM auth2_sign_in_waits");
});

afterAll(async () => {
  await db.query("DELETE FROM auth2_sign_in_waits");
  await cleanUp(db);
  delete process.env.AUTH2;
});

const tryIn = (address: string, who: string, password: string) => browser(route, { address }).post<{ code?: string }>("/sign-in/email", { email: who, password });
/** Moves every wait for a name into the past, as if the time had passed. */
const pass = (who: string) => db.query("UPDATE auth2_sign_in_waits SET next_allowed_at = now() - interval '1 second' WHERE name_key = $1", [nameKey(who)]);

describe("one name from one address", () => {
  it(`after ${PAIR_FREE} wrong passwords the next try waits, and is refused without checking the password`, async () => {
    const a = await newAccount(route, "wait-pair");
    for (let i = 0; i < PAIR_FREE; i++) expect((await tryIn("203.0.113.10", a.email, "wrong password")).status).toBe(401);
    // The fourth is counted and checked (the wait starts after it)...
    expect((await tryIn("203.0.113.10", a.email, "wrong password")).status).toBe(401);
    // ...and the fifth must wait: even the right password is not looked at. (The wait is one second; it is stretched
    // here so a slow machine cannot outlast it between two requests.)
    await db.query("UPDATE auth2_sign_in_waits SET next_allowed_at = now() + interval '1 minute' WHERE name_key = $1 AND client <> '' AND next_allowed_at > now() - interval '10 seconds'", [nameKey(a.email)]);
    const res = await tryIn("203.0.113.10", a.email, PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("SIGN_IN_WAIT");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    await pass(a.email);
    expect((await tryIn("203.0.113.10", a.email, PASSWORD)).status).toBe(200);
    expect((await db.query("SELECT 1 FROM auth2_sign_in_waits WHERE name_key = $1 AND client <> ''", [nameKey(a.email)])).rowCount).toBe(0);
  });

  it("another address is not held up by it", async () => {
    const a = await newAccount(route, "wait-other");
    for (let i = 0; i < PAIR_FREE + 1; i++) await tryIn("203.0.113.11", a.email, "wrong password");
    expect((await tryIn("203.0.113.11", a.email, PASSWORD)).status).toBe(429);
    expect((await tryIn("203.0.113.12", a.email, PASSWORD)).status).toBe(200);
  });

  it("parallel guesses cannot slip past the count", async () => {
    const a = await newAccount(route, "wait-race");
    const all = await Promise.all(Array.from({ length: 8 }, () => tryIn("203.0.113.13", a.email, "wrong password")));
    const checked = all.filter((r) => r.status === 401).length;
    expect(checked).toBeLessThanOrEqual(PAIR_FREE + 1);
    expect(all.filter((r) => r.status === 429).length).toBe(8 - checked);
  });
});

const LOCKED = "Too many failed sign-ins for this address, so it is locked for now. To get in at once, choose a new password with \"Forgotten your password?\", or ask an administrator to unlock it.";
/** Seven wrong passwords for a name, each from its own address (so the per-address wait never applies). */
async function sevenWrong(who: string, net: string) {
  const statuses: number[] = [];
  for (let i = 1; i <= 7; i++) statuses.push((await tryIn(`${net}.${i}`, who, "wrong password")).status);
  return statuses;
}

describe("the lock: 7 failed sign-ins in a row (owner's ruling of 23 Nov)", () => {
  it("after exactly 7 wrong passwords the 8th try is refused, even with the right password, and the lock is audited", async () => {
    const a = await newAccount(route, "lock-seven");
    const before = await sevenWrong(a.email, "198.18.0");
    expect(before).toEqual([401, 401, 401, 401, 401, 401, 401]);
    const res = await tryIn("198.18.1.1", a.email, PASSWORD);
    expect([res.status, res.body.code, (res.body as { message?: string }).message]).toEqual([429, "SIGN_IN_LOCKED", LOCKED]);
    expect(res.headers.get("retry-after")).toBeNull();
    const row = await db.query<{ failures: number; mins: number }>("SELECT failures, round(extract(epoch FROM locked_until - now()) / 60)::int AS mins FROM auth2_sign_in_waits WHERE name_key = $1 AND client = ''", [nameKey(a.email)]);
    expect(row.rows[0]).toMatchObject({ failures: 7, mins: 30 });
    const line = await db.query<{ action: string; summary: string }>("SELECT action, summary FROM audit_log WHERE actor = $1 AND action = 'account.locked'", [a.email]);
    expect(line.rows[0]?.summary).toMatch(/7 failed sign-ins in a row \(for 30 minutes\)/);
  });

  it("6 wrong then a right password: the count goes back to 0, so 7 more are needed", async () => {
    const a = await newAccount(route, "lock-reset");
    for (let i = 1; i <= 6; i++) await tryIn(`198.18.2.${i}`, a.email, "wrong password");
    expect((await tryIn("198.18.2.50", a.email, PASSWORD)).status).toBe(200);
    expect((await sevenWrong(a.email, "198.18.3")).every((x) => x === 401)).toBe(true);
    expect((await tryIn("198.18.3.50", a.email, PASSWORD)).body.code).toBe("SIGN_IN_LOCKED");
  });

  it("an unknown address gets the same answers at the same tries, and names are stored only as hashes", async () => {
    const nobody = email("nobody-here");
    expect(await sevenWrong(nobody, "198.18.4")).toEqual([401, 401, 401, 401, 401, 401, 401]);
    const res = await tryIn("198.18.5.1", nobody, "anything");
    expect([res.status, res.body.code, (res.body as { message?: string }).message]).toEqual([429, "SIGN_IN_LOCKED", LOCKED]);
    const all = JSON.stringify((await db.query("SELECT * FROM auth2_sign_in_waits")).rows);
    expect(all).not.toContain("@zz-auth2.test");
    expect(all).toContain(nameKey(nobody));
    // and no audit line names an address that has no account
    expect((await db.query("SELECT 1 FROM audit_log WHERE actor = $1", [nobody])).rowCount).toBe(0);
  });

  it("a lock that has run out starts again from 0; 'until unlocked' holds until an administrator unlocks, audited", async () => {
    const a = await newAccount(route, "lock-ends");
    await sevenWrong(a.email, "198.18.6");
    await db.query("UPDATE auth2_sign_in_waits SET locked_until = now() - interval '1 second' WHERE name_key = $1 AND client = ''", [nameKey(a.email)]);
    expect((await tryIn("198.18.7.1", a.email, PASSWORD)).status).toBe(200);
    await db.query(`INSERT INTO auth2_settings (key, value) VALUES ('signIn.lockMinutes', '0') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    try {
      await sevenWrong(a.email, "198.18.8");
      const r = await db.query<{ forever: boolean }>("SELECT locked_until = 'infinity' AS forever FROM auth2_sign_in_waits WHERE name_key = $1 AND client = ''", [nameKey(a.email)]);
      expect(r.rows[0]?.forever).toBe(true);
      const adm = await newAccount(route, "lock-admin");
      await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [adm.userId]);
      const ops = adminOps({ db, auth, actorId: adm.userId, baseURL: "http://localhost:3322" });
      expect((await ops.listUsers({ state: "locked" })).users.find((u) => u.id === a.userId)?.lockedUntil).toBe("until-unlocked");
      await ops.unlock(a.userId);
      expect((await tryIn("198.18.9.1", a.email, PASSWORD)).status).toBe(200);
      expect((await db.query("SELECT 1 FROM audit_log WHERE actor = $1 AND action = 'platform.user_unlocked'", [adm.email])).rowCount).toBe(1);
      // A platform administrator is never locked for good: 30 minutes at most.
      await sevenWrong(adm.email, "198.18.10");
      const m = await db.query<{ mins: number }>("SELECT round(extract(epoch FROM locked_until - now()) / 60)::int AS mins FROM auth2_sign_in_waits WHERE name_key = $1 AND client = ''", [nameKey(adm.email)]);
      expect(m.rows[0]?.mins).toBe(30);
    } finally {
      await db.query("DELETE FROM auth2_settings WHERE key = 'signIn.lockMinutes'");
    }
  });

  it("the locked person gets back in with a reset link, which lifts the lock", async () => {
    const a = await newAccount(route, "lock-selfreset");
    await sevenWrong(a.email, "198.18.11");
    await browser(route).post("/request-password-reset", { email: a.email, redirectTo: "/auth/reset/new" });
    await waitForMail("reset-password", a.email, 1);
    expect((await browser(route).post("/reset-password", { token: lastMail("reset-password", a.email).token, newPassword: "Back in again 2!" })).status).toBe(200);
    expect((await tryIn("198.18.12.1", a.email, "Back in again 2!")).status).toBe(200);
  });

  it("parallel wrong passwords cannot get past 7", async () => {
    const a = await newAccount(route, "lock-race");
    const all = await Promise.all(Array.from({ length: 12 }, (_, i) => tryIn(`198.18.13.${i + 1}`, a.email, "wrong password")));
    expect(all.filter((r) => r.status === 401).length).toBeLessThanOrEqual(7);
    expect((await tryIn("198.18.14.1", a.email, PASSWORD)).body.code).toBe("SIGN_IN_LOCKED");
  });
});

describe("B5: the lock never holds the owner's own browser", () => {
  it("a browser that signed in before is neither counted nor held; a new one is locked; a made-up tag does not help", async () => {
    const a = await newAccount(route, "wait-known");
    const known = browser(route, { address: "192.0.2.90" });
    expect((await known.post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(200);
    expect([...known.jar.keys()]).toContain("c2r2_known");
    await sevenWrong(a.email, "198.19.0");
    expect((await tryIn("192.0.2.91", a.email, PASSWORD)).body.code).toBe("SIGN_IN_LOCKED");
    expect((await known.post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(200);
    const forged = browser(route, { address: "192.0.2.92", headers: () => ({ cookie: "c2r2_known=AAAAAAAAAAAAAAAAAAAAAA" }) });
    expect((await forged.post<{ code?: string }>("/sign-in/email", { email: a.email, password: PASSWORD })).body.code).toBe("SIGN_IN_LOCKED");
  });

  it("claimTry directly: a known device goes ahead while the name is locked", async () => {
    const name = "victim-sim@zz-auth2.test";
    for (let i = 0; i < 7; i++) expect(await claimTry(db, name, `198.20.0.${i}`)).toBeNull();
    expect(await claimTry(db, name, "198.20.1.1")).toBe("locked");
    expect(await claimTry(db, name, "192.0.2.50", new Date(), { knownDevice: true })).toBeNull();
    await clearTries(db, name, "192.0.2.50");
    await db.query("DELETE FROM auth2_sign_in_waits");
  });

  it("IPv6 addresses are counted by their /64", async () => {
    expect(clientBucket("2001:db8:1:2::1")).toBe("2001:db8:1:2::");
    expect(clientBucket("2001:0db8:0001:0002:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::");
    expect(clientBucket("2001:db8::7")).toBe("2001:db8:0:0::");
    expect(clientBucket("::ffff:192.0.2.1")).toBe("0:0:0:0::");
    expect(clientBucket("203.0.113.5")).toBe("203.0.113.5");
    const a = await newAccount(route, "wait-v6");
    const statuses: number[] = [];
    for (let i = 1; i <= PAIR_FREE + 3; i++) statuses.push((await tryIn(`2001:db8:1:2::${i}`, a.email, "wrong password")).status);
    // Every address of the /64 is one client: the per-address wait catches up with it.
    expect(statuses).toContain(429);
    expect((await db.query("SELECT DISTINCT client FROM auth2_sign_in_waits WHERE name_key = $1 AND client <> ''", [nameKey(a.email)])).rows.map((r) => r.client)).toEqual(["2001:db8:1:2::"]);
  });
});
