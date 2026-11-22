/**
 * The workspace endpoints (accounts slice 2), as a Better Auth plugin so they sit under the same catch-all route
 * (/api/auth2/workspace/...) with the same origin check, throttle and session handling as sign-in. The organization
 * plugin's own endpoints are all switched off (../auth.ts): these are the only way to change a workspace.
 *
 * Every endpoint reads the caller's membership of the named workspace from the database on each request (a session
 * is never trusted for it), checks ./permissions.ts, and answers 404 for a workspace the caller is not in, so a
 * stranger cannot tell it exists. Changes are written to the audit log in the same transaction (./store.ts).
 */
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { Pool } from "pg";
import { z } from "zod";
import { cleanWorkspaceName } from "../guards";
import { isRole, manages, may, mayGrant, type Role } from "./permissions";
import * as store from "./store";

const id = z.string().min(1).max(100);

type SessionCtx = { context: { session: { session: { id: string; userId: string; activeOrganizationId?: string | null }; user: { id: string; email: string; name: string } } } };

/** The caller and their membership of `workspaceId`, or 404. */
async function memberOf(db: Pool, ctx: SessionCtx, workspaceId: string) {
  const { user } = ctx.context.session;
  const m = await store.membershipOf(db, workspaceId, user.id);
  if (!m) throw store.notFound();
  return { user, m };
}

const notAllowed = () => store.refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");

export function workspaces(db: Pool) {
  return {
    id: "c2r-workspaces",
    endpoints: {
      listWorkspaces: createAuthEndpoint("/workspace/list", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
        const { session, user } = ctx.context.session;
        const active = await store.activeWorkspace(db, session);
        const all = await store.membershipsOf(db, user.id);
        return ctx.json({ active: active.workspaceId, workspaces: all.map((w) => ({ id: w.workspaceId, name: w.name, role: w.role })) });
      }),

      setActiveWorkspace: createAuthEndpoint("/workspace/set-active", { method: "POST", body: z.object({ workspaceId: id }), use: [sessionMiddleware] }, async (ctx) => {
        const { session, user } = ctx.context.session;
        const m = await store.setActive(db, session.id, user.id, ctx.body.workspaceId);
        return ctx.json({ active: m.workspaceId, name: m.name, role: m.role });
      }),

      createWorkspace: createAuthEndpoint("/workspace/create", { method: "POST", body: z.object({ name: z.string().max(400) }), use: [sessionMiddleware] }, async (ctx) => {
        const { session, user } = ctx.context.session;
        const name = cleanWorkspaceName(ctx.body.name);
        const wid = await store.createWorkspace(db, user, name);
        await store.setActive(db, session.id, user.id, wid);
        return ctx.json({ id: wid, name, role: "owner" });
      }),

      renameWorkspace: createAuthEndpoint("/workspace/rename", { method: "POST", body: z.object({ workspaceId: id, name: z.string().max(400) }), use: [sessionMiddleware] }, async (ctx) => {
        const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
        if (!may(m.role, "rename")) throw notAllowed();
        const name = cleanWorkspaceName(ctx.body.name);
        await store.renameWorkspace(db, user.email, m.workspaceId, name);
        return ctx.json({ id: m.workspaceId, name });
      }),

      deleteWorkspace: createAuthEndpoint("/workspace/delete", { method: "POST", body: z.object({ workspaceId: id }), use: [sessionMiddleware] }, async (ctx) => {
        const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
        if (!may(m.role, "delete")) throw notAllowed();
        await store.deleteWorkspace(db, user, m.workspaceId);
        const active = await store.activeWorkspace(db, ctx.context.session.session);
        return ctx.json({ deleted: m.workspaceId, active: active.workspaceId });
      }),

      leaveWorkspace: createAuthEndpoint("/workspace/leave", { method: "POST", body: z.object({ workspaceId: id }), use: [sessionMiddleware] }, async (ctx) => {
        const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
        await store.leaveWorkspace(db, user, m.workspaceId);
        const active = await store.activeWorkspace(db, ctx.context.session.session);
        return ctx.json({ left: m.workspaceId, active: active.workspaceId });
      }),

      changeMemberRole: createAuthEndpoint(
        "/workspace/member/role",
        { method: "POST", body: z.object({ workspaceId: id, memberId: id, role: z.string().max(20) }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          const role = ctx.body.role;
          if (!isRole(role)) throw store.refuse("BAD_REQUEST", "INVALID_ROLE", "Choose owner, admin or member.");
          if (!manages(m.role, "member") || !mayGrant(m.role, role)) throw notAllowed();
          await store.changeRole(db, user.email, m.workspaceId, ctx.body.memberId, role, (current: Role) => manages(m.role, current));
          return ctx.json({ memberId: ctx.body.memberId, role });
        }
      ),

      removeWorkspaceMember: createAuthEndpoint(
        "/workspace/member/remove",
        { method: "POST", body: z.object({ workspaceId: id, memberId: id }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          if (!manages(m.role, "member")) throw notAllowed();
          if (ctx.body.memberId === m.memberId) throw store.refuse("BAD_REQUEST", "USE_LEAVE", "To take yourself out of a workspace, leave it.");
          await store.removeMember(db, user.email, m.workspaceId, ctx.body.memberId, (current: Role) => manages(m.role, current));
          return ctx.json({ removed: ctx.body.memberId });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}
