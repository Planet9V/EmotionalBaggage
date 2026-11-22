// The new sign-in wired into the rest of the app (accounts slice 2, integration with the admin area): who is the
// platform administrator (src/lib/admin/platformAdminHook.ts), and, with the switch on, every route reached through
// the new sign-in's session only (src/lib/api/route.ts). With the switch off the app is as before.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { GET as accessGet } from "@/app/api/admin/access/route";
import { GET as signInGet, PUT as signInPut } from "@/app/api/admin/sign-in/route";
import { GET as projectsGet } from "@/app/api/projects/route";
import { POST as oldSignIn } from "@/app/api/auth/sign-in/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { PUT as plansPut } from "@/app/api/admin/plans/route";
import { PUT as settingsPut } from "@/app/api/admin/settings/route";
import { PUT as credPut } from "@/app/api/admin/credentials/[provider]/route";
import { builtInCatalogue } from "@/lib/admin/planSchema";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platformAdminFromAuth2 } from "@/lib/admin/platformAdminHook";
import { sessionCookieHeader } from "../api/helpers";
import { authenticatorCode, cleanUp, newAccount, PASSWORD, useAuth2, type Browser } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
const BASE = "http://localhost:3322";

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
});
afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

/** A request to an app route as the browser `b` would send it (its new sign-in cookies), or with a given cookie. */
const asBrowser = (path: string, cookie: string, init: { method?: string; body?: unknown } = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3322", origin: BASE, cookie, ...(init.body === undefined ? {} : { "content-type": "application/json" }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
const cookieOf = (b: Browser) => b.cookieHeader();

describe("item 1: the platform administrator is the new sign-in's own, checked on every request", () => {
  it("answers from the new session and the flag in the database; an old demo session is not an identity", async () => {
    const admin = await newAccount(route, "wire-admin");
    const plain = await newAccount(route, "wire-plain");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [admin.userId]);
    const access = async (cookie: string) => {
      const res = await accessGet(asBrowser("/api/admin/access", cookie));
      return { status: res.status, body: (await res.json()) as { platformAdmin?: boolean } };
    };
    expect((await access(cookieOf(admin.b))).body.platformAdmin).toBe(true);
    expect((await access(cookieOf(plain.b))).body.platformAdmin).toBe(false);
    // The old sign-in's demo session: not accepted for anything while the new sign-in is on.
    expect((await access(sessionCookieHeader())).status).toBe(401);
    // A made-up header or cookie flag counts for nothing.
    const forged = asBrowser("/api/admin/access", `${cookieOf(plain.b)}; platformAdmin=true`);
    forged.headers.set("x-platform-admin", "1");
    expect(((await (await accessGet(forged)).json()) as { platformAdmin: boolean }).platformAdmin).toBe(false);
    // Removing the flag takes effect on the next request.
    await db.query('UPDATE "user" SET "platformAdmin" = false WHERE id = $1', [admin.userId]);
    expect((await access(cookieOf(admin.b))).body.platformAdmin).toBe(false);
    await db.query('UPDATE "user" SET "platformAdmin" = true, "disabledAt" = now() WHERE id = $1', [admin.userId]);
    expect(await platformAdminFromAuth2(asBrowser("/api/admin/access", cookieOf(admin.b)))).toBe(false);
  });

  it("fails closed: no session, or the switch off, answers false", async () => {
    const admin = await newAccount(route, "wire-off");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [admin.userId]);
    expect(await platformAdminFromAuth2(asBrowser("/api/admin/access", ""))).toBe(false);
    expect(await platformAdminFromAuth2(asBrowser("/api/admin/access", "c2r2.session_token=garbage.garbage"))).toBe(false);
    process.env.AUTH2 = "0";
    try {
      expect(await platformAdminFromAuth2(asBrowser("/api/admin/access", cookieOf(admin.b)))).toBe(false);
      // Off: the old sign-in is the identity again, and nobody is the platform administrator.
      const res = await accessGet(asBrowser("/api/admin/access", sessionCookieHeader()));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { platformAdmin: boolean }).platformAdmin).toBe(false);
    } finally {
      process.env.AUTH2 = "1";
    }
  });
});

describe("item 3: Admin, Sign-in", () => {
  it("the platform administrator sees and changes the addresses (audited); anyone else sees only that it is on", async () => {
    const admin = await newAccount(route, "si-admin");
    const plain = await newAccount(route, "si-plain");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [admin.userId]);
    const status = async (cookie: string) => (await signInGet(asBrowser("/api/admin/sign-in", cookie))).json() as Promise<{ on: boolean; detail: { baseURL: string | null; trustedOrigins: string[] } | null; sharedConcepts: string }>;
    const mine = await status(cookieOf(admin.b));
    expect(mine.on).toBe(true);
    expect(mine.detail?.baseURL).toBe("http://localhost:3322");
    expect(mine.sharedConcepts).toMatch(/every signed-in account sees and changes the same concepts/);
    expect((await status(cookieOf(plain.b))).detail).toBeNull();
    expect((await signInPut(asBrowser("/api/admin/sign-in", cookieOf(plain.b), { method: "PUT", body: { trustedOrigins: ["https://x.example.test"] } }))).status).toBe(403);
    const saved = await signInPut(asBrowser("/api/admin/sign-in", cookieOf(admin.b), { method: "PUT", body: { trustedOrigins: ["https://other.example.test"] } }));
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as { detail: { trustedOrigins: string[] } }).detail.trustedOrigins).toEqual(["https://other.example.test"]);
    const lines = await db.query<{ action: string }>("SELECT action FROM audit_log WHERE actor = $1 ORDER BY id", [admin.email]);
    expect(lines.rows.map((r) => r.action)).toContain("platform.addresses_set");
    await signInPut(asBrowser("/api/admin/sign-in", cookieOf(admin.b), { method: "PUT", body: { trustedOrigins: [] } }));
  });
});

const page = async (path: string, cookie: string) => {
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("@/proxy");
  return (await proxy(new NextRequest(`${BASE}${path}`, { headers: { cookie } }))).headers.get("location");
};

describe("item 5: the cut-over, with the switch on", () => {
  it("the old demo sign-in is refused everywhere", async () => {
    const r = await oldSignIn(new Request(`${BASE}/api/auth/sign-in`, { method: "POST", headers: { host: "localhost:3322", origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ username: "demo", password: "demo" }) }));
    expect(r.status).toBe(404);
    expect((await projectsGet(asBrowser("/api/projects", sessionCookieHeader()))).status).toBe(401);
    expect(await page("/concepts", sessionCookieHeader())).toBe(`${BASE}/auth/sign-in?next=%2Fconcepts`);
    expect(await page("/sign-in?next=/concepts", "")).toBe(`${BASE}/auth/sign-in?next=%2Fconcepts`);
    expect(await page("/account", sessionCookieHeader())).toBe(`${BASE}/auth/account`);
    expect(((await (await meGet(asBrowser("/api/auth/me", sessionCookieHeader()))).json()) as { user: unknown }).user).toBeNull();
  });

  it("a new-sign-in session reaches the app's pages and API, and 'who am I' names the account", async () => {
    const a = await newAccount(route, "co-user");
    expect(await page("/concepts", cookieOf(a.b))).toBeNull();
    expect(await page("/admin", cookieOf(a.b))).toBeNull();
    expect((await projectsGet(asBrowser("/api/projects", cookieOf(a.b)))).status).toBe(200);
    expect(((await (await meGet(asBrowser("/api/auth/me", cookieOf(a.b)))).json()) as { user: { username: string } }).user.username).toBe(a.email);
    // A stale or made-up cookie is not a session (checked on the server, not only present).
    expect(await page("/concepts", "c2r2.session_token=made.up")).toBe(`${BASE}/auth/sign-in?next=%2Fconcepts`);
  });

  it("someone who owes two-step sign-in is sent to set it up, on pages and in the API", async () => {
    const a = await newAccount(route, "co-owed");
    await db.query('UPDATE "user" SET "twoFactorRequired" = true WHERE id = $1', [a.userId]);
    expect(await page("/concepts", cookieOf(a.b))).toBe(`${BASE}/auth/two-factor/setup`);
    const res = await projectsGet(asBrowser("/api/projects", cookieOf(a.b)));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(/two-step sign-in/);
    const en = await a.b.post<{ totpURI: string }>("/two-factor/enable", { password: PASSWORD });
    await a.b.post("/two-factor/verify-totp", { code: authenticatorCode(en.body.totpURI) });
    expect((await projectsGet(asBrowser("/api/projects", cookieOf(a.b)))).status).toBe(200);
  });

  it("the platform administrator writes the new admin sections; a normal account cannot", async () => {
    const admin = await newAccount(route, "co-admin");
    const plain = await newAccount(route, "co-plain");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [admin.userId]);
    const { pool } = await import("@/lib/db");
    const before = await pool().query("SELECT key, value FROM settings WHERE key IN ('plans.catalogue', 'mail.smtp', 'voice.tts')");
    const credsBefore = await pool().query("SELECT provider, field, value, bound_origin FROM credentials WHERE provider = 'stripe'");
    try {
      const writes = (cookie: string) => [
        plansPut(asBrowser("/api/admin/plans", cookie, { method: "PUT", body: builtInCatalogue() })),
        settingsPut(asBrowser("/api/admin/settings", cookie, { method: "PUT", body: { mail: { mode: "none" } } })),
        settingsPut(asBrowser("/api/admin/settings", cookie, { method: "PUT", body: { voice: { provider: "none" } } })),
        credPut(asBrowser("/api/admin/credentials/stripe", cookie, { method: "PUT", body: { fields: { secretKey: "sk_test_" + "cutover0000000000" } } }), { params: Promise.resolve({ provider: "stripe" }) }),
      ];
      expect((await Promise.all(writes(cookieOf(plain.b)))).map((r) => r.status)).toEqual([403, 403, 403, 403]);
      expect((await Promise.all(writes(cookieOf(admin.b)))).map((r) => r.status)).toEqual([200, 200, 200, 200]);
    } finally {
      await pool().query("DELETE FROM settings WHERE key IN ('plans.catalogue', 'mail.smtp', 'voice.tts')");
      for (const r of before.rows) await pool().query("INSERT INTO settings (key, value) VALUES ($1, $2)", [r.key, JSON.stringify(r.value)]);
      await pool().query("DELETE FROM credentials WHERE provider = 'stripe'");
      for (const c of credsBefore.rows) await pool().query("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ($1,$2,$3,$4)", [c.provider, c.field, c.value, c.bound_origin]);
    }
  });
});

describe("item 5: with the switch off, the app is as before", () => {
  it("the old demo session reaches the API and pages; the new session is no identity", async () => {
    const a = await newAccount(route, "co-off");
    process.env.AUTH2 = "0";
    try {
      expect((await projectsGet(asBrowser("/api/projects", sessionCookieHeader()))).status).toBe(200);
      expect((await projectsGet(asBrowser("/api/projects", cookieOf(a.b)))).status).toBe(401);
      expect(await page("/concepts", sessionCookieHeader())).toBeNull();
      expect(await page("/concepts", cookieOf(a.b))).toBe(`${BASE}/sign-in?next=%2Fconcepts`);
    } finally {
      process.env.AUTH2 = "1";
    }
  });
});

describe("item 5b: the switch command", () => {
  it("turns the stored switch on and off from the owner's connection, and says where the set-up code appears", async () => {
    const run = (arg: string) => promisify(execFile)("node", ["scripts/sign-in.mjs", arg], { env: { ...process.env, AUTH2: "" } });
    const { readAuth2Setting, writeAuth2Setting } = await import("@/lib/auth2/config");
    const keep = await readAuth2Setting(db, "auth2.enabled");
    const admins = await db.query('SELECT id FROM "user" WHERE "platformAdmin"');
    await db.query('UPDATE "user" SET "platformAdmin" = false');
    try {
      const on = await run("on");
      expect(on.stdout).toMatch(/The new sign-in is on/);
      expect(on.stdout).toMatch(/docker compose logs web/);
      expect(await readAuth2Setting(db, "auth2.enabled")).toBe(true);
      expect((await run("status")).stdout).toMatch(/is on/);
      expect((await run("off")).stdout).toMatch(/is off/);
      expect(await readAuth2Setting(db, "auth2.enabled")).toBe(false);
      const lines = await db.query("SELECT summary FROM audit_log WHERE action = 'auth2.switch' ORDER BY id DESC LIMIT 2");
      expect(lines.rows.map((r) => r.summary)).toEqual(["Turned the new sign-in off from the command line (scripts/sign-in.mjs)", "Turned the new sign-in on from the command line (scripts/sign-in.mjs)"]);
      await expect(run("sideways")).rejects.toMatchObject({ code: 2 });
    } finally {
      await writeAuth2Setting(db, "auth2.enabled", keep);
      for (const r of admins.rows) await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [r.id]);
    }
  });
});

