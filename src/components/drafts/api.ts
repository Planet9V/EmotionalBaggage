"use client";

// Query keys, fetchers and mutations for AI drafts, following the patterns in src/lib/queries.ts:
// one key per piece of data, the fetcher passes TanStack Query's signal on, and every write refreshes
// what depends on it (an approved draft changes the section's rows, the plan and the activity list).
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { keys as appKeys } from "@/lib/queries";
import type { Draft, GeneratorsReply, RunResult } from "@/lib/ai/drafts/shared";
import type { ImpactReply } from "@/lib/ai/drafts/impact";
import type { OptimiseState } from "@/lib/ai/drafts/service";
import type { Item } from "@/lib/types";

/** An API failure with its status and any detail the server sent (409 on a run carries `pending`). */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: { pending?: number }
  ) {
    super(message);
  }
}

/** Like api() in src/lib/http.ts, keeping the status and detail. A 401 sends the browser to sign in. */
export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers });
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: { pending?: number } };
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-in")) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- outside React, no router here
    window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.detail);
  return body as T;
}

const enc = encodeURIComponent;

export const draftKeys = {
  all: (projectId: string) => ["drafts", projectId] as const,
  list: (projectId: string, store: string | null, status: string) => ["drafts", projectId, "list", store ?? "*", status] as const,
  generators: (projectId: string, store: string | null) => ["drafts", projectId, "generators", store ?? "*"] as const,
  optimise: (projectId: string) => ["drafts", projectId, "optimise"] as const,
};

export type DraftList = { drafts: Draft[]; pending: Record<string, number> };

export const draftQueries = {
  list: (projectId: string, store: string | null, status: "draft" | "approved" | "rejected" | "all" = "draft") =>
    queryOptions({
      queryKey: draftKeys.list(projectId, store, status),
      queryFn: ({ signal }) => call<DraftList>(`/api/drafts?projectId=${enc(projectId)}&status=${status}${store ? `&store=${enc(store)}` : ""}`, { signal }),
      enabled: !!projectId,
    }),
  generators: (projectId: string, store: string | null) =>
    queryOptions({
      queryKey: draftKeys.generators(projectId, store),
      queryFn: ({ signal }) => call<GeneratorsReply>(`/api/drafts/generators?projectId=${enc(projectId)}&kind=section${store ? `&store=${enc(store)}` : ""}`, { signal }),
      enabled: !!projectId,
    }),
  optimise: (projectId: string) =>
    queryOptions({
      queryKey: draftKeys.optimise(projectId),
      queryFn: ({ signal }) => call<{ actions: OptimiseState[] }>(`/api/drafts/optimise?projectId=${enc(projectId)}`, { signal }).then((r) => r.actions),
      enabled: !!projectId,
    }),
};

/** After a draft is decided or a run saved: drafts, the concept's rows, the plan and the activity list. */
export function refreshAfterDecision(qc: QueryClient, projectId: string, itemsToo = true) {
  const keys = [draftKeys.all(projectId), appKeys.events(projectId), ...(itemsToo ? [appKeys.itemsOf(projectId), appKeys.plan(projectId)] : [])];
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

type Approved = { draft: Draft; item: Item | null };

/**
 * An approved press release or FAQ entry is put to the reviewer once, right after approval, through the
 * one reviewer route. It runs here, at the mutation, not in a component: the card that was approved is
 * gone from the screen by the time the approval answers. A failure is not an error of the approval;
 * the section's critique panel then offers "Attack it".
 */
function attackApproved(qc: QueryClient, projectId: string, approved: Approved[]) {
  for (const a of approved) {
    const message = ATTACK_MESSAGE[a.draft.targetStore];
    if (!message || !a.item) continue;
    void call("/api/challenge", { method: "POST", body: JSON.stringify({ projectId, itemId: a.item.id, message }) })
      .catch(() => undefined)
      .finally(() => {
        void qc.invalidateQueries({ queryKey: appKeys.challenge(projectId) });
        void qc.invalidateQueries({ queryKey: appKeys.events(projectId) });
      });
  }
}

export type RunInput = { generator: string; supersede?: boolean; reviseIds?: number[]; why?: string; critique?: string; signal?: AbortSignal };

export function useDraftActions(projectId: string) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: ({ signal, ...b }: RunInput) => call<RunResult>("/api/drafts/run", { method: "POST", body: JSON.stringify({ projectId, ...b }), signal }),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
  const approve = useMutation({
    mutationFn: (id: number) => call<{ draft: Draft; item: Item | null; before: Item | null }>(`/api/drafts/${id}/approve`, { method: "POST" }),
    onSuccess: (r) => attackApproved(qc, projectId, [r]),
    onSettled: () => refreshAfterDecision(qc, projectId),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => call<{ draft: Draft }>(`/api/drafts/${id}/reject`, { method: "POST", body: JSON.stringify({ reason: reason ?? "" }) }),
    // The card goes at once; a refusal brings it back with the server's sentence.
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: draftKeys.all(projectId) });
      const lists = qc.getQueriesData<DraftList>({ queryKey: draftKeys.all(projectId) });
      qc.setQueriesData<DraftList>({ queryKey: draftKeys.all(projectId) }, (l) => (l && Array.isArray(l.drafts) ? { ...l, drafts: l.drafts.filter((d) => d.id !== id || d.status !== "draft") } : l));
      return { lists };
    },
    onError: (_e, _v, ctx) => ctx?.lists.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
  const edit = useMutation({
    mutationFn: ({ id, ...change }: { id: number; title?: string; body?: string; data?: Record<string, unknown> }) =>
      call<{ draft: Draft }>(`/api/drafts/${id}`, { method: "PATCH", body: JSON.stringify(change) }),
    onSuccess: ({ draft }) => qc.setQueriesData<DraftList>({ queryKey: draftKeys.all(projectId) }, (l) => (l && Array.isArray(l.drafts) ? { ...l, drafts: l.drafts.map((d) => (d.id === draft.id ? draft : d)) } : l)),
  });
  const approveRun = useMutation({
    mutationFn: (runId: string) => call<{ approved: Approved[] }>("/api/drafts/approve-run", { method: "POST", body: JSON.stringify({ projectId, runId, confirm: true }) }),
    onSuccess: (r) => attackApproved(qc, projectId, r.approved),
    onSettled: () => refreshAfterDecision(qc, projectId),
  });
  return { run, approve, reject, edit, approveRun };
}

export function useImpact(projectId: string) {
  const qc = useQueryClient();
  const impact = useMutation({
    mutationFn: (itemId: number) => call<ImpactReply>("/api/drafts/impact", { method: "POST", body: JSON.stringify({ projectId, itemId }) }),
  });
  const propose = useMutation({
    mutationFn: (b: { itemId: number; groups: { generator: string; itemIds: number[] }[]; supersede?: boolean }) =>
      call<{ runs: RunResult[] }>("/api/drafts/impact/propose", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
  return { impact, propose };
}

export function useOptimise(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { action: string; supersede?: boolean }) => call<RunResult>("/api/drafts/optimise", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
}

/** The reviewer, through the one reviewer route. */
export function useChallengeRow(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { itemId: number; message: string }) => call<{ reply: string; itemId: number }>("/api/challenge", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: appKeys.challenge(projectId) }), qc.invalidateQueries({ queryKey: appKeys.events(projectId) })]),
  });
}

/** The words the reviewer is asked with when an approved press release or FAQ entry is attacked. */
export const ATTACK_MESSAGE: Record<string, string> = {
  "concept/press": "Attack this press release. What would a sceptical buyer, journalist or investor say is wrong with it?",
  "concept/faq": "Attack this FAQ answer. Is it straight, and what question does it dodge?",
};
