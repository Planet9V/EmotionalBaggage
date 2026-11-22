/**
 * Workspaces in the database (accounts slice 2): Better Auth's `organization` and `member` tables, written with
 * this app's own SQL on the owner's connection. The organization plugin's own HTTP endpoints are all switched off
 * (../auth.ts); every change goes through the endpoints in ./plugin.ts, which call the functions here after
 * checking ./permissions.ts.
 *
 * Two promises are kept here, whatever order requests arrive in:
 * - every account belongs to at least one workspace: leaving or deleting one's only workspace is refused, and a
 *   person removed from their last workspace (or whose last workspace is deleted) gets a new one of their own;
 * - every workspace keeps at least one owner.
 * Each change locks the rows it reasons about (the user, or the workspace) first, so two requests at once cannot
 * both pass a check that only one of them may pass.
 *
 * The actor is checked again INSIDE each transaction, after the locks (review F7, N10): every change that can alter
 * a role takes the workspace's row lock first, so the role re-read there (a Guard) is the one in force when the
 * change commits. A demoted or removed actor's change in flight is refused.
 *
 * A session's active workspace is fixed wherever it could go stale: after a removal, a departure or a deletion,
 * every session that named that workspace is moved to the person's first remaining one, and activeWorkspace()
 * repairs a session that names none (the trial found a refused switch cleared it).
 */
import { randomBytes } from "node:crypto";
import { APIError } from "better-auth/api";
import type { Pool, PoolClient } from "pg";
import { auditIn } from "@/lib/db";
import { MAX_OWNED_WORKSPACES, asRole, manages, may, mayGrant, type Role } from "./permissions";

export type Db = Pool | PoolClient;

export const newId = () => randomBytes(18).toString("base64url");

export const refuse = (status: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TOO_MANY_REQUESTS", code: string, message: string) =>
  APIError.from(status, { code, message });

/** Not a member, or no such workspace: the same answer, so a stranger learns nothing about another workspace. */
export const notFound = () => refuse("NOT_FOUND", "WORKSPACE_NOT_FOUND", "That workspace was not found, or you are not a member of it.");

/** The slug of the workspace made at sign-up (./guards.ts renames it by this slug). */
export const personalSlug = (userId: string) => `ws-${userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;

export async function inTx<T>(db: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export type Membership = { memberId: string; workspaceId: string; name: string; role: Role; joinedAt: Date };

/** The user's membership of one workspace, or null. */
export async function membershipOf(db: Db, workspaceId: unknown, userId: string): Promise<Membership | null> {
  if (typeof workspaceId !== "string" || !workspaceId || workspaceId.length > 100) return null;
  const r = await db.query<{ id: string; name: string; role: string; createdAt: Date }>(
    `SELECT m.id, o.name, m.role, m."createdAt" FROM member m JOIN organization o ON o.id = m."organizationId"
      WHERE m."organizationId" = $1 AND m."userId" = $2`,
    [workspaceId, userId]
  );
  const m = r.rows[0];
  return m ? { memberId: m.id, workspaceId, name: m.name, role: asRole(m.role), joinedAt: m.createdAt } : null;
}

/** Every workspace the user belongs to, in the order joined. */
export async function membershipsOf(db: Db, userId: string): Promise<Membership[]> {
  const r = await db.query<{ id: string; organizationId: string; name: string; role: string; createdAt: Date }>(
    `SELECT m.id, m."organizationId", o.name, m.role, m."createdAt" FROM member m JOIN organization o ON o.id = m."organizationId"
      WHERE m."userId" = $1 ORDER BY m."createdAt", m.id`,
    [userId]
  );
  return r.rows.map((m) => ({ memberId: m.id, workspaceId: m.organizationId, name: m.name, role: asRole(m.role), joinedAt: m.createdAt }));
}

/** Locks the user's row: every change that could leave them with no workspace takes this first. */
const lockUser = (c: PoolClient, userId: string) => c.query('SELECT 1 FROM "user" WHERE id = $1 FOR UPDATE', [userId]);
/** Locks a workspace's row: every change to its owners takes this first. */
export async function lockWorkspace(c: PoolClient, workspaceId: string) {
  const r = await c.query<{ name: string }>("SELECT name FROM organization WHERE id = $1 FOR UPDATE", [workspaceId]);
  if (!r.rowCount) throw notFound();
  return r.rows[0].name;
}

async function insertWorkspace(c: Db, name: string, slug: string, ownerId: string): Promise<string> {
  const id = newId();
  await c.query('INSERT INTO organization (id, name, slug, "createdAt") VALUES ($1, $2, $3, now())', [id, name, slug]);
  await c.query(`INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, 'owner', now())`, [newId(), id, ownerId]);
  return id;
}

/**
 * The workspace every new account gets, with the account as owner. Called by the user-created hook (../auth.ts)
 * and whenever a person is left with no workspace; a second one made that way gets a random slug.
 */
export async function createPersonal(c: Db, user: { id: string; name: string; email: string }): Promise<string> {
  const name = `${user.name || user.email.split("@")[0]}'s workspace`.slice(0, 100);
  const taken = await c.query("SELECT 1 FROM organization WHERE slug = $1", [personalSlug(user.id)]);
  return insertWorkspace(c, name, taken.rowCount ? `ws-${newId().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}` : personalSlug(user.id), user.id);
}

/** A new workspace, named by its owner. At most MAX_OWNED_WORKSPACES per person. */
export async function createWorkspace(db: Pool, user: { id: string; email: string }, name: string): Promise<string> {
  return inTx(db, async (c) => {
    await lockUser(c, user.id);
    const owned = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM member WHERE "userId" = $1 AND role LIKE '%owner%'`, [user.id]);
    if (owned.rows[0].n >= MAX_OWNED_WORKSPACES) {
      throw refuse("FORBIDDEN", "WORKSPACE_LIMIT", `You own ${MAX_OWNED_WORKSPACES} workspaces already, the most one person can. Delete one you no longer need first.`);
    }
    const id = await insertWorkspace(c, name, `ws-${newId().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`, user.id);
    await auditIn(c, { actor: user.email, action: "workspace.created", summary: `Created the workspace "${name}"`, detail: { workspaceId: id } });
    return id;
  });
}

/** A workspace made by a platform administrator for a named owner: no per-person limit. */
export async function createWorkspaceFor(db: Pool, actor: string, owner: { id: string; email: string }, name: string, guard: Guard): Promise<string> {
  return inTx(db, async (c) => {
    await lockUser(c, owner.id);
    await guard(c, "");
    const id = await insertWorkspace(c, name, `ws-${newId().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`, owner.id);
    await auditIn(c, { actor, action: "workspace.created", summary: `As platform administrator, created the workspace "${name}" with ${owner.email} as owner`, detail: { workspaceId: id } });
    return id;
  });
}

/** Moves every session of `userId` that names `gone` (or nothing) to their first workspace. */
async function repointSessions(c: PoolClient, userId: string, gone: string) {
  await c.query(
    `UPDATE "session" SET "activeOrganizationId" = (SELECT m."organizationId" FROM member m WHERE m."userId" = $1 ORDER BY m."createdAt", m.id LIMIT 1)
      WHERE "userId" = $1 AND ("activeOrganizationId" = $2 OR "activeOrganizationId" IS NULL)`,
    [userId, gone]
  );
}

/** Makes sure a person who just lost a membership still has a workspace, then fixes their sessions. */
async function afterLoss(c: PoolClient, userId: string, gone: string) {
  const left = await c.query('SELECT 1 FROM member WHERE "userId" = $1 LIMIT 1', [userId]);
  if (!left.rowCount) {
    const u = await c.query<{ id: string; name: string; email: string }>('SELECT id, name, email FROM "user" WHERE id = $1', [userId]);
    if (u.rows[0]) {
      const id = await createPersonal(c, u.rows[0]);
      await auditIn(c, { actor: u.rows[0].email, action: "workspace.created", summary: "Was given a new workspace of their own after losing their last one", detail: { workspaceId: id } });
    }
  }
  await repointSessions(c, userId, gone);
}

/**
 * The workspace a session is in. A session that names no workspace, or one its user no longer belongs to, is moved
 * to the user's first workspace (made if, against every rule above, there is none), so it is never empty.
 */
export async function activeWorkspace(db: Pool, session: { id: string; userId: string }): Promise<Membership> {
  // Read from the row, not from the session the request carried: a change earlier in this request may have moved it.
  const row = await db.query<{ a: string | null }>('SELECT "activeOrganizationId" AS a FROM "session" WHERE id = $1 AND "userId" = $2', [session.id, session.userId]);
  const named = await membershipOf(db, row.rows[0]?.a, session.userId);
  if (named) return named;
  return inTx(db, async (c) => {
    await lockUser(c, session.userId);
    let first = (await membershipsOf(c, session.userId))[0];
    if (!first) {
      const u = await c.query<{ id: string; name: string; email: string }>('SELECT id, name, email FROM "user" WHERE id = $1', [session.userId]);
      if (!u.rows[0]) throw refuse("NOT_FOUND", "WORKSPACE_NOT_FOUND", "This account no longer exists.");
      await createPersonal(c, u.rows[0]);
      first = (await membershipsOf(c, session.userId))[0];
    }
    await c.query('UPDATE "session" SET "activeOrganizationId" = $2 WHERE id = $1', [session.id, first.workspaceId]);
    return first;
  });
}

/** Switches a session to a workspace its user belongs to. A refusal changes nothing. */
export async function setActive(db: Pool, sessionId: string, userId: string, workspaceId: unknown): Promise<Membership> {
  const m = await membershipOf(db, workspaceId, userId);
  if (!m) throw notFound();
  await db.query('UPDATE "session" SET "activeOrganizationId" = $2 WHERE id = $1 AND "userId" = $3', [sessionId, m.workspaceId, userId]);
  return m;
}

/**
 * Answers the actor's role in force, read inside the transaction after the workspace's lock: a workspace member's
 * own role (forRole), or "owner" for a platform administrator still enabled (forPlatformAdmin). Throws when gone.
 */
export type Guard = (c: PoolClient, workspaceId: string) => Promise<Role>;

const notAllowed = () => refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");

/** The guard for a workspace member acting through the workspace endpoints. */
export const forRole = (userId: string): Guard => async (c, workspaceId) => {
  const r = await c.query<{ role: string }>('SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2', [workspaceId, userId]);
  if (!r.rows[0]) throw notFound();
  return asRole(r.rows[0].role);
};

/** The guard for a platform administrator (../adminOps.ts): full power while still an enabled administrator. */
export const forPlatformAdmin = (userId: string): Guard => async (c) => {
  const r = await c.query<{ ok: boolean }>('SELECT "platformAdmin" AND "disabledAt" IS NULL AS ok FROM "user" WHERE id = $1 FOR SHARE', [userId]);
  if (!r.rows[0]?.ok) throw refuse("FORBIDDEN", "NOT_PLATFORM_ADMIN", "Only a platform administrator may do this.");
  return "owner";
};

/**
 * Cancels the invitations someone made in a workspace that they may no longer give (review N8): all of them when
 * they left or were removed (`role` null), else those for a role above what `role` may grant.
 */
async function cancelInvitationsBy(c: PoolClient, workspaceId: string, userId: string, role: Role | null) {
  const pending = await c.query<{ id: string; role: string | null }>(
    `SELECT i.id, i.role FROM invitation i LEFT JOIN auth2_invitation_tokens t ON t.invitation_id = i.id
      WHERE i."organizationId" = $1 AND i."inviterId" = $2 AND i.status = 'pending' AND NOT COALESCE(t.by_platform_admin, false)`,
    [workspaceId, userId]
  );
  for (const i of pending.rows) {
    if (role && role !== "member" && mayGrant(role, asRole(i.role))) continue;
    await c.query("UPDATE invitation SET status = 'canceled' WHERE id = $1", [i.id]);
    await c.query("DELETE FROM auth2_invitation_tokens WHERE invitation_id = $1", [i.id]);
  }
}

export async function renameWorkspace(db: Pool, actor: string, workspaceId: string, name: string, guard: Guard) {
  await inTx(db, async (c) => {
    const old = await lockWorkspace(c, workspaceId);
    if (!may(await guard(c, workspaceId), "rename")) throw notAllowed();
    await c.query("UPDATE organization SET name = $2 WHERE id = $1", [workspaceId, name]);
    await auditIn(c, { actor, action: "workspace.renamed", summary: `Renamed the workspace "${old}" to "${name}"`, detail: { workspaceId } });
  });
}

/**
 * Deletes a workspace: its memberships and invitations go with it. Refused when it is the deleting owner's only
 * workspace. Anyone for whom it was the last workspace gets a new one of their own.
 */
export async function deleteWorkspace(db: Pool, actor: { id: string; email: string }, workspaceId: string, guard: Guard, opts: { platformAdmin?: boolean } = {}) {
  await inTx(db, async (c) => {
    // Users first, then the workspace (the order every change here takes), sorted so two deletions agree.
    const before = (await c.query<{ userId: string }>('SELECT "userId" FROM member WHERE "organizationId" = $1', [workspaceId])).rows.map((r) => r.userId);
    for (const u of [...new Set([actor.id, ...before])].sort()) await lockUser(c, u);
    const name = await lockWorkspace(c, workspaceId);
    if (!may(await guard(c, workspaceId), "delete")) throw notAllowed();
    // A platform administrator may delete any workspace: whoever is left without one gets a new one below.
    if (!opts.platformAdmin) {
      const mine = await c.query<{ n: number }>('SELECT count(*)::int AS n FROM member WHERE "userId" = $1', [actor.id]);
      if (mine.rows[0].n <= 1) throw refuse("FORBIDDEN", "ONLY_WORKSPACE", "This is your only workspace, so it cannot be deleted. Every account keeps at least one.");
    }
    const people = (await c.query<{ userId: string }>('SELECT "userId" FROM member WHERE "organizationId" = $1', [workspaceId])).rows.map((r) => r.userId);
    await c.query("DELETE FROM organization WHERE id = $1", [workspaceId]);
    for (const u of people) await afterLoss(c, u, workspaceId);
    await auditIn(c, { actor: actor.email, action: "workspace.deleted", summary: `${opts.platformAdmin ? "As platform administrator, deleted" : "Deleted"} the workspace "${name}" (${people.length} ${people.length === 1 ? "member" : "members"})`, detail: { workspaceId } });
  });
}

const ownerCount = async (c: PoolClient, workspaceId: string) =>
  (await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1 AND role LIKE '%owner%'`, [workspaceId])).rows[0].n;

/** Leaves a workspace. Refused for one's only workspace, and for the last owner. */
export async function leaveWorkspace(db: Pool, user: { id: string; email: string }, workspaceId: string) {
  await inTx(db, async (c) => {
    await lockUser(c, user.id);
    const name = await lockWorkspace(c, workspaceId);
    const m = await membershipOf(c, workspaceId, user.id);
    if (!m) throw notFound();
    const mine = await c.query<{ n: number }>('SELECT count(*)::int AS n FROM member WHERE "userId" = $1', [user.id]);
    if (mine.rows[0].n <= 1) throw refuse("FORBIDDEN", "ONLY_WORKSPACE", "This is your only workspace, so you cannot leave it. Every account keeps at least one.");
    if (m.role === "owner" && (await ownerCount(c, workspaceId)) <= 1) {
      throw refuse("FORBIDDEN", "LAST_OWNER", "You are the only owner. Make someone else an owner first, or delete the workspace.");
    }
    await c.query("DELETE FROM member WHERE id = $1", [m.memberId]);
    await cancelInvitationsBy(c, workspaceId, user.id, null);
    await repointSessions(c, user.id, workspaceId);
    await auditIn(c, { actor: user.email, action: "workspace.left", summary: `Left the workspace "${name}"`, detail: { workspaceId } });
  });
}

export type Target = { memberId: string; userId: string; email: string; role: Role };

/** A member of this workspace by member id, or null (a member id of another workspace is not found). */
async function targetOf(db: Db, workspaceId: string, memberId: unknown): Promise<Target | null> {
  if (typeof memberId !== "string" || !memberId || memberId.length > 100) return null;
  const r = await db.query<{ id: string; userId: string; email: string; role: string }>(
    `SELECT m.id, m."userId", u.email, m.role FROM member m JOIN "user" u ON u.id = m."userId" WHERE m.id = $1 AND m."organizationId" = $2`,
    [memberId, workspaceId]
  );
  const t = r.rows[0];
  return t ? { memberId: t.id, userId: t.userId, email: t.email, role: asRole(t.role) } : null;
}

/**
 * Changes a member's role, after ./plugin.ts has checked that the actor may. Refused when it would leave the
 * workspace with no owner.
 */
export async function changeRole(db: Pool, actor: string, workspaceId: string, memberId: string, role: Role, guard: Guard) {
  await inTx(db, async (c) => {
    const name = await lockWorkspace(c, workspaceId);
    const mine = await guard(c, workspaceId);
    const t = await targetOf(c, workspaceId, memberId);
    if (!t) throw refuse("NOT_FOUND", "MEMBER_NOT_FOUND", "That person is not a member of this workspace.");
    if (!manages(mine, t.role) || !mayGrant(mine, role)) throw notAllowed();
    if (t.role === role) return;
    if (t.role === "owner" && (await ownerCount(c, workspaceId)) <= 1) {
      throw refuse("FORBIDDEN", "LAST_OWNER", "This is the only owner. Make someone else an owner first.");
    }
    await c.query("UPDATE member SET role = $2 WHERE id = $1", [memberId, role]);
    await cancelInvitationsBy(c, workspaceId, t.userId, role);
    await auditIn(c, { actor, action: "workspace.role_changed", summary: `Changed ${t.email} from ${t.role} to ${role} in "${name}"`, detail: { workspaceId, memberId, from: t.role, to: role } });
  });
}

/** Removes a member, after ./plugin.ts has checked that the actor may. The last owner cannot be removed. */
export async function removeMember(db: Pool, actor: string, workspaceId: string, memberId: string, guard: Guard) {
  await inTx(db, async (c) => {
    // The person first, then the workspace: the same order as leaving and deleting, so they cannot deadlock.
    const seen = await targetOf(c, workspaceId, memberId);
    if (seen) await lockUser(c, seen.userId);
    const name = await lockWorkspace(c, workspaceId);
    const mine = await guard(c, workspaceId);
    const t = await targetOf(c, workspaceId, memberId);
    if (!t) throw refuse("NOT_FOUND", "MEMBER_NOT_FOUND", "That person is not a member of this workspace.");
    if (!manages(mine, t.role)) throw notAllowed();
    if (t.role === "owner" && (await ownerCount(c, workspaceId)) <= 1) throw refuse("FORBIDDEN", "LAST_OWNER", "This is the only owner, who cannot be removed.");
    await c.query("DELETE FROM member WHERE id = $1", [memberId]);
    await cancelInvitationsBy(c, workspaceId, t.userId, null);
    await afterLoss(c, t.userId, workspaceId);
    await auditIn(c, { actor, action: "workspace.member_removed", summary: `Removed ${t.email} (${t.role}) from "${name}"`, detail: { workspaceId, memberId } });
  });
}
