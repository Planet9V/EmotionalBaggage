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
