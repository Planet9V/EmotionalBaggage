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
import type { MailSender } from "../mail";
import { CLIENT_ADDRESS_HEADER, hashPassword, verifyPassword } from "@/lib/auth";
import { claimRefusal, claimTry, clearTries, failedTry } from "../signInWait";
import { isRole, manages, may, mayGrant } from "./permissions";
import * as invitations from "./invitations";
import * as store from "./store";
import * as twoFactor from "./twoFactor";
import { membersView } from "./view";

const id = z.string().min(1).max(100);

type SessionCtx = { context: { session: { session: { id: string; userId: string; activeOrganizationId?: string | null }; user: { id: string; email: string; name: string; emailVerified: boolean } } } };

/** Refuses a person who must set up two-factor first (./twoFactor.ts): they cannot reach any workspace yet. */
async function enrolled(db: Pool, ctx: SessionCtx) {
  if (await twoFactor.owed(db, ctx.context.session.user.id)) throw twoFactor.setupRequired();
}

/** The caller and their membership of `workspaceId`, or 404. */
async function memberOf(db: Pool, ctx: SessionCtx, workspaceId: string) {
  const { user } = ctx.context.session;
  await enrolled(db, ctx);
  const m = await store.membershipOf(db, workspaceId, user.id);
  if (!m) throw store.notFound();
  return { user, m };
}

let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword(`dummy-${Math.random()}`));

const notAllowed = () => store.refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");

/** What the invitation endpoints need from the sign-in's configuration (../auth.ts). */
export type WorkspaceDeps = {
  /** The mail sender, or null in "no mail" mode (../mail.ts, currentMailSender). */
  mailer: () => Promise<MailSender | null>;
  /** An address on this site's account screens with a token. */
  link: (path: string, token: string) => string;
};

export function workspaces(db: Pool, deps: WorkspaceDeps) {
  return {
    id: "c2r-workspaces",
    endpoints: {
      listWorkspaces: createAuthEndpoint("/workspace/list", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
        await enrolled(db, ctx);
        const { session, user } = ctx.context.session;
        const active = await store.activeWorkspace(db, session);
        const all = await store.membershipsOf(db, user.id);
        return ctx.json({ active: active.workspaceId, workspaces: all.map((w) => ({ id: w.workspaceId, name: w.name, role: w.role })) });
      }),

      setActiveWorkspace: createAuthEndpoint("/workspace/set-active", { method: "POST", body: z.object({ workspaceId: id }), use: [sessionMiddleware] }, async (ctx) => {
        await enrolled(db, ctx);
        const { session, user } = ctx.context.session;
        const m = await store.setActive(db, session.id, user.id, ctx.body.workspaceId);
        return ctx.json({ active: m.workspaceId, name: m.name, role: m.role });
      }),

      createWorkspace: createAuthEndpoint("/workspace/create", { method: "POST", body: z.object({ name: z.string().max(400) }), use: [sessionMiddleware] }, async (ctx) => {
        await enrolled(db, ctx);
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
        await store.renameWorkspace(db, user.email, m.workspaceId, name, store.forRole(user.id));
        return ctx.json({ id: m.workspaceId, name });
      }),

      deleteWorkspace: createAuthEndpoint("/workspace/delete", { method: "POST", body: z.object({ workspaceId: id }), use: [sessionMiddleware] }, async (ctx) => {
        const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
        if (!may(m.role, "delete")) throw notAllowed();
        await store.deleteWorkspace(db, user, m.workspaceId, store.forRole(user.id));
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
          await store.changeRole(db, user.email, m.workspaceId, ctx.body.memberId, role, store.forRole(user.id));
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
          await store.removeMember(db, user.email, m.workspaceId, ctx.body.memberId, store.forRole(user.id));
          return ctx.json({ removed: ctx.body.memberId });
        }
      ),

      // --- members and two-factor (steps 3 and 4) ---------------------------------------------------------------

      listWorkspaceMembers: createAuthEndpoint("/workspace/members", { method: "GET", query: z.object({ workspaceId: id }), use: [sessionMiddleware] }, async (ctx) => {
        const { user, m } = await memberOf(db, ctx, ctx.query.workspaceId);
        return ctx.json(await membersView(db, user, m));
      }),

      setWorkspaceTwoFactor: createAuthEndpoint(
        "/workspace/two-factor-policy",
        { method: "POST", body: z.object({ workspaceId: id, required: z.boolean() }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          await twoFactor.setPolicy(db, user, m, ctx.body.required);
          return ctx.json({ workspaceId: m.workspaceId, required: ctx.body.required });
        }
      ),

      setMemberTwoFactor: createAuthEndpoint(
        "/workspace/member/two-factor-required",
        { method: "POST", body: z.object({ workspaceId: id, memberId: id, required: z.boolean() }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          await twoFactor.setMemberRequired(db, user, m, ctx.body.memberId, ctx.body.required);
          return ctx.json({ memberId: ctx.body.memberId, required: ctx.body.required });
        }
      ),

      resetMemberTwoFactor: createAuthEndpoint(
        "/workspace/member/reset-two-factor",
        { method: "POST", body: z.object({ workspaceId: id, memberId: id }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          const r = await twoFactor.resetMemberTwoFactor(db, deps, user, m, ctx.body.memberId);
          // `code`: only in "no mail" mode, shown once to whoever reset it, to hand over.
          return ctx.json({ reset: ctx.body.memberId, ...r });
        }
      ),

      /**
       * Setting two-factor up again after someone else reset it (review B4): the address, the password and the proof
       * (the emailed link's token, or the handed-over code). One answer for anything wrong. On success, the password
       * alone starts a session for the next 15 minutes, to set the app up again.
       */
      giveReenrolProof: createAuthEndpoint(
        "/re-enrol",
        { method: "POST", body: z.object({ email: z.string().max(320), password: z.string().max(200), proof: z.string().max(200) }) },
        async (ctx) => {
          const email = ctx.body.email.trim().toLowerCase();
          const refused = claimRefusal(await claimTry(db, email, ctx.headers?.get(CLIENT_ADDRESS_HEADER) ?? ""));
          if (refused) throw refused;
          const u = await db.query<{ id: string; password: string | null }>(
            `SELECT u.id, a.password FROM "user" u LEFT JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential' WHERE lower(u.email) = $1`,
            [email]
          );
          const row = u.rows[0];
          // The same work whether or not the account exists.
          const pwOk = await verifyPassword(ctx.body.password, row?.password ?? (await dummy()));
          const ok = !!row && pwOk && (await twoFactor.giveProof(db, row.id, ctx.body.proof));
          if (!pwOk) await failedTry(db, email);
          if (!ok) throw store.refuse("BAD_REQUEST", "REENROL_INVALID", "That address, password and code or link do not match. Check them, or ask for a new reset.");
          await clearTries(db, email, ctx.headers?.get(CLIENT_ADDRESS_HEADER) ?? "");
          return ctx.json({ proved: true });
        }
      ),

      // --- invitations (step 2) --------------------------------------------------------------------------------

      inviteToWorkspace: createAuthEndpoint(
        "/workspace/invite",
        { method: "POST", body: z.object({ workspaceId: id, email: z.string().max(320), role: z.string().max(20) }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          return ctx.json(await invitations.invite(db, deps, user, m, ctx.body.email, ctx.body.role));
        }
      ),

      resendInvitation: createAuthEndpoint(
        "/workspace/invitation/resend",
        { method: "POST", body: z.object({ workspaceId: id, invitationId: id }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          return ctx.json(await invitations.resend(db, deps, user, m, ctx.body.invitationId));
        }
      ),

      revokeInvitation: createAuthEndpoint(
        "/workspace/invitation/revoke",
        { method: "POST", body: z.object({ workspaceId: id, invitationId: id }), use: [sessionMiddleware] },
        async (ctx) => {
          const { user, m } = await memberOf(db, ctx, ctx.body.workspaceId);
          await invitations.revoke(db, user, m, ctx.body.invitationId);
          return ctx.json({ revoked: ctx.body.invitationId });
        }
      ),

      acceptInvitation: createAuthEndpoint(
        "/workspace/invitation/accept",
        { method: "POST", body: z.object({ token: z.string().max(200) }), use: [sessionMiddleware] },
        async (ctx) => {
          // A person who owes two-factor reaches no workspace, a new one included (review N9).
          await enrolled(db, ctx);
          const { session, user } = ctx.context.session;
          return ctx.json(await invitations.accept(db, user, session.id, ctx.body.token));
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}
