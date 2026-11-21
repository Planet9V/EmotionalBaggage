"use client";

// The Files page's data in the browser: the list with what cites each source, one source's text, and the
// changes (add, read again, remove). A change refreshes the list, the concept's rows (sources are rows), the
// story (it may stop citing a removed source) and the activity list.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { keys as appKeys } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { SourceData } from "./parts";

type Citation = { itemId: number; title: string; section: string; how: "cites" | "drafted from" };
export type SourceEntry = { item: Item; citedBy: Citation[] };
export type IndexOutcome = { ok: true; indexed: number; skipped: number; failed: number; error?: string } | { ok: false; reason: string };
export type SourceChange = { item: Item; chunks: number; index: IndexOutcome };

const enc = encodeURIComponent;

export const sourceKeys = {
  all: (projectId: string) => ["sources", projectId] as const,
  list: (projectId: string) => ["sources", projectId, "list"] as const,
  one: (projectId: string, id: number) => ["sources", projectId, "one", id] as const,
};

export const sourceQueries = {
  list: (projectId: string) =>
    queryOptions({
      queryKey: sourceKeys.list(projectId),
      queryFn: ({ signal }) => api<{ sources: SourceEntry[] }>(`/api/projects/${enc(projectId)}/sources`, { signal }).then((r) => r.sources),
    }),
  search: (projectId: string, term: string) =>
    queryOptions({
      queryKey: [...sourceKeys.all(projectId), "search", term] as const,
      queryFn: ({ signal }) => api<{ sources: SourceEntry[] }>(`/api/projects/${enc(projectId)}/sources?q=${enc(term)}`, { signal }).then((r) => r.sources),
    }),
  one: (projectId: string, id: number) =>
    queryOptions({
      queryKey: sourceKeys.one(projectId, id),
      queryFn: ({ signal }) => api<{ item: Item; text: string; passages: number }>(`/api/projects/${enc(projectId)}/sources/${id}`, { signal }),
    }),
};

export type PastedSource = { title: string; what?: string; kind?: SourceData["kind"]; origin?: string; url?: string; text: string; folder?: string };
export type UploadedSource = { file: File; title?: string; what?: string; kind?: SourceData["kind"]; origin?: string; url?: string; folder?: string };

export function useSourceActions(projectId: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([sourceKeys.all(projectId), appKeys.itemsOf(projectId), appKeys.events(projectId), appKeys.files(projectId)].map((queryKey) => qc.invalidateQueries({ queryKey }))).then(() => undefined);
  const base = `/api/projects/${enc(projectId)}/sources`;
  const upload = useMutation({
    mutationFn: (s: UploadedSource) => {
      const form = new FormData();
      form.append("file", s.file);
      for (const k of ["title", "what", "kind", "origin", "url", "folder"] as const) if (s[k]) form.append(k, s[k] as string);
      return api<SourceChange>(base, { method: "POST", body: form });
    },
    onSettled: refresh,
  });
  const paste = useMutation({
    mutationFn: (s: PastedSource) => api<SourceChange>(base, { method: "POST", body: JSON.stringify(s) }),
    onSettled: refresh,
  });
  const reindex = useMutation({
    mutationFn: (id: number) => api<SourceChange>(`${base}/${id}/reindex`, { method: "POST" }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: ({ id, why }: { id: number; why?: string }) => api<{ ok: true; uncited: number; fileRemoved: boolean }>(`${base}/${id}`, { method: "DELETE", body: JSON.stringify(why ? { why } : {}) }),
    onSettled: refresh,
  });
  const replace = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return api<SourceChange>(`${base}/${id}/version`, { method: "POST", body: form });
    },
    onSettled: refresh,
  });
  return { upload, paste, reindex, remove, replace };
}

/** What indexing did, in words, for the line under a change. */
export function indexText(i: IndexOutcome): string {
  if (!i.ok) return `Search by words finds it now. ${i.reason}`;
  if (i.failed) return `Indexed for search by meaning with ${i.failed} ${i.failed === 1 ? "failure" : "failures"}${i.error ? `: ${i.error}` : "."}`;
  return "Indexed for search by meaning and by words.";
}
