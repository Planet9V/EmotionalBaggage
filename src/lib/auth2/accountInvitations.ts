/**
 * Invitations to create an account, made by a platform administrator (owner's ruling of 23 Nov: "sending
 * invitations, expiring after 7 days"). Separate from workspace invitations (./workspaces/invitations.ts), which
 * ask an existing or new account to join one workspace.
 *
 * The account is made when the invitation is: name, address, role, a workspace of its own, no password and not
 * confirmed. The link carries a random 32-byte token; only its SHA-256 is stored (auth2_account_invitations,
 * owner-only), as for every token here (./tokenHash.ts). Following the link and choosing a password (under the
 * password rules) confirms the address and signs the person in. The link works once, until `invites.expiryDays`
 * (default 7) after it was last sent; sending it again makes a new token, so the old link stops working; revoking
 * ends it. States: pending, accepted, expired, revoked.
 *
 * With mail set up the link is emailed; without it (or when sending fails) it is handed back to the administrator
 * once, to pass on, and never logged. Nothing here is ever a blocker.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { hashPassword } from "@/lib/auth";
import { auditIn } from "@/lib/db";
import { render, type MailSender } from "./mail";
import { checkNewPassword } from "./newPassword";
import { readRules } from "./rules";
import { unlock } from "./signInWait";
import { inTx, newId, refuse } from "./workspaces/store";

const hashOf = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");
const newToken = () => randomBytes(32).toString("base64url");
const RESEND_AFTER_S = 60;
const MAX_SENDS = 10;

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type AccountInvitation = {
  id: string;
  userId: string;
  email: string;
  name: string;
  platformAdmin: boolean;
  status: InvitationStatus;
  createdAt: string;
  sentAt: string;
  expiresAt: string;
  sends: number;
  mailed: boolean;
  invitedBy: string;
};
export type Delivered = { invitationId: string; mailed: boolean; link?: string; expiresAt: string };
type Deps = { mailer: () => Promise<MailSender | null>; link: (path: string, token: string) => string };

const STATUS_SQL = `CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted' WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.expires_at <= now() THEN 'expired' ELSE 'pending' END`;

async function deliver(deps: Deps, to: string, name: string, token: string, inviter: string, days: number): Promise<{ mailed: boolean; link?: string }> {
  const link = deps.link("/join", token);
  const sender = await deps.mailer();
  if (!sender) return { mailed: false, link };
  try {
    await sender.send(render({ kind: "account-invitation", to, name, link, inviter, days }));
    return { mailed: true };
  } catch (e) {
    console.error(`[auth2] an account invitation could not be sent: ${(e as Error).name}`);
    return { mailed: false, link };
  }
}

/** Makes a new invitation (or the first) for an account that has no password yet, inside the caller's transaction. */
export async function issue(c: PoolClient, user: { id: string; email: string; platformAdmin: boolean }, actor: string): Promise<{ id: string; token: string; expiresAt: Date; days: number }> {
  const days = (await readRules(c)).inviteExpiryDays;
  const token = newToken();
  await c.query("UPDATE auth2_account_invitations SET revoked_at = now(), token_hash = NULL WHERE user_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL", [user.id]);
  const id = newId();
  const r = await c.query<{ expires_at: Date }>(
    `INSERT INTO auth2_account_invitations (id, user_id, email, platform_admin, token_hash, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7)) RETURNING expires_at`,
    [id, user.id, user.email, user.platformAdmin, hashOf(token), actor, days]
  );
  return { id, token, expiresAt: r.rows[0]!.expires_at, days };
}

/** Sends (or hands back) the link of an invitation just issued, and notes whether it was emailed. */
export async function send(db: Pool, deps: Deps, inv: { id: string; token: string; expiresAt: Date; days: number }, to: { email: string; name: string }, inviter: string): Promise<Delivered> {
  const d = await deliver(deps, to.email, to.name, inv.token, inviter, inv.days);
  await db.query("UPDATE auth2_account_invitations SET mailed = $2 WHERE id = $1", [inv.id, d.mailed]);
  return { invitationId: inv.id, ...d, expiresAt: new Date(inv.expiresAt).toISOString() };
}

/** Every account invitation, newest first, optionally of one status. */
export async function list(db: Pool, status?: InvitationStatus): Promise<AccountInvitation[]> {
  const r = await db.query<{ id: string; user_id: string; email: string; name: string | null; platform_admin: boolean; status: InvitationStatus; created_at: Date; sent_at: Date; expires_at: Date; send_count: number; mailed: boolean; created_by: string }>(
    `SELECT i.id, i.user_id, i.email, u.name, i.platform_admin, ${STATUS_SQL} AS status, i.created_at, i.sent_at, i.expires_at, i.send_count, i.mailed, i.created_by
       FROM auth2_account_invitations i JOIN "user" u ON u.id = i.user_id
      ${status ? `WHERE ${STATUS_SQL} = $1` : ""} ORDER BY i.created_at DESC LIMIT 500`,
    status ? [status] : []
  );
  return r.rows.map((x) => ({
    id: x.id, userId: x.user_id, email: x.email, name: x.name ?? "", platformAdmin: x.platform_admin, status: x.status, createdAt: x.created_at.toISOString(),
    sentAt: x.sent_at.toISOString(), expiresAt: x.expires_at.toISOString(), sends: x.send_count, mailed: x.mailed, invitedBy: x.created_by,
  }));
}

type Row = { id: string; user_id: string; email: string; name: string; platform_admin: boolean; status: InvitationStatus; sent_age: number; send_count: number };

async function openRow(c: PoolClient, invitationId: unknown): Promise<Row> {
  if (typeof invitationId !== "string" || !invitationId || invitationId.length > 100) throw refuse("NOT_FOUND", "INVITATION_NOT_FOUND", "That invitation was not found.");
  const r = await c.query<Row>(
    `SELECT i.id, i.user_id, i.email, u.name, i.platform_admin, ${STATUS_SQL} AS status, extract(epoch FROM now() - i.sent_at)::int AS sent_age, i.send_count
       FROM auth2_account_invitations i JOIN "user" u ON u.id = i.user_id WHERE i.id = $1 FOR UPDATE OF i`,
    [invitationId]
  );
  const row = r.rows[0];
  if (!row) throw refuse("NOT_FOUND", "INVITATION_NOT_FOUND", "That invitation was not found.");
  return row;
}

/** Sends an invitation again (pending or expired): a new link, a fresh expiry; the old link stops working. */
export async function resend(db: Pool, deps: Deps, invitationId: unknown, actor: { email: string; name: string }): Promise<Delivered> {
  const { row, token, expiresAt, days } = await inTx(db, async (c) => {
    const row = await openRow(c, invitationId);
    if (row.status === "accepted") throw refuse("CONFLICT", "INVITATION_ACCEPTED", "This invitation has been accepted: the account is in use.");
    if (row.status === "revoked") throw refuse("CONFLICT", "INVITATION_REVOKED", "This invitation was revoked. Invite the person again from their row in Users.");
    if (row.sent_age < RESEND_AFTER_S) throw refuse("TOO_MANY_REQUESTS", "RESENT_TOO_SOON", "This invitation was sent less than a minute ago. Wait a minute before sending it again.");
    if (row.send_count >= MAX_SENDS) throw refuse("FORBIDDEN", "RESEND_LIMIT", `This invitation has been sent ${MAX_SENDS} times, the most it may. Revoke it and invite the address again.`);
    const days = (await readRules(c)).inviteExpiryDays;
    const token = newToken();
    const r = await c.query<{ expires_at: Date }>(
      `UPDATE auth2_account_invitations SET token_hash = $2, sent_at = now(), send_count = send_count + 1, expires_at = now() + make_interval(days => $3) WHERE id = $1 RETURNING expires_at`,
      [row.id, hashOf(token), days]
    );
    await auditIn(c, { actor: actor.email, action: "platform.account_invitation_resent", summary: `Sent the account invitation for ${row.email} again (works ${days} days)`, detail: { invitationId: row.id, userId: row.user_id } });
    return { row, token, expiresAt: r.rows[0]!.expires_at, days };
  });
  return send(db, deps, { id: row.id, token, expiresAt, days }, { email: row.email, name: row.name }, actor.name || actor.email);
}

/** Ends a pending or expired invitation: its link stops working. The account stays, with no password. */
export async function revoke(db: Pool, invitationId: unknown, actor: string): Promise<void> {
  await inTx(db, async (c) => {
    const row = await openRow(c, invitationId);
    if (row.status === "accepted") throw refuse("CONFLICT", "INVITATION_ACCEPTED", "This invitation has been accepted: the account is in use.");
    if (row.status === "revoked") return;
    await c.query("UPDATE auth2_account_invitations SET revoked_at = now(), token_hash = NULL WHERE id = $1", [row.id]);
    await auditIn(c, { actor, action: "platform.account_invitation_revoked", summary: `Revoked the account invitation for ${row.email}`, detail: { invitationId: row.id, userId: row.user_id } });
  });
}

export type JoinView = { state: "open"; email: string; name: string } | { state: "expired" | "used" | "revoked" | "invalid" };

/** What an invitation link is for, shown on /auth/join before the password is chosen. */
export async function byToken(db: Pool, token: unknown): Promise<JoinView> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return { state: "invalid" };
  const r = await db.query<{ email: string; name: string; status: InvitationStatus }>(
    `SELECT i.email, u.name, ${STATUS_SQL} AS status FROM auth2_account_invitations i JOIN "user" u ON u.id = i.user_id WHERE i.token_hash = $1`,
    [hashOf(token)]
  );
  const x = r.rows[0];
  if (!x) return { state: "invalid" };
  if (x.status === "pending") return { state: "open", email: x.email, name: x.name };
  return { state: x.status === "accepted" ? "used" : x.status };
}

const notValid = () => refuse("NOT_FOUND", "INVITATION_INVALID", "This invitation link is not valid. It may have been used, revoked or sent again since. Ask for a new one.");

/**
 * Accepts an invitation: the token must be pending; the password must meet the rules. Sets it, confirms the address,
 * marks the invitation used, and answers the address so the caller can sign the person in. One accept wins.
 */
export async function accept(db: Pool, token: unknown, password: unknown): Promise<{ email: string }> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw notValid();
  const pre = await db.query<{ email: string; name: string }>(`SELECT i.email, u.name FROM auth2_account_invitations i JOIN "user" u ON u.id = i.user_id WHERE i.token_hash = $1`, [hashOf(token)]);
  const who = pre.rows[0];
  if (!who) throw notValid();
  const pw = await checkNewPassword(db, password, who);
  const hash = await hashPassword(pw);
  return inTx(db, async (c) => {
    const r = await c.query<{ id: string; user_id: string; email: string; status: InvitationStatus }>(
      `SELECT i.id, i.user_id, i.email, ${STATUS_SQL} AS status FROM auth2_account_invitations i WHERE i.token_hash = $1 FOR UPDATE`,
      [hashOf(token)]
    );
    const row = r.rows[0];
    if (!row || row.status === "accepted" || row.status === "revoked") throw notValid();
    if (row.status === "expired") throw refuse("NOT_FOUND", "INVITATION_EXPIRED", "This invitation has expired. Ask the administrator who invited you to send it again.");
    const has = await c.query(`SELECT 1 FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`, [row.user_id]);
    if (has.rowCount) await c.query(`UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = 'credential'`, [row.user_id, hash]);
    else await c.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [newId(), row.user_id, hash]);
    await c.query(`UPDATE "user" SET "emailVerified" = true, "mustChangePassword" = false, "updatedAt" = now() WHERE id = $1`, [row.user_id]);
    await c.query("UPDATE auth2_account_invitations SET accepted_at = now(), token_hash = NULL WHERE id = $1", [row.id]);
    await unlock(c, row.email);
    await auditIn(c, { actor: row.email, action: "account.invitation_accepted", summary: "Accepted the invitation to create an account and chose a password", detail: { invitationId: row.id } });
    return { email: row.email };
  });
}
