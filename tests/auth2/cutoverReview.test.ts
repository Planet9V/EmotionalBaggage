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
