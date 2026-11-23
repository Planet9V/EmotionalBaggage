// Migration 0044 (ws25-users; its number may change at merge): the seeded first-run suggestion admin@oxot.nl is
// cleared only while no owner exists and it is still the seed; the new setting keys are accepted, others refused.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ownerPool, pool, ready } from "@/lib/db";

const file = readdirSync(join(process.cwd(), "migrations")).find((f) => f.endsWith("_user_admin_rules.sql"))!;
const UP = readFileSync(join(process.cwd(), "migrations", file), "utf8").split("-- Down Migration")[0]!;
// Only the clearing statement is run again: the ALTERs have run already.
const CLEAR = UP.slice(UP.indexOf("DELETE FROM auth2_settings"), UP.indexOf("-- Per account:"));

let saved: { value: unknown } | undefined;
beforeAll(async () => {
  await ready();
  saved = (await ownerPool().query("SELECT value FROM auth2_settings WHERE key = 'auth2.platformAdminAddress'")).rows[0];
});
afterAll(async () => {
  const db = ownerPool();
  await db.query("DELETE FROM auth2_settings WHERE key = 'auth2.platformAdminAddress'");
  if (saved) await db.query("INSERT INTO auth2_settings (key, value) VALUES ('auth2.platformAdminAddress', $1)", [JSON.stringify(saved.value)]);
  await pool().end();
});

const seed = (v: string) => ownerPool().query(`INSERT INTO auth2_settings (key, value) VALUES ('auth2.platformAdminAddress', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(v)]);
const stored = async () => (await ownerPool().query<{ value: string }>("SELECT value FROM auth2_settings WHERE key = 'auth2.platformAdminAddress'")).rows[0]?.value ?? null;

describe("migration 0044, account rules", () => {
  it("clears the seeded admin@oxot.nl while no owner exists, keeps any other address, and keeps the seed once an owner exists", async () => {
    const db = ownerPool();
    const owners = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" WHERE "platformAdmin"`)).rows[0]!.n;
    const done = (await db.query("SELECT 1 FROM auth2_install WHERE completed_at IS NOT NULL")).rowCount;
    await seed("admin@oxot.nl");
    await db.query(CLEAR);
    expect(await stored()).toBe(owners === 0 && !done ? null : "admin@oxot.nl");
    await seed("someone@example.test");
    await db.query(CLEAR);
    expect(await stored()).toBe("someone@example.test");
  });

  it("the new setting keys are accepted; an unknown key is still refused; the new columns exist", async () => {
    const db = ownerPool();
    for (const k of ["invites.expiryDays", "signIn.maxFailures", "signIn.lockMinutes", "password.policy", "notify.signupRequestsTo", "signUp.open", "impersonation.minutes", "impersonation.notifyUser"]) {
      await db.query("INSERT INTO auth2_settings (key, value) VALUES ($1, '1') ON CONFLICT (key) DO NOTHING", [k]);
      await db.query("DELETE FROM auth2_settings WHERE key = $1 AND value = '1'::jsonb", [k]);
    }
    await expect(db.query("INSERT INTO auth2_settings (key, value) VALUES ('made.up', '1')")).rejects.toMatchObject({ code: "23514" });
    const cols = (await db.query<{ c: string }>(`SELECT table_name || '.' || column_name AS c FROM information_schema.columns WHERE (table_name, column_name) IN (('user','mustChangePassword'),('user','resetRequestedAt'),('session','impersonatedBy'),('session','impersonationEndsAt'),('auth2_sign_in_waits','locked_until'))`)).rows.map((r) => r.c);
    expect(cols.sort()).toEqual(["auth2_sign_in_waits.locked_until", "session.impersonatedBy", "session.impersonationEndsAt", "user.mustChangePassword", "user.resetRequestedAt"]);
  });
});
