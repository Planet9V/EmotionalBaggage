/**
 * What the members screen shows (accounts slice 2, step 3), read by the screen itself and by the
 * /workspace/members endpoint. Every member may see who is in the workspace and their roles; only owners and admins
 * see each member's two-factor state, the requirements, and the invitations waiting (./permissions.ts, "see-admin").
 */
import type { Pool } from "pg";
import { pendingInvitations, type Pending } from "./invitations";
import { asRole, manages, may, type Role } from "./permissions";
import { policyOf } from "./twoFactor";
import type { Membership } from "./store";

type MemberRow = {
  memberId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  you: boolean;
  /** Owners and admins only: */
  twoFactor?: boolean;
  required?: boolean;
  manageable?: boolean;
};

export type MembersView = {
  workspace: { id: string; name: string; role: Role };
  members: MemberRow[];
  admin?: { twoFactorRequired: boolean; invitations: (Omit<Pending, "expiresAt" | "sentAt"> & { expiresAt: string; sentAt: string | null })[] };
};

export async function membersView(db: Pool, viewer: { id: string }, m: Membership): Promise<MembersView> {
  const admin = may(m.role, "see-admin");
  const r = await db.query<{ id: string; userId: string; name: string; email: string; role: string; createdAt: Date; tf: boolean | null; flagged: boolean | null }>(
    `SELECT mm.id, mm."userId", u.name, u.email, mm.role, mm."createdAt", u."twoFactorEnabled" AS tf, f.two_factor_required AS flagged
       FROM member mm JOIN "user" u ON u.id = mm."userId" LEFT JOIN auth2_member_flags f ON f.member_id = mm.id
      WHERE mm."organizationId" = $1 ORDER BY mm."createdAt", mm.id`,
    [m.workspaceId]
  );
  const members = r.rows.map((x): MemberRow => {
    const role = asRole(x.role);
    const row: MemberRow = { memberId: x.id, name: x.name, email: x.email, role, joinedAt: new Date(x.createdAt).toISOString(), you: x.userId === viewer.id };
    if (admin) Object.assign(row, { twoFactor: x.tf === true, required: x.flagged === true, manageable: manages(m.role, role) && x.userId !== viewer.id });
    return row;
  });
  const view: MembersView = { workspace: { id: m.workspaceId, name: m.name, role: m.role }, members };
  if (admin) {
    const pending = await pendingInvitations(db, m.workspaceId);
    view.admin = {
      twoFactorRequired: await policyOf(db, m.workspaceId),
      invitations: pending.map((p) => ({ ...p, expiresAt: p.expiresAt.toISOString(), sentAt: p.sentAt ? p.sentAt.toISOString() : null })),
    };
  }
  return view;
}
