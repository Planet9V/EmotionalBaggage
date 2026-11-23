/**
 * "View as this user" (owner's addition of 23 Nov: the platform administrator must be able to "emulate what another
 * user sees ... to see what they see and edit like that user"), as a Better Auth plugin under the catch-all route.
 *
 * Why not Better Auth's admin plugin, which has impersonation: it decides who is an administrator by a `role`
 * column of its own, and brings some fifteen endpoints (set role, ban, set password, list and remove users, revoke
 * sessions) that would bypass this app's rules (the last-administrator rail, step-up, the audit wording, hashed
 * tokens). This uses the same library calls its impersonation uses (internalAdapter.createSession with
 * `impersonatedBy`, setSessionCookie, a signed cookie holding the administrator's own session), and nothing else
 * of that plugin.
 *
 * Rules, each tested in tests/auth2/viewAs.test.ts:
 * - only an enabled platform administrator, not already viewing as someone, after typing their own password
 *   (step-up, ./stepUp.ts); never as another platform administrator, a disabled account, or one with no password;
 * - the session lasts `impersonation.minutes` (default 60) and is never extended (./sessionLife.ts);
 * - it is the person's own session in every other way: their workspaces, roles and data, through the same checks;
 * - it cannot reach the admin area (the person is no administrator, and requirePlatformAdmin refuses a viewing
 *   session as well) and cannot change the person's password, address, two-step sign-in or sessions, or delete the
 *   account (BLOCKED below);
 * - start and stop are audited with both names; everything written meanwhile is recorded as "admin as person"
 *   (src/lib/api/route.ts and the catch-all route);
 * - the person's own sessions are not touched; no email is sent unless `impersonation.notifyUser` is on.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { deleteSessionCookie, expireCookie, setSessionCookie } from "better-auth/cookies";
import type { Pool } from "pg";
import { z } from "zod";
import { audit } from "@/lib/db";
import type { MailSender } from "./mail";
import { isPlatformAdmin } from "./platformAdmin";
import { readRules } from "./rules";
import { checkStepUp } from "./stepUp";
import { refuse } from "./workspaces/store";

/** The cookie that holds the administrator's own session while they view as someone (signed, httpOnly). */
const ADMIN_SESSION_COOKIE = "admin_session";
/** A cookie the page can read that says only "a view-as session may be open", so the banner knows to ask. No secret. */
const VIEWING_HINT_COOKIE = "c2r2_viewing";

/** Better Auth endpoints a viewing session may not use: the person's password, address, two-step, sessions, account. */
const BLOCKED = new Set([
  "/change-password", "/change-email", "/set-password", "/delete-user", "/revoke-other-sessions", "/revoke-sessions", "/revoke-session",
  "/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes", "/two-factor/view-backup-codes", "/two-factor/get-totp-uri", "/two-factor/verify-totp",
  "/re-enrol", "/view-as/start", "/sign-out",
]);
export const blockedWhileViewing = (path: string) => BLOCKED.has(path);
export const viewingRefusal = () =>
  APIError.from("FORBIDDEN", { code: "VIEW_AS_NOT_ALLOWED", message: "While viewing as someone, their password, address, two-step sign-in and sessions cannot be changed. Use Stop in the banner to go back to your own account." });

type Viewed = { impersonatedBy?: string | null; impersonationEndsAt?: Date | string | null };

export function viewAs(db: Pool, deps: { mailer: () => Promise<MailSender | null> }) {
  return {
    id: "c2r-view-as",
    endpoints: {
      startViewAs: createAuthEndpoint("/view-as/start", { method: "POST", body: z.object({ userId: z.string().min(1).max(100), password: z.string().max(400) }), use: [sessionMiddleware] }, async (ctx) => {
        const me = ctx.context.session;
        if ((me.session as Viewed).impersonatedBy) throw viewingRefusal();
        if (!(await isPlatformAdmin(db, me.user.id))) throw refuse("FORBIDDEN", "NOT_PLATFORM_ADMIN", "Only a platform administrator may do this.");
        await checkStepUp(db, me.user.id, ctx.body.password);
        const t = await db.query<{ id: string; email: string; name: string; platformAdmin: boolean; disabledAt: Date | null; has: boolean }>(
          `SELECT u.id, u.email, u.name, u."platformAdmin", u."disabledAt", EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'credential') AS has FROM "user" u WHERE u.id = $1`,
          [ctx.body.userId]
        );
        const target = t.rows[0];
        if (!target || target.id === me.user.id) throw refuse("NOT_FOUND", "USER_NOT_FOUND", "That account was not found.");
        if (target.platformAdmin) throw refuse("FORBIDDEN", "VIEW_AS_ADMIN", "You cannot view as another platform administrator.");
        if (target.disabledAt) throw refuse("FORBIDDEN", "ACCOUNT_DISABLED", "This account is disabled. Enable it first to view as this person.");
        if (!target.has) throw refuse("FORBIDDEN", "VIEW_AS_INVITED", "This person has not chosen a password yet, so there is nothing of theirs to see.");
        const minutes = (await readRules(db)).viewAsMinutes;
        const ends = new Date(Date.now() + minutes * 60_000);
        const session = await ctx.context.internalAdapter.createSession(target.id, true, { impersonatedBy: me.user.id, impersonationEndsAt: ends, expiresAt: ends }, true);
        if (!session) throw APIError.from("INTERNAL_SERVER_ERROR", { code: "VIEW_AS_FAILED", message: "The session could not be started." });
        const user = await ctx.context.internalAdapter.findUserById(target.id);
        const cookie = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE);
        await ctx.setSignedCookie(cookie.name, me.session.token, ctx.context.secret, ctx.context.authCookies.sessionToken.attributes);
        deleteSessionCookie(ctx);
        await setSessionCookie(ctx, { session, user: user! }, true);
        ctx.setCookie(VIEWING_HINT_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: false, secure: ctx.context.authCookies.sessionToken.attributes.secure, maxAge: minutes * 60 });
        await audit({ actor: me.user.email, action: "platform.view_as_started", summary: `Started viewing as ${target.email} for at most ${minutes} minutes`, detail: { userId: target.id, minutes } });
        if ((await readRules(db)).viewAsNotifyUser) {
          const sender = await deps.mailer();
          await sender
            ?.send({
              to: target.email,
              subject: "An administrator is viewing your account on Shipwright",
              text: `Hello ${target.name},\n\nA platform administrator of Shipwright (${me.user.name || me.user.email}) is viewing your account as you see it, to help with a problem, for at most ${minutes} minutes. Your password and two-step sign-in are not seen or changed.\n\nShipwright`,
              html: `<p>Hello ${escapeHtml(target.name)},</p><p>A platform administrator of Shipwright (${escapeHtml(me.user.name || me.user.email)}) is viewing your account as you see it, to help with a problem, for at most ${minutes} minutes. Your password and two-step sign-in are not seen or changed.</p><p>Shipwright</p>`,
            })
            .catch((e) => console.error(`[auth2] the "view as" notice was not sent: ${(e as Error).name}`));
        }
        return ctx.json({ viewing: { email: target.email, name: target.name, endsAt: ends.toISOString() } });
      }),

      viewAsStatus: createAuthEndpoint("/view-as/status", { method: "GET" }, async (ctx) => {
        const s = await getSessionFromCtx(ctx);
        const by = s ? viewedBy(s.session) : null;
        if (!s || !by) return ctx.json({ viewing: null });
        const admin = (await db.query<{ email: string; name: string }>('SELECT email, name FROM "user" WHERE id = $1', [by])).rows[0];
        const ends = (s.session as Viewed).impersonationEndsAt;
        return ctx.json({ viewing: { name: s.user.name, email: s.user.email, endsAt: ends ? new Date(ends).toISOString() : null, by: admin?.email ?? "" } });
      }),

      stopViewAs: createAuthEndpoint("/view-as/stop", { method: "POST" }, async (ctx) => {
        const current = await getSessionFromCtx(ctx);
        const cookie = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE);
        const adminToken = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
        const viewedBy = (current?.session as Viewed | undefined)?.impersonatedBy ?? null;
        expireCookie(ctx, cookie);
        ctx.setCookie(VIEWING_HINT_COOKIE, "", { path: "/", maxAge: 0 });
        // Not viewing as anyone: nothing else changes (a stale cookie is just removed).
        if (!viewedBy && current) return ctx.json({ back: false });
        if (current && viewedBy) await ctx.context.internalAdapter.deleteSession(current.session.token);
        const back = adminToken ? await ctx.context.internalAdapter.findSession(adminToken) : null;
        if (current && viewedBy) {
          const admin = back?.user.email ?? (await db.query<{ email: string }>('SELECT email FROM "user" WHERE id = $1', [viewedBy])).rows[0]?.email ?? viewedBy;
          await audit({ actor: admin, action: "platform.view_as_stopped", summary: `Stopped viewing as ${current.user.email}`, detail: { userId: current.user.id } });
        }
        if (back && (!viewedBy || back.session.userId === viewedBy) && new Date(back.session.expiresAt).getTime() > Date.now()) {
          await setSessionCookie(ctx, back);
          return ctx.json({ back: true });
        }
        deleteSessionCookie(ctx);
        return ctx.json({ back: false });
      }),
    },
  } satisfies BetterAuthPlugin;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Whether a session (as Better Auth returns it) is a "view as" session, and who started it. */
export const viewedBy = (session: unknown): string | null => {
  const v = (session as Viewed | null | undefined)?.impersonatedBy;
  return typeof v === "string" && v ? v : null;
};
