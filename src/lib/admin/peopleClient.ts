"use client";

/**
 * Queries and changes for Admin, Users and Workspaces (src/app/api/admin/users, invitations, workspaces). Passwords
 * typed here (a temporary password, the administrator's own for a step-up) go in a POST body and nowhere else:
 * never a query key, the cache or a URL.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import type { UserFilter, UserPage } from "@/lib/auth2/adminOps";
import type { AccountInvitation, InvitationStatus } from "@/lib/auth2/accountInvitations";

export type { UserFilter, UserPage, AccountInvitation, InvitationStatus };
export type { UserState } from "@/lib/auth2/adminOps";

const keys = {
  users: (f: UserFilter) => ["admin", "users", f.q ?? "", f.role ?? "", f.state ?? "", f.page ?? 1] as const,
  invitations: (s?: InvitationStatus) => ["admin", "invitations", s ?? ""] as const,
};

function usersQuery(f: UserFilter): string {
  const p = new URLSearchParams();
  if (f.q?.trim()) p.set("q", f.q.trim());
  if (f.role) p.set("role", f.role);
  if (f.state) p.set("state", f.state);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const useUsers = (f: UserFilter) =>
  useQuery({ queryKey: keys.users(f), queryFn: ({ signal }) => api<UserPage & { me: string }>(`/api/admin/users${usersQuery(f)}`, { signal }), placeholderData: keepPreviousData });

export const useAccountInvitations = (status?: InvitationStatus) =>
  useQuery({ queryKey: keys.invitations(status), queryFn: ({ signal }) => api<{ invitations: AccountInvitation[] }>(`/api/admin/invitations${status ? `?status=${status}` : ""}`, { signal }).then((r) => r.invitations) });

/** What a change can answer: a link to hand over (no mail), a one-time code, a count, or whether mail went. */
export type ChangeAnswer = { ok: true; link?: string; mailed?: boolean; code?: string; ended?: number; sent?: boolean; confirmationSent?: boolean; expiresAt?: string };

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    void qc.invalidateQueries({ queryKey: ["admin", "invitations"] });
    void qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
  };
}

export type CreateUser = { name: string; email: string; platformAdmin?: boolean; how: "invite" | "password"; password?: string; markVerified?: boolean; stepUp?: string };

export function useCreateUser() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (u: CreateUser) => api<{ id: string; invitation?: ChangeAnswer & { invitationId: string } }>("/api/admin/users", { method: "POST", body: JSON.stringify(u) }),
    onSuccess: refresh,
  });
}

export type UserAction =
  | { action: "rename"; name: string; stepUp?: string }
  | { action: "email"; email: string; markVerified?: boolean; stepUp?: string }
  | { action: "confirm"; stepUp?: string }
  | { action: "admin"; on: boolean; stepUp?: string }
  | { action: "disabled"; on: boolean; stepUp?: string }
  | { action: "unlock"; stepUp?: string }
  | { action: "password"; password: string; stepUp?: string }
  | { action: "reset-link"; stepUp?: string }
  | { action: "two-factor-required"; on: boolean; stepUp?: string }
  | { action: "two-factor-reset"; stepUp?: string }
  | { action: "two-factor-off"; stepUp?: string }
  | { action: "end-sessions"; stepUp?: string }
  | { action: "invite-again"; stepUp?: string };

export function useUserAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: UserAction }) => api<ChangeAnswer>(`/api/admin/users/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(change) }),
    onSuccess: refresh,
  });
}

export function useDeleteUser() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, ...rest }: { id: string; confirmEmail: string; deleteWorkspaces?: boolean; transfer?: Record<string, string>; stepUp?: string }) =>
      api<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify(rest) }),
    onSuccess: refresh,
  });
}

export function useInvitationAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "resend" | "revoke" }) => api<ChangeAnswer>(`/api/admin/invitations/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ action }) }),
    onSuccess: refresh,
  });
}
