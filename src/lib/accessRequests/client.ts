"use client";

/**
 * Query keys and hooks for access requests: the public form on /welcome and the Admin tab. Same pattern as
 * src/lib/admin/client.ts: reads through TanStack Query, a status change is optimistic and rolls back when the
 * server refuses it.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/http";
import { downloadFile } from "@/lib/download";
import type { AccessRequestRow, AccessRequestValues, AccessStatus } from "./shared";

const key = () => ["admin", "access-requests"] as const;

const accessRequestsQuery = () =>
  queryOptions({
    queryKey: key(),
    queryFn: ({ signal }) => api<{ requests: AccessRequestRow[] }>("/api/admin/access-requests", { signal }).then((r) => r.requests),
    // a refusal (the demo password is still in use) is an answer, not a network blip: do not retry it
    retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
  });

export function useAccessRequests() {
  return useQuery(accessRequestsQuery());
}

/** Sets one request's status. The row changes at once; a refused change puts it back and rejects. */
export function useSetAccessStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: AccessStatus }) =>
      api<{ request: AccessRequestRow }>(`/api/admin/access-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).then((r) => r.request),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key() });
      const before = qc.getQueryData<AccessRequestRow[]>(key());
      qc.setQueryData<AccessRequestRow[]>(key(), (list) => list?.map((r) => (r.id === id ? { ...r, status } : r)));
      return { before };
    },
    onError: (_e, _v, c) => qc.setQueryData(key(), c?.before),
    onSuccess: (row) => qc.setQueryData<AccessRequestRow[]>(key(), (list) => list?.map((r) => (r.id === row.id ? row : r))),
  });
}

/** Deletes one request. It leaves the list when the server has deleted it. */
export function useDeleteAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/api/admin/access-requests/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => qc.setQueryData<AccessRequestRow[]>(key(), (list) => list?.filter((r) => r.id !== id)),
  });
}

/** Downloads every request as CSV through the server (which records the copy). Answers the file name. */
export async function downloadAccessRequests(): Promise<string> {
  const res = await fetch("/api/admin/access-requests/export");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? `The download failed (${res.status}).`, res.status);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "access-requests.csv";
  downloadFile(name, await res.blob(), "text/csv");
  return name;
}

/** Sends the public form. Answers the server's confirmation sentence. */
export function useSendAccessRequest() {
  return useMutation({
    mutationFn: (v: AccessRequestValues) => api<{ ok: true; message: string }>("/api/access-requests", { method: "POST", body: JSON.stringify(v) }).then((r) => r.message),
  });
}
