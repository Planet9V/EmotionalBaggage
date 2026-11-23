// "View as this user" (owner's addition of 23 Nov; src/lib/auth2/viewAs.ts), through the real route: each rule.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { requirePlatformAdmin } from "@/lib/auth2/platformAdmin";
import { auditOf, browser, cleanUp, email, newAccount, PASSWORD, useAuth2, type Browser } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];

beforeAll(async () => {
  ({ db, route } = await useAuth2({ rateLimit: false }));
  await cleanUp(db);
});
afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

async function anAdmin(tag: string) {
  const a = await newAccount(route, tag);
  await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [a.userId]);
  return a;
}
const me = (b: Browser) => b.get<{ user: { id: string; email: string }; session: { impersonatedBy?: string | null; activeOrganizationId: string } } | null>("/get-session");
const sessionsOf = async (userId: string) => (await db.query('SELECT id FROM "session" WHERE "userId" = $1 AND "impersonatedBy" IS NULL', [userId])).rowCount;

describe("starting", () => {
  it("needs a platform administrator and their own password; refuses another administrator, a disabled or invited account", async () => {
    const adm = await anAdmin("va-admin");
    const plain = await newAccount(route, "va-plain");
    const other = await newAccount(route, "va-other");
    expect((await plain.b.post("/view-as/start", { userId: other.userId, password: PASSWORD })).body).toMatchObject({ code: "NOT_PLATFORM_ADMIN" });
    expect((await browser(route).post("/view-as/start", { userId: other.userId, password: PASSWORD })).status).toBe(401);
    expect((await adm.b.post("/view-as/start", { userId: other.userId, password: "" })).body).toMatchObject({ code: "STEP_UP_REQUIRED" });
    expect((await adm.b.post("/view-as/start", { userId: other.userId, password: "wrong one" })).body).toMatchObject({ code: "STEP_UP_WRONG" });
    const adm2 = await anAdmin("va-admin2");
    expect((await adm.b.post("/view-as/start", { userId: adm2.userId, password: PASSWORD })).body).toMatchObject({ code: "VIEW_AS_ADMIN" });
    await db.query('UPDATE "user" SET "disabledAt" = now() WHERE id = $1', [other.userId]);
    expect((await adm.b.post("/view-as/start", { userId: other.userId, password: PASSWORD })).body).toMatchObject({ code: "ACCOUNT_DISABLED" });
    // still signed in as the administrator after every refusal
    expect((await me(adm.b)).body?.user.id).toBe(adm.userId);
  });
});

describe("while viewing", () => {
  it("is the person's own session, in their workspace; banner status, limits, audit with both names; the person's sessions untouched; stop returns", async () => {
    const adm = await anAdmin("vw-admin");
    const t = await newAccount(route, "vw-target");
    expect(await sessionsOf(t.userId)).toBe(1);
    const start = await adm.b.post<{ viewing: { email: string; endsAt: string } }>("/view-as/start", { userId: t.userId, password: PASSWORD });
    expect(start.status).toBe(200);
    expect(start.body.viewing.email).toBe(t.email);
    const s = await me(adm.b);
    expect(s.body?.user.id).toBe(t.userId);
    expect(s.body?.session.impersonatedBy).toBe(adm.userId);
    // the person's workspace, not the administrator's
    expect(s.body?.session.activeOrganizationId).toBe(t.workspaceId);
    const list = await adm.b.get<{ workspaces: { id: string }[] }>("/workspace/list");
    expect(list.body.workspaces.map((w) => w.id)).toEqual([t.workspaceId]);
    // 60 minutes by default, never slid forward
    const row = (await db.query<{ mins: number }>('SELECT round(extract(epoch FROM "expiresAt" - now()) / 60)::int AS mins FROM "session" WHERE "impersonatedBy" = $1', [adm.userId])).rows[0];
    expect(row?.mins).toBe(60);
    // the banner's status
    expect((await adm.b.get<{ viewing: { email: string; by: string } }>("/view-as/status")).body.viewing).toMatchObject({ email: t.email, by: adm.email });
    // the person's password, address, two-step sign-in and sessions are out of reach, and so is the admin area
    for (const [path, body] of [["/change-password", { currentPassword: PASSWORD, newPassword: "Taken over 1!" }], ["/two-factor/enable", { password: PASSWORD }], ["/revoke-other-sessions", {}], ["/change-email", { newEmail: email("x") }], ["/sign-out", {}], ["/view-as/start", { userId: t.userId, password: PASSWORD }]] as const) {
      expect((await adm.b.post(path, body)).body, path).toMatchObject({ code: "VIEW_AS_NOT_ALLOWED" });
    }
    await expect(requirePlatformAdmin(new Headers({ cookie: adm.b.cookieHeader() }))).rejects.toMatchObject({ status: 403 });
    // a write as the person is recorded under both names
    expect((await adm.b.post("/workspace/rename", { workspaceId: t.workspaceId, name: "Renamed while viewing" })).status).toBe(200);
    const lines = await db.query<{ actor: string }>("SELECT actor FROM audit_log WHERE action = 'workspace.renamed' AND detail->>'workspaceId' = $1 ORDER BY id DESC LIMIT 1", [t.workspaceId]);
    expect(lines.rows[0]?.actor).toBe(`${adm.email} as ${t.email}`);
    // the person's own session was not ended
    expect(await sessionsOf(t.userId)).toBe(1);
    // stop: back to the administrator, the viewing session gone, both audited
    expect((await adm.b.post<{ back: boolean }>("/view-as/stop", {})).body.back).toBe(true);
    expect((await me(adm.b)).body?.user.id).toBe(adm.userId);
    expect((await db.query('SELECT 1 FROM "session" WHERE "impersonatedBy" = $1', [adm.userId])).rowCount).toBe(0);
    const actions = (await auditOf(db, adm.email)).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(["platform.view_as_started", "platform.view_as_stopped"]));
  });

  it("ends when its time is up, whatever its use", async () => {
    const adm = await anAdmin("ve-admin");
    const t = await newAccount(route, "ve-target");
    await adm.b.post("/view-as/start", { userId: t.userId, password: PASSWORD });
    await db.query(`UPDATE "session" SET "expiresAt" = now() - interval '1 second', "impersonationEndsAt" = now() - interval '1 second' WHERE "impersonatedBy" = $1`, [adm.userId]);
    expect((await me(adm.b)).body).toBeNull();
    // Stop still brings the administrator back
    expect((await adm.b.post<{ back: boolean }>("/view-as/stop", {})).body.back).toBe(true);
    expect((await me(adm.b)).body?.user.id).toBe(adm.userId);
  });

  it("stop with no viewing session changes nothing", async () => {
    const a = await newAccount(route, "vs-plain");
    expect((await a.b.post<{ back: boolean }>("/view-as/stop", {})).body.back).toBe(false);
    expect((await me(a.b)).body?.user.id).toBe(a.userId);
  });
});
