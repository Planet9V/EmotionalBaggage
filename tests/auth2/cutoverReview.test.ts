// The review of the cut-over (22 Nov; scripts and outputs were in /tmp/cutover-review): each finding's scenario, now a
// regression test. With the switch on the new sign-in's session is the only identity; with it off the app is as on main.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { sessionCookieHeader } from "../api/helpers";
import { cleanUp, newAccount, useAuth2, type Browser } from "./helpers";

let db: Pool;
let auth: Awaited<ReturnType<typeof useAuth2>>["auth"];
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
const BASE = "http://localhost:3322";

beforeAll(async () => {
  ({ db, auth, route } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
});
afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

type Init = { method?: string; body?: unknown; headers?: Record<string, string> };
/** A request to an app route with the given cookie, sent as a page on this site sends it. */
const asBrowser = (path: string, cookie: string, init: Init = {}) =>
  new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { host: "localhost:3322", origin: BASE, cookie, ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...(init.headers ?? {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
const cookieOf = (b: Browser) => b.cookieHeader();

/** A self-signed-up stranger and the platform administrator, both of the new sign-in. */
async function strangerAndAdmin(tag: string) {
  const stranger = await newAccount(route, `${tag}-stranger`);
  const admin = await newAccount(route, `${tag}-admin`);
  await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [admin.userId]);
  return { stranger: cookieOf(stranger.b), admin: cookieOf(admin.b) };
}

describe("B1: access requests are the platform administrator's while the new sign-in is on", () => {
  it("a self-signed-up account cannot list, export or change them; the platform administrator can; off is as before", async () => {
    const { createAccessRequest } = await import("@/lib/accessRequests/store");
    const id = await createAccessRequest({ name: "Prospect Person", email: "prospect@zz-auth2.test", building: "x", company: "Acme", level: "" });
    const { GET: list } = await import("@/app/api/admin/access-requests/route");
    const { GET: exportCsv } = await import("@/app/api/admin/access-requests/export/route");
    const { PATCH: patch } = await import("@/app/api/admin/access-requests/[id]/route");
    const calls = (cookie: string) => [
      () => list(asBrowser("/api/admin/access-requests", cookie)),
      () => exportCsv(asBrowser("/api/admin/access-requests/export", cookie)),
      () => patch(asBrowser(`/api/admin/access-requests/${id}`, cookie, { method: "PATCH", body: { status: "contacted" } }), { params: Promise.resolve({ id: String(id) }) }),
    ];
    try {
      const { stranger, admin } = await strangerAndAdmin("b1");
      for (const call of calls(stranger)) {
        const r = await call();
        expect(r.status).toBe(403);
        expect(await r.text()).not.toContain("prospect@zz-auth2.test");
      }
      const statuses = [];
      for (const call of calls(admin)) statuses.push((await call()).status);
      expect(statuses).toEqual([200, 200, 200]);
      // Off: as on main. The demo account still has the published password, so it is refused, by that rule.
      process.env.AUTH2 = "0";
      try {
        const r = await list(asBrowser("/api/admin/access-requests", sessionCookieHeader()));
        expect(r.status).toBe(403);
        expect(((await r.json()) as { error: string }).error).toMatch(/published demo password/);
      } finally {
        process.env.AUTH2 = "1";
      }
    } finally {
      await db.query("DELETE FROM access_requests WHERE email = 'prospect@zz-auth2.test'");
    }
  });
});

describe("B2: a failed read of the switch never turns the new sign-in off", () => {
  const g = globalThis as unknown as { __c2rAuth2Known?: boolean };
  /** Makes the next `n` reads of auth2_settings on the owner's pool fail, as a statement timeout would. */
  async function failSwitchReads(n: number) {
    const { ownerPool } = await import("@/lib/db");
    const p = ownerPool() as unknown as { query: (...a: unknown[]) => unknown };
    const orig = p.query.bind(p);
    let left = n;
    p.query = (...a: unknown[]) => {
      if (left > 0 && typeof a[0] === "string" && a[0].includes("auth2_settings")) {
        left--;
        return Promise.reject(new Error("simulated statement timeout"));
      }
      return orig(...a);
    };
    return () => void (p.query = orig);
  }

  async function withStoredSwitch(on: boolean, run: () => Promise<void>) {
    const { writeAuth2Setting, readAuth2Setting, forgetAuth2Switch } = await import("@/lib/auth2/config");
    const keep = await readAuth2Setting(db, "auth2.enabled");
    delete process.env.AUTH2;
    try {
      await writeAuth2Setting(db, "auth2.enabled", on);
      forgetAuth2Switch();
      await run();
    } finally {
      await writeAuth2Setting(db, "auth2.enabled", keep);
      process.env.AUTH2 = "1";
    }
  }

  it("R1: read as on, then one failed read: the old demo session is still refused (latched on)", async () => {
    const { forgetAuth2Switch } = await import("@/lib/auth2/config");
    const { GET: projectsGet } = await import("@/app/api/projects/route");
    await withStoredSwitch(true, async () => {
      expect((await projectsGet(asBrowser("/api/projects", sessionCookieHeader()))).status).toBe(401);
      const restore = await failSwitchReads(1);
      try {
        forgetAuth2Switch();
        expect((await projectsGet(asBrowser("/api/projects", sessionCookieHeader()))).status).toBe(401);
      } finally {
        restore();
      }
      // A successful read that says off is what turns it off.
      const { writeAuth2Setting } = await import("@/lib/auth2/config");
      await writeAuth2Setting(db, "auth2.enabled", false);
      expect((await projectsGet(asBrowser("/api/projects", sessionCookieHeader()))).status).toBe(200);
    });
  });

  it("never read in this process and the read fails: 503 from the API and the proxy, not the old sign-in", async () => {
    const { forgetAuth2Switch, auth2Enabled } = await import("@/lib/auth2/config");
    const { GET: projectsGet } = await import("@/app/api/projects/route");
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    await withStoredSwitch(true, async () => {
      const restore = await failSwitchReads(3);
      const known = g.__c2rAuth2Known;
      try {
        forgetAuth2Switch();
        g.__c2rAuth2Known = undefined;
        const api = await projectsGet(asBrowser("/api/projects", sessionCookieHeader()));
        expect(api.status).toBe(503);
        expect(((await api.json()) as { error: string }).error).toMatch(/temporarily unavailable/);
        const pageRes = await proxy(new NextRequest(`${BASE}/concepts`, { headers: { cookie: sessionCookieHeader() } }));
        expect(pageRes.status).toBe(503);
        expect(await pageRes.text()).toMatch(/Temporarily unavailable/);
        await expect(auth2Enabled()).rejects.toThrow(/temporarily unavailable/);
      } finally {
        restore();
        g.__c2rAuth2Known = known;
        forgetAuth2Switch();
      }
      expect(await auth2Enabled()).toBe(true);
    });
  });
});

describe("B3: with the new sign-in on, the admin area is the platform administrator's", () => {
  type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
  /** Every /api/admin route file and its handlers, found on disk so a route added later is covered too. */
  async function adminRoutes() {
    const { readdirSync } = await import("node:fs");
    const { join, relative } = await import("node:path");
    const root = join(process.cwd(), "src/app/api/admin");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else if (e.name === "route.ts") files.push(relative(root, join(dir, e.name)));
      }
    };
    walk(root);
    return files.sort();
  }
  /** A path and context for a route file: [id] is 0 and other parameters "nope", so nothing real is touched. */
  const pathOf = (file: string) => `/api/admin/${file.replace(/\/?route\.ts$/, "")}`.replace(/\[id\]/g, "0").replace(/\[(\w+)\]/g, "nope");
  const ctxOf = (file: string) => {
    const params: Record<string, string> = {};
    for (const [, name] of file.matchAll(/\[(\w+)\]/g)) params[name] = name === "id" ? "0" : "nope";
    return { params: Promise.resolve(params) };
  };
  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
  /** A body that no route accepts (strict schemas), so the administrator's calls change nothing. */
  const PROBE = { __probe: true };

  /** Routes outside /api/admin that write credentials or install-wide settings (docs/guide/admin.md lists them). */
  const WRITE_ROUTES: [string, string, (typeof METHODS)[number]][] = [
    ["@/app/api/channels/x/connect/route", "/api/channels/x/connect", "POST"],
    ["@/app/api/channels/x/callback/route", "/api/channels/x/callback?state=nope&code=nope", "GET"],
    ["@/app/api/channels/x/ack/route", "/api/channels/x/ack", "POST"],
    ["@/app/api/channels/instagram/review/route", "/api/channels/instagram/review", "GET"],
    ["@/app/api/channels/instagram/review/route", "/api/channels/instagram/review", "PUT"],
  ];

  it("a self-signed-up account gets 403 on every /api/admin route and each listed write route; the platform administrator gets through", async () => {
    const files = await adminRoutes();
    expect(files.length).toBeGreaterThan(20);
    const { pool } = await import("@/lib/db");
    const plans = await pool().query("SELECT key, value FROM settings WHERE key = 'plans.catalogue'");
    const { stranger, admin } = await strangerAndAdmin("b3");
    const seen: string[] = [];
    const through: Record<string, number> = {};
    try {
      const call = async (h: Handler, path: string, method: string, cookie: string, ctx?: unknown) =>
        h(asBrowser(path, cookie, { method, body: method === "GET" || method === "DELETE" ? undefined : PROBE }), ctx);
      for (const file of files) {
        const mod = (await import(`@/app/api/admin/${file.replace(/\.ts$/, "")}`)) as Partial<Record<(typeof METHODS)[number], Handler>>;
        for (const m of METHODS) {
          const h = mod[m];
          if (!h) continue;
          const r = await call(h, pathOf(file), m, stranger, ctxOf(file));
          seen.push(`${m} ${file}`);
          expect(r.status, `${m} ${file} for a stranger`).toBe(403);
          expect(((await r.json()) as { error: string }).error).toBe("This area is for the platform administrator.");
          through[`${m} ${file}`] = (await call(h, pathOf(file), m, admin, ctxOf(file))).status;
        }
      }
      for (const [mod, path, m] of WRITE_ROUTES) {
        const h = ((await import(mod)) as Record<string, Handler>)[m];
        expect((await call(h, path, m, stranger)).status, `${m} ${path} for a stranger`).toBe(403);
        through[`${m} ${path}`] = (await call(h, path, m, admin)).status;
      }
    } finally {
      await pool().query("DELETE FROM settings WHERE key = 'plans.catalogue'");
      for (const r of plans.rows) await pool().query("INSERT INTO settings (key, value) VALUES ($1, $2)", [r.key, JSON.stringify(r.value)]);
    }
    // Found on disk, so a handler added later (a DELETE of one access request, say) is in this list by itself.
    expect(seen).toEqual(expect.arrayContaining(["GET access-requests/route.ts", "PATCH access-requests/[id]/route.ts", "PUT sign-in/route.ts"]));
    for (const [what, status] of Object.entries(through)) {
      expect([401, 403], `${what} for the platform administrator answered ${status}`).not.toContain(status);
    }
  });

  it("with the switch off, the demo account keeps the old open powers, exactly as before", async () => {
    const { GET: printers } = await import("@/app/api/admin/printers/route");
    const { GET: settings } = await import("@/app/api/admin/settings/route");
    const { GET: review } = await import("@/app/api/channels/instagram/review/route");
    process.env.AUTH2 = "0";
    try {
      for (const r of [printers(asBrowser("/api/admin/printers", sessionCookieHeader())), settings(asBrowser("/api/admin/settings", sessionCookieHeader())), review(asBrowser("/api/channels/instagram/review", sessionCookieHeader()))]) {
        expect((await r).status).toBe(200);
      }
    } finally {
      process.env.AUTH2 = "1";
    }
  });

  it("the /admin page shows the area to the platform administrator only; concept settings and the print flow's printer list stay open", async () => {
    const { adminPageOpen } = await import("@/lib/admin/pageGate");
    const { stranger, admin } = await strangerAndAdmin("b3-page");
    const h = (cookie: string) => new Headers({ host: "localhost:3322", cookie });
    expect(await adminPageOpen(h(stranger))).toBe(false);
    expect(await adminPageOpen(h(""))).toBe(false);
    expect(await adminPageOpen(h(admin))).toBe(true);
    process.env.AUTH2 = "0";
    try {
      expect(await adminPageOpen(h(sessionCookieHeader()))).toBe(true);
    } finally {
      process.env.AUTH2 = "1";
    }
    // The print flow's list: names and families only, never an address or an access value.
    const { GET: choices } = await import("@/app/api/printers/route");
    const r = await choices(asBrowser("/api/printers", stranger));
    expect(r.status).toBe(200);
    for (const p of ((await r.json()) as { printers: Record<string, unknown>[] }).printers) {
      expect(Object.keys(p).sort()).toEqual(["enabled", "family", "familyLabel", "id", "model", "name"]);
    }
    // A concept's own campaign CSV mapping stays open to any signed-in account.
    const proj = await db.query<{ id: string }>("SELECT id FROM projects ORDER BY id LIMIT 1");
    const { GET: mapping } = await import("@/app/api/projects/[id]/campaigns/csv-mapping/route");
    const m = await mapping(asBrowser(`/api/projects/${proj.rows[0].id}/campaigns/csv-mapping?channel=x`, stranger), { params: Promise.resolve({ id: proj.rows[0].id }) });
    expect(m.status).not.toBe(403);
  });
});

describe("F1: with the switch off, Admin, Sign-in tells the demo account only whether it is on", () => {
  it("answers exactly { enabled }, and the read creates no secret", async () => {
    const { GET } = await import("@/app/api/admin/sign-in/route");
    const { forgetAuth2Switch } = await import("@/lib/auth2/config");
    const kept = await db.query<{ value: string }>("SELECT value FROM auth2_secrets WHERE name = 'better-auth'");
    const envSecret = process.env.BETTER_AUTH_SECRET;
    process.env.AUTH2 = "0";
    delete process.env.BETTER_AUTH_SECRET;
    try {
      await db.query("DELETE FROM auth2_secrets WHERE name = 'better-auth'");
      forgetAuth2Switch();
      const r = await GET(asBrowser("/api/admin/sign-in", sessionCookieHeader()));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ enabled: false });
      expect((await db.query("SELECT 1 FROM auth2_secrets WHERE name = 'better-auth'")).rowCount).toBe(0);
    } finally {
      process.env.AUTH2 = "1";
      process.env.BETTER_AUTH_SECRET = envSecret;
      for (const k of kept.rows) await db.query("INSERT INTO auth2_secrets (name, value) VALUES ('better-auth', $1) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value", [k.value]);
      forgetAuth2Switch();
    }
  });

  it("the platform administrator still reads the whole status", async () => {
    const { GET } = await import("@/app/api/admin/sign-in/route");
    const { admin } = await strangerAndAdmin("f1");
    const body = (await (await GET(asBrowser("/api/admin/sign-in", admin))).json()) as { on: boolean; detail: { baseURL: string } };
    expect(body.on).toBe(true);
    expect(body.detail.baseURL).toBe(BASE);
  });
});

describe("F2: the platform administrator cannot lock everyone out with the addresses", () => {
  const put = async (cookie: string, body: unknown, from = BASE) => {
    const { PUT } = await import("@/app/api/admin/sign-in/route");
    const host = new URL(from).host;
    const r = await PUT(asBrowser("/api/admin/sign-in", cookie, { method: "PUT", body, headers: { origin: from, host } }));
    return { status: r.status, body: (await r.json()) as { error?: string; detail?: { code?: string } } };
  };
  const stored = async (key: string) => (await db.query<{ value: unknown }>("SELECT value FROM auth2_settings WHERE key = $1", [key])).rows[0]?.value ?? null;

  it("a new address must be the page's own origin; other addresses must be https origins (http for localhost only)", async () => {
    const { admin } = await strangerAndAdmin("f2");
    const keep = { base: await stored("auth2.baseUrl"), more: await stored("auth2.trustedOrigins") };
    try {
      const moved = await put(admin, { baseURL: "https://elsewhere.example.test" });
      expect(moved.status).toBe(400);
      expect(moved.body.detail?.code).toBe("ADDRESS_MISMATCH");
      expect(await stored("auth2.baseUrl")).toEqual(keep.base);
      expect((await put(admin, { baseURL: BASE })).status).toBe(200);
      for (const wrong of ["http://intranet.example.test", "https://x.example.test/path", "https://user@x.example.test", "not an address"]) {
        const r = await put(admin, { trustedOrigins: [wrong] });
        expect(r.status, wrong).toBe(400);
        expect(r.body.detail?.code).toBe("INVALID_ADDRESS");
      }
      expect((await put(admin, { trustedOrigins: ["https://other.example.test", "http://localhost:4000"] })).status).toBe(200);
      // No Origin at all (a script with the administrator's cookie): refused, nothing to compare with.
      const { PUT } = await import("@/app/api/admin/sign-in/route");
      const bare = new Request(`${BASE}/api/admin/sign-in`, { method: "PUT", headers: { host: "localhost:3322", cookie: admin, "content-type": "application/json" }, body: JSON.stringify({ trustedOrigins: [] }) });
      const r = await PUT(bare);
      expect(r.status).toBe(400);
      expect(((await r.json()) as { detail: { code: string } }).detail.code).toBe("ORIGIN_REQUIRED");
    } finally {
      await db.query("DELETE FROM auth2_settings WHERE key IN ('auth2.baseUrl', 'auth2.trustedOrigins')");
      if (keep.base !== null) await db.query("INSERT INTO auth2_settings (key, value) VALUES ('auth2.baseUrl', $1)", [JSON.stringify(keep.base)]);
      if (keep.more !== null) await db.query("INSERT INTO auth2_settings (key, value) VALUES ('auth2.trustedOrigins', $1)", [JSON.stringify(keep.more)]);
      (await import("@/lib/auth2/config")).forgetAuth2Switch();
    }
  });

  it("a change that would stop trusting the page's own origin is refused; in production the address cannot be cleared", async () => {
    const { admin } = await strangerAndAdmin("f2-lock");
    const adminId = (await db.query<{ id: string }>('SELECT id FROM "user" WHERE email LIKE \'f2-lock-admin%\'')).rows[0].id;
    const keep = await stored("auth2.trustedOrigins");
    try {
      expect((await put(admin, { trustedOrigins: ["https://other.example.test"] })).status).toBe(200);
      const lock = await put(admin, { trustedOrigins: [] }, "https://other.example.test");
      expect(lock.status).toBe(400);
      expect(lock.body.detail?.code).toBe("WOULD_LOCK_OUT");
      expect(await stored("auth2.trustedOrigins")).toEqual(["https://other.example.test"]);
      const { adminOps } = await import("@/lib/auth2/adminOps");
      const ops = adminOps({ db, auth, actorId: adminId, baseURL: BASE });
      const env = process.env as Record<string, string | undefined>;
      const node = env.NODE_ENV;
      env.NODE_ENV = "production";
      try {
        for (const empty of [null, ""]) {
          await expect(ops.setAddresses({ baseURL: empty, requestOrigin: BASE })).rejects.toMatchObject({ body: { code: "ADDRESS_REQUIRED" } });
          await expect(ops.setAddresses({ baseURL: empty, requestOrigin: null })).rejects.toMatchObject({ body: { code: "ADDRESS_REQUIRED" } });
        }
      } finally {
        env.NODE_ENV = node;
      }
    } finally {
      await db.query("DELETE FROM auth2_settings WHERE key = 'auth2.trustedOrigins'");
      if (keep !== null) await db.query("INSERT INTO auth2_settings (key, value) VALUES ('auth2.trustedOrigins', $1)", [JSON.stringify(keep)]);
      (await import("@/lib/auth2/config")).forgetAuth2Switch();
    }
  });
});

describe("F3: turning the new sign-in on ends the old sign-in's sessions, and does not prepare the demo account", () => {
  const run = async (arg: string) => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    return promisify(execFile)("node", ["scripts/sign-in.mjs", arg], { env: { ...process.env, AUTH2: "" } });
  };
  /** A fresh session for the demo account, as tests/auth/session.setup.ts makes one, for the tests after this. */
  async function newDemoSession() {
    const { setTestSession } = await import("../api/helpers");
    const { createSession, DEFAULT_USERNAME } = await import("@/lib/auth");
    const id = (await db.query<{ id: string }>("SELECT id FROM users WHERE lower(username) = $1", [DEFAULT_USERNAME])).rows[0].id;
    setTestSession(await createSession(Number(id), "vitest-setup"));
  }

  it("`sign-in.mjs on` deletes every old session; switched off again, the old cookie is not accepted", async () => {
    const { readAuth2Setting, writeAuth2Setting } = await import("@/lib/auth2/config");
    const { GET: projectsGet } = await import("@/app/api/projects/route");
    const keep = await readAuth2Setting(db, "auth2.enabled");
    try {
      expect(Number((await db.query("SELECT count(*) AS n FROM sessions")).rows[0].n)).toBeGreaterThan(0);
      const on = await run("on");
      expect(on.stdout).toMatch(/Ended \d+ sessions? of the old sign-in/);
      expect(Number((await db.query("SELECT count(*) AS n FROM sessions")).rows[0].n)).toBe(0);
      const off = await run("off");
      expect(off.stdout).toMatch(/demo \/ demo/);
      process.env.AUTH2 = "0";
      try {
        expect((await projectsGet(asBrowser("/api/projects", sessionCookieHeader()))).status).toBe(401);
      } finally {
        process.env.AUTH2 = "1";
      }
    } finally {
      await writeAuth2Setting(db, "auth2.enabled", keep);
      await newDemoSession();
    }
  });

  it("turning it on in Admin, Sign-in deletes them too, in the same step, and says how many in the audit log", async () => {
    const { readAuth2Setting, writeAuth2Setting } = await import("@/lib/auth2/config");
    const { PUT } = await import("@/app/api/admin/sign-in/route");
    const keep = await readAuth2Setting(db, "auth2.enabled");
    const { admin } = await strangerAndAdmin("f3");
    try {
      expect(Number((await db.query("SELECT count(*) AS n FROM sessions")).rows[0].n)).toBeGreaterThan(0);
      expect((await PUT(asBrowser("/api/admin/sign-in", admin, { method: "PUT", body: { enabled: true } }))).status).toBe(200);
      expect(Number((await db.query("SELECT count(*) AS n FROM sessions")).rows[0].n)).toBe(0);
      const line = await db.query<{ detail: { oldSessionsEnded?: number } }>("SELECT detail FROM audit_log WHERE action = 'auth2.switch' ORDER BY id DESC LIMIT 1");
      expect(line.rows[0].detail.oldSessionsEnded).toBeGreaterThan(0);
    } finally {
      await writeAuth2Setting(db, "auth2.enabled", keep);
      await newDemoSession();
    }
  });

  it("ensureDefaultUser makes no demo account while the switch is on, or when the switch cannot be read", async () => {
    const { ensureDefaultUser } = await import("@/lib/auth");
    const asked: string[] = [];
    const fake = (stored: unknown) => ({
      query: async (text: string) => {
        asked.push(text);
        if (text.includes("auth2_settings")) {
          if (stored === "fail") throw new Error("simulated");
          return { rows: stored === undefined ? [] : [{ value: stored }] };
        }
        return { rows: [{ has: false }], rowCount: 1 };
      },
    });
    const call = (db: ReturnType<typeof fake>) => ensureDefaultUser(db as unknown as Pool);
    // the AUTH2 override is on in this file
    expect(await call(fake(false))).toBe(false);
    expect(asked).toEqual([]);
    delete process.env.AUTH2;
    try {
      for (const stored of [true, "fail"]) {
        asked.length = 0;
        expect(await call(fake(stored))).toBe(false);
        expect(asked.some((t) => /INSERT INTO users/.test(t))).toBe(false);
      }
      // Off: an empty users table gets demo / demo, as before.
      asked.length = 0;
      expect(await call(fake(false))).toBe(true);
      expect(asked.some((t) => /INSERT INTO users/.test(t))).toBe(true);
    } finally {
      process.env.AUTH2 = "1";
    }
  });
});

describe("N4: `sign-in.mjs status` says whether an owner exists and whether a set-up code waits, never the code", () => {
  it("names both, and prints nothing that looks like a code", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const status = async () => (await promisify(execFile)("node", ["scripts/sign-in.mjs", "status"], { env: { ...process.env, AUTH2: "" } })).stdout;
    const admins = await db.query<{ id: string }>('SELECT id FROM "user" WHERE "platformAdmin"');
    const code = await db.query("SELECT * FROM auth2_setup_code");
    try {
      await db.query('UPDATE "user" SET "platformAdmin" = false');
      await db.query("DELETE FROM auth2_setup_code");
      expect(await status()).toMatch(/No owner \(platform administrator\) exists yet\.\nNo set-up code is waiting yet/);
      await db.query("INSERT INTO auth2_setup_code (id, code_hash, created_at, failures, next_allowed_at) VALUES (true, 'x', now(), 0, now())");
      const waiting = await status();
      expect(waiting).toMatch(/A set-up code is waiting\. It was printed to the app's standard output/);
      expect(waiting).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
      const { admin } = await strangerAndAdmin("n4");
      expect(admin).toBeTruthy();
      const owned = await status();
      expect(owned).toMatch(/An owner \(platform administrator\) exists\./);
      expect(owned).not.toMatch(/set-up code/);
    } finally {
      await db.query('UPDATE "user" SET "platformAdmin" = false');
      for (const r of admins.rows) await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [r.id]);
      await db.query("DELETE FROM auth2_setup_code");
      for (const r of code.rows) await db.query("INSERT INTO auth2_setup_code (id, code_hash, created_at, failures, next_allowed_at) VALUES ($1, $2, $3, $4, $5)", [r.id, r.code_hash, r.created_at, r.failures, r.next_allowed_at]);
    }
  });
});
