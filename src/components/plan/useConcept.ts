"use client";

import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { messageOf, queries, type ChallengeMessage, type ResearchEntry } from "@/lib/queries";
import type { EventRow, FileMeta, Item, Plan } from "@/lib/types";


export type ConceptData = {
  items: Item[];
  files: FileMeta[];
  plan: Plan | null;
  research: { configured: boolean; model: string; entries: ResearchEntry[] } | null;
  challenge: { configured: boolean; model: string; messages: ChallengeMessage[] } | null;
  events: EventRow[];
};

export type ConceptPart = keyof ConceptData;

const EMPTY: ConceptData = { items: [], files: [], plan: null, research: null, challenge: null, events: [] };

const optionsFor = (projectId: string, part: ConceptPart) => {
  switch (part) {
    case "items": return queries.items(projectId, null);
    case "files": return queries.files(projectId);
    case "plan": return queries.plan(projectId);
    case "research": return queries.research(projectId);
    case "challenge": return queries.challenge(projectId);
    case "events": return queries.events(projectId);
  }
};

type Combined = { data: ConceptData; errors: Partial<Record<ConceptPart, string>>; pending: boolean; updatedAt: number };

/** Everything recorded for a concept, loaded in parallel; each part reports its own error. The parts share their cache with the views that show them. */
export function useConcept(projectId: string | undefined, parts: ConceptPart[]) {
  const key = parts.join(",");
  const combine = useCallback(
    (results: UseQueryResult<unknown>[]): Combined => {
      const names = key.split(",") as ConceptPart[];
      const data: ConceptData = { ...EMPTY };
      const errors: Partial<Record<ConceptPart, string>> = {};
      let updatedAt = 0;
      results.forEach((r, i) => {
        if (r.data !== undefined) (data as Record<string, unknown>)[names[i]] = r.data;
        if (r.error) errors[names[i]] = messageOf(r.error);
        updatedAt = Math.max(updatedAt, r.dataUpdatedAt, r.errorUpdatedAt);
      });
      return { data, errors, pending: results.some((r) => r.isPending), updatedAt };
    },
    [key]
  );
  const { data, errors, pending, updatedAt } = useQueries({
    queries: parts.map((part) => ({ ...(optionsFor(projectId ?? "", part) as UseQueryOptions<unknown>), enabled: !!projectId })),
    combine,
  });
  const qc = useQueryClient();

  const loading = !!projectId && pending;
  const loadedAt = useMemo(() => (loading || !updatedAt ? null : new Date(updatedAt)), [loading, updatedAt]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    const names = key.split(",") as ConceptPart[];
    await Promise.all(names.map((part) => qc.refetchQueries({ queryKey: optionsFor(projectId, part).queryKey, exact: true })));
  }, [projectId, key, qc]);

  return { data, errors, loading, loadedAt, reload };
}
