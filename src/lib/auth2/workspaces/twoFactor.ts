/**
 * The two-factor requirement (accounts slice 2, step 4; owner's ruling, matching Eigenia's portal rule).
 *
 * A person must use an authenticator app when ANY workspace they belong to requires it (its policy), when an
 * owner or admin of any of their workspaces required it of them by name, or when a platform administrator required
 * it of them ("user"."twoFactorRequired", ../adminOps.ts). Such a person, until enrolled, is sent
 * to enrolment after the password step and cannot reach any workspace (owed(): the workspace endpoints answer
 * TWO_FACTOR_SETUP_REQUIRED, the screens redirect); once enrolled they cannot turn it off.
 *
 * The recovery path for a lost phone: an owner or admin who manages that member (./permissions.ts) resets their
 * two-factor. That removes the app and the recovery codes, ends every session of the account, emails a notice when
 * mail is on, and is audited. Allowed only where this workspace requires it of the member, so an admin cannot use
 * it to weaken an account whose two-factor is the person's own choice.
 */
import type { Pool, PoolClient } from "pg";
import { auditIn } from "@/lib/db";
import { render, type MailSender } from "../mail";
import { asRole, manages, may, type Role } from "./permissions";
import { inTx, lockWorkspace, refuse, type Membership } from "./store";

const REQUIRED_SQL = `(EXISTS (
  SELECT 1 FROM member m
    LEFT JOIN auth2_workspace_policy p ON p.organization_id = m."organizationId"
    LEFT JOIN auth2_member_flags f ON f.member_id = m.id
   WHERE m."userId" = $1 AND (COALESCE(p.two_factor_required, false) OR COALESCE(f.two_factor_required, false)))
  OR COALESCE((SELECT "twoFactorRequired" FROM "user" WHERE id = $1), false))`;

/** Whether any workspace of the user requires two-factor of them. */
export async function requiredFor(db: Pool, userId: string): Promise<boolean> {
  return (await db.query<{ r: boolean }>(`SELECT ${REQUIRED_SQL} AS r`, [userId])).rows[0].r;
}

/** Whether the user must enrol before reaching a workspace: required, and no authenticator app yet. */
export async function owed(db: Pool, userId: string): Promise<boolean> {
  const r = await db.query<{ owed: boolean }>(`SELECT ${REQUIRED_SQL} AND NOT COALESCE((SELECT "twoFactorEnabled" FROM "user" WHERE id = $1), false) AS owed`, [userId]);
  return r.rows[0].owed;
}

export const setupRequired = () =>
  refuse("FORBIDDEN", "TWO_FACTOR_SETUP_REQUIRED", "A workspace you belong to requires two-step sign-in. Set up an authenticator app first.");

/** Whether this workspace requires it of everyone. */
export async function policyOf(db: Pool, workspaceId: string): Promise<boolean> {
  const r = await db.query<{ r: boolean }>("SELECT two_factor_required AS r FROM auth2_workspace_policy WHERE organization_id = $1", [workspaceId]);
  return r.rows[0]?.r ?? false;
}

export async function setPolicy(db: Pool, actor: string, m: Membership, required: boolean) {
  if (!may(m.role, "set-policy")) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
  await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    await c.query(
      `INSERT INTO auth2_workspace_policy (organization_id, two_factor_required, updated_at, updated_by) VALUES ($1, $2, now(), $3)
       ON CONFLICT (organization_id) DO UPDATE SET two_factor_required = EXCLUDED.two_factor_required, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [m.workspaceId, required, actor]
    );
    await auditIn(c, {
      actor,
      action: "workspace.two_factor_policy",
      summary: required ? `Required two-step sign-in for everyone in "${name}"` : `Stopped requiring two-step sign-in for everyone in "${name}"`,
      detail: { workspaceId: m.workspaceId, required },
    });
  });
}

type Target = { memberId: string; userId: string; email: string; name: string; role: Role; flagged: boolean };

async function targetIn(db: Pool | PoolClient, workspaceId: string, memberId: unknown): Promise<Target> {
  if (typeof memberId !== "string" || !memberId || memberId.length > 100) throw refuse("NOT_FOUND", "MEMBER_NOT_FOUND", "That person is not a member of this workspace.");
  const r = await db.query<{ id: string; userId: string; email: string; name: string; role: string; flagged: boolean | null }>(
    `SELECT m.id, m."userId", u.email, u.name, m.role, f.two_factor_required AS flagged
       FROM member m JOIN "user" u ON u.id = m."userId" LEFT JOIN auth2_member_flags f ON f.member_id = m.id
      WHERE m.id = $1 AND m."organizationId" = $2`,
    [memberId, workspaceId]
  );
  const t = r.rows[0];
  if (!t) throw refuse("NOT_FOUND", "MEMBER_NOT_FOUND", "That person is not a member of this workspace.");
  return { memberId: t.id, userId: t.userId, email: t.email, name: t.name, role: asRole(t.role), flagged: t.flagged === true };
}

/** Requires (or stops requiring) two-factor of one member. */
export async function setMemberRequired(db: Pool, actor: string, m: Membership, memberId: unknown, required: boolean) {
  await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const t = await targetIn(c, m.workspaceId, memberId);
    if (!manages(m.role, t.role)) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    await c.query(
      `INSERT INTO auth2_member_flags (member_id, two_factor_required, updated_at, updated_by) VALUES ($1, $2, now(), $3)
       ON CONFLICT (member_id) DO UPDATE SET two_factor_required = EXCLUDED.two_factor_required, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [t.memberId, required, actor]
    );
    await auditIn(c, {
      actor,
      action: "workspace.member_two_factor_required",
      summary: required ? `Required two-step sign-in of ${t.email} in "${name}"` : `Stopped requiring two-step sign-in of ${t.email} in "${name}"`,
      detail: { workspaceId: m.workspaceId, memberId: t.memberId, required },
    });
  });
}

/**
 * Resets a member's two-factor (they lost their phone): removes the app and the recovery codes, ends all their
 * sessions, and tells them by email when mail is on. Not one's own, only for a member this workspace requires it
 * of, and only by an owner or admin who manages them.
 */
export async function resetMemberTwoFactor(
  db: Pool,
  deps: { mailer: () => Promise<MailSender | null>; link: (path: string, token: string) => string },
  actor: { id: string; email: string; name: string },
  m: Membership,
  memberId: unknown
) {
  const { t, name } = await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const t = await targetIn(c, m.workspaceId, memberId);
    if (t.userId === actor.id) throw refuse("BAD_REQUEST", "NOT_YOUR_OWN", "You cannot reset your own two-step sign-in here. Use a recovery code to sign in, then set it up again.");
    if (!manages(m.role, t.role)) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    const policy = await c.query<{ r: boolean }>("SELECT two_factor_required AS r FROM auth2_workspace_policy WHERE organization_id = $1", [m.workspaceId]);
    if (!(policy.rows[0]?.r || t.flagged)) {
      throw refuse("FORBIDDEN", "TWO_FACTOR_NOT_REQUIRED_HERE", "This workspace does not require two-step sign-in of this member, so it is theirs to manage. Require it first if they need it reset.");
    }
    await c.query('DELETE FROM "twoFactor" WHERE "userId" = $1', [t.userId]);
    await c.query('UPDATE "user" SET "twoFactorEnabled" = false, "updatedAt" = now() WHERE id = $1', [t.userId]);
    await c.query("DELETE FROM auth2_totp_steps WHERE user_id = $1", [t.userId]);
    // Two-factor challenges halfway through a sign-in carry the user's id as their value.
    await c.query("DELETE FROM verification WHERE value = $1", [t.userId]);
    await c.query('DELETE FROM "session" WHERE "userId" = $1', [t.userId]);
    await auditIn(c, {
      actor: actor.email,
      action: "workspace.member_two_factor_reset",
      summary: `Reset the two-step sign-in of ${t.email} in "${name}": authenticator app and recovery codes removed, sessions ended`,
      detail: { workspaceId: m.workspaceId, memberId: t.memberId },
    });
    return { t, name };
  });
  const sender = await deps.mailer();
  if (sender) {
    const signIn = deps.link("/sign-in", "").replace(/\?token=$/, "");
    await sender.send(render({ kind: "two-factor-reset", to: t.email, name: t.name, link: signIn, workspace: name, by: actor.name || actor.email })).catch((e) => console.error(`[auth2] a two-factor reset notice could not be sent: ${(e as Error).message}`));
  }
}
