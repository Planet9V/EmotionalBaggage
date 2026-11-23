// Lock alerts (owner's answer of 23 Nov: "an email alert is sent to jim@eigenia.nl"), through the real sign-in route
// and the SMTP stand-in: one per lock, the account named (an unknown address is not), at most 20 an hour with one
// "more locks are happening" notice, nothing when mail is off, and never a password, token or hash.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { nameKey } from "@/lib/auth2/signInWait";
import { smtpStandIn } from "../admin/smtpStandIn";
import { browser, cleanUp, email, newAccount, PASSWORD, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let smtp: Awaited<ReturnType<typeof smtpStandIn>>;

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
  smtp = await smtpStandIn("unused");
});
beforeEach(async () => {
  await db.query("DELETE FROM auth2_lock_alerts");
  await db.query("DELETE FROM auth2_sign_in_waits");
});
afterAll(async () => {
  await db.query("DELETE FROM settings WHERE key = 'mail.smtp'");
  await db.query("DELETE FROM auth2_settings WHERE key = 'notify.lockAlertsTo'");
  await db.query("DELETE FROM auth2_lock_alerts");
  await smtp.close();
  await cleanUp(db);
  delete process.env.AUTH2;
});

const mailOn = (on: boolean) =>
  on
    ? db.query("INSERT INTO settings (key, value) VALUES ('mail.smtp', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify({ mode: "smtp", fromName: "C2R", fromAddress: "noreply@example.test", host: "127.0.0.1", port: smtp.port, security: "none", username: null })])
    : db.query("DELETE FROM settings WHERE key = 'mail.smtp'");
const settle = async (n: number) => {
  for (let i = 0; i < 60 && smtp.messages.length < n; i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 150));
};
let net = 0;
async function lock(who: string) {
  net++;
  for (let i = 1; i <= 7; i++) await browser(route, { address: `198.18.${100 + net}.${i}` }).post("/sign-in/email", { email: who, password: "wrong password" });
}
/** The alerts since `from`, with quoted-printable soft breaks and =3D undone so the text reads as sent. */
const alerts = (from: number) =>
  smtp.messages.slice(from).map((m) => m.replace(/=\n/g, "").replace(/=3D/g, "=")).filter((m) => /Subject: (Sign-in locked|More sign-in locks)/.test(m));

describe("lock alerts", () => {
  it("one alert per lock to jim@eigenia.nl by default, naming the account, with a link to Admin, Users; tries during the lock send no more", async () => {
    await mailOn(true);
    const a = await newAccount(route, "la-real");
    const start = smtp.messages.length;
    await lock(a.email);
    await settle(start + 1);
    const got = alerts(start);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatch(/To: jim@eigenia\.nl/i);
    expect(got[0]).toContain(`Account locked: ${a.email}`);
    expect(got[0]).toMatch(/Failed sign-ins in a row: 7/);
    expect(got[0]).toMatch(/\/admin\?tab=users/);
    expect(got[0]).not.toContain("wrong password");
    expect(got[0]).not.toContain(PASSWORD);
    for (let i = 0; i < 3; i++) await browser(route).post("/sign-in/email", { email: a.email, password: "wrong password" });
    await settle(start + 2);
    expect(alerts(start)).toHaveLength(1);
  });

  it("an unknown address is 'an address with no account': neither the address nor its hash is sent", async () => {
    const nobody = email("la-nobody");
    const start = smtp.messages.length;
    await lock(nobody);
    await settle(start + 1);
    const got = alerts(start);
    expect(got).toHaveLength(1);
    expect(got[0]).toContain("Account locked: an address with no account");
    expect(got[0]).not.toContain(nobody);
    expect(got[0]).not.toContain(nameKey(nobody));
  });

  it("at most 20 an hour: the 21st is one 'more locks are happening' notice, then nothing; every lock is still in the audit log", async () => {
    await db.query("INSERT INTO auth2_lock_alerts (sent_at) SELECT now() - interval '5 minutes' FROM generate_series(1, 20)");
    const start = smtp.messages.length;
    const first = email("la-many-1");
    await lock(first);
    await settle(start + 1);
    const got = alerts(start);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatch(/Subject: More sign-in locks are happening/);
    expect(got[0]).toMatch(/see the audit log/);
    expect(got[0]).not.toContain(first);
    await lock(email("la-many-2"));
    await settle(start + 2);
    expect(alerts(start)).toHaveLength(1);
    expect((await db.query("SELECT 1 FROM audit_log WHERE action = 'account.locked_unknown' AND at > now() - interval '1 minute'")).rowCount).toBeGreaterThanOrEqual(2);
  });

  it("goes to the address set in Admin, Email; none when it is empty or mail is off; the lock itself happens all the same", async () => {
    await db.query(`INSERT INTO auth2_settings (key, value) VALUES ('notify.lockAlertsTo', '"security@example.test"') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    let start = smtp.messages.length;
    await lock(email("la-set"));
    await settle(start + 1);
    expect(alerts(start)[0]).toMatch(/To: security@example\.test/i);
    await db.query(`UPDATE auth2_settings SET value = '""' WHERE key = 'notify.lockAlertsTo'`);
    start = smtp.messages.length;
    await lock(email("la-empty"));
    await settle(start + 1);
    expect(alerts(start)).toHaveLength(0);
    await db.query("DELETE FROM auth2_settings WHERE key = 'notify.lockAlertsTo'");
    await mailOn(false);
    start = smtp.messages.length;
    const off = email("la-off");
    await lock(off);
    await settle(start + 1);
    expect(alerts(start)).toHaveLength(0);
    expect((await browser(route).post<{ code?: string }>("/sign-in/email", { email: off, password: "anything" })).body.code).toBe("SIGN_IN_LOCKED");
  });
});
