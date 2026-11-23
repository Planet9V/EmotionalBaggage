// Self-service reset (owner's ruling of 23 Nov). With mail: a single-use link, 60 minutes, the same answer for any
// address, other sessions ended, a lock lifted, audited. Without mail: the request is noted on the account for the
// platform administrator (Users, "asked for a reset"); an unknown address leaves nothing; the answer is the same.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { makeAuth } from "@/lib/auth2/auth";
import { adminOps } from "@/lib/auth2/adminOps";
import { browser, cleanUp, email, lastMail, newAccount, PASSWORD, sent, useAuth2, waitForMail } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
let auth: Awaited<ReturnType<typeof useAuth2>>["auth"];
const BASE = "http://localhost:3322";

beforeAll(async () => {
  ({ db, route, auth } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
});
afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

describe("with mail", () => {
  it("one link, once, for 60 minutes; the same answer for an unknown address; other sessions end", async () => {
    const a = await newAccount(route, "rs-mail");
    const before = sent.length;
    const known = await browser(route).post("/request-password-reset", { email: a.email, redirectTo: "/auth/reset/new" });
    const unknown = await browser(route).post("/request-password-reset", { email: email("rs-nobody"), redirectTo: "/auth/reset/new" });
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(known.body).toEqual(unknown.body);
    await waitForMail("reset-password", a.email, 1);
    expect(sent.slice(before).filter((m) => /^Choose a new password/.test(m.subject))).toHaveLength(1);
    const { token, text } = lastMail("reset-password", a.email);
    expect(text).toContain("works once, for one hour");
    const row = await db.query<{ mins: number }>("SELECT round(extract(epoch FROM \"expiresAt\" - now()) / 60)::int AS mins FROM verification WHERE value = $1", [a.userId]);
    expect(row.rows[0]?.mins).toBe(60);
    // the token is stored only hashed
    expect(JSON.stringify((await db.query("SELECT identifier FROM verification WHERE value = $1", [a.userId])).rows)).not.toContain(token);
    expect((await browser(route).post("/reset-password", { token, newPassword: "Reset by link 5!" })).status).toBe(200);
    expect((await db.query('SELECT 1 FROM "session" WHERE "userId" = $1', [a.userId])).rowCount).toBe(0);
    expect((await browser(route).post("/reset-password", { token, newPassword: "Reset twice 6!" })).status).toBe(400);
    expect((await db.query("SELECT 1 FROM audit_log WHERE actor = $1 AND action = 'account.password_reset'", [a.email])).rowCount).toBe(1);
  });

  it("the no-mail request is refused while mail is set up", async () => {
    const a = await newAccount(route, "rs-refuse");
    expect((await browser(route).post("/account/reset-request", { email: a.email })).body).toMatchObject({ code: "USE_RESET_LINK" });
  });
});

describe("without mail", () => {
  it("notes the request for the administrator; an unknown address leaves nothing; the same answer", async () => {
    const noMail = makeAuth(db, { mail: null, rateLimit: false, baseURL: BASE });
    const call = async (body: unknown) => {
      const res = await noMail.handler(new Request(`${BASE}/api/auth2/account/reset-request`, { method: "POST", headers: { origin: BASE, host: "localhost:3322", "content-type": "application/json", "x-c2r-client-address": "203.0.113.77" }, body: JSON.stringify(body) }));
      return { status: res.status, body: await res.json() };
    };
    const a = await newAccount(route, "rs-nomail");
    const known = await call({ email: a.email });
    const unknown = await call({ email: email("rs-nomail-nobody") });
    expect(known).toEqual(unknown);
    expect(known.status).toBe(200);
    const adm = await newAccount(route, "rs-admin");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [adm.userId]);
    const ops = adminOps({ db, auth, actorId: adm.userId, baseURL: BASE, stepUp: PASSWORD });
    const listed = (await ops.listUsers({ state: "reset" })).users.map((u) => u.email);
    expect(listed).toContain(a.email);
    expect(listed.some((e) => e.includes("rs-nomail-nobody"))).toBe(false);
    expect((await db.query("SELECT 1 FROM audit_log WHERE actor = $1 AND action = 'account.reset_requested'", [a.email])).rowCount).toBe(1);
    // the administrator's temporary password clears the request
    await ops.setPassword(a.userId, "Given by admin 7!");
    expect((await ops.listUsers({ state: "reset" })).users.map((u) => u.email)).not.toContain(a.email);
  });
});
