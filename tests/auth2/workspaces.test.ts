// Workspaces (accounts slice 2, step 1) through the real route with AUTH2 on: the permission matrix
// (src/lib/auth2/workspaces/permissions.ts), the active workspace that is never empty, the limits, and isolation
// between workspaces. Members are put in place with a database fixture here; the invitation flow has its own file.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { MAX_OWNED_WORKSPACES } from "@/lib/auth2/workspaces/permissions";
import { addMember, auditOf, cleanUp, newAccount, useAuth2, type Browser } from "./helpers";

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

type List = { active: string; workspaces: { id: string; name: string; role: string }[] };
const list = async (b: Browser) => (await b.get<List>("/workspace/list")).body;
const activeRow = async (userId: string) =>
  (await db.query<{ a: string | null }>('SELECT "activeOrganizationId" AS a FROM "session" WHERE "userId" = $1', [userId])).rows.map((r) => r.a);
const memberIdOf = async (workspaceId: string, userId: string) =>
  (await db.query<{ id: string }>('SELECT id FROM member WHERE "organizationId" = $1 AND "userId" = $2', [workspaceId, userId])).rows[0]?.id;

/** A workspace owned by a new account, with an admin and a member put in it. */
async function team(tag: string) {
  const owner = await newAccount(route, `${tag}-owner`);
  const admin = await newAccount(route, `${tag}-admin`);
  const member = await newAccount(route, `${tag}-member`);
  const ws = owner.workspaceId;
  const adminId = await addMember(db, ws, admin.userId, "admin");
  const memberId = await addMember(db, ws, member.userId, "member");
  const ownerId = (await memberIdOf(ws, owner.userId))!;
  return { owner, admin, member, ws, ownerId, adminId, memberId };
}

describe("the organization plugin's own endpoints", () => {
  it("are all switched off", async () => {
    const a = await newAccount(route, "plugin");
    for (const path of ["/organization/list", "/organization/set-active", "/organization/create", "/organization/invite-member", "/organization/remove-member", "/organization/update-member-role", "/organization/delete", "/organization/leave", "/organization/list-members", "/organization/accept-invitation"]) {
      const res = path === "/organization/list" || path === "/organization/list-members" ? await a.b.get(path) : await a.b.post(path, { organizationId: a.workspaceId });
      expect(res.status, path).toBe(404);
    }
  });
});

describe("a workspace of one's own", () => {
  it("every account starts with one, as its owner, and the session is in it", async () => {
    const a = await newAccount(route, "own");
    const l = await list(a.b);
    expect(l.workspaces).toEqual([{ id: a.workspaceId, name: "own's workspace", role: "owner" }]);
    expect(l.active).toBe(a.workspaceId);
  });

  it("a new workspace becomes the active one; past the limit, creating is refused", async () => {
    const a = await newAccount(route, "creator");
    const made = await a.b.post<{ id: string; role: string }>("/workspace/create", { name: "  Second\nbench  " });
    expect(made.status).toBe(200);
    expect(made.body.role).toBe("owner");
    const l = await list(a.b);
    expect(l.active).toBe(made.body.id);
    expect(l.workspaces.find((w) => w.id === made.body.id)?.name).toBe("Second bench");
    for (let i = 2; i < MAX_OWNED_WORKSPACES; i++) expect((await a.b.post("/workspace/create", { name: `Bench ${i}` })).status).toBe(200);
    const over = await a.b.post<{ code: string }>("/workspace/create", { name: "One too many" });
    expect(over.status).toBe(403);
    expect(over.body.code).toBe("WORKSPACE_LIMIT");
    expect((await list(a.b)).workspaces).toHaveLength(MAX_OWNED_WORKSPACES);
  });

  it("names are checked: empty, too long or with a link are refused", async () => {
    const a = await newAccount(route, "namer");
    expect((await a.b.post<{ code: string }>("/workspace/create", { name: "   " })).body.code).toBe("INVALID_WORKSPACE_NAME");
    expect((await a.b.post<{ code: string }>("/workspace/create", { name: "x".repeat(101) })).body.code).toBe("WORKSPACE_NAME_TOO_LONG");
    expect((await a.b.post<{ code: string }>("/workspace/rename", { workspaceId: a.workspaceId, name: "see https://evil.test" })).body.code).toBe("WORKSPACE_NAME_HAS_LINK");
  });

  it("one's only workspace can be neither left nor deleted", async () => {
    const a = await newAccount(route, "only");
    const leave = await a.b.post<{ code: string }>("/workspace/leave", { workspaceId: a.workspaceId });
    expect([leave.status, leave.body.code]).toEqual([403, "ONLY_WORKSPACE"]);
    const del = await a.b.post<{ code: string }>("/workspace/delete", { workspaceId: a.workspaceId });
    expect([del.status, del.body.code]).toEqual([403, "ONLY_WORKSPACE"]);
    expect((await list(a.b)).workspaces).toHaveLength(1);
  });
});

describe("the active workspace is never empty", () => {
  it("a refused switch leaves the session where it was (the trial's cleared case)", async () => {
    const a = await newAccount(route, "switcher");
    const b = await newAccount(route, "stranger");
    const res = await a.b.post<{ code: string }>("/workspace/set-active", { workspaceId: b.workspaceId });
    expect([res.status, res.body.code]).toEqual([404, "WORKSPACE_NOT_FOUND"]);
    expect(await activeRow(a.userId)).toEqual([a.workspaceId]);
    expect((await list(a.b)).active).toBe(a.workspaceId);
  });

  it("a session that names no workspace, or a stale one, is repaired on its next read", async () => {
    const a = await newAccount(route, "repair");
    await db.query('UPDATE "session" SET "activeOrganizationId" = NULL WHERE "userId" = $1', [a.userId]);
    expect((await list(a.b)).active).toBe(a.workspaceId);
    expect(await activeRow(a.userId)).toEqual([a.workspaceId]);
    await db.query(`UPDATE "session" SET "activeOrganizationId" = 'no-such-workspace' WHERE "userId" = $1`, [a.userId]);
    expect((await list(a.b)).active).toBe(a.workspaceId);
  });

  it("switching to a workspace one belongs to works", async () => {
    const t = await team("switch");
    expect((await t.member.b.post("/workspace/set-active", { workspaceId: t.ws })).status).toBe(200);
    expect((await list(t.member.b)).active).toBe(t.ws);
  });

  it("someone removed from the workspace their session is in is moved to another of theirs", async () => {
    const t = await team("moved");
    await t.member.b.post("/workspace/set-active", { workspaceId: t.ws });
    expect((await t.owner.b.post("/workspace/member/remove", { workspaceId: t.ws, memberId: t.memberId })).status).toBe(200);
    expect(await activeRow(t.member.userId)).toEqual([t.member.workspaceId]);
    expect((await list(t.member.b)).workspaces.map((w) => w.id)).toEqual([t.member.workspaceId]);
  });

  it("someone removed from their last workspace gets a new one of their own", async () => {
    const t = await team("last");
    // The member deletes the workspace they signed up with, leaving only the team's.
    await db.query('DELETE FROM organization WHERE id = $1', [t.member.workspaceId]);
    expect((await t.owner.b.post("/workspace/member/remove", { workspaceId: t.ws, memberId: t.memberId })).status).toBe(200);
    const l = await list(t.member.b);
    expect(l.workspaces).toHaveLength(1);
    expect(l.workspaces[0]).toMatchObject({ role: "owner" });
    expect(l.active).toBe(l.workspaces[0].id);
  });

  it("deleting a workspace moves everyone's sessions out of it, and nobody is left without one", async () => {
    const t = await team("deleted");
    await db.query('DELETE FROM organization WHERE id = $1', [t.member.workspaceId]);
    await t.admin.b.post("/workspace/set-active", { workspaceId: t.ws });
    // The owner needs a second workspace to delete this one.
    await t.owner.b.post("/workspace/create", { name: "Kept" });
    expect((await t.owner.b.post("/workspace/delete", { workspaceId: t.ws })).status).toBe(200);
    expect(await activeRow(t.admin.userId)).toEqual([t.admin.workspaceId]);
    const m = await list(t.member.b);
    expect(m.workspaces).toHaveLength(1);
    expect(m.workspaces[0].id).not.toBe(t.ws);
    expect((await db.query("SELECT 1 FROM organization WHERE id = $1", [t.ws])).rowCount).toBe(0);
  });
});

describe("the permission matrix", () => {
  it("a member cannot rename, delete, change roles or remove anyone", async () => {
    const t = await team("plain");
    const m = t.member.b;
    for (const [path, body] of [
      ["/workspace/rename", { workspaceId: t.ws, name: "Mine now" }],
      ["/workspace/delete", { workspaceId: t.ws }],
      ["/workspace/member/role", { workspaceId: t.ws, memberId: t.adminId, role: "member" }],
      ["/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "owner" }],
      ["/workspace/member/remove", { workspaceId: t.ws, memberId: t.adminId }],
    ] as const) {
      const res = await m.post<{ code: string }>(path, body);
      expect([res.status, res.body.code], path).toEqual([403, "NOT_ALLOWED"]);
    }
    const roles = await db.query<{ role: string }>('SELECT role FROM member WHERE "organizationId" = $1 ORDER BY role', [t.ws]);
    expect(roles.rows.map((r) => r.role)).toEqual(["admin", "member", "owner"]);
  });

  it("an admin manages admins and members, but cannot make an owner, touch an owner or delete the workspace", async () => {
    const t = await team("admin");
    const a = t.admin.b;
    expect((await a.post<{ code: string }>("/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "owner" })).body.code).toBe("NOT_ALLOWED");
    expect((await a.post<{ code: string }>("/workspace/member/role", { workspaceId: t.ws, memberId: t.ownerId, role: "member" })).body.code).toBe("NOT_ALLOWED");
    expect((await a.post<{ code: string }>("/workspace/member/remove", { workspaceId: t.ws, memberId: t.ownerId })).body.code).toBe("NOT_ALLOWED");
    expect((await a.post<{ code: string }>("/workspace/delete", { workspaceId: t.ws })).body.code).toBe("NOT_ALLOWED");
    expect((await a.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "admin" })).status).toBe(200);
    expect((await a.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "member" })).status).toBe(200);
    expect((await a.post("/workspace/rename", { workspaceId: t.ws, name: "Renamed by the admin" })).status).toBe(200);
    expect((await a.post("/workspace/member/remove", { workspaceId: t.ws, memberId: t.memberId })).status).toBe(200);
  });

  it("an owner can make another owner, and the last owner can be neither demoted, removed nor leave", async () => {
    const t = await team("owner");
    const o = t.owner.b;
    const demote = await o.post<{ code: string }>("/workspace/member/role", { workspaceId: t.ws, memberId: t.ownerId, role: "admin" });
    expect([demote.status, demote.body.code]).toEqual([403, "LAST_OWNER"]);
    // With a second workspace, so "only workspace" is not the reason.
    await o.post("/workspace/create", { name: "Elsewhere" });
    const leave = await o.post<{ code: string }>("/workspace/leave", { workspaceId: t.ws });
    expect([leave.status, leave.body.code]).toEqual([403, "LAST_OWNER"]);
    expect((await o.post<{ code: string }>("/workspace/member/remove", { workspaceId: t.ws, memberId: t.ownerId })).body.code).toBe("USE_LEAVE");
    expect((await o.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.adminId, role: "owner" })).status).toBe(200);
    // Two owners now: the first may step down, and the second may then remove nobody's last owner.
    expect((await o.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.ownerId, role: "member" })).status).toBe(200);
    const last = await t.admin.b.post<{ code: string }>("/workspace/member/role", { workspaceId: t.ws, memberId: t.adminId, role: "member" });
    expect(last.body.code).toBe("LAST_OWNER");
  });

  it("an unknown role is refused", async () => {
    const t = await team("badrole");
    const res = await t.owner.b.post<{ code: string }>("/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "superuser" });
    expect([res.status, res.body.code]).toEqual([400, "INVALID_ROLE"]);
  });

  it("a member can leave a workspace that is not their only one", async () => {
    const t = await team("leaver");
    expect((await t.member.b.post("/workspace/leave", { workspaceId: t.ws })).status).toBe(200);
    expect(await memberIdOf(t.ws, t.member.userId)).toBeUndefined();
  });

  it("two owners stepping down at once cannot leave the workspace with none", async () => {
    const t = await team("race");
    await t.owner.b.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.adminId, role: "owner" });
    const [x, y] = await Promise.all([
      t.owner.b.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.ownerId, role: "member" }),
      t.admin.b.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.adminId, role: "member" }),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 403]);
    const owners = await db.query(`SELECT 1 FROM member WHERE "organizationId" = $1 AND role = 'owner'`, [t.ws]);
    expect(owners.rowCount).toBe(1);
  });
});

describe("workspace A and workspace B", () => {
  it("a stranger gets not-found for every action on another workspace, and nothing changes", async () => {
    const t = await team("iso");
    const outsider = await newAccount(route, "outsider");
    const o = outsider.b;
    const nameBefore = (await db.query<{ name: string }>("SELECT name FROM organization WHERE id = $1", [t.ws])).rows[0].name;
    for (const [path, body] of [
      ["/workspace/set-active", { workspaceId: t.ws }],
      ["/workspace/rename", { workspaceId: t.ws, name: "Taken" }],
      ["/workspace/delete", { workspaceId: t.ws }],
      ["/workspace/leave", { workspaceId: t.ws }],
      ["/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "owner" }],
      ["/workspace/member/remove", { workspaceId: t.ws, memberId: t.memberId }],
    ] as const) {
      const res = await o.post<{ code: string }>(path, body);
      expect([res.status, res.body.code], path).toEqual([404, "WORKSPACE_NOT_FOUND"]);
    }
    expect((await db.query<{ name: string }>("SELECT name FROM organization WHERE id = $1", [t.ws])).rows[0].name).toBe(nameBefore);
    expect(await memberIdOf(t.ws, t.member.userId)).toBe(t.memberId);
  });

  it("an owner of A cannot act on B's members by naming B's member ids under A", async () => {
    const a = await team("a-side");
    const b = await team("b-side");
    const res = await a.owner.b.post<{ code: string }>("/workspace/member/remove", { workspaceId: a.ws, memberId: b.memberId });
    expect([res.status, res.body.code]).toEqual([404, "MEMBER_NOT_FOUND"]);
    const role = await a.owner.b.post<{ code: string }>("/workspace/member/role", { workspaceId: a.ws, memberId: b.ownerId, role: "member" });
    expect(role.body.code).toBe("MEMBER_NOT_FOUND");
    expect(await memberIdOf(b.ws, b.member.userId)).toBe(b.memberId);
  });

  it("signed out, every workspace endpoint answers 401", async () => {
    const { browser } = await import("./helpers");
    const anon = browser(route);
    expect((await anon.get("/workspace/list")).status).toBe(401);
    expect((await anon.post("/workspace/create", { name: "x" })).status).toBe(401);
  });
});

describe("audit lines", () => {
  it("creating, renaming, changing a role, removing, leaving and deleting are each recorded", async () => {
    const t = await team("audit");
    await t.owner.b.post("/workspace/rename", { workspaceId: t.ws, name: "Audited" });
    await t.owner.b.post("/workspace/member/role", { workspaceId: t.ws, memberId: t.memberId, role: "admin" });
    await t.admin.b.post("/workspace/leave", { workspaceId: t.ws });
    await t.owner.b.post("/workspace/member/remove", { workspaceId: t.ws, memberId: t.memberId });
    await t.owner.b.post("/workspace/create", { name: "Spare" });
    await t.owner.b.post("/workspace/delete", { workspaceId: t.ws });
    const lines = (await auditOf(db, t.owner.email)).map((l) => l.action);
    expect(lines).toEqual(expect.arrayContaining(["workspace.renamed", "workspace.role_changed", "workspace.member_removed", "workspace.created", "workspace.deleted"]));
    expect((await auditOf(db, t.admin.email)).map((l) => l.action)).toContain("workspace.left");
    const removed = (await auditOf(db, t.owner.email)).find((l) => l.action === "workspace.member_removed");
    expect(removed?.summary).toContain(t.member.email);
  });
});
