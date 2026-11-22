// The first-run "create the owner" step (accounts slice 2, step 6; review of slice 2: B1, B2, B3, N12), through the
// real route and proxy. It needs an install with no owner, so this file empties the test database's accounts and
// install row first (test files run one at a time: vitest.config.mts, fileParallelism false) and marks the install
// done again at the end.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { ensureSetupCode, forgetFirstRun, forgetSetupCode, firstRunOpen } from "@/lib/auth2/firstRun";
import { auditOf, browser, installDone, PASSWORD, useAuth2 } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let auth: Awaited<ReturnType<typeof useAuth2>>["auth"];
const env = process.env as Record<string, string | undefined>;
const OWNER = "owner-first@zz-auth2.test";
let code = "";

/** A new set-up code, as a restart would make, read from the log line it is printed on. */
async function newCode() {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(" ")));
  try {
    forgetFirstRun();
    forgetSetupCode();
    await ensureSetupCode(db);
  } finally {
    spy.mockRestore();
  }
  const m = /set-up code: ([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/.exec(lines.join("\n"));
  if (!m) throw new Error(`no set-up code was printed: ${lines.join(" | ")}`);
  return m[1];
}

async function emptyInstall() {
  await db.query(`DELETE FROM organization`);
  await db.query(`DELETE FROM "user"`);
  await db.query("DELETE FROM auth2_install");
  await db.query("DELETE FROM auth2_setup_code");
  await db.query(`DELETE FROM "rateLimit"`);
  const c = await import("@/lib/auth2/config");
  await c.writeAuth2Setting(db, "auth2.platformAdminAddress", "admin@oxot.nl");
  await c.writeAuth2Setting(db, "auth2.baseUrl", null);
  forgetFirstRun();
  code = await newCode();
}

beforeAll(async () => {
  ({ db, route, auth } = await useAuth2({ rateLimit: false }));
});
beforeEach(emptyInstall);
afterAll(async () => {
  await db.query(`DELETE FROM organization`);
  await db.query(`DELETE FROM "user"`);
  await db.query("DELETE FROM auth2_setup_code");
  await installDone(db);
  delete process.env.AUTH2;
});

const front = async (path: string) => {
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("@/proxy");
  return (await proxy(new NextRequest(`http://localhost:3322${path}`))).headers.get("location");
};
const owner = (b = browser(route), body: Record<string, unknown> = {}) =>
  b.post<{ code?: string; user?: { id: string } }>("/first-run/owner", { name: "Olive Owner", email: OWNER, password: PASSWORD, setupCode: code, ...body });
const count = async (sql: string) => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`)).rows[0].n;
const stored = async (key: string) => (await db.query<{ value: unknown }>("SELECT value FROM auth2_settings WHERE key = $1", [key])).rows[0]?.value ?? null;

/** A request straight to the route, with chosen Host and Origin, as a client that is not a browser can send. */
const raw = async (body: string | object, h: Record<string, string>) => {
  const res = await route.POST(new Request("http://internal/api/auth2/first-run/owner", {
    method: "POST",
    headers: { "content-type": "application/json", "x-c2r-client-address": "203.0.113.7", ...h },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
  const t = await res.text();
  let b: { code?: string } = {};
  try {
    b = JSON.parse(t);
  } catch {
    // not JSON
  }
  return { status: res.status, body: b };
};
async function production<T>(fn: () => Promise<T>) {
  const keep = { N: env.NODE_ENV, U: env.BETTER_AUTH_URL };
  env.NODE_ENV = "production";
  delete env.BETTER_AUTH_URL;
  (await import("@/lib/auth2/config")).forgetAuth2Switch();
  try {
    return await fn();
  } finally {
    env.NODE_ENV = keep.N;
    env.BETTER_AUTH_URL = keep.U;
    (await import("@/lib/auth2/config")).forgetAuth2Switch();
  }
}

describe("with no owner yet", () => {
  it("/ and /welcome lead to the first-run page, which offers the platform administrator address", async () => {
    expect(await firstRunOpen(db)).toBe(true);
    expect(await front("/")).toBe("http://localhost:3322/auth/first-run");
    expect(await front("/welcome")).toBe("http://localhost:3322/auth/first-run");
    const { firstRunForm } = await import("@/lib/auth2/firstRun");
    expect((await firstRunForm(db)).email).toBe("admin@oxot.nl");
  });

  it("creates a confirmed platform administrator with a workspace, signed in, and audited; the set-up code is spent", async () => {
    const b = browser(route);
    const res = await owner(b);
    expect(res.status).toBe(200);
    const s = await b.get<{ user: { id: string; email: string } }>("/get-session");
    expect(s.body.user.email).toBe(OWNER);
    const u = await db.query<{ platformAdmin: boolean; emailVerified: boolean }>('SELECT "platformAdmin", "emailVerified" FROM "user" WHERE email = $1', [OWNER]);
    expect(u.rows[0]).toEqual({ platformAdmin: true, emailVerified: true });
    expect((await b.get<{ workspaces: unknown[] }>("/workspace/list")).body.workspaces).toHaveLength(1);
    expect((await auditOf(db, OWNER)).map((l) => l.action)).toContain("platform.owner_created");
    expect(await stored("auth2.platformAdminAddress")).toBe(OWNER);
    expect(JSON.stringify((await db.query("SELECT * FROM audit_log WHERE actor = $1", [OWNER])).rows)).not.toContain(PASSWORD);
    expect(await count("auth2_setup_code")).toBe(0);
    expect(await count("auth2_install WHERE completed_at IS NOT NULL")).toBe(1);
  });

  it("six submissions at once create one owner", async () => {
    const rs = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => owner(browser(route), { email: `o${i}@zz-auth2.test` })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.body.code === "FIRST_RUN_CLOSED")).toHaveLength(5);
    expect(await count('"user"')).toBe(1);
    expect(await count('"user" WHERE "platformAdmin"')).toBe(1);
  });

  it("refuses a short password or a bad address, and stays open", async () => {
    expect((await owner(browser(route), { password: "short" })).body.code).toBe("PASSWORD_TOO_SHORT");
    expect((await owner(browser(route), { email: "nope" })).body.code).toBe("INVALID_EMAIL");
    expect(await firstRunOpen(db)).toBe(true);
  });
});

describe("B2: the set-up code", () => {
  it("is printed once, kept only as a hash, and required", async () => {
    const row = (await db.query<{ code_hash: string }>("SELECT code_hash FROM auth2_setup_code")).rows[0];
    expect(row.code_hash).not.toContain(code.replace(/-/g, ""));
    expect((await owner(browser(route), { setupCode: undefined })).body.code).toBe("SETUP_CODE_WRONG");
    expect((await owner(browser(route), { setupCode: "AAAA-BBBB-CCCC-DDDD" })).body.code).toBe("SETUP_CODE_WRONG");
    expect(await count('"user"')).toBe(0);
    // Typed in lower case and without dashes, it still works.
    await db.query("UPDATE auth2_setup_code SET next_allowed_at = now()");
    expect((await owner(browser(route), { setupCode: code.replace(/-/g, "").toLowerCase() })).status).toBe(200);
  });

  it("a wrong code earns a growing wait, during which even the right one waits", async () => {
    expect((await owner(browser(route), { setupCode: "WRONG-CODE" })).body.code).toBe("SETUP_CODE_WRONG");
    // The wait is set (a second after the first wrong code); stretched here so a slow machine cannot outlast it.
    expect((await db.query<{ w: boolean }>("SELECT next_allowed_at > now() - interval '5 seconds' AND failures = 1 AS w FROM auth2_setup_code")).rows[0].w).toBe(true);
    await db.query("UPDATE auth2_setup_code SET next_allowed_at = now() + interval '1 minute'");
    const waiting = await owner();
    expect([waiting.status, waiting.body.code]).toEqual([429, "SETUP_CODE_WAIT"]);
    await db.query("UPDATE auth2_setup_code SET next_allowed_at = now()");
    expect((await owner()).status).toBe(200);
  });

  it("a restart while still open makes a new code, and the old one stops working", async () => {
    const old = code;
    code = await newCode();
    expect(code).not.toBe(old);
    expect((await owner(browser(route), { setupCode: old })).body.code).toBe("SETUP_CODE_WRONG");
    await db.query("UPDATE auth2_setup_code SET next_allowed_at = now()");
    expect((await owner()).status).toBe(200);
  });

  it("no code is made, or printed, once an owner exists", async () => {
    expect((await owner()).status).toBe(200);
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      forgetFirstRun();
      forgetSetupCode();
      await ensureSetupCode(db);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(await count("auth2_setup_code")).toBe(0);
  });
});

describe("B1: nothing is stored unless the owner is", () => {
  it("a request that fails (a lone surrogate in the address) stores no address and leaves first run open", async () => {
    await production(async () => {
      const evil = { host: "evil.example.test", origin: "https://evil.example.test" };
      const body = `{"name":"x","email":"a\\ud800@b.cc","password":"${PASSWORD}","setupCode":"${code}","address":"https://evil.example.test"}`;
      const r = await raw(body, evil);
      expect(r.status).toBe(400);
      forgetFirstRun();
      expect(await stored("auth2.baseUrl")).toBeNull();
      expect(await count('"user"')).toBe(0);
      expect(await firstRunOpen(db)).toBe(true);
    });
  });

  it("the address must match the form's scheme and host; a mismatch stores nothing", async () => {
    await production(async () => {
      const real = { host: "app.real.test", origin: "https://app.real.test" };
      const body = { name: "Real Owner", email: OWNER, password: PASSWORD, setupCode: code };
      expect((await raw({ ...body, address: "http://app.real.test" }, real)).body.code).toBe("ADDRESS_MISMATCH");
      // Origin and Host disagree: refused (the app's own cross-site check answers first).
      expect((await raw({ ...body, address: "https://app.real.test" }, { ...real, host: "other.test" })).status).toBe(403);
      expect((await raw({ ...body, address: "https://evil.example.test" }, real)).body.code).toBe("ADDRESS_MISMATCH");
      expect(await stored("auth2.baseUrl")).toBeNull();
      const ok = await raw({ ...body, address: "https://app.real.test/" }, real);
      expect(ok.status).toBe(200);
      expect(await stored("auth2.baseUrl")).toBe("https://app.real.test");
    });
  });

  it("a wrong set-up code from another host stores no address either", async () => {
    await production(async () => {
      const evil = { host: "evil.example.test", origin: "https://evil.example.test" };
      const r = await raw({ name: "Mallory", email: "mallory@zz-auth2.test", password: PASSWORD, setupCode: "NOPE-NOPE-NOPE-NOPE", address: "https://evil.example.test" }, evil);
      expect(r.body.code).toBe("SETUP_CODE_WRONG");
      expect(await stored("auth2.baseUrl")).toBeNull();
    });
  });

  it("a platform administrator can change the addresses later, and it is audited", async () => {
    expect((await owner()).status).toBe(200);
    const id = (await db.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [OWNER])).rows[0].id;
    const { adminOps } = await import("@/lib/auth2/adminOps");
    const ops = adminOps({ db, auth, actorId: id, baseURL: "http://localhost:3322" });
    await ops.setAddresses({ baseURL: "https://moved.example.test/path", trustedOrigins: ["https://also.example.test"] });
    expect(await stored("auth2.baseUrl")).toBe("https://moved.example.test");
    expect(await stored("auth2.trustedOrigins")).toEqual(["https://also.example.test"]);
    await expect(ops.setAddresses({ baseURL: "javascript:alert(1)" })).rejects.toMatchObject({ body: { code: "INVALID_ADDRESS" } });
    expect((await auditOf(db, OWNER)).map((l) => l.action)).toContain("platform.addresses_set");
    await ops.setAddresses({ baseURL: null, trustedOrigins: [] });
  });
});

describe("B3 and N12: open until an owner exists", () => {
  it("an ordinary account made earlier does not close it; sign-up, reset and invitations wait until the owner exists", async () => {
    await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('early', 'Early', 'early@zz-auth2.test', true, now(), now())`);
    forgetFirstRun();
    expect(await firstRunOpen(db)).toBe(true);
    const b = browser(route);
    expect((await b.post<{ code: string }>("/sign-up/email", { name: "Late", email: "late@zz-auth2.test", password: PASSWORD })).body.code).toBe("SETUP_REQUIRED");
    expect((await b.post<{ code: string }>("/request-password-reset", { email: "early@zz-auth2.test" })).body.code).toBe("SETUP_REQUIRED");
    expect((await b.post<{ code: string }>("/workspace/invitation/accept", { token: "x".repeat(43) })).body.code).toBe("SETUP_REQUIRED");
    expect(await count('"user" WHERE email = \'late@zz-auth2.test\'')).toBe(0);
    const made = await owner();
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    expect((await b.post("/sign-up/email", { name: "Late", email: "late@zz-auth2.test", password: PASSWORD })).status).toBe(200);
  });

  it("a failed attempt seen by another request does not close it in this process", async () => {
    const [bad, seen] = await Promise.all([owner(browser(route), { setupCode: "WRONG" }), new Promise((r) => setTimeout(r, 10)).then(() => firstRunOpen(db))]);
    expect(bad.body.code).toBe("SETUP_CODE_WRONG");
    expect(seen).toBe(true);
    expect(await firstRunOpen(db)).toBe(true);
  });

  it("once the owner exists it is closed for good, and / no longer leads there", async () => {
    expect((await owner()).status).toBe(200);
    forgetFirstRun();
    expect(await firstRunOpen(db)).toBe(false);
    const again = await owner(browser(route), { email: "late@zz-auth2.test" });
    expect([again.status, again.body.code]).toEqual([404, "FIRST_RUN_CLOSED"]);
    expect(await front("/")).not.toBe("http://localhost:3322/auth/first-run");
  });

  it("a sign-up with the platform administrator address afterwards does not make a platform administrator", async () => {
    expect((await owner()).status).toBe(200);
    await (await import("@/lib/auth2/config")).writeAuth2Setting(db, "auth2.platformAdminAddress", "admin-addr@zz-auth2.test");
    expect((await browser(route).post("/sign-up/email", { name: "Not Owner", email: "admin-addr@zz-auth2.test", password: PASSWORD })).status).toBe(200);
    const u = await db.query<{ platformAdmin: boolean }>('SELECT "platformAdmin" FROM "user" WHERE email = $1', ["admin-addr@zz-auth2.test"]);
    expect(u.rows[0].platformAdmin).toBe(false);
  });
});
