/**
 * Invitations to a workspace (accounts slice 2, step 2).
 *
 * The link in an invitation carries a random token of 32 bytes. Only its SHA-256 is stored
 * (auth2_invitation_tokens), so a copy of the database holds no link that works. A token works once, until the
 * invitation expires (48 hours, as the email says), and only for the account with the invited address once that
 * address is confirmed. Sending it again makes a new token: the old link stops working. Revoking ends it.
 *
 * Mail goes through currentMailSender() (../mail.ts). In "no mail" mode, or when sending fails, the link is
 * handed back to the owner or admin who made the invitation, to pass on themselves; that is the only time it is
 * ever shown, and it is never logged.
 *
 * Limits, each a refusal with its own sentence: an address already a member or already invited; MAX_SEATS people
 * per workspace counting pending invitations; INVITATIONS_PER_HOUR new invitations per workspace; one resend per
 * minute and MAX_SENDS sends per invitation. The route's throttle (../auth.ts) counts per network address on top.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { auditIn } from "@/lib/db";
import { render, type MailSender } from "../mail";
import { INVITATIONS_PER_HOUR, MAX_SEATS, MAX_SENDS, asRole, mayGrant, type Role } from "./permissions";
import { inTx, lockWorkspace, newId, refuse, type Membership } from "./store";

const INVITATION_HOURS = 48;
const RESEND_AFTER_S = 60;

const hashOf = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");
const newToken = () => randomBytes(32).toString("base64url");

export type Sent = { invitationId: string; email: string; role: Role; mailed: boolean; link?: string };
type Deps = { mailer: () => Promise<MailSender | null>; link: (path: string, token: string) => string };
type Actor = { id: string; email: string; name: string };

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
function cleanEmail(raw: unknown): string {
  const e = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!e || e.length > 254 || !EMAIL.test(e)) throw refuse("BAD_REQUEST", "INVALID_EMAIL", "Enter a whole email address, such as name@example.com.");
  return e;
}

/** Sends the invitation, or hands its link back when there is no mail service or sending failed. */
async function deliver(deps: Deps, to: string, token: string, workspace: string, inviter: string): Promise<{ mailed: boolean; link?: string }> {
  const link = deps.link("/invite", token);
  const sender = await deps.mailer();
  if (!sender) return { mailed: false, link };
  try {
    await sender.send(render({ kind: "invitation", to, link, workspace, inviter }));
    return { mailed: true };
  } catch (e) {
    console.error(`[auth2] an invitation email could not be sent: ${(e as Error).message}`);
    return { mailed: false, link };
  }
}

const PENDING = `i.status = 'pending' AND i."expiresAt" > now()`;

/** Invites an address to a workspace with a role, after checking the actor may give that role. */
export async function invite(db: Pool, deps: Deps, actor: Actor, m: Membership, rawEmail: unknown, rawRole: unknown): Promise<Sent> {
  const email = cleanEmail(rawEmail);
  const role = asRoleStrict(rawRole);
  if (!mayGrant(m.role, role) || m.role === "member") throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
  const token = newToken();
  const { id, name } = await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const member = await c.query(`SELECT 1 FROM member mm JOIN "user" u ON u.id = mm."userId" WHERE mm."organizationId" = $1 AND lower(u.email) = $2`, [m.workspaceId, email]);
    if (member.rowCount) throw refuse("CONFLICT", "ALREADY_MEMBER", "That person is a member of this workspace already.");
    const pending = await c.query(`SELECT 1 FROM invitation i WHERE i."organizationId" = $1 AND lower(i.email) = $2 AND ${PENDING}`, [m.workspaceId, email]);
    if (pending.rowCount) throw refuse("CONFLICT", "ALREADY_INVITED", "That address has an invitation waiting already. Send it again from the list of invitations.");
    const seats = await c.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM member WHERE "organizationId" = $1) + (SELECT count(*) FROM invitation i WHERE i."organizationId" = $1 AND ${PENDING}) AS n`,
      [m.workspaceId]
    );
    if (Number(seats.rows[0].n) >= MAX_SEATS) throw refuse("FORBIDDEN", "SEAT_LIMIT", `A workspace holds at most ${MAX_SEATS} people, counting invitations not yet accepted.`);
    const recent = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM invitation WHERE "organizationId" = $1 AND "createdAt" > now() - interval '1 hour'`, [m.workspaceId]);
    if (recent.rows[0].n >= INVITATIONS_PER_HOUR) throw refuse("TOO_MANY_REQUESTS", "TOO_MANY_INVITATIONS", `This workspace has sent ${INVITATIONS_PER_HOUR} invitations in the last hour, the most it may. Try again later.`);
    const id = newId();
    await c.query(
      `INSERT INTO invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") VALUES ($1, $2, $3, $4, 'pending', now() + make_interval(hours => $5), now(), $6)`,
      [id, m.workspaceId, email, role, INVITATION_HOURS, actor.id]
    );
    await c.query("INSERT INTO auth2_invitation_tokens (invitation_id, token_hash) VALUES ($1, $2)", [id, hashOf(token)]);
    await auditIn(c, { actor: actor.email, action: "workspace.invited", summary: `Invited ${email} to "${name}" as ${role}`, detail: { workspaceId: m.workspaceId, invitationId: id, role } });
    return { id, name };
  });
  const d = await deliver(deps, email, token, name, actor.name || actor.email);
  return { invitationId: id, email, role, ...d };
}

function asRoleStrict(raw: unknown): Role {
  if (raw !== "owner" && raw !== "admin" && raw !== "member") throw refuse("BAD_REQUEST", "INVALID_ROLE", "Choose owner, admin or member.");
  return raw;
}

type Row = { id: string; email: string; role: string | null; status: string; expiresAt: Date; organizationId: string };

/** A pending invitation of this workspace by id, locked, or not found. */
async function pendingOf(c: PoolClient, workspaceId: string, invitationId: unknown): Promise<Row> {
  if (typeof invitationId !== "string" || !invitationId || invitationId.length > 100) throw refuse("NOT_FOUND", "INVITATION_NOT_FOUND", "That invitation was not found.");
  const r = await c.query<Row>(`SELECT id, email, role, status, "expiresAt", "organizationId" FROM invitation WHERE id = $1 AND "organizationId" = $2 FOR UPDATE`, [invitationId, workspaceId]);
  const row = r.rows[0];
  if (!row || row.status !== "pending") throw refuse("NOT_FOUND", "INVITATION_NOT_FOUND", "That invitation was not found.");
  return row;
}

/** Sends an invitation again with a new link (the old one stops working) and a fresh 48 hours. */
export async function resend(db: Pool, deps: Deps, actor: Actor, m: Membership, invitationId: unknown): Promise<Sent> {
  const token = newToken();
  const { row, name } = await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const row = await pendingOf(c, m.workspaceId, invitationId);
    if (m.role === "member" || !mayGrant(m.role, asRole(row.role))) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    const t = await c.query<{ age: number; send_count: number }>("SELECT extract(epoch FROM now() - sent_at)::int AS age, send_count FROM auth2_invitation_tokens WHERE invitation_id = $1", [row.id]);
    const tok = t.rows[0];
    if (tok && tok.age < RESEND_AFTER_S) throw refuse("TOO_MANY_REQUESTS", "RESENT_TOO_SOON", "This invitation was sent less than a minute ago. Wait a minute before sending it again.");
    if (tok && tok.send_count >= MAX_SENDS) throw refuse("FORBIDDEN", "RESEND_LIMIT", `This invitation has been sent ${MAX_SENDS} times, the most it may. Revoke it and invite the address again.`);
    await c.query(
      `INSERT INTO auth2_invitation_tokens (invitation_id, token_hash) VALUES ($1, $2)
       ON CONFLICT (invitation_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, sent_at = now(), send_count = auth2_invitation_tokens.send_count + 1, used_at = NULL`,
      [row.id, hashOf(token)]
    );
    await c.query(`UPDATE invitation SET "expiresAt" = now() + make_interval(hours => $2) WHERE id = $1`, [row.id, INVITATION_HOURS]);
    await auditIn(c, { actor: actor.email, action: "workspace.invitation_resent", summary: `Sent the invitation for ${row.email} to "${name}" again`, detail: { workspaceId: m.workspaceId, invitationId: row.id } });
    return { row, name };
  });
  const d = await deliver(deps, row.email, token, name, actor.name || actor.email);
  return { invitationId: row.id, email: row.email, role: asRole(row.role), ...d };
}

/** Ends an invitation: its link stops working at once. */
export async function revoke(db: Pool, actor: Actor, m: Membership, invitationId: unknown) {
  await inTx(db, async (c) => {
    const name = await lockWorkspace(c, m.workspaceId);
    const row = await pendingOf(c, m.workspaceId, invitationId);
    if (m.role === "member" || !mayGrant(m.role, asRole(row.role))) throw refuse("FORBIDDEN", "NOT_ALLOWED", "Your role in this workspace does not allow this change.");
    await c.query("UPDATE invitation SET status = 'canceled' WHERE id = $1", [row.id]);
    await c.query("DELETE FROM auth2_invitation_tokens WHERE invitation_id = $1", [row.id]);
    await auditIn(c, { actor: actor.email, action: "workspace.invitation_revoked", summary: `Revoked the invitation for ${row.email} to "${name}"`, detail: { workspaceId: m.workspaceId, invitationId: row.id } });
  });
}

export type Pending = { id: string; email: string; role: Role; expiresAt: Date; invitedBy: string; sentAt: Date | null; sends: number };

/** The workspace's invitations not yet accepted, revoked or expired, newest first. */
export async function pendingInvitations(db: Pool, workspaceId: string): Promise<Pending[]> {
  const r = await db.query<{ id: string; email: string; role: string | null; expiresAt: Date; invitedBy: string; sent_at: Date | null; send_count: number | null }>(
    `SELECT i.id, i.email, i.role, i."expiresAt", u.name AS "invitedBy", t.sent_at, t.send_count
       FROM invitation i JOIN "user" u ON u.id = i."inviterId" LEFT JOIN auth2_invitation_tokens t ON t.invitation_id = i.id
      WHERE i."organizationId" = $1 AND ${PENDING} ORDER BY i."createdAt" DESC`,
    [workspaceId]
  );
  return r.rows.map((x) => ({ id: x.id, email: x.email, role: asRole(x.role), expiresAt: x.expiresAt, invitedBy: x.invitedBy, sentAt: x.sent_at, sends: x.send_count ?? 0 }));
}

export type Invitation = { workspace: string; inviter: string; email: string; role: Role; state: "open" | "used" | "expired" };

const NOT_VALID = () => refuse("NOT_FOUND", "INVITATION_INVALID", "This invitation link is not valid. It may have been used, revoked or sent again since. Ask for a new one.");

/** What an invitation link is for, shown on the invitation page before accepting. Anything wrong is one answer. */
export async function invitationByToken(db: Pool, token: unknown): Promise<Invitation> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw NOT_VALID();
  const r = await db.query<{ workspace: string; inviter: string; email: string; role: string | null; status: string; expired: boolean; used: boolean }>(
    `SELECT o.name AS workspace, u.name AS inviter, i.email, i.role, i.status, i."expiresAt" <= now() AS expired, t.used_at IS NOT NULL AS used
       FROM auth2_invitation_tokens t JOIN invitation i ON i.id = t.invitation_id JOIN organization o ON o.id = i."organizationId" JOIN "user" u ON u.id = i."inviterId"
      WHERE t.token_hash = $1`,
    [hashOf(token)]
  );
  const x = r.rows[0];
  if (!x || (x.status !== "pending" && x.status !== "accepted")) throw NOT_VALID();
  return { workspace: x.workspace, inviter: x.inviter, email: x.email, role: asRole(x.role), state: x.used || x.status === "accepted" ? "used" : x.expired ? "expired" : "open" };
}

/**
 * Accepts an invitation for the signed-in account: the token must be unused and unexpired, the account's address
 * the invited one, and confirmed. The session moves into the workspace. Two tabs accepting at once join once.
 */
export async function accept(db: Pool, user: { id: string; email: string; emailVerified: boolean }, sessionId: string, token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw NOT_VALID();
  return inTx(db, async (c) => {
    const r = await c.query<Row & { used_at: Date | null; workspace: string }>(
      `SELECT i.id, i.email, i.role, i.status, i."expiresAt", i."organizationId", t.used_at, o.name AS workspace
         FROM auth2_invitation_tokens t JOIN invitation i ON i.id = t.invitation_id JOIN organization o ON o.id = i."organizationId"
        WHERE t.token_hash = $1 FOR UPDATE OF t, i`,
      [hashOf(token)]
    );
    const row = r.rows[0];
    if (!row || row.used_at || row.status !== "pending") throw NOT_VALID();
    if (new Date(row.expiresAt).getTime() <= Date.now()) throw refuse("NOT_FOUND", "INVITATION_EXPIRED", "This invitation has expired. Ask whoever invited you to send it again.");
    if (row.email.toLowerCase() !== user.email.toLowerCase()) {
      throw refuse("FORBIDDEN", "INVITATION_OTHER_ADDRESS", "This invitation is for another email address. Sign out, then sign in or create an account with the address it was sent to.");
    }
    if (!user.emailVerified) throw refuse("FORBIDDEN", "EMAIL_NOT_VERIFIED", "Confirm your email address first: follow the link in the email we sent you.");
    const role = asRole(row.role);
    const already = await c.query('SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2', [row.organizationId, user.id]);
    if (!already.rowCount) {
      await c.query(`INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, now())`, [newId(), row.organizationId, user.id, role]);
    }
    await c.query("UPDATE invitation SET status = 'accepted' WHERE id = $1", [row.id]);
    await c.query("UPDATE auth2_invitation_tokens SET used_at = now() WHERE invitation_id = $1", [row.id]);
    await c.query('UPDATE "session" SET "activeOrganizationId" = $2 WHERE id = $1', [sessionId, row.organizationId]);
    await auditIn(c, { actor: user.email, action: "workspace.joined", summary: `Accepted the invitation to "${row.workspace}" as ${role}`, detail: { workspaceId: row.organizationId, invitationId: row.id, role } });
    return { workspaceId: row.organizationId, name: row.workspace, role };
  });
}
