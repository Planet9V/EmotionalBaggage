// The password rules (owner's ruling of 23 Nov: "minimum complexity password requirements"): one function, every
// entry point. Each place a password is chosen is called here with a weak password and must refuse it with the
// same code and sentence; a stored policy outside its bounds is brought inside them.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { adminOps } from "@/lib/auth2/adminOps";
import { newPasswordProblem, isCommonPassword } from "@/lib/auth2/newPassword";
import { DEFAULT_PASSWORD_POLICY, normalizePolicy, passwordChecklist, passwordProblem } from "@/lib/auth2/passwordPolicy";
import { readRules, writeRules } from "@/lib/auth2/rules";
import { browser, cleanUp, email, lastMail, newAccount, PASSWORD, useAuth2, waitForMail } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let auth: Awaited<ReturnType<typeof useAuth2>>["auth"];

beforeAll(async () => {
  ({ db, route, auth } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
  await db.query("DELETE FROM auth2_settings WHERE key = 'password.policy'");
});
afterAll(async () => {
  await db.query("DELETE FROM auth2_settings WHERE key = 'password.policy'");
  await cleanUp(db);
  delete process.env.AUTH2;
});

const P = DEFAULT_PASSWORD_POLICY;

describe("the rules themselves", () => {
  it("defaults: 12 characters, upper, lower, digit and symbol, not the address or name, not common, at most 128", () => {
    expect(P).toMatchObject({ minLength: 12, maxLength: 128, upper: true, lower: true, digit: true, symbol: true, notEmailOrName: true, notCommon: true });
    expect(passwordProblem(P, "Short1!")).toBe("The password must be at least 12 characters.");
    expect(passwordProblem(P, "all lower case 1!")).toBe("The password needs at least one upper-case letter.");
    expect(passwordProblem(P, "ALL UPPER CASE 1!")).toBe("The password needs at least one lower-case letter.");
    expect(passwordProblem(P, "No digits here at all!")).toBe("The password needs at least one digit.");
    expect(passwordProblem(P, "No symbols here 1234")).toBe("The password needs at least one symbol, such as ! or #.");
    expect(passwordProblem(P, `Aa1!${"x".repeat(125)}`)).toBe("The password must be at most 128 characters.");
    expect(passwordProblem(P, "Ada.Lovelace1!", { email: "ada.lovelace1!@example.test" })).toBe("The password cannot be your email address or your name.");
    expect(passwordProblem(P, "Grace Hopper 1!", { name: "grace hopper 1!" })).toBe("The password cannot be your email address or your name.");
    expect(passwordProblem(P, PASSWORD)).toBeNull();
  });

  it("the common list is bundled, compared in lower case, and only on the server", () => {
    expect(isCommonPassword("1QAZ2WSX3EDC")).toBe(true);
    expect(isCommonPassword("Correct horse battery 7!")).toBe(false);
    const relaxed = normalizePolicy({ minLength: 8, upper: false, digit: false, symbol: false });
    expect(passwordProblem(relaxed, "baseball")).toBeNull();
    expect(newPasswordProblem(relaxed, "baseball")).toMatch(/most commonly used/);
    expect(passwordChecklist(P, "").find((r) => r.key === "common")?.met).toBeNull();
  });

  it("a policy outside its bounds is brought inside them; the shortest allowed is 8", async () => {
    expect(normalizePolicy({ minLength: 3 }).minLength).toBe(8);
    expect(normalizePolicy({ minLength: 500, maxLength: 9 })).toMatchObject({ minLength: 64, maxLength: 128 });
    const c = await db.connect();
    try {
      await expect(writeRules(c, { password: { minLength: 6 } }, "tester")).rejects.toMatchObject({ body: { code: "INVALID_SETTING" } });
    } finally {
      c.release();
    }
    await db.query(`INSERT INTO auth2_settings (key, value) VALUES ('password.policy', '{"minLength": 2}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    expect((await readRules(db)).password.minLength).toBe(8);
    await db.query("DELETE FROM auth2_settings WHERE key = 'password.policy'");
  });
});

describe("every entry point refuses a weak password with the same code", () => {
  const weak = "weakpassword";
  const expectRule = (r: { status: number; body: unknown }) => {
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: "PASSWORD_RULE", message: "The password needs at least one upper-case letter." });
  };

  it("sign-up", async () => {
    expectRule(await browser(route).post("/sign-up/email", { name: "Weak", email: email("weak"), password: weak }));
  });

  it("change of password", async () => {
    const a = await newAccount(route, "pw-change");
    expectRule(await a.b.post("/change-password", { currentPassword: PASSWORD, newPassword: weak }));
  });

  it("reset by email link, and the address is checked too", async () => {
    const a = await newAccount(route, "pw-reset");
    await browser(route).post("/request-password-reset", { email: a.email, redirectTo: "/auth/reset/new" });
    await waitForMail("reset-password", a.email, 1);
    const token = lastMail("reset-password", a.email).token;
    expectRule(await browser(route).post("/reset-password", { token, newPassword: weak }));
    // "not your address or name": the account is found through the link's token
    await db.query('UPDATE "user" SET name = $2 WHERE id = $1', [a.userId, "Rosa Parks 1955!"]);
    const own = await browser(route).post("/reset-password", { token, newPassword: "rosa parks 1955!".replace("r", "R") });
    expect(own.body).toMatchObject({ code: "PASSWORD_RULE", message: "The password cannot be your email address or your name." });
    expect((await browser(route).post("/reset-password", { token, newPassword: "A fresh password 8!" })).status).toBe(200);
  });

  it("a temporary password typed by a platform administrator", async () => {
    const adm = await newAccount(route, "pw-admin");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [adm.userId]);
    const ops = adminOps({ db, auth, actorId: adm.userId, baseURL: "http://localhost:3322" });
    const t = await newAccount(route, "pw-target");
    await expect(ops.setPassword(t.userId, weak)).rejects.toMatchObject({ body: { code: "PASSWORD_RULE" } });
    await expect(ops.createUser({ email: email("pw-new"), name: "New", password: weak })).rejects.toMatchObject({ body: { code: "PASSWORD_RULE" } });
  });

  it("an administrator's stricter setting applies at the next change; existing passwords keep working", async () => {
    const a = await newAccount(route, "pw-strict");
    const c = await db.connect();
    try {
      await writeRules(c, { password: { minLength: 30 } }, "tester");
    } finally {
      c.release();
    }
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(200);
    const r = await a.b.post("/change-password", { currentPassword: PASSWORD, newPassword: "Still only twenty chars 1!" });
    expect(r.body).toMatchObject({ code: "PASSWORD_RULE", message: "The password must be at least 30 characters." });
    await db.query("DELETE FROM auth2_settings WHERE key = 'password.policy'");
  });
});
