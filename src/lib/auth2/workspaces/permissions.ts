/**
 * Who may do what in a workspace (accounts slice 2). One table, read by the server before every change and by the
 * screens to decide which buttons to show; the server never trusts the screen. Browser-safe: no server import.
 *
 * Roles: owner, admin, member. Every workspace has at least one owner at all times (the store refuses the change
 * that would leave none). An admin is the role that may add and invite people (owner's ruling).
 *
 * | Action                                         | owner          | admin                          | member |
 * |------------------------------------------------|----------------|--------------------------------|--------|
 * | See the members and their roles                | yes            | yes                            | yes    |
 * | See pending invitations, two-factor state      | yes            | yes                            | no     |
 * | Invite (as member or admin)                    | yes            | yes                            | no     |
 * | Invite as owner                                | yes            | no                             | no     |
 * | Resend or revoke an invitation                 | yes            | yes (not one inviting an owner)| no     |
 * | Change a role                                  | anyone's, to any role | admins and members, to admin or member | no |
 * | Remove a member                                | anyone         | admins and members             | no     |
 * | Require two-factor for the whole workspace     | yes            | yes                            | no     |
 * | Require two-factor for one member              | anyone         | admins and members             | no     |
 * | Reset a member's two-factor (lost phone)       | anyone else    | other admins and members       | no     |
 * | Rename the workspace                           | yes            | yes                            | no     |
 * | Delete the workspace                           | yes            | no                             | no     |
 * | Leave the workspace                            | yes            | yes                            | yes    |
 *
 * Limits that apply whoever acts: the last owner cannot be removed, demoted or leave; nobody can leave or delete
 * their only workspace; a person owns at most MAX_OWNED_WORKSPACES workspaces; a workspace holds at most
 * MAX_SEATS people, counting pending invitations.
 */
const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const MAX_OWNED_WORKSPACES = 5;
export const MAX_SEATS = 50;
/** Invitations one workspace may make in an hour: each sends an email. */
export const INVITATIONS_PER_HOUR = 20;
/** How often one invitation may be sent again. */
export const MAX_SENDS = 5;

/** A stored role as one of the three. Better Auth stores roles as a comma list; the highest known one counts, and
 *  anything unknown is a plain member (fails closed). */
export function asRole(raw: unknown): Role {
  const parts = typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : [];
  if (parts.includes("owner")) return "owner";
  if (parts.includes("admin")) return "admin";
  return "member";
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** Actions that depend only on the actor's role. */
type Plain = "see-admin" | "invite" | "set-policy" | "rename" | "delete";
const PLAIN: Record<Plain, readonly Role[]> = {
  "see-admin": ["owner", "admin"],
  invite: ["owner", "admin"],
  "set-policy": ["owner", "admin"],
  rename: ["owner", "admin"],
  delete: ["owner"],
};

export const may = (actor: Role, action: Plain) => PLAIN[action].includes(actor);

/** Whether `actor` may manage a member whose role is `target` (change role, remove, two-factor). */
export const manages = (actor: Role, target: Role) => actor === "owner" || (actor === "admin" && target !== "owner");

/** Whether `actor` may give someone the role `role` (by invitation or by a change of role). */
export const mayGrant = (actor: Role, role: Role) => actor === "owner" || (actor === "admin" && role !== "owner");
