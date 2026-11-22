/**
 * What a platform administrator can do to any account or workspace (owner's ruling of 22 Nov: "full power" over
 * users and organizations). Framework-free: no request, no screen. A later change wires these to the admin area;
 * whatever calls them passes the signed-in account's id, and every function checks again, on every call, that it is
 * a platform administrator who is not disabled (./platformAdmin.ts).
 *
 * Every change writes one audit line naming the administrator and the account or workspace it touched; no line
 * ever holds a password, token or link.
 *
 * Rules that hold here as everywhere: the last platform administrator can never lose the flag, be disabled or be
 * deleted (all administrators' rows are locked before counting, so two administrators removing each other at once
 * leave one); every account keeps a workspace (a person left without one gets a new one of their own); every
 * workspace keeps an owner.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { auditIn } from "@/lib/db";
import type { Auth2 } from "./auth";
import { AUTH2_PAGES } from "./config";
import { cleanName, cleanWorkspaceName } from "./guards";
import { isPlatformAdmin } from "./platformAdmin";
import { MAX_SEATS, asRole, isRole, type Role } from "./workspaces/permissions";
import * as store from "./workspaces/store";
import { inTx, newId, refuse } from "./workspaces/store";

const MAX_PASSWORD = 128;
const INVITATION_HOURS = 48;

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
};

/** The owner's pool, the sign-in instance (src/lib/auth2/server.ts auth2()), the acting account, and the base address
 *  links are made with (resolveAuth2Config().baseURL). */
type Ctx = { db: Pool; auth: Auth2; actorId: string; baseURL: string };

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
function cleanEmail(raw: unknown): string {
  const e = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!e || e.length > 254 || !EMAIL.test(e)) throw refuse("BAD_REQUEST", "INVALID_EMAIL", "Enter a whole email address, such as name@example.com.");
  return e;
}
function checkPassword(p: unknown): string {
  if (typeof p !== "string" || p.length < MIN_PASSWORD_LENGTH) throw refuse("BAD_REQUEST", "PASSWORD_TOO_SHORT", `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (p.length > MAX_PASSWORD) throw refuse("BAD_REQUEST", "PASSWORD_TOO_LONG", `The password must be at most ${MAX_PASSWORD} characters.`);
  return p;
}

/** The administrator's address, after checking they are one. Every operation starts here. */
async function admin(ctx: Ctx): Promise<string> {
  if (!(await isPlatformAdmin(ctx.db, ctx.actorId))) throw refuse("FORBIDDEN", "NOT_PLATFORM_ADMIN", "Only a platform administrator may do this.");
  return (await ctx.db.query<{ email: string }>('SELECT email FROM "user" WHERE id = $1', [ctx.actorId])).rows[0].email;
}

async function userRow(c: Pool | PoolClient, userId: unknown, lock = false) {
  if (typeof userId !== "string" || !userId || userId.length > 100) throw refuse("NOT_FOUND", "USER_NOT_FOUND", "That account was not found.");
  const r = await c.query<{ id: string; email: string; name: string; platformAdmin: boolean }>(
    `SELECT id, email, name, "platformAdmin" FROM "user" WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [userId]
  );
  if (!r.rows[0]) throw refuse("NOT_FOUND", "USER_NOT_FOUND", "That account was not found.");
  return r.rows[0];
}

/** Locks every platform administrator's row and answers how many there are (not disabled). */
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
  const audit = (c: PoolClient, actor: string, action: string, summary: string, detail: Record<string, unknown>) => auditIn(c, { actor, action: `platform.${action}`, summary, detail });

  return {
    /** Every account with its state, newest first. */
    async listUsers(): Promise<UserState[]> {
      await admin(ctx);
      const r = await db.query<{ id: string; email: string; name: string; emailVerified: boolean; twoFactorEnabled: boolean | null; twoFactorRequired: boolean; platformAdmin: boolean; disabledAt: Date | null; createdAt: Date; n: number }>(
        `SELECT u.id, u.email, u.name, u."emailVerified", u."twoFactorEnabled", u."twoFactorRequired", u."platformAdmin", u."disabledAt", u."createdAt",
                (SELECT count(*)::int FROM member m WHERE m."userId" = u.id) AS n
           FROM "user" u ORDER BY u."createdAt" DESC, u.id`
      );
      return r.rows.map((u) => ({
        id: u.id, email: u.email, name: u.name, confirmed: u.emailVerified, twoFactor: u.twoFactorEnabled === true, twoFactorRequired: u.twoFactorRequired,
        platformAdmin: u.platformAdmin, disabled: u.disabledAt !== null, createdAt: new Date(u.createdAt).toISOString(), workspaces: u.n,
      }));
    },

    /**
     * Creates an account, confirmed or not, with a password or without one (it is then set later with setPassword,
     * or by the person through a reset when mail is on). It gets its own workspace, as every account does.
     */
    async createUser(input: { email: unknown; name: unknown; password?: unknown; confirmed?: boolean }): Promise<{ id: string }> {
      const actor = await admin(ctx);
      const email = cleanEmail(input.email);
      const name = cleanName(input.name);
      const password = input.password === undefined ? null : checkPassword(input.password);
      const taken = await db.query('SELECT 1 FROM "user" WHERE lower(email) = $1', [email]);
      if (taken.rowCount) throw refuse("CONFLICT", "USER_EXISTS", "An account with that address exists already.");
      const ac = await ctx.auth.$context;
      const user = await ac.internalAdapter.createUser({ email, name, emailVerified: input.confirmed === true }, { method: "email-password" });
      if (password) await ac.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await hashPassword(password) });
      await inTx(db, (c) => audit(c, actor, "user_created", `Created the account ${email}${input.confirmed ? ", confirmed" : ""}${password ? ", with a password" : ", without a password"}`, { userId: user.id }));
      return { id: user.id };
    },

    /** Confirms an address without sending anything (for "no mail" mode, or a person who cannot receive mail). */
    async confirmEmail(userId: unknown) {
      const actor = await admin(ctx);
      await inTx(db, async (c) => {
        const u = await userRow(c, userId, true);
        await c.query('UPDATE "user" SET "emailVerified" = true, "updatedAt" = now() WHERE id = $1', [u.id]);
        await audit(c, actor, "email_confirmed", `Confirmed the address of ${u.email} (no email sent)`, { userId: u.id });
      });
    },

    /** Sets a new password (or the first one) and ends every session of that account. */
    async setPassword(userId: unknown, password: unknown) {
      const actor = await admin(ctx);
      const p = checkPassword(password);
      const hash = await hashPassword(p);
      await inTx(db, async (c) => {
        const u = await userRow(c, userId, true);
        const r = await c.query(`UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = 'credential'`, [u.id, hash]);
        if (!r.rowCount) {
          await c.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [newId(), u.id, hash]);
        }
        await endSessions(c, u.id);
        await audit(c, actor, "password_set", `Set a new password for ${u.email}; every session of the account ended`, { userId: u.id });
      });
    },

    /** Requires two-factor of one person, whatever their workspaces say (or stops requiring it at this level). */
    async setTwoFactorRequired(userId: unknown, required: boolean) {
      const actor = await admin(ctx);
      await inTx(db, async (c) => {
        const u = await userRow(c, userId, true);
        await c.query('UPDATE "user" SET "twoFactorRequired" = $2 WHERE id = $1', [u.id, required]);
        await audit(c, actor, required ? "two_factor_required" : "two_factor_not_required", `${required ? "Required" : "Stopped requiring"} two-step sign-in of ${u.email}`, { userId: u.id });
      });
    },

    /** Removes the authenticator app and recovery codes and ends every session; set up again if still required. */
    async resetTwoFactor(userId: unknown) {
      const actor = await admin(ctx);
      await inTx(db, async (c) => {
        const u = await userRow(c, userId, true);
        await clearTwoFactor(c, u.id);
        await endSessions(c, u.id);
        await audit(c, actor, "two_factor_reset", `Reset the two-step sign-in of ${u.email}: authenticator app and recovery codes removed, sessions ended`, { userId: u.id });
      });
    },

    /** Turns two-factor off for a person: as resetTwoFactor, and the platform-level requirement is lifted too.
     *  A workspace that requires it will still ask for it at the next sign-in. */
    async disableTwoFactor(userId: unknown) {
      const actor = await admin(ctx);
      await inTx(db, async (c) => {
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
      await inTx(db, async (c) => {
        const n = await lockAdmins(c);
        const u = await userRow(c, userId, true);
        if (disabled && u.platformAdmin && n <= 1) throw lastAdmin();
        await c.query(`UPDATE "user" SET "disabledAt" = ${disabled ? "COALESCE(\"disabledAt\", now())" : "NULL"} WHERE id = $1`, [u.id]);
        if (disabled) await endSessions(c, u.id);
        await audit(c, actor, disabled ? "user_disabled" : "user_enabled", `${disabled ? "Disabled" : "Enabled again"} the account ${u.email}`, { userId: u.id });
      });
    },

    /** Grants or removes the platform administrator flag. The last one can never lose it. */
    async setPlatformAdmin(userId: unknown, on: boolean) {
      const actor = await admin(ctx);
      await inTx(db, async (c) => {
        const n = await lockAdmins(c);
        const u = await userRow(c, userId, true);
        if (!on && u.platformAdmin && n <= 1) throw lastAdmin();
        await c.query('UPDATE "user" SET "platformAdmin" = $2 WHERE id = $1', [u.id, on]);
        await audit(c, actor, on ? "admin_granted" : "admin_removed", `${on ? "Made" : "Stopped"} ${u.email} ${on ? "a" : "being a"} platform administrator`, { userId: u.id });
      });
    },

    /**
     * Deletes an account. Workspaces it solely owns (no other owner) must be dealt with in the same call, or it is
     * refused and names them: `transfer` gives a workspace to another of its members as owner, `deleteWorkspaces`
     * deletes the rest. The last platform administrator cannot be deleted.
     */
    async deleteUser(userId: unknown, opts: { transfer?: Record<string, string>; deleteWorkspaces?: boolean } = {}) {
      const actor = await admin(ctx);
      await inTx(db, async (c) => {
        const n = await lockAdmins(c);
        const u = await userRow(c, userId, true);
        if (u.platformAdmin && n <= 1) throw lastAdmin();
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

    // --- workspaces ----------------------------------------------------------------------------------------------

    async createOrganization(name: unknown, ownerUserId: unknown): Promise<{ id: string }> {
      const actor = await admin(ctx);
      const clean = cleanWorkspaceName(name);
      const owner = await userRow(db, ownerUserId);
      return { id: await store.createWorkspaceFor(db, actor, owner, clean) };
    },

    async renameOrganization(workspaceId: string, name: unknown) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await store.renameWorkspace(db, actor, workspaceId, cleanWorkspaceName(name));
    },

    async deleteOrganization(workspaceId: string) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await store.deleteWorkspace(db, { id: ctx.actorId, email: actor }, workspaceId, { platformAdmin: true });
    },

    async setOrganizationTwoFactor(workspaceId: string, required: boolean) {
      const actor = await admin(ctx);
      const name = await existing(db, workspaceId);
      await inTx(db, async (c) => {
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
      return inTx(db, async (c) => {
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
      await store.changeRole(db, actor, workspaceId, memberId, role as Role, () => true);
    },

    async removeMember(workspaceId: string, memberId: string) {
      const actor = await admin(ctx);
      await existing(db, workspaceId);
      await store.removeMember(db, actor, workspaceId, memberId, () => true);
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
      const id = await inTx(db, async (c) => {
        const name = await store.lockWorkspace(c, workspaceId);
        const member = await c.query(`SELECT 1 FROM member m JOIN "user" u ON u.id = m."userId" WHERE m."organizationId" = $1 AND lower(u.email) = $2`, [workspaceId, to]);
        if (member.rowCount) throw refuse("CONFLICT", "ALREADY_MEMBER", "That person is a member of this workspace already.");
        // An earlier invitation for the address is replaced, so only the link returned now works.
        await c.query(`UPDATE invitation SET status = 'canceled' WHERE "organizationId" = $1 AND lower(email) = $2 AND status = 'pending'`, [workspaceId, to]);
        const id = newId();
        await c.query(
          `INSERT INTO invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") VALUES ($1, $2, $3, $4, 'pending', now() + make_interval(hours => $5), now(), $6)`,
          [id, workspaceId, to, asRole(role), INVITATION_HOURS, ctx.actorId]
        );
        await c.query("INSERT INTO auth2_invitation_tokens (invitation_id, token_hash) VALUES ($1, $2)", [id, createHash("sha256").update(token, "utf8").digest("base64url")]);
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
