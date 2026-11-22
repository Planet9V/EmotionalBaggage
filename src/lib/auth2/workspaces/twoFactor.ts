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
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { auditIn } from "@/lib/db";
import { render, type MailSender } from "../mail";
import { asRole, manages, may, type Role } from "./permissions";
import { forRole, inTx, lockWorkspace, refuse, type Membership } from "./store";

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

export async function setPolicy(db: Pool, actor: { id: string; email: string }, m: Membership, required: boolean) {
  if (!may(m.role, "set-policy")) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
  await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    if (!may(await forRole(actor.id)(c, m.workspaceId), "set-policy")) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    await c.query(
      `INSERT INTO auth2_workspace_policy (organization_id, two_factor_required, updated_at, updated_by) VALUES ($1, $2, now(), $3)
       ON CONFLICT (organization_id) DO UPDATE SET two_factor_required = EXCLUDED.two_factor_required, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [m.workspaceId, required, actor.email]
    );
    await auditIn(c, {
      actor: actor.email,
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
export async function setMemberRequired(db: Pool, actor: { id: string; email: string }, m: Membership, memberId: unknown, required: boolean) {
  await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const t = await targetIn(c, m.workspaceId, memberId);
    if (!manages(await forRole(actor.id)(c, m.workspaceId), t.role)) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    await c.query(
      `INSERT INTO auth2_member_flags (member_id, two_factor_required, updated_at, updated_by) VALUES ($1, $2, now(), $3)
       ON CONFLICT (member_id) DO UPDATE SET two_factor_required = EXCLUDED.two_factor_required, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [t.memberId, required, actor.email]
    );
    await auditIn(c, {
      actor: actor.email,
      action: "workspace.member_two_factor_required",
      summary: required ? `Required two-step sign-in of ${t.email} in "${name}"` : `Stopped requiring two-step sign-in of ${t.email} in "${name}"`,
      detail: { workspaceId: m.workspaceId, memberId: t.memberId, required },
    });
  });
}

// --- resets and the proof needed afterwards (review B4) ------------------------------------------------------------

const RESETS_PER_DAY = 3;
const PROOF_HOURS = 24;
/** How long a proved person may sign in with the password alone to set up the app again. */
const PROVED_MINUTES = 15;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const proofHash = (proof: string) => createHash("sha256").update(proof.replace(/[\s-]+/g, "").toUpperCase(), "utf8").digest("base64url");

/**
 * After someone else resets an account's two-factor, the account cannot sign in with its password alone until it
 * has given a proof beyond the password: the link emailed to its own address (mail on), or a one-time code shown once
 * to whoever reset it (no mail). Only the proof's hash is stored; it expires after a day. Answers the proof, to be
 * emailed or shown by the caller after the transaction commits.
 */
async function requireProof(c: PoolClient, userId: string, by: string, kind: "link" | "code"): Promise<string> {
  const proof = kind === "link" ? randomBytes(32).toString("base64url") : Array.from({ length: 16 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("").match(/.{4}/g)!.join("-");
  await c.query(
    `INSERT INTO auth2_reenrol (user_id, proof_hash, expires_at, created_by, proved_until) VALUES ($1, $2, now() + make_interval(hours => $3), $4, NULL)
     ON CONFLICT (user_id) DO UPDATE SET proof_hash = EXCLUDED.proof_hash, expires_at = EXCLUDED.expires_at, created_by = EXCLUDED.created_by, proved_until = NULL`,
    [userId, kind === "link" ? proofHash(proof) : proofHash(proof), PROOF_HOURS, by]
  );
  return proof;
}

/** Removes the app and recovery codes, ends every session, logs the reset, and requires a proof (see above). */
export async function resetAndRequireProof(c: PoolClient, userId: string, by: string, kind: "link" | "code"): Promise<string> {
  const recent = await c.query<{ n: number }>("SELECT count(*)::int AS n FROM auth2_two_factor_resets WHERE user_id = $1 AND at > now() - interval '1 day'", [userId]);
  if (recent.rows[0].n >= RESETS_PER_DAY) {
    throw refuse("TOO_MANY_REQUESTS", "RESET_LIMIT", `This person's two-step sign-in has been reset ${RESETS_PER_DAY} times in the last day, the most it may be. Try again tomorrow, or ask a platform administrator.`);
  }
  await c.query('DELETE FROM "twoFactor" WHERE "userId" = $1', [userId]);
  await c.query('UPDATE "user" SET "twoFactorEnabled" = false, "updatedAt" = now() WHERE id = $1', [userId]);
  await c.query("DELETE FROM auth2_totp_steps WHERE user_id = $1", [userId]);
  // Two-factor challenges halfway through a sign-in, and reset links, carry the user's id as their value.
  await c.query("DELETE FROM verification WHERE value = $1", [userId]);
  await c.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
  await c.query("INSERT INTO auth2_two_factor_resets (user_id) VALUES ($1)", [userId]);
  return requireProof(c, userId, by, kind);
}

/** Whether an account still owes a proof before a password-only sign-in may start a session. */
export async function proofOwed(db: Pool, userId: string): Promise<boolean> {
  const r = await db.query("SELECT 1 FROM auth2_reenrol WHERE user_id = $1 AND (proved_until IS NULL OR proved_until < now())", [userId]);
  return (r.rowCount ?? 0) > 0;
}

/**
 * Checks a proof for an account (by its address): answers true and opens a short window in which the password alone
 * starts a session, to set up the app again; false for anything wrong (one answer for every case).
 */
export async function giveProof(db: Pool, userId: string | null, proof: unknown): Promise<boolean> {
  if (!userId || typeof proof !== "string" || !proof.isWellFormed() || proof.length > 100) return false;
  const r = await db.query(
    `UPDATE auth2_reenrol SET proved_until = now() + make_interval(mins => $3) WHERE user_id = $1 AND proof_hash = $2 AND expires_at > now() RETURNING 1`,
    [userId, proofHash(proof), PROVED_MINUTES]
  );
  return (r.rowCount ?? 0) > 0;
}

/** Set up again: the proof is spent. */
export async function proofSpent(db: Pool, userId: string) {
  await db.query("DELETE FROM auth2_reenrol WHERE user_id = $1", [userId]);
}

/**
 * Resets a member's two-factor (they lost their phone). Refused for one's own account, for a member the actor does
 * not manage, and where this workspace does not require it of them. Refused too, as a platform administrator's
 * matter (review B4), when the member is a platform administrator, holds owner or admin in any other workspace that
 * has anyone else in it (their own workspace alone does not count: every account owns one), or is
 * required to use two-factor by another workspace or by a platform administrator: a workspace must not be able to
 * weaken an account that matters elsewhere. At most RESETS_PER_DAY a day per person.
 *
 * Answers the one-time code to hand over when there is no mail; with mail, the member is sent a link to their own
 * address instead, and told what happened.
 */
export async function resetMemberTwoFactor(
  db: Pool,
  deps: { mailer: () => Promise<MailSender | null>; link: (path: string, token: string) => string },
  actor: { id: string; email: string; name: string },
  m: Membership,
  memberId: unknown
): Promise<{ code?: string }> {
  const sender = await deps.mailer();
  const { t, name, proof } = await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const mine = await forRole(actor.id)(c, m.workspaceId);
    const t = await targetIn(c, m.workspaceId, memberId);
    if (t.userId === actor.id) throw refuse("BAD_REQUEST", "NOT_YOUR_OWN", "You cannot reset your own two-step sign-in here. Use a recovery code to sign in, then set it up again.");
    if (!manages(mine, t.role)) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    await c.query('SELECT 1 FROM "user" WHERE id = $1 FOR UPDATE', [t.userId]);
    const policy = await c.query<{ r: boolean }>("SELECT two_factor_required AS r FROM auth2_workspace_policy WHERE organization_id = $1", [m.workspaceId]);
    if (!(policy.rows[0]?.r || t.flagged)) {
      throw refuse("FORBIDDEN", "TWO_FACTOR_NOT_REQUIRED_HERE", "This workspace does not require two-step sign-in of this member, so it is theirs to manage. Require it first if they need it reset.");
    }
    const elsewhere = await c.query<{ x: boolean }>(
      `SELECT COALESCE((SELECT "platformAdmin" OR "twoFactorRequired" FROM "user" WHERE id = $1), false)
           OR EXISTS (SELECT 1 FROM member o WHERE o."userId" = $1 AND o."organizationId" <> $2 AND (o.role LIKE '%owner%' OR o.role LIKE '%admin%')
                        -- a workspace of their own with nobody else in it puts nobody else at risk
                        AND EXISTS (SELECT 1 FROM member x WHERE x."organizationId" = o."organizationId" AND x."userId" <> $1))
           OR EXISTS (SELECT 1 FROM member o
                        LEFT JOIN auth2_workspace_policy p ON p.organization_id = o."organizationId"
                        LEFT JOIN auth2_member_flags f ON f.member_id = o.id
                       WHERE o."userId" = $1 AND o."organizationId" <> $2 AND (COALESCE(p.two_factor_required, false) OR COALESCE(f.two_factor_required, false))) AS x`,
      [t.userId, m.workspaceId]
    );
    if (elsewhere.rows[0].x) {
      throw refuse("FORBIDDEN", "RESET_NEEDS_PLATFORM_ADMIN", "This person's two-step sign-in matters beyond this workspace (they administer another, another requires it, or they administer the installation). Ask a platform administrator to reset it.");
    }
    const proof = await resetAndRequireProof(c, t.userId, actor.email, sender ? "link" : "code");
    await auditIn(c, {
      actor: actor.email,
      action: "workspace.member_two_factor_reset",
      summary: `Reset the two-step sign-in of ${t.email} in "${name}": authenticator app and recovery codes removed, sessions ended; setting it up again needs ${sender ? "the link emailed to them" : "a one-time code handed over"}`,
      detail: { workspaceId: m.workspaceId, memberId: t.memberId },
    });
    return { t, name, proof };
  });
  if (!sender) return { code: proof };
  await sender
    .send(render({ kind: "two-factor-reset", to: t.email, name: t.name, link: deps.link("/re-enrol", proof), workspace: name, by: actor.name || actor.email }))
    .catch((e) => console.error(`[auth2] a two-factor reset notice could not be sent: ${(e as Error).message}`));
  return {};
}
