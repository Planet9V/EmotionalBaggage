"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { EventRow, FileMeta, Item, Plan } from "@/lib/types";

export type ResearchEntry = { id: number; query: string; answer: string; citations: string[]; model: string; createdAt: string };
export type ChallengeMessage = { id: number; role: string; content: string; createdAt: string };

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

async function loadAll(projectId: string, parts: ConceptPart[]) {
  const id = encodeURIComponent(projectId);
  const fetchers: Record<ConceptPart, () => Promise<unknown>> = {
    items: () => api<{ items: Item[] }>(`/api/projects/${id}/items`).then((r) => r.items),
    files: () => api<{ files: FileMeta[] }>(`/api/projects/${id}/files`).then((r) => r.files),
    plan: () => api<Plan>(`/api/projects/${id}/plan`),
    research: () => api<ConceptData["research"]>(`/api/research?projectId=${id}`),
    challenge: () => api<ConceptData["challenge"]>(`/api/challenge?projectId=${id}`),
    events: () => api<{ events: EventRow[] }>(`/api/projects/${id}/events`).then((r) => r.events),
  };
  const settled = await Promise.allSettled(parts.map((p) => fetchers[p]()));
  const data: Partial<ConceptData> = {};
  const errors: Partial<Record<ConceptPart, string>> = {};
  settled.forEach((r, i) => {
    const part = parts[i];
    if (r.status === "fulfilled") (data as Record<string, unknown>)[part] = r.value;
    else errors[part] = (r.reason as Error).message;
  });
  return { data, errors };
}

/** Everything recorded for a concept, loaded in parallel; each part reports its own error. */
export function useConcept(projectId: string | undefined, parts: ConceptPart[]) {
  const [data, setData] = useState<ConceptData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<ConceptPart, string>>>({});
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const key = parts.join(",");

  const apply = useCallback((r: Awaited<ReturnType<typeof loadAll>>) => {
    setData((d) => ({ ...d, ...r.data }));
    setErrors(r.errors);
    setLoadedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    loadAll(projectId, key.split(",") as ConceptPart[]).then((r) => alive && apply(r));
    return () => {
      alive = false;
    };
  }, [projectId, key, apply]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    apply(await loadAll(projectId, key.split(",") as ConceptPart[]));
  }, [projectId, key, apply]);

  return { data, errors, loading, loadedAt, reload };
}
