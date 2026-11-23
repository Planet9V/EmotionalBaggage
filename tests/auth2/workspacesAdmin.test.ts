// Admin, Workspaces routes (owner's addition of 23 Nov: CRUD of workspaces for the platform administrator): guards,
// create with a chosen owner, rename, members added without an invitation, role, transfer, remove, and delete by
// typing the name. What a deletion does to concepts: nothing yet (concepts are not kept per workspace).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { cleanUp, newAccount, useAuth2 } from "./helpers";

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

describe("Admin, Workspaces", () => {
  it("guards: signed out 401, a member 403; the administrator does the whole round", async () => {
    const list = await import("@/app/api/admin/workspaces/route");
    const one = await import("@/app/api/admin/workspaces/[id]/route");
    const member = await newAccount(route, "wa-member");
    const owner = await newAccount(route, "wa-owner");
    const adm = await newAccount(route, "wa-admin");
    await db.query('UPDATE "user" SET "platformAdmin" = true WHERE id = $1', [adm.userId]);
    const a = adm.b.cookieHeader();
    for (const cookie of ["", member.b.cookieHeader()]) {
      expect((await list.GET(req("/api/admin/workspaces", cookie))).status).toBe(cookie ? 403 : 401);
      expect((await list.POST(req("/api/admin/workspaces", cookie, "POST", { name: "Nope", ownerUserId: member.userId }))).status).toBe(cookie ? 403 : 401);
      expect((await one.POST(req(`/api/admin/workspaces/${member.workspaceId}`, cookie, "POST", { action: "rename", name: "Taken" }), ctx(member.workspaceId))).status).toBe(cookie ? 403 : 401);
    }
    const made = await list.POST(req("/api/admin/workspaces", a, "POST", { name: "Bag Lab", ownerUserId: owner.userId }));
    expect(made.status).toBe(201);
    const id = ((await made.json()) as { id: string }).id;
    const found = (await (await list.GET(req(`/api/admin/workspaces?q=${encodeURIComponent(owner.email)}`, a))).json()) as { workspaces: { id: string; owners: string[] }[] };
    expect(found.workspaces.find((w) => w.id === id)?.owners).toEqual([owner.email]);
    const post = (b: unknown) => one.POST(req(`/api/admin/workspaces/${id}`, a, "POST", b), ctx(id));
    expect((await post({ action: "rename", name: "Bag Lab Two" })).status).toBe(200);
    expect((await post({ action: "add", userId: member.userId, role: "member" })).status).toBe(200);
    const detail = (await (await one.GET(req(`/api/admin/workspaces/${id}`, a), ctx(id))).json()) as { workspace: { name: string }; members: { memberId: string; email: string; role: string }[] };
    expect(detail.workspace.name).toBe("Bag Lab Two");
    const m = detail.members.find((x) => x.email === member.email)!;
    expect((await post({ action: "role", memberId: m.memberId, role: "admin" })).status).toBe(200);
    expect((await post({ action: "transfer", memberId: m.memberId })).status).toBe(200);
    const roles = (await db.query<{ email: string; role: string }>(`SELECT u.email, m.role FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = $1 ORDER BY u.email`, [id])).rows;
    expect(Object.fromEntries(roles.map((r) => [r.email, r.role]))).toEqual({ [member.email]: "owner", [owner.email]: "admin" });
    // the last owner cannot be removed
    expect((await post({ action: "remove", memberId: m.memberId })).status).toBe(403);
    const wrong = await post({ action: "delete", confirmName: "Bag Lab" });
    expect(wrong.status).toBe(400);
    expect((await post({ action: "delete", confirmName: "Bag Lab Two" })).status).toBe(200);
    expect((await db.query("SELECT 1 FROM organization WHERE id = $1", [id])).rowCount).toBe(0);
    const actions = (await db.query<{ action: string }>("SELECT action FROM audit_log WHERE actor = $1", [adm.email])).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["workspace.renamed", "platform.member_added", "workspace.role_changed", "platform.workspace_transferred", "workspace.deleted"]));
  });
});
