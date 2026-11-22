// The new sign-in wired into the rest of the app (accounts slice 2, integration with the admin area): who is the
// platform administrator (src/lib/admin/platformAdminHook.ts), and, with the switch on, every route reached through
// the new sign-in's session only (src/lib/api/route.ts). With the switch off the app is as before.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { GET as accessGet } from "@/app/api/admin/access/route";
import { platformAdminFromAuth2 } from "@/lib/admin/platformAdminHook";
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
