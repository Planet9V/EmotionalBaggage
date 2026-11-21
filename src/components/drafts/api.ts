"use client";

// Query keys, fetchers and mutations for AI drafts, following the patterns in src/lib/queries.ts:
// one key per piece of data, the fetcher passes TanStack Query's signal on, and every write refreshes
// what depends on it (an approved draft changes the section's rows, the plan and the activity list).
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { keys as appKeys } from "@/lib/queries";
import { ATTACK_MESSAGE, type Draft, type GeneratorsReply, type RunResult } from "@/lib/ai/drafts/shared";
import type { ImpactReply } from "@/lib/ai/drafts/impact";
import type { OptimiseState } from "@/lib/ai/drafts/service";
import type { Item } from "@/lib/types";
import { api } from "@/lib/http";

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
      queryFn: ({ signal }) => api<DraftList>(`/api/drafts?projectId=${enc(projectId)}&status=${status}${store ? `&store=${enc(store)}` : ""}`, { signal }),
      enabled: !!projectId,
    }),
  generators: (projectId: string, store: string | null) =>
    queryOptions({
      queryKey: draftKeys.generators(projectId, store),
      queryFn: ({ signal }) => api<GeneratorsReply>(`/api/drafts/generators?projectId=${enc(projectId)}&kind=section${store ? `&store=${enc(store)}` : ""}`, { signal }),
      enabled: !!projectId,
    }),
  /** The link-drafting generator (Traceability), which no section's Draft with AI button lists. */
  links: (projectId: string) =>
    queryOptions({
      queryKey: [...draftKeys.generators(projectId, "links")],
      queryFn: ({ signal }) => api<GeneratorsReply>(`/api/drafts/generators?projectId=${enc(projectId)}&kind=links`, { signal }),
      enabled: !!projectId,
    }),
  optimise: (projectId: string) =>
    queryOptions({
      queryKey: draftKeys.optimise(projectId),
      queryFn: ({ signal }) => api<{ actions: OptimiseState[] }>(`/api/drafts/optimise?projectId=${enc(projectId)}`, { signal }).then((r) => r.actions),
      enabled: !!projectId,
    }),
};

/** After a draft is decided or a run saved: drafts, the concept's rows, the plan and the activity list. */
function refreshAfterDecision(qc: QueryClient, projectId: string, itemsToo = true) {
  const keys = [draftKeys.all(projectId), appKeys.events(projectId), ...(itemsToo ? [appKeys.itemsOf(projectId), appKeys.plan(projectId)] : [])];
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

type Approved = { draft: Draft; item: Item | null };

/**
 * An approved press release or FAQ entry is attacked once by the reviewer on the server, after the
 * approval answers (src/lib/ai/drafts/attack.ts), so leaving the page loses nothing. Here the screen
 * only refreshes what will show it: the row (its data.attack) and the reviewer's thread.
 */
function attackApproved(qc: QueryClient, projectId: string, approved: Approved[]) {
  if (!approved.some((a) => a.item && a.draft.targetStore in ATTACK_MESSAGE)) return;
  void qc.invalidateQueries({ queryKey: appKeys.challenge(projectId) });
  void qc.invalidateQueries({ queryKey: appKeys.itemsOf(projectId) });
}

export type RunInput = { generator: string; supersede?: boolean; reviseIds?: number[]; why?: string; critique?: string; signal?: AbortSignal };

export function useDraftActions(projectId: string) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: ({ signal, ...b }: RunInput) => api<RunResult>("/api/drafts/run", { method: "POST", body: JSON.stringify({ projectId, ...b }), signal }),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
  const approve = useMutation({
    mutationFn: (id: number) => api<{ draft: Draft; item: Item | null; before: Item | null }>(`/api/drafts/${id}/approve`, { method: "POST" }),
    onSuccess: (r) => attackApproved(qc, projectId, [r]),
    onSettled: () => refreshAfterDecision(qc, projectId),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => api<{ draft: Draft }>(`/api/drafts/${id}/reject`, { method: "POST", body: JSON.stringify({ reason: reason ?? "" }) }),
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
      api<{ draft: Draft }>(`/api/drafts/${id}`, { method: "PATCH", body: JSON.stringify(change) }),
    onSuccess: ({ draft }) => qc.setQueriesData<DraftList>({ queryKey: draftKeys.all(projectId) }, (l) => (l && Array.isArray(l.drafts) ? { ...l, drafts: l.drafts.map((d) => (d.id === draft.id ? draft : d)) } : l)),
  });
  const approveRun = useMutation({
    mutationFn: (runId: string) => api<{ approved: Approved[] }>("/api/drafts/approve-run", { method: "POST", body: JSON.stringify({ projectId, runId, confirm: true }) }),
    onSuccess: (r) => attackApproved(qc, projectId, r.approved),
    onSettled: () => refreshAfterDecision(qc, projectId),
  });
  return { run, approve, reject, edit, approveRun };
}

export function useImpact(projectId: string) {
  const qc = useQueryClient();
  const impact = useMutation({
    mutationFn: (itemId: number) => api<ImpactReply>("/api/drafts/impact", { method: "POST", body: JSON.stringify({ projectId, itemId }) }),
  });
  const propose = useMutation({
    mutationFn: (b: { itemId: number; groups: { generator: string; itemIds: number[] }[]; supersede?: boolean }) =>
      api<{ runs: RunResult[] }>("/api/drafts/impact/propose", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
  return { impact, propose };
}

export function useOptimise(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { action: string; supersede?: boolean }) => api<RunResult>("/api/drafts/optimise", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => refreshAfterDecision(qc, projectId, false),
  });
}

/** The reviewer, through the one reviewer route. */
export function useChallengeRow(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { itemId: number; message: string }) => api<{ reply: string; itemId: number }>("/api/challenge", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: appKeys.challenge(projectId) }), qc.invalidateQueries({ queryKey: appKeys.events(projectId) })]),
  });
}

/** "Attack it" when the attack after approval did not happen: the server attacks the row once, never twice. */
export function useAttackRow(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { itemId: number }) => api<{ ran: boolean; reason: string }>("/api/drafts/attack", { method: "POST", body: JSON.stringify({ projectId, ...b }) }),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: appKeys.challenge(projectId) }), qc.invalidateQueries({ queryKey: appKeys.events(projectId) }), qc.invalidateQueries({ queryKey: appKeys.itemsOf(projectId) })]),
  });
}

/** Moved to the server's shared shapes, where the attack after approval now runs. */
