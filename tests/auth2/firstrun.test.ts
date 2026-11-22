// The first-run "create the owner" step (accounts slice 2, step 6; owner's rulings of 22 Nov), through the real
// route and proxy. It needs an install with no account, so this file empties the test database's account table
// first (test files run one at a time: vitest.config.mts, fileParallelism false).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { forgetFirstRun, firstRunOpen } from "@/lib/auth2/firstRun";
import { auditOf, browser, PASSWORD, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
const env = process.env as Record<string, string | undefined>;
const OWNER = "owner-first@zz-auth2.test";

async function emptyInstall() {
  await db.query(`DELETE FROM organization`);
  await db.query(`DELETE FROM "user"`);
  await db.query("DELETE FROM auth2_install");
  await db.query(`DELETE FROM "rateLimit"`);
  await db.query("UPDATE settings SET value = '\"admin@oxot.nl\"' WHERE key = 'auth2.platformAdminAddress'");
  forgetFirstRun();
}

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
});
beforeEach(emptyInstall);
afterAll(async () => {
  await emptyInstall();
  delete process.env.AUTH2;
});

const front = async (path: string) => {
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("@/proxy");
  return (await proxy(new NextRequest(`http://localhost:3322${path}`))).headers.get("location");
};
const owner = (b = browser(route), body: Record<string, unknown> = {}) => b.post<{ code?: string; user?: { id: string } }>("/first-run/owner", { name: "Olive Owner", email: OWNER, password: PASSWORD, ...body });

describe("with no account yet", () => {
  it("/ and /welcome lead to the first-run page, which offers the platform administrator address", async () => {
    expect(await firstRunOpen(db)).toBe(true);
    expect(await front("/")).toBe("http://localhost:3322/auth/first-run");
    expect(await front("/welcome")).toBe("http://localhost:3322/auth/first-run");
    const { firstRunForm } = await import("@/lib/auth2/firstRun");
    expect((await firstRunForm(db)).email).toBe("admin@oxot.nl");
  });

  it("creates a confirmed platform administrator with a workspace, signed in, and audited", async () => {
    const b = browser(route);
    const res = await owner(b);
    expect(res.status).toBe(200);
    const s = await b.get<{ user: { id: string; email: string; emailVerified: boolean } }>("/get-session");
    expect(s.body.user.email).toBe(OWNER);
    const u = await db.query<{ platformAdmin: boolean; emailVerified: boolean }>('SELECT "platformAdmin", "emailVerified" FROM "user" WHERE email = $1', [OWNER]);
    expect(u.rows[0]).toEqual({ platformAdmin: true, emailVerified: true });
    expect((await b.get<{ workspaces: unknown[] }>("/workspace/list")).body.workspaces).toHaveLength(1);
    expect((await auditOf(db, OWNER)).map((l) => l.action)).toContain("platform.owner_created");
    // The address chosen there is what the setting now holds.
    expect((await db.query<{ value: string }>("SELECT value FROM settings WHERE key = 'auth2.platformAdminAddress'")).rows[0].value).toBe(OWNER);
    // No password reaches the audit log.
    expect(JSON.stringify(await db.query("SELECT * FROM audit_log WHERE actor = $1", [OWNER]))).not.toContain(PASSWORD);
  });

  it("two submissions at once create one owner", async () => {
    const [a, b] = await Promise.all([owner(), owner(browser(route), { email: "owner-second@zz-auth2.test" })]);
    expect([a.status, b.status].sort()).toEqual([200, 404]);
    expect([a, b].find((r) => r.status === 404)?.body.code).toBe("FIRST_RUN_CLOSED");
    expect((await db.query('SELECT 1 FROM "user"')).rowCount).toBe(1);
    expect((await db.query('SELECT 1 FROM "user" WHERE "platformAdmin"')).rowCount).toBe(1);
  });

  it("refuses a short password or a bad address, and stays open", async () => {
    expect((await owner(browser(route), { password: "short" })).body.code).toBe("PASSWORD_TOO_SHORT");
    expect((await owner(browser(route), { email: "nope" })).body.code).toBe("INVALID_EMAIL");
    expect(await firstRunOpen(db)).toBe(true);
  });

  it("in production with no base address, the owner confirms the one the page is open at, and it is stored", async () => {
    const keep = { NODE_ENV: env.NODE_ENV, BETTER_AUTH_URL: env.BETTER_AUTH_URL };
    env.NODE_ENV = "production";
    delete env.BETTER_AUTH_URL;
    try {
      await db.query("DELETE FROM settings WHERE key = 'auth2.baseUrl'");
      const wrong = await owner(browser(route), { address: "https://elsewhere.example.test" });
      expect(wrong.body.code).toBe("ADDRESS_MISMATCH");
      const ok = await owner(browser(route), { address: "http://localhost:3322/" });
      expect(ok.status).toBe(200);
      expect((await db.query<{ value: string }>("SELECT value FROM settings WHERE key = 'auth2.baseUrl'")).rows[0].value).toBe("http://localhost:3322");
    } finally {
      env.NODE_ENV = keep.NODE_ENV;
      env.BETTER_AUTH_URL = keep.BETTER_AUTH_URL;
      await db.query("DELETE FROM settings WHERE key = 'auth2.baseUrl'");
    }
  });
});

describe("once any account exists", () => {
  it("the step is closed for good: the endpoint refuses and / no longer leads there", async () => {
    expect((await owner()).status).toBe(200);
    forgetFirstRun();
    expect(await firstRunOpen(db)).toBe(false);
    const again = await owner(browser(route), { email: "late@zz-auth2.test" });
    expect([again.status, again.body.code]).toEqual([404, "FIRST_RUN_CLOSED"]);
    expect(await front("/")).not.toBe("http://localhost:3322/auth/first-run");
  });

  it("a normal sign-up with the platform administrator address does not make a platform administrator", async () => {
    await db.query("UPDATE settings SET value = '\"admin-addr@zz-auth2.test\"' WHERE key = 'auth2.platformAdminAddress'");
    const b = browser(route);
    expect((await b.post("/sign-up/email", { name: "Not Owner", email: "admin-addr@zz-auth2.test", password: PASSWORD })).status).toBe(200);
    const u = await db.query<{ platformAdmin: boolean }>('SELECT "platformAdmin" FROM "user" WHERE email = $1', ["admin-addr@zz-auth2.test"]);
    expect(u.rows[0].platformAdmin).toBe(false);
    // And the first-run step, which could have made one, is now closed.
    forgetFirstRun();
    expect((await owner(browser(route), { email: "admin-addr2@zz-auth2.test" })).body.code).toBe("FIRST_RUN_CLOSED");
    expect((await db.query('SELECT 1 FROM "user" WHERE "platformAdmin"')).rowCount).toBe(0);
  });
});
