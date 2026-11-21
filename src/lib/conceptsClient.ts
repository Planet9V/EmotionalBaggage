"use client";

/**
 * Concepts in the browser: the full list (active and archived) and every change to a concept,
 * as TanStack Query mutations. Each mutation updates the cached lists at once and then refreshes
 * every query under `keys.concepts()`, so the sidebar, the Concepts page and any other screen
 * that lists concepts agree without a reload.
 *
 * Query keys: the sidebar's active list is `["projects"]` (src/lib/queries.ts); the full list
 * here is `["projects", "all"]` and one concept is `["projects", "one", id]`. Both start with
 * `keys.concepts()`, so invalidating that prefix refreshes all three.
 */
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./http";
import { keys } from "./queries";
import type { Project } from "./types";

/** A concept as /api/projects returns it (src/lib/api/concepts.ts, toConcept). Dates arrive as ISO strings. */
export type Concept = {
  id: string;
  name: string;
  oneLiner: string;
  productType: string;
  stage: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  rowCount: number;
  rowsByStage: Record<string, number>;
};

export type ConceptChange = Partial<Pick<Concept, "name" | "oneLiner" | "productType" | "stage">>;
export type NewConcept = { name: string; oneLiner?: string; productType?: string; items?: unknown[] };
export type DeletedConcept = { concept: string; name: string; items: number; files: number; events: number; messages: number; research: number; gates: number; defaultCleared: boolean };

const enc = encodeURIComponent;

const conceptKeys = {
  all: () => [...keys.concepts(), "all"] as const,
  one: (id: string) => [...keys.concepts(), "one", id] as const,
};

export const conceptQueries = {
  /** Every concept, archived ones included. */
  all: () =>
    queryOptions({
      queryKey: conceptKeys.all(),
      queryFn: ({ signal }) => api<{ projects: Concept[] }>("/api/projects?archived=all", { signal }).then((r) => r.projects),
    }),
  one: (id: string) =>
    queryOptions({
      queryKey: conceptKeys.one(id),
      queryFn: ({ signal }) => api<{ project: Concept }>(`/api/projects/${enc(id)}`, { signal }).then((r) => r.project),
    }),
};

/** The address of the JSON export of one concept (a download). */
export const exportHref = (id: string) => `/api/projects/${enc(id)}/export`;

/** When a concept last changed: its latest event or its own last edit, whichever is later. */
export function lastChanged(c: Pick<Concept, "updatedAt" | "lastActivityAt">): string {
  const a = Date.parse(c.updatedAt);
  const b = c.lastActivityAt ? Date.parse(c.lastActivityAt) : NaN;
  return !Number.isNaN(b) && (Number.isNaN(a) || b > a) ? (c.lastActivityAt as string) : c.updatedAt;
}

/** Put one concept into both cached lists (replacing it if present), or take it out with `null`. */
function writeCached(qc: QueryClient, id: string, next: Concept | null) {
  qc.setQueryData<Concept[]>(conceptKeys.all(), (xs) => {
    if (!xs) return xs;
    if (!next) return xs.filter((x) => x.id !== id);
    return xs.some((x) => x.id === id) ? xs.map((x) => (x.id === id ? next : x)) : [...xs, next];
  });
  // The sidebar's list holds active concepts only.
  qc.setQueryData<Project[]>(keys.concepts(), (xs) => {
    if (!xs) return xs;
    const active = next && !next.archivedAt;
    if (!active) return xs.filter((x) => x.id !== id);
    return xs.some((x) => x.id === id) ? xs.map((x) => (x.id === id ? { ...x, ...next } : x)) : [...xs, next];
  });
  if (next) qc.setQueryData(conceptKeys.one(id), next);
}

const refreshConcepts = (qc: QueryClient) => qc.invalidateQueries({ queryKey: keys.concepts() });

export function useCreateConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: NewConcept) => api<{ project: Concept }>("/api/projects", { method: "POST", body: JSON.stringify(b) }).then((r) => r.project),
    onSuccess: (c) => writeCached(qc, c.id, c),
    onSettled: () => refreshConcepts(qc),
  });
}

export function useEditConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: ConceptChange }) =>
      api<{ project: Concept }>(`/api/projects/${enc(id)}`, { method: "PATCH", body: JSON.stringify(change) }).then((r) => r.project),
    onSuccess: (c) => writeCached(qc, c.id, c),
    onSettled: () => refreshConcepts(qc),
  });
}

export function useDuplicateConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<{ project: Concept }>(`/api/projects/${enc(id)}/duplicate`, { method: "POST", body: JSON.stringify({ name }) }).then((r) => r.project),
    onSuccess: (c) => writeCached(qc, c.id, c),
    onSettled: () => refreshConcepts(qc),
  });
}

export function useArchiveConcept() {
  const qc = useQueryClient();
  return useMutation({
    // `why` is optional and kept in the history
    mutationFn: (v: string | { id: string; why?: string }) => {
      const { id, why } = typeof v === "string" ? { id: v, why: undefined } : v;
      return api<{ project: Concept }>(`/api/projects/${enc(id)}/archive`, { method: "POST", ...(why?.trim() ? { body: JSON.stringify({ why }) } : {}) }).then((r) => r.project);
    },
    onSuccess: (c) => writeCached(qc, c.id, c),
    onSettled: () => refreshConcepts(qc),
  });
}

export function useRestoreConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ project: Concept }>(`/api/projects/${enc(id)}/restore`, { method: "POST" }).then((r) => r.project),
    onSuccess: (c) => writeCached(qc, c.id, c),
    onSettled: () => refreshConcepts(qc),
  });
}

/** Deletes with the exact name typed. Every cached answer about the concept is dropped. */
export function useDeleteConcept() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirm, why }: { id: string; confirm: string; why?: string }) =>
      api<{ deleted: DeletedConcept }>(`/api/projects/${enc(id)}`, { method: "DELETE", body: JSON.stringify({ confirm, ...(why?.trim() ? { why } : {}) }) }).then((r) => r.deleted),
    onSuccess: (_d, { id }) => {
      writeCached(qc, id, null);
      qc.removeQueries({ queryKey: conceptKeys.one(id) });
      for (const k of [keys.itemsOf(id), keys.plan(id), keys.events(id), keys.files(id), keys.research(id), keys.challenge(id)]) {
        qc.removeQueries({ queryKey: k });
      }
    },
    onSettled: () => refreshConcepts(qc),
  });
}
