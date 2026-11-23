/**
 * What a platform administrator can do to any account or workspace (owner's ruling of 22 Nov: "full power" over
 * users and organizations). Framework-free: no request, no screen. A later change wires these to the admin area;
 * whatever calls them passes the signed-in account's id, and every function checks again, on every call, that it is
 * a platform administrator who is not disabled (./platformAdmin.ts).
 *
 * Every change writes one audit line naming the administrator and the account or workspace it touched; no line
 * ever holds a password, token or link.
 *
 * The actor is checked twice: before anything (a quick refusal), and again INSIDE the transaction after its locks
 * (review F7), so an administrator demoted or disabled while a change of theirs waits on a lock does not make it.
 *
 * Rules that hold here as everywhere: the last enabled platform administrator can never lose the flag, be disabled
 * or be deleted (all administrators' rows are locked before counting, so two administrators removing each other at
 * once leave one; the rule applies only when the target is itself an enabled administrator, review N11); every
 * account keeps a workspace (a person left without one gets a new one of their own); every
 * workspace keeps an owner.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword } from "@/lib/auth";
import { auditIn } from "@/lib/db";
import type { Auth2 } from "./auth";
import { AUTH2_PAGES, AUTH2_SETTING, resolveAddresses, writeAuth2Setting } from "./config";
import { resetAndRequireProof } from "./workspaces/twoFactor";
import * as invitations from "./accountInvitations";
import type { Delivered, InvitationStatus } from "./accountInvitations";
import { currentMailSender, render, type MailSender } from "./mail";
import { unlock } from "./signInWait";
import { checkStepUp } from "./stepUp";
import { cleanEmail, cleanName, cleanWorkspaceName } from "./guards";
import { checkNewPassword } from "./newPassword";
import { readRules } from "./rules";
import { isPlatformAdmin } from "./platformAdmin";
import { MAX_SEATS, asRole, isRole } from "./workspaces/permissions";
import * as store from "./workspaces/store";
import { inTx, newId, refuse } from "./workspaces/store";


/** One account as the Users tab shows it. */
export type UserState = {
  id: string;
  email: string;
  name: string;
  confirmed: boolean;
  twoFactor: boolean;
  twoFactorRequired: boolean;
  platformAdmin: boolean;
  disabled: boolean;
  createdAt: string;
  workspaces: number;
  /** active, invited (a pending invitation and no password yet), or disabled */
  state: "active" | "invited" | "disabled";
  hasPassword: boolean;
  /** an ISO time, "until-unlocked", or null when not locked */
  lockedUntil: string | "until-unlocked" | null;
  mustChangePassword: boolean;
  /** asked for a password reset while no mail is set up (ISO time) */
  resetRequestedAt: string | null;
  invitation: { id: string; status: "pending" | "accepted" | "expired" | "revoked"; expiresAt: string; mailed: boolean } | null;
  sessions: number;
};

/** One workspace as Admin, Workspaces lists it. */
export type WorkspaceRow = { id: string; name: string; createdAt: string; members: number; owners: string[]; personal: boolean; twoFactorRequired: boolean };
export type WorkspaceDetail = { workspace: WorkspaceRow; members: { memberId: string; userId: string; email: string; name: string; role: "owner" | "admin" | "member"; platformAdmin: boolean; joinedAt: string }[] };

export type UserFilter = { q?: string; role?: "member" | "admin"; state?: "active" | "invited" | "disabled" | "locked" | "reset"; page?: number; pageSize?: number };
export type UserPage = { users: UserState[]; total: number; page: number; pageSize: number };

/** The SHA-256 name key of ./signInWait.ts, worked out in SQL from an address. */
const NAME_KEY_SQL = (col: string) => `translate(rtrim(encode(sha256(convert_to(lower(trim(${col})), 'UTF8')), 'base64'), '='), '+/', '-_')`;

/** The owner's pool, the sign-in instance (src/lib/auth2/server.ts auth2()), the acting account, and the base address
 *  links are made with (resolveAuth2Config().baseURL). */
type Ctx = {
  db: Pool;
  auth: Auth2;
  actorId: string;
  baseURL: string;
  /** the acting administrator's own password, typed again for a step-up (./stepUp.ts); used and forgotten */
  stepUp?: string;
  /** where mail goes; currentMailSender() (./mail.ts) unless a test gives its own */
  mailer?: () => Promise<MailSender | null>;
};

/** A password typed by the administrator: the same rules as any new password (./passwordPolicy.ts). */
const checkPassword = (db: Pool | PoolClient, p: unknown, who: { email?: string; name?: string }) => checkNewPassword(db, p, who);

/** The administrator's address, after checking they are one. Every operation starts here. */
async function admin(ctx: Ctx): Promise<string> {
  if (!(await isPlatformAdmin(ctx.db, ctx.actorId))) throw refuse("FORBIDDEN", "NOT_PLATFORM_ADMIN", "Only a platform administrator may do this.");
  return (await ctx.db.query<{ email: string }>('SELECT email FROM "user" WHERE id = $1', [ctx.actorId])).rows[0].email;
}

async function userRow(c: Pool | PoolClient, userId: unknown, lock = false) {
  if (typeof userId !== "string" || !userId || userId.length > 100) throw refuse("NOT_FOUND", "USER_NOT_FOUND", "That account was not found.");
  const r = await c.query<{ id: string; email: string; name: string; platformAdmin: boolean; enabledAdmin: boolean }>(
    `SELECT id, email, name, "platformAdmin", "platformAdmin" AND "disabledAt" IS NULL AS "enabledAdmin" FROM "user" WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [userId]
  );
  if (!r.rows[0]) throw refuse("NOT_FOUND", "USER_NOT_FOUND", "That account was not found.");
  return r.rows[0];
}

/** Locks every platform administrator's row (in id order) and answers how many are enabled. */
async function lockAdmins(c: PoolClient): Promise<number> {
  const r = await c.query<{ id: string; disabledAt: Date | null }>(`SELECT id, "disabledAt" FROM "user" WHERE "platformAdmin" ORDER BY id FOR UPDATE`);
  return r.rows.filter((x) => !x.disabledAt).length;
}

const lastAdmin = () => refuse("FORBIDDEN", "LAST_PLATFORM_ADMIN", "This is the last platform administrator. Make someone else one first.");

/** Ends every session of an account and any sign-in halfway through. */
async function endSessions(c: PoolClient, userId: string) {
  await c.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
  await c.query("DELETE FROM verification WHERE value = $1", [userId]);
}

export function adminOps(ctx: Ctx) {
  const { db } = ctx;
  /** The actor, checked again inside the transaction after its locks (review F7). */
  const still = (c: PoolClient) => store.forPlatformAdmin(ctx.actorId)(c, "");
  const guard = store.forPlatformAdmin(ctx.actorId);
  /** A transaction that starts by locking the actor's row and re-checking it. */
  // Platform administration is rare: one change at a time across the install, so two administrators acting on each
  // other's rows cannot deadlock.
  const tx = <T>(fn: (c: PoolClient) => Promise<T>) => inTx(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.platform_admin'))");
    await still(c);
    return fn(c);
  });
  const audit = (c: PoolClient, actor: string, action: string, summary: string, detail: Record<string, unknown>) => auditIn(c, { actor, action: `platform.${action}`, summary, detail });
  /** Step-up when the change reaches another platform administrator (or `always`, as for granting the role). */
  const stepUpFor = async (target: { id: string; platformAdmin: boolean }, always = false) => {
    if (always || (target.platformAdmin && target.id !== ctx.actorId)) await checkStepUp(db, ctx.actorId, ctx.stepUp);
  };
  const mailer = ctx.mailer ?? currentMailSender;
  const deps = { mailer, link: (path: string, token: string) => `${ctx.baseURL.replace(/\/+$/, "")}${AUTH2_PAGES}${path}?token=${encodeURIComponent(token)}` };
  const actorName = async () => (await db.query<{ name: string; email: string }>('SELECT name, email FROM "user" WHERE id = $1', [ctx.actorId])).rows[0]!;

  return {
    /** Accounts with their state, newest first: search by name or address, filter by role and state, in pages. */
    async listUsers(filter: UserFilter = {}): Promise<UserPage> {
      await admin(ctx);
      const pageSize = Math.min(200, Math.max(1, Math.round(filter.pageSize ?? 50)));
      const page = Math.max(1, Math.round(filter.page ?? 1));
      const where: string[] = [];
      const args: unknown[] = [];
      const q = typeof filter.q === "string" ? filter.q.trim().slice(0, 200) : "";
      if (q) {
        args.push(`%${q.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
        where.push(`(lower(u.email) LIKE $${args.length} OR lower(u.name) LIKE $${args.length})`);
      }
      if (filter.role === "admin") where.push(`u."platformAdmin"`);
      if (filter.role === "member") where.push(`NOT u."platformAdmin"`);
      const invited = `(NOT EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'credential') AND EXISTS (SELECT 1 FROM auth2_account_invitations i WHERE i.user_id = u.id AND i.accepted_at IS NULL AND i.revoked_at IS NULL))`;
      if (filter.state === "disabled") where.push(`u."disabledAt" IS NOT NULL`);
      if (filter.state === "invited") where.push(`u."disabledAt" IS NULL AND ${invited}`);
      if (filter.state === "active") where.push(`u."disabledAt" IS NULL AND NOT ${invited}`);
      if (filter.state === "locked") where.push(`EXISTS (SELECT 1 FROM auth2_sign_in_waits w WHERE w.client = '' AND w.name_key = ${NAME_KEY_SQL("u.email")} AND w.locked_until > now())`);
      if (filter.state === "reset") where.push(`u."resetRequestedAt" IS NOT NULL`);
      const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const total = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" u ${w}`, args)).rows[0]!.n;
      const r = await db.query<{
        id: string; email: string; name: string; emailVerified: boolean; twoFactorEnabled: boolean | null; twoFactorRequired: boolean; platformAdmin: boolean; disabledAt: Date | null; createdAt: Date; n: number;
        mustChangePassword: boolean; resetRequestedAt: Date | null; has_password: boolean; sessions: number; locked_until: Date | null; forever: boolean | null;
        inv_id: string | null; inv_status: "pending" | "accepted" | "expired" | "revoked" | null; inv_expires: Date | null; inv_mailed: boolean | null;
      }>(
        `SELECT u.id, u.email, u.name, u."emailVerified", u."twoFactorEnabled", u."twoFactorRequired", u."platformAdmin", u."disabledAt", u."createdAt", u."mustChangePassword", u."resetRequestedAt",
                (SELECT count(*)::int FROM member m WHERE m."userId" = u.id) AS n,
                EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'credential') AS has_password,
                (SELECT count(*)::int FROM "session" s WHERE s."userId" = u.id AND s."expiresAt" > now()) AS sessions,
                lk.locked_until, lk.locked_until = 'infinity' AS forever,
                inv.id AS inv_id, inv.status AS inv_status, inv.expires_at AS inv_expires, inv.mailed AS inv_mailed
           FROM "user" u
           LEFT JOIN LATERAL (SELECT w.locked_until FROM auth2_sign_in_waits w
                               WHERE w.client = '' AND w.name_key = ${NAME_KEY_SQL("u.email")} AND w.locked_until > now()) lk ON true
           LEFT JOIN LATERAL (SELECT i.id, CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.expires_at <= now() THEN 'expired' ELSE 'pending' END AS status,
                                     i.expires_at, i.mailed FROM auth2_account_invitations i WHERE i.user_id = u.id ORDER BY i.created_at DESC LIMIT 1) inv ON true
           ${w} ORDER BY u."createdAt" DESC, u.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        args
      );
      const users = r.rows.map((u): UserState => {
        const isInvited = !u.has_password && (u.inv_status === "pending" || u.inv_status === "expired");
        return {
          id: u.id, email: u.email, name: u.name, confirmed: u.emailVerified, twoFactor: u.twoFactorEnabled === true, twoFactorRequired: u.twoFactorRequired,
          platformAdmin: u.platformAdmin, disabled: u.disabledAt !== null, createdAt: new Date(u.createdAt).toISOString(), workspaces: u.n,
          state: u.disabledAt !== null ? "disabled" : isInvited ? "invited" : "active",
          hasPassword: u.has_password,
          lockedUntil: u.locked_until === null ? null : u.forever ? "until-unlocked" : new Date(u.locked_until).toISOString(),
          mustChangePassword: u.mustChangePassword,
          resetRequestedAt: u.resetRequestedAt ? new Date(u.resetRequestedAt).toISOString() : null,
          invitation: u.inv_id && u.inv_status && u.inv_expires ? { id: u.inv_id, status: u.inv_status, expiresAt: new Date(u.inv_expires).toISOString(), mailed: u.inv_mailed === true } : null,
          sessions: u.sessions,
        };
      });
      return { users, total, page, pageSize };
    },

    /**
     * Creates an account with a workspace of its own, in one of two ways (owner's ruling of 23 Nov):
     * - `invite`: no password; an invitation link is emailed, or handed back once when no mail is set up
     *   (./accountInvitations.ts). Following it sets the password and confirms the address.
     * - with `password`: a temporary password the administrator typed (never made or shown by the app), under the
     *   password rules; the address is marked confirmed only if `confirmed`; the person must change it at first
     *   sign-in (no session starts before they do).
     * `platformAdmin` makes the account a platform administrator (step-up required).
     */
    async createUser(input: { email: unknown; name: unknown; password?: unknown; confirmed?: boolean; platformAdmin?: boolean; invite?: boolean }): Promise<{ id: string; invitation?: Delivered }> {
      const actor = await admin(ctx);
      const email = cleanEmail(input.email);
      const name = cleanName(input.name);
      const makeAdmin = input.platformAdmin === true;
      if (input.invite && input.password !== undefined) throw refuse("BAD_REQUEST", "INVITE_OR_PASSWORD", "Choose either an invitation or a temporary password, not both.");
      const password = input.invite || input.password === undefined ? null : await checkPassword(db, input.password, { email, name });
      if (makeAdmin) await checkStepUp(db, ctx.actorId, ctx.stepUp);
      const hash = password ? await hashPassword(password) : null;
      const made = await tx(async (c) => {
        const taken = await c.query('SELECT 1 FROM "user" WHERE lower(email) = $1', [email]);
        if (taken.rowCount) throw refuse("CONFLICT", "USER_EXISTS", "An account with that address exists already.");
        const id = newId();
        await c.query(
          `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled", "platformAdmin", "mustChangePassword") VALUES ($1, $2, $3, $4, now(), now(), false, $5, $6)`,
          [id, name, email, !input.invite && input.confirmed === true, makeAdmin, hash !== null]
        );
        if (hash) await c.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [newId(), id, hash]);
        await store.createPersonal(c, { id, name, email });
        const inv = input.invite ? await invitations.issue(c, { id, email, platformAdmin: makeAdmin }, actor) : null;
        const how = input.invite ? `, invited (the link works ${inv!.days} days)` : password ? `, with a temporary password to change at first sign-in${input.confirmed ? ", address marked confirmed without email" : ""}` : `${input.confirmed ? ", confirmed" : ""}, without a password`;
        await audit(c, actor, "user_created", `Created the account ${email}${makeAdmin ? " as a platform administrator" : ""}${how}`, { userId: id, platformAdmin: makeAdmin, invited: !!input.invite });
        return { id, inv };
      });
      if (!made.inv) return { id: made.id };
      return { id: made.id, invitation: await invitations.send(db, deps, made.inv, { email, name }, (await actorName()).name || actor) };
    },

    /** A new invitation for an account that has no password yet (the last one expired or was revoked). */
    async inviteAgain(userId: unknown): Promise<Delivered> {
      const actor = await admin(ctx);
      const target = await userRow(db, userId);
      await stepUpFor(target);
      const inv = await tx(async (c) => {
        const u = await userRow(c, userId, true);
        const has = await c.query(`SELECT 1 FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`, [u.id]);
        if (has.rowCount) throw refuse("CONFLICT", "HAS_PASSWORD", "This account has a password already. Send a password reset instead.");
        const inv = await invitations.issue(c, { id: u.id, email: u.email, platformAdmin: u.platformAdmin }, actor);
        await audit(c, actor, "account_invitation_sent", `Invited ${u.email} again (the link works ${inv.days} days)`, { userId: u.id, invitationId: inv.id });
        return inv;
      });
      return invitations.send(db, deps, inv, target, (await actorName()).name || actor);
    },

    async listInvitations(status?: InvitationStatus) {
      await admin(ctx);
      return invitations.list(db, status);
    },

    async resendInvitation(invitationId: unknown): Promise<Delivered> {
      await admin(ctx);
      return invitations.resend(db, deps, invitationId, await actorName());
    },

    async revokeInvitation(invitationId: unknown) {
      const actor = await admin(ctx);
      await invitations.revoke(db, invitationId, actor);
    },

    /** Changes a person's name. */
    async updateName(userId: unknown, rawName: unknown) {
      const actor = await admin(ctx);
      const name = cleanName(rawName);
      await stepUpFor(await userRow(db, userId));
      await tx(async (c) => {
        const u = await userRow(c, userId, true);
        if (u.name === name) return;
        await c.query('UPDATE "user" SET name = $2, "updatedAt" = now() WHERE id = $1', [u.id, name]);
        await audit(c, actor, "user_renamed", `Changed the name of ${u.email} from "${u.name}" to "${name}"`, { userId: u.id, before: u.name, after: name });
      });
    },

    /**
     * Changes a person's address. Every session ends and the old address's sign-in counts go. Unless the
     * administrator ticks `markVerified`, the new address must be confirmed: a confirmation link is sent when mail is
     * set up; without mail the person cannot sign in until an administrator confirms it.
     */
    async changeEmail(userId: unknown, rawEmail: unknown, opts: { markVerified?: boolean } = {}): Promise<{ confirmationSent: boolean }> {
      const actor = await admin(ctx);
      const email = cleanEmail(rawEmail);
      await stepUpFor(await userRow(db, userId));
      const old = await tx(async (c) => {
        const u = await userRow(c, userId, true);
        if (u.email.toLowerCase() === email) throw refuse("BAD_REQUEST", "SAME_EMAIL", "That is the address the account has already.");
        const taken = await c.query('SELECT 1 FROM "user" WHERE lower(email) = $1', [email]);
        if (taken.rowCount) throw refuse("CONFLICT", "USER_EXISTS", "An account with that address exists already.");
        await c.query('UPDATE "user" SET email = $2, "emailVerified" = $3, "updatedAt" = now() WHERE id = $1', [u.id, email, opts.markVerified === true]);
        await c.query("UPDATE auth2_account_invitations SET email = $2 WHERE user_id = $1 AND accepted_at IS NULL", [u.id, email]);
        await endSessions(c, u.id);
        await unlock(c, u.email);
        await audit(c, actor, "email_changed", `Changed the address of ${u.email} to ${email}${opts.markVerified ? ", marked confirmed without email" : ", to be confirmed"}; sessions ended`, { userId: u.id, before: u.email, after: email, markVerified: opts.markVerified === true });
        return u;
      });
      if (opts.markVerified) return { confirmationSent: false };
      const sender = await mailer();
      if (!sender) return { confirmationSent: false };
      try {
        const { createEmailVerificationToken } = await import("better-auth/api");
        const secret = (ctx.auth as unknown as { options: { secret: string } }).options.secret;
        const token = await createEmailVerificationToken(secret, email, undefined, 24 * 60 * 60);
        await sender.send(render({ kind: "confirm-email", to: email, name: old.name, link: deps.link("/confirm", token) }));
        return { confirmationSent: true };
      } catch (e) {
        console.error(`[auth2] the confirmation of a changed address was not sent: ${(e as Error).name}`);
        return { confirmationSent: false };
      }
    },

    /** Lifts a lock from failed sign-ins. */
    async unlock(userId: unknown) {
      const actor = await admin(ctx);
      await tx(async (c) => {
        const u = await userRow(c, userId, true);
        const was = await unlock(c, u.email);
        await audit(c, actor, "user_unlocked", `Unlocked ${u.email}${was ? "" : " (it was not locked)"}`, { userId: u.id, wasLocked: was });
      });
    },

    /** Signs a person out of every browser. */
    async endAllSessions(userId: unknown): Promise<{ ended: number }> {
      const actor = await admin(ctx);
      await stepUpFor(await userRow(db, userId));
      return tx(async (c) => {
        const u = await userRow(c, userId, true);
        const n = (await c.query('DELETE FROM "session" WHERE "userId" = $1', [u.id])).rowCount ?? 0;
        await c.query("DELETE FROM verification WHERE value = $1", [u.id]);
        await audit(c, actor, "sessions_ended", `Signed ${u.email} out of every browser (${n} ${n === 1 ? "session" : "sessions"})`, { userId: u.id, ended: n });
        return { ended: n };
      });
    },

    /** Emails the person a reset link (mail must be set up). The answer says whether it went. */
    async sendResetLink(userId: unknown): Promise<{ sent: boolean }> {
      const actor = await admin(ctx);
      const u = await userRow(db, userId);
      await stepUpFor(u);
      if (!(await mailer())) return { sent: false };
      await ctx.auth.api.requestPasswordReset({ body: { email: u.email, redirectTo: `${AUTH2_PAGES}/reset/new` } });
      await tx(async (c) => audit(c, actor, "reset_link_sent", `Sent ${u.email} a link to choose a new password`, { userId: u.id }));
      return { sent: true };
    },

    /** Confirms an address without sending anything (for "no mail" mode, or a person who cannot receive mail). */
    async confirmEmail(userId: unknown) {
      const actor = await admin(ctx);
      await tx(async (c) => {
        const u = await userRow(c, userId, true);
        await c.query('UPDATE "user" SET "emailVerified" = true, "updatedAt" = now() WHERE id = $1', [u.id]);
        await audit(c, actor, "email_confirmed", `Confirmed the address of ${u.email} (no email sent)`, { userId: u.id });
      });
    },

    /**
     * Sets a temporary password the administrator typed (or the first one): every session ends, a lock goes, and the
     * person must choose their own at the next sign-in (no session starts before they do).
     */
    async setPassword(userId: unknown, password: unknown) {
      const actor = await admin(ctx);
      const target = await userRow(db, userId);
      await stepUpFor(target);
      const p = await checkPassword(db, password, target);
      const hash = await hashPassword(p);
      await tx(async (c) => {
        const u = await userRow(c, userId, true);
        const r = await c.query(`UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = 'credential'`, [u.id, hash]);
        if (!r.rowCount) {
          await c.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [newId(), u.id, hash]);
        }
        await c.query('UPDATE "user" SET "mustChangePassword" = true, "resetRequestedAt" = NULL, "updatedAt" = now() WHERE id = $1', [u.id]);
        await endSessions(c, u.id);
        await unlock(c, u.email);
        await audit(c, actor, "password_set", `Set a temporary password for ${u.email}, to be changed at the next sign-in; every session of the account ended`, { userId: u.id });
      });
    },

    /** Requires two-factor of one person, whatever their workspaces say (or stops requiring it at this level). */
    async setTwoFactorRequired(userId: unknown, required: boolean) {
      const actor = await admin(ctx);
      await stepUpFor(await userRow(db, userId));
      await tx(async (c) => {
        const u = await userRow(c, userId, true);
        await c.query('UPDATE "user" SET "twoFactorRequired" = $2 WHERE id = $1', [u.id, required]);
        await audit(c, actor, required ? "two_factor_required" : "two_factor_not_required", `${required ? "Required" : "Stopped requiring"} two-step sign-in of ${u.email}`, { userId: u.id });
      });
    },

    /**
     * Removes the authenticator app and recovery codes and ends every session. As after any reset by someone else
     * (review B4), the password alone then starts no session: answers a one-time code, shown only now, for the
     * administrator to hand to the person, who enters it with their password at /auth/re-enrol.
     */
    async resetTwoFactor(userId: unknown): Promise<{ code: string }> {
      const actor = await admin(ctx);
      await stepUpFor(await userRow(db, userId));
      return tx(async (c) => {
        const n = await lockAdmins(c);
        const u = await userRow(c, userId, true);
        // The last platform administrator is never left owing a proof to get back in (owner's rule of 23 Nov).
        if (u.enabledAdmin && n <= 1) throw lastAdmin();
        const code = await resetAndRequireProof(c, u.id, actor, "code");
        await audit(c, actor, "two_factor_reset", `Reset the two-step sign-in of ${u.email}: authenticator app and recovery codes removed, sessions ended, a one-time code handed to the administrator`, { userId: u.id });
        return { code };
      });
    },

    /** Turns two-factor off for a person: as resetTwoFactor, and the platform-level requirement is lifted too.
     *  A workspace that requires it will still ask for it at the next sign-in. */
    async disableTwoFactor(userId: unknown) {
      const actor = await admin(ctx);
      await stepUpFor(await userRow(db, userId));
      await tx(async (c) => {
        const u = await userRow(c, userId, true);
        await clearTwoFactor(c, u.id);
        await c.query('UPDATE "user" SET "twoFactorRequired" = false WHERE id = $1', [u.id]);
        await endSessions(c, u.id);
        await audit(c, actor, "two_factor_off", `Turned off two-step sign-in for ${u.email}; sessions ended`, { userId: u.id });
      });
    },

    /** A disabled account cannot sign in; its sessions end now. The last platform administrator cannot be disabled. */
    async setDisabled(userId: unknown, disabled: boolean) {
      const actor = await admin(ctx);
      if (disabled && userId === ctx.actorId) throw refuse("FORBIDDEN", "NOT_YOURSELF", "You cannot disable your own account. Another platform administrator can.");
      await stepUpFor(await userRow(db, userId));
      await inTx(db, async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.platform_admin'))");
        // All administrators' rows (in id order), then the actor again.
        const n = await lockAdmins(c);
        await still(c);
        const u = await userRow(c, userId, true);
        if (disabled && u.enabledAdmin && n <= 1) throw lastAdmin();
        await c.query(`UPDATE "user" SET "disabledAt" = ${disabled ? "COALESCE(\"disabledAt\", now())" : "NULL"} WHERE id = $1`, [u.id]);
        if (disabled) await endSessions(c, u.id);
        await audit(c, actor, disabled ? "user_disabled" : "user_enabled", `${disabled ? "Disabled" : "Enabled again"} the account ${u.email}`, { userId: u.id });
      });
    },

    /** Grants or removes the platform administrator flag. The last one can never lose it. */
    async setPlatformAdmin(userId: unknown, on: boolean) {
      const actor = await admin(ctx);
      await stepUpFor(await userRow(db, userId), on);
      await inTx(db, async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.platform_admin'))");
        // All administrators' rows (in id order), then the actor again.
        const n = await lockAdmins(c);
        await still(c);
        const u = await userRow(c, userId, true);
        if (!on && u.enabledAdmin && n <= 1) throw lastAdmin();
        await c.query('UPDATE "user" SET "platformAdmin" = $2 WHERE id = $1', [u.id, on]);
        await audit(c, actor, on ? "admin_granted" : "admin_removed", `${on ? "Made" : "Stopped"} ${u.email} ${on ? "a" : "being a"} platform administrator`, { userId: u.id });
      });
    },

    /**
     * Deletes an account. Workspaces it solely owns (no other owner) must be dealt with in the same call, or it is
     * refused and names them: `transfer` gives a workspace to another of its members as owner, `deleteWorkspaces`
     * deletes the rest. The last platform administrator cannot be deleted.
     */
    async deleteUser(userId: unknown, opts: { transfer?: Record<string, string>; deleteWorkspaces?: boolean; confirmEmail?: unknown } = {}) {
      const actor = await admin(ctx);
      if (userId === ctx.actorId) throw refuse("FORBIDDEN", "NOT_YOURSELF", "You cannot delete your own account. Another platform administrator can.");
      const target = await userRow(db, userId);
      // From the Users tab the address is typed again (scripts and tests on the owner's connection may leave it out).
      if (opts.confirmEmail !== undefined && (typeof opts.confirmEmail !== "string" || opts.confirmEmail.trim().toLowerCase() !== target.email.toLowerCase())) {
        throw refuse("BAD_REQUEST", "CONFIRM_EMAIL_MISMATCH", `Type the address ${target.email} exactly to delete this account.`);
      }
      await stepUpFor(target);
      await inTx(db, async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.platform_admin'))");
        // All administrators' rows (in id order), then the actor again.
        const n = await lockAdmins(c);
        await still(c);
        const u = await userRow(c, userId, true);
        if (u.enabledAdmin && n <= 1) throw lastAdmin();
        const sole = await c.query<{ id: string; name: string }>(
          `SELECT o.id, o.name FROM member m JOIN organization o ON o.id = m."organizationId"
            WHERE m."userId" = $1 AND m.role LIKE '%owner%'
              AND NOT EXISTS (SELECT 1 FROM member x WHERE x."organizationId" = o.id AND x."userId" <> $1 AND x.role LIKE '%owner%')
            ORDER BY o.name FOR UPDATE OF o`,
          [u.id]
        );
        const transfer = opts.transfer ?? {};
        const left: { id: string; name: string }[] = [];
        for (const w of sole.rows) {
          const to = transfer[w.id];
          if (to) {
            const r = await c.query(`UPDATE member SET role = 'owner' WHERE "organizationId" = $1 AND "userId" = $2 AND "userId" <> $3`, [w.id, to, u.id]);
            if (!r.rowCount) throw refuse("BAD_REQUEST", "TRANSFER_NOT_A_MEMBER", `The new owner of "${w.name}" must already be one of its members.`);
            await audit(c, actor, "workspace_transferred", `Made another member owner of "${w.name}" before deleting ${u.email}`, { workspaceId: w.id, to });
          } else left.push(w);
        }
        // Only the account's own personal workspace with nobody else in it goes without being asked: it is theirs alone.
        const alone = await c.query<{ id: string }>(
          `SELECT o.id FROM organization o WHERE o.id = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM member x WHERE x."organizationId" = o.id AND x."userId" <> $2)`,
          [left.map((w) => w.id), u.id]
        );
        const aloneIds = new Set(alone.rows.map((r) => r.id));
        const shared = left.filter((w) => !aloneIds.has(w.id));
        if (shared.length && !opts.deleteWorkspaces) {
          throw refuse("CONFLICT", "SOLE_OWNER", `${u.email} is the only owner of ${shared.map((w) => `"${w.name}"`).join(", ")}, which others work in. Make someone else owner of each, or delete them in the same step.`);
        }
        const others = (await c.query<{ userId: string }>(`SELECT DISTINCT "userId" FROM member WHERE "organizationId" = ANY($1::text[]) AND "userId" <> $2`, [left.map((w) => w.id), u.id])).rows.map((r) => r.userId);
        for (const w of left) await c.query("DELETE FROM organization WHERE id = $1", [w.id]);
        await c.query('DELETE FROM "user" WHERE id = $1', [u.id]);
        // Anyone whose last workspace went with it gets one of their own; sessions that named a deleted one move.
        for (const o of others) {
          const has = await c.query('SELECT 1 FROM member WHERE "userId" = $1 LIMIT 1', [o]);
          if (!has.rowCount) {
            const p = (await c.query<{ id: string; name: string; email: string }>('SELECT id, name, email FROM "user" WHERE id = $1', [o])).rows[0];
            if (p) await store.createPersonal(c, p);
          }
          await c.query(
            `UPDATE "session" SET "activeOrganizationId" = (SELECT m."organizationId" FROM member m WHERE m."userId" = $1 ORDER BY m."createdAt", m.id LIMIT 1)
              WHERE "userId" = $1 AND ("activeOrganizationId" IS NULL OR "activeOrganizationId" = ANY($2::text[]))`,
            [o, left.map((w) => w.id)]
          );
        }
        await audit(c, actor, "user_deleted", `Deleted the account ${u.email}${left.length ? ` and ${left.length} ${left.length === 1 ? "workspace" : "workspaces"} only it owned` : ""}`, { userId: u.id, workspaces: left.map((w) => w.id) });
      });
    },

    /**
     * The address people open the installation at, and other addresses forms may come from (review B1): stored in
     * the owner-only settings, used at once. Checked so that nobody locks the installation out (cut-over review F2):
     * - in production the address cannot be cleared;
     * - a new address must be the origin of the request making the change (`requestOrigin`), as on the first-run
     *   page: the administrator is looking at the app there, so it answers there;
     * - other addresses must be well-formed origins, https (http only for localhost);
     * - a change that would leave the request's own origin untrusted is refused.
     * `requestOrigin: null` is for callers that are not a browser request (scripts and tests on the owner's
     * connection); the two origin checks then do not apply.
     */
    async setAddresses(input: { baseURL?: unknown; trustedOrigins?: unknown; requestOrigin: string | null }) {
      const actor = await admin(ctx);
      const bad = (what: string, why = "is not an address, for example https://app.example.com.") => refuse("BAD_REQUEST", "INVALID_ADDRESS", `${what} ${why}`);
      const origin = (v: unknown, what: string) => {
        try {
          if (typeof v !== "string" || !v.isWellFormed()) throw new Error("text");
          const u = new URL(v);
          if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
          return u.origin;
        } catch {
          throw bad(what);
        }
      };
      const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
      /** An origin exactly (no path, query, user or fragment), https unless it is this machine. */
      const trusted = (v: unknown) => {
        const o = origin(v, "An other address");
        const u = new URL(v as string);
        if (u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) throw bad("An other address", `must be an origin only, for example https://app.example.com: ${o} with nothing after it.`);
        if (u.protocol !== "https:" && !LOCAL.has(u.hostname)) throw bad("An other address", "must start with https:// (http only for localhost).");
        return o;
      };
      const from = input.requestOrigin;
      if (from !== null && !from) throw refuse("BAD_REQUEST", "ORIGIN_REQUIRED", "Change the addresses from Admin, Sign-in in a browser: the request did not say where it came from.");
      const empty = input.baseURL === null || input.baseURL === "";
      if (empty && process.env.NODE_ENV === "production") {
        throw refuse("BAD_REQUEST", "ADDRESS_REQUIRED", "The address of this installation cannot be removed: sign-in would stop working for everyone.");
      }
      const base = input.baseURL === undefined ? undefined : empty ? null : origin(input.baseURL, "The address");
      if (base && from !== null && base !== origin(from, "The page's own address")) {
        throw refuse("BAD_REQUEST", "ADDRESS_MISMATCH", `The address must be the one this page is open at (${from}). Open Admin at the new address, then change it there.`);
      }
      const more = input.trustedOrigins === undefined ? undefined : Array.isArray(input.trustedOrigins) ? input.trustedOrigins.slice(0, 20).map(trusted) : [];
      await tx(async (c) => {
        if (base !== undefined) await writeAuth2Setting(c, AUTH2_SETTING.baseUrl, base, actor);
        if (more !== undefined) await writeAuth2Setting(c, AUTH2_SETTING.trustedOrigins, more.length ? [...new Set(more)] : null, actor);
        if (from !== null) {
          // What would be trusted after the change, read inside this transaction: the request's own origin must stay.
          const after = await resolveAddresses(c);
          if (!after.trustedOrigins.includes(origin(from, "The page's own address"))) {
            throw refuse("BAD_REQUEST", "WOULD_LOCK_OUT", `This change would stop ${from}, where this page is open, from being trusted, so nobody could sign in here. Keep it in the list, or make the change from the address that stays.`);
          }
        }
        await audit(c, actor, "addresses_set", `Set the installation's address${base !== undefined ? ` to ${base ?? "(none)"}` : ""}${more !== undefined ? `; other addresses: ${more.join(", ") || "(none)"}` : ""}`, { baseURL: base, trustedOrigins: more });
      });
    },

    // --- workspaces ----------------------------------------------------------------------------------------------

    /** Every workspace, newest first, searched by its name or a member's address or name. */
    async listOrganizations(rawQ?: unknown, onlyId?: string): Promise<WorkspaceRow[]> {
      await admin(ctx);
      const q = typeof rawQ === "string" ? rawQ.trim().toLowerCase().slice(0, 200) : "";
      const like = q ? `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : null;
      const r = await db.query<{ id: string; name: string; slug: string; createdAt: Date; n: number; owners: string[] | null; tf: boolean | null }>(
        `SELECT o.id, o.name, o.slug, o."createdAt",
                (SELECT count(*)::int FROM member m WHERE m."organizationId" = o.id) AS n,
                (SELECT array_agg(u.email ORDER BY u.email) FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = o.id AND m.role LIKE '%owner%') AS owners,
                (SELECT p.two_factor_required FROM auth2_workspace_policy p WHERE p.organization_id = o.id) AS tf
           FROM organization o
          WHERE ($2::text IS NULL OR o.id = $2) AND ($1::text IS NULL OR lower(o.name) LIKE $1 OR EXISTS (SELECT 1 FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = o.id AND (lower(u.email) LIKE $1 OR lower(u.name) LIKE $1)))
          ORDER BY o."createdAt" DESC, o.id LIMIT 500`,
        [like, onlyId ?? null]
      );
      return r.rows.map((w) => ({ id: w.id, name: w.name, createdAt: new Date(w.createdAt).toISOString(), members: w.n, owners: w.owners ?? [], personal: w.slug.startsWith("ws-"), twoFactorRequired: w.tf === true }));
    },

    /** One workspace with its members. */
    async organization(workspaceId: unknown): Promise<WorkspaceDetail> {
      await admin(ctx);
      await existing(db, workspaceId);
      const id = workspaceId as string;
      const [row] = await this.listOrganizations(undefined, id);
      if (!row) throw store.notFound();
      const m = await db.query<{ id: string; userId: string; email: string; name: string; role: string; platformAdmin: boolean; createdAt: Date }>(
        `SELECT m.id, m."userId", u.email, u.name, m.role, u."platformAdmin", m."createdAt" FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = $1 ORDER BY m."createdAt", m.id`,
        [id]
      );
      return { workspace: row, members: m.rows.map((x) => ({ memberId: x.id, userId: x.userId, email: x.email, name: x.name, role: asRole(x.role), platformAdmin: x.platformAdmin, joinedAt: new Date(x.createdAt).toISOString() })) };
    },

    /** Makes one member the workspace's only owner; the owners before become admins. One transaction, audited. */
    async transferOwnership(workspaceId: string, memberId: unknown) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await tx(async (c) => {
        const name = await store.lockWorkspace(c, workspaceId);
        const t = await c.query<{ id: string; email: string }>(`SELECT m.id, u.email FROM member m JOIN "user" u ON u.id = m."userId" WHERE m.id = $1 AND m."organizationId" = $2`, [memberId, workspaceId]);
        if (!t.rows[0]) throw refuse("NOT_FOUND", "MEMBER_NOT_FOUND", "That person is not a member of this workspace.");
        const before = await c.query<{ email: string }>(`SELECT u.email FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = $1 AND m.role LIKE '%owner%' AND m.id <> $2`, [workspaceId, t.rows[0].id]);
        await c.query(`UPDATE member SET role = 'owner' WHERE id = $1`, [t.rows[0].id]);
        await c.query(`UPDATE member SET role = 'admin' WHERE "organizationId" = $1 AND role LIKE '%owner%' AND id <> $2`, [workspaceId, t.rows[0].id]);
        await audit(c, actor, "workspace_transferred", `Made ${t.rows[0].email} the only owner of "${name}"${before.rows.length ? `; ${before.rows.map((r) => r.email).join(", ")} became admin` : ""}`, { workspaceId, memberId: t.rows[0].id, formerOwners: before.rows.map((r) => r.email) });
      });
    },

    async createOrganization(name: unknown, ownerUserId: unknown): Promise<{ id: string }> {
      const actor = await admin(ctx);
      const clean = cleanWorkspaceName(name);
      const owner = await userRow(db, ownerUserId);
      return { id: await store.createWorkspaceFor(db, actor, owner, clean, guard) };
    },

    async renameOrganization(workspaceId: string, name: unknown) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await store.renameWorkspace(db, actor, workspaceId, cleanWorkspaceName(name), guard);
    },

    async deleteOrganization(workspaceId: string) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await store.deleteWorkspace(db, { id: ctx.actorId, email: actor }, workspaceId, guard, { platformAdmin: true });
    },

    async setOrganizationTwoFactor(workspaceId: string, required: boolean) {
      const actor = await admin(ctx);
      const name = await existing(db, workspaceId);
      await tx(async (c) => {
        await c.query(
          `INSERT INTO auth2_workspace_policy (organization_id, two_factor_required, updated_at, updated_by) VALUES ($1, $2, now(), $3)
           ON CONFLICT (organization_id) DO UPDATE SET two_factor_required = EXCLUDED.two_factor_required, updated_at = now(), updated_by = EXCLUDED.updated_by`,
          [workspaceId, required, actor]
        );
        await audit(c, actor, "two_factor_policy", `${required ? "Required" : "Stopped requiring"} two-step sign-in for everyone in "${name}"`, { workspaceId, required });
      });
    },

    /** Puts an existing account in a workspace with a role, directly: no invitation, no mail. */
    async addMember(workspaceId: string, userId: unknown, role: unknown): Promise<{ memberId: string }> {
      const actor = await admin(ctx);
      if (!isRole(role)) throw refuse("BAD_REQUEST", "INVALID_ROLE", "Choose owner, admin or member.");
      return tx(async (c) => {
        const name = await store.lockWorkspace(c, workspaceId);
        const u = await userRow(c, userId);
        const already = await c.query('SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2', [workspaceId, u.id]);
        if (already.rowCount) throw refuse("CONFLICT", "ALREADY_MEMBER", "That person is a member of this workspace already.");
        const seats = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1`, [workspaceId]);
        if (seats.rows[0].n >= MAX_SEATS) throw refuse("FORBIDDEN", "SEAT_LIMIT", `A workspace holds at most ${MAX_SEATS} people.`);
        const memberId = newId();
        await c.query(`INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, now())`, [memberId, workspaceId, u.id, role]);
        await audit(c, actor, "member_added", `Added ${u.email} to "${name}" as ${role}, without an invitation`, { workspaceId, userId: u.id, role });
        return { memberId };
      });
    },

    async changeMemberRole(workspaceId: string, memberId: string, role: unknown) {
      const actor = await admin(ctx);
      if (!isRole(role)) throw refuse("BAD_REQUEST", "INVALID_ROLE", "Choose owner, admin or member.");
      await existing(db, workspaceId);
      await store.changeRole(db, actor, workspaceId, memberId, role, guard);
    },

    async removeMember(workspaceId: string, memberId: string) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await store.removeMember(db, actor, workspaceId, memberId, guard);
    },

    /**
     * Makes an invitation and returns its one-time link to the administrator, to hand over (nothing is emailed).
     * The stored token is a hash, as for every invitation (./workspaces/invitations.ts).
     */
    async createInvitation(workspaceId: string, email: unknown, role: unknown): Promise<{ invitationId: string; link: string }> {
      const actor = await admin(ctx);
      const to = cleanEmail(email);
      if (!isRole(role)) throw refuse("BAD_REQUEST", "INVALID_ROLE", "Choose owner, admin or member.");
      const token = randomBytes(32).toString("base64url");
      const id = await tx(async (c) => {
        const name = await store.lockWorkspace(c, workspaceId);
        const member = await c.query(`SELECT 1 FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = $1 AND lower(u.email) = $2`, [workspaceId, to]);
        if (member.rowCount) throw refuse("CONFLICT", "ALREADY_MEMBER", "That person is a member of this workspace already.");
        // An earlier invitation for the address is replaced, so only the link returned now works.
        await c.query(`UPDATE invitation SET status = 'canceled' WHERE "organizationId" = $1 AND lower(email) = $2 AND status = 'pending'`, [workspaceId, to]);
        const id = newId();
        await c.query(
          `INSERT INTO invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") VALUES ($1, $2, $3, $4, 'pending', now() + make_interval(days => $5), now(), $6)`,
          [id, workspaceId, to, asRole(role), (await readRules(c)).inviteExpiryDays, ctx.actorId]
        );
        await c.query("INSERT INTO auth2_invitation_tokens (invitation_id, token_hash, by_platform_admin) VALUES ($1, $2, true)", [id, createHash("sha256").update(token, "utf8").digest("base64url")]);
        await audit(c, actor, "invitation_created", `Made an invitation for ${to} to "${name}" as ${role}; the link was handed to the administrator`, { workspaceId, invitationId: id });
        return id;
      });
      return { invitationId: id, link: `${ctx.baseURL.replace(/\/+$/, "")}${AUTH2_PAGES}/invite?token=${encodeURIComponent(token)}` };
    },
  };
}

async function clearTwoFactor(c: PoolClient, userId: string) {
  await c.query('DELETE FROM "twoFactor" WHERE "userId" = $1', [userId]);
  await c.query('UPDATE "user" SET "twoFactorEnabled" = false, "updatedAt" = now() WHERE id = $1', [userId]);
  await c.query("DELETE FROM auth2_totp_steps WHERE user_id = $1", [userId]);
}

async function existing(db: Pool, workspaceId: unknown): Promise<string> {
  if (typeof workspaceId !== "string" || !workspaceId) throw store.notFound();
  const r = await db.query<{ name: string }>("SELECT name FROM organization WHERE id = $1", [workspaceId]);
  if (!r.rows[0]) throw store.notFound();
  return r.rows[0].name;
}
