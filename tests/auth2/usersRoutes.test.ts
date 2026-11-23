// Admin, Users routes (src/app/api/admin/users, invitations) with the new sign-in on: signed out 401, anyone but a
// platform administrator 403 (a "view as" session too), and the administrator's create, change and delete, with
// the link handed back once when no mail is set up and the typed confirmation of a delete. tests/auth2/cutoverReview
// walks every /api/admin route for a stranger as well.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { cleanUp, email, newAccount, PASSWORD, useAuth2, type Browser } from "./helpers";

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

const req = (path: string, cookie: string, method = "GET", body?: unknown) =>
  new Request(`${BASE}${path}`, { method, headers: { host: "localhost:3322", origin: BASE, cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = async (r: Response) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> });

async function routes() {
  const users = await import("@/app/api/admin/users/route");
  const one = await import("@/app/api/admin/users/[id]/route");
  const inv = await import("@/app/api/admin/invitations/route");
  const invOne = await import("@/app/api/admin/invitations/[id]/route");
  return { users, one, inv, invOne };
}

async function admin(tag: string): Promise<{ b: Browser; cookie: string; userId: string; email: string }> {
  const a = await newAccount(route, tag);
  await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [a.userId]);
  return { ...a, cookie: a.b.cookieHeader() };
}

describe("guards", () => {
  it("signed out 401, a member 403, a viewing session 403, on every users and invitations handler", async () => {
    const r = await routes();
    const member = await newAccount(route, "ur-member");
    const adm = await admin("ur-guard");
    const target = await newAccount(route, "ur-viewed");
    await adm.b.post("/view-as/start", { userId: target.userId, password: PASSWORD });
    const viewing = adm.b.cookieHeader();
    const calls = (cookie: string) => [
      () => r.users.GET(req("/api/admin/users", cookie)),
      () => r.users.POST(req("/api/admin/users", cookie, "POST", { name: "X", email: email("x"), how: "invite" })),
      () => r.one.POST(req(`/api/admin/users/${member.userId}`, cookie, "POST", { action: "disabled", on: true }), ctx(member.userId)),
      () => r.one.DELETE(req(`/api/admin/users/${member.userId}`, cookie, "DELETE", { confirmEmail: member.email }), ctx(member.userId)),
      () => r.inv.GET(req("/api/admin/invitations", cookie)),
      () => r.invOne.POST(req("/api/admin/invitations/nope", cookie, "POST", { action: "revoke" }), ctx("nope")),
    ];
    for (const c of calls("")) expect((await c()).status).toBe(401);
    for (const c of calls(member.b.cookieHeader())) expect((await c()).status).toBe(403);
    for (const c of calls(viewing)) expect((await c()).status).toBe(403);
    expect((await db.query('SELECT "disabledAt" FROM "user" WHERE id = $1', [member.userId])).rows[0].disabledAt).toBeNull();
  });
});

describe("the platform administrator", () => {
  it("creates by invitation (link handed back once without mail; no mail here is the capture, so it is mailed), lists, renames, deletes with the typed address", async () => {
    const r = await routes();
    const adm = await admin("ur-admin");
    const who = email("ur-new");
    const made = await json(await r.users.POST(req("/api/admin/users", adm.cookie, "POST", { name: "New Person", email: who, how: "invite" })));
    expect(made.status).toBe(201);
    const id = made.body.id as string;
    const list = await json(await r.users.GET(req(`/api/admin/users?q=${encodeURIComponent(who)}`, adm.cookie)));
    expect(list.body).toMatchObject({ total: 1, me: adm.userId });
    expect((list.body.users as { state: string }[])[0]?.state).toBe("invited");
    expect((await json(await r.one.POST(req(`/api/admin/users/${id}`, adm.cookie, "POST", { action: "rename", name: "Renamed Person" }), ctx(id)))).status).toBe(200);
    const wrong = await json(await r.one.DELETE(req(`/api/admin/users/${id}`, adm.cookie, "DELETE", { confirmEmail: "someone@else.test" }), ctx(id)));
    expect([wrong.status, (wrong.body.detail as { code: string }).code]).toEqual([400, "CONFIRM_EMAIL_MISMATCH"]);
    expect((await r.one.DELETE(req(`/api/admin/users/${id}`, adm.cookie, "DELETE", { confirmEmail: who.toUpperCase() }), ctx(id))).status).toBe(200);
    expect((await db.query('SELECT 1 FROM "user" WHERE id = $1', [id])).rowCount).toBe(0);
  });

  it("a temporary password typed by the administrator is never echoed or logged; making an administrator needs step-up", async () => {
    const r = await routes();
    const adm = await admin("ur-temp");
    const who = email("ur-temp-new");
    const res = await r.users.POST(req("/api/admin/users", adm.cookie, "POST", { name: "Temp", email: who, how: "password", password: "Typed by admin 9!", markVerified: true }));
    const text = await res.text();
    expect(res.status).toBe(201);
    expect(text).not.toContain("Typed by admin 9!");
    const audit = JSON.stringify((await db.query("SELECT * FROM audit_log WHERE actor = $1", [adm.email])).rows);
    expect(audit).not.toContain("Typed by admin 9!");
    const noStep = await json(await r.users.POST(req("/api/admin/users", adm.cookie, "POST", { name: "Admin Two", email: email("ur-a2"), how: "invite", platformAdmin: true })));
    expect((noStep.body.detail as { code: string }).code).toBe("STEP_UP_REQUIRED");
    const withStep = await r.users.POST(req("/api/admin/users", adm.cookie, "POST", { name: "Admin Two", email: email("ur-a2"), how: "invite", platformAdmin: true, stepUp: PASSWORD }));
    expect(withStep.status).toBe(201);
    expect(await withStep.text()).not.toContain(PASSWORD);
  });

  it("invitations: list by status, revoke, resend refused once revoked", async () => {
    const r = await routes();
    const adm = await admin("ur-inv");
    const who = email("ur-inv-new");
    await r.users.POST(req("/api/admin/users", adm.cookie, "POST", { name: "Invitee", email: who, how: "invite" }));
    const pending = (await json(await r.inv.GET(req("/api/admin/invitations?status=pending", adm.cookie)))).body.invitations as { id: string; email: string }[];
    const mine = pending.find((i) => i.email === who)!;
    expect(mine).toBeTruthy();
    expect((await r.invOne.POST(req(`/api/admin/invitations/${mine.id}`, adm.cookie, "POST", { action: "revoke" }), ctx(mine.id))).status).toBe(200);
    const again = await json(await r.invOne.POST(req(`/api/admin/invitations/${mine.id}`, adm.cookie, "POST", { action: "resend" }), ctx(mine.id)));
    expect((again.body.detail as { code: string }).code).toBe("INVITATION_REVOKED");
    const revoked = (await json(await r.inv.GET(req("/api/admin/invitations?status=revoked", adm.cookie)))).body.invitations as { email: string }[];
    expect(revoked.map((i) => i.email)).toContain(who);
  });
});
