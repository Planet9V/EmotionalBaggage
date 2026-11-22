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
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { auditIn } from "@/lib/db";
import type { Auth2 } from "./auth";
import { AUTH2_PAGES, AUTH2_SETTING, resolveAddresses, writeAuth2Setting } from "./config";
import { resetAndRequireProof } from "./workspaces/twoFactor";
import { cleanEmail, cleanName, cleanWorkspaceName } from "./guards";
import { isPlatformAdmin } from "./platformAdmin";
import { MAX_SEATS, asRole, isRole } from "./workspaces/permissions";
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
      const hash = password ? await hashPassword(password) : null;
      return tx(async (c) => {
        const taken = await c.query('SELECT 1 FROM "user" WHERE lower(email) = $1', [email]);
        if (taken.rowCount) throw refuse("CONFLICT", "USER_EXISTS", "An account with that address exists already.");
        const id = newId();
        await c.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") VALUES ($1, $2, $3, $4, now(), now(), false)`, [id, name, email, input.confirmed === true]);
        if (hash) await c.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [newId(), id, hash]);
        await store.createPersonal(c, { id, name, email });
        await audit(c, actor, "user_created", `Created the account ${email}${input.confirmed ? ", confirmed" : ""}${password ? ", with a password" : ", without a password"}`, { userId: id });
        return { id };
      });
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

    /** Sets a new password (or the first one) and ends every session of that account. */
    async setPassword(userId: unknown, password: unknown) {
      const actor = await admin(ctx);
      const p = checkPassword(password);
      const hash = await hashPassword(p);
      await tx(async (c) => {
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
      return tx(async (c) => {
        const u = await userRow(c, userId, true);
        const code = await resetAndRequireProof(c, u.id, actor, "code");
        await audit(c, actor, "two_factor_reset", `Reset the two-step sign-in of ${u.email}: authenticator app and recovery codes removed, sessions ended, a one-time code handed to the administrator`, { userId: u.id });
        return { code };
      });
    },

    /** Turns two-factor off for a person: as resetTwoFactor, and the platform-level requirement is lifted too.
     *  A workspace that requires it will still ask for it at the next sign-in. */
    async disableTwoFactor(userId: unknown) {
      const actor = await admin(ctx);
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
    async deleteUser(userId: unknown, opts: { transfer?: Record<string, string>; deleteWorkspaces?: boolean } = {}) {
      const actor = await admin(ctx);
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
          `INSERT INTO invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") VALUES ($1, $2, $3, $4, 'pending', now() + make_interval(hours => $5), now(), $6)`,
          [id, workspaceId, to, asRole(role), INVITATION_HOURS, ctx.actorId]
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
