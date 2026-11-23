"use client";

/** Queries and changes for Admin, Workspaces (src/app/api/admin/workspaces). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import type { WorkspaceDetail, WorkspaceRow } from "@/lib/auth2/adminOps";

export type { WorkspaceRow, WorkspaceDetail };

export const useWorkspaces = (q: string) =>
  useQuery({ queryKey: ["admin", "workspaces", q.trim()], queryFn: ({ signal }) => api<{ workspaces: WorkspaceRow[] }>(`/api/admin/workspaces${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, { signal }).then((r) => r.workspaces) });

export const useWorkspace = (id: string) =>
  useQuery({ queryKey: ["admin", "workspaces", "one", id], queryFn: ({ signal }) => api<WorkspaceDetail>(`/api/admin/workspaces/${encodeURIComponent(id)}`, { signal }) });

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin", "workspaces"] });
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };
}

export function useCreateWorkspace() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (w: { name: string; ownerUserId: string }) => api<{ id: string }>("/api/admin/workspaces", { method: "POST", body: JSON.stringify(w) }), onSuccess: refresh });
}

export type WorkspaceAction =
  | { action: "rename"; name: string }
  | { action: "add"; userId: string; role: "owner" | "admin" | "member" }
  | { action: "role"; memberId: string; role: "owner" | "admin" | "member" }
  | { action: "remove"; memberId: string }
  | { action: "transfer"; memberId: string }
  | { action: "two-factor"; on: boolean }
  | { action: "delete"; confirmName: string };

export function useWorkspaceAction(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (change: WorkspaceAction) => api<{ ok: true }>(`/api/admin/workspaces/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(change) }), onSuccess: refresh });
}
