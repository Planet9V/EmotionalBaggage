"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import type { HistoryEntry, HistoryPage } from "./history";

export const historyKeys = {
  item: (itemId: number) => ["history", "item", itemId] as const,
  activity: (projectId: string, section: string, kind: string) => ["history", "activity", projectId, section, kind] as const,
};

const NO_ENTRIES: HistoryEntry[] = [];

function usePages(queryKey: readonly unknown[], url: (before: number | null) => string, enabled: boolean) {
  const q = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => api<HistoryPage>(url(pageParam), { signal }),
    getNextPageParam: (last) => last.next,
  });
  const entries = q.data ? q.data.pages.flatMap((p) => p.entries) : NO_ENTRIES;
  return {
    entries,
    loading: enabled && q.isPending,
    error: messageOf(q.error),
    more: q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    loadMore: () => void q.fetchNextPage(),
    reload: () => void q.refetch(),
    refetch: q.refetch,
  };
}

/** One row's changes, newest first. */
export function useItemHistory(itemId: number, enabled = true) {
  return usePages(historyKeys.item(itemId), (before) => `/api/items/${itemId}/history${before ? `?before=${before}` : ""}`, enabled);
}

/** Every change in a concept, filtered by the section of the row and the kind of change. */
export function useActivity(projectId: string, section: string, kind: string) {
  return usePages(
    historyKeys.activity(projectId, section, kind),
    (before) => {
      const p = new URLSearchParams();
      if (section) p.set("section", section);
      if (kind) p.set("kind", kind);
      if (before) p.set("before", String(before));
      const s = p.toString();
      return `/api/projects/${encodeURIComponent(projectId)}/activity${s ? `?${s}` : ""}`;
    },
    !!projectId
  );
}
