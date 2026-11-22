// The review of the cut-over (22 Nov; scripts and outputs were in /tmp/cutover-review): each finding's scenario, now a
// regression test. With the switch on the new sign-in's session is the only identity; with it off the app is as on main.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { sessionCookieHeader } from "../api/helpers";
import { cleanUp, newAccount, useAuth2, type Browser } from "./helpers";

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
