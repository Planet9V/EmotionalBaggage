"use client";

// Query keys, fetchers and mutations for the channel screens, in the pattern of src/lib/queries.ts.
// A secret never goes in a key, the cache or a URL: nothing here handles one.
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { keys as appKeys } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { ChannelStatus } from "./status";
import type { Preview, SendBody, SendKind } from "./send";
import type { SyncResult } from "./amazonSync";
import type { Grouping } from "./reviews";
import type { CheckItem } from "./igChecklist";

const enc = encodeURIComponent;

const channelKeys = {
  status: (projectId: string) => ["channels", projectId, "status"] as const,
  preview: (projectId: string, kind: SendKind, itemId: number) => ["channels", projectId, "preview", kind, itemId] as const,
  groups: (projectId: string, mode: string) => ["channels", projectId, "groups", mode] as const,
  review: () => ["channels", "instagram-review"] as const,
};

export const channelQueries = {
  status: (projectId: string) =>
    queryOptions({ queryKey: channelKeys.status(projectId), queryFn: ({ signal }) => api<ChannelStatus>(`/api/channels/status?projectId=${enc(projectId)}`, { signal }), enabled: !!projectId }),
  preview: (projectId: string, kind: SendKind, itemId: number) =>
    queryOptions({
      queryKey: channelKeys.preview(projectId, kind, itemId),
      queryFn: ({ signal }) => api<Preview>(`/api/channels/send/preview?projectId=${enc(projectId)}&kind=${kind}&itemId=${itemId}`, { signal }),
      staleTime: 0,
      gcTime: 0,
    }),
  groups: (projectId: string, mode: "auto" | "tags") =>
    queryOptions({ queryKey: channelKeys.groups(projectId, mode), queryFn: ({ signal }) => api<Grouping>(`/api/channels/reviews/groups?projectId=${enc(projectId)}&mode=${mode}`, { signal }), enabled: !!projectId }),
  review: () => queryOptions({ queryKey: channelKeys.review(), queryFn: ({ signal }) => api<{ items: CheckItem[]; ticks: Record<string, boolean>; updatedAt: string | null; by: string | null }>("/api/channels/instagram/review", { signal }) }),
};

export const useChannelStatus = (projectId: string) => useQuery(channelQueries.status(projectId));

const post = <T,>(path: string, payload: unknown, method = "POST") => api<T>(path, { method, body: JSON.stringify(payload) });

/** Everything a channel action can change: the concept's rows, its activity, the channel status and groups. */
function useRefresh(projectId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: appKeys.itemsOf(projectId) }),
      qc.invalidateQueries({ queryKey: appKeys.events(projectId) }),
      qc.invalidateQueries({ queryKey: ["channels", projectId] }),
      qc.invalidateQueries({ queryKey: ["drafts", projectId] }),
    ]);
}

export function useChannelActions(projectId: string) {
  const refresh = useRefresh(projectId);
  const qc = useQueryClient();
  return {
    setMarketplace: useMutation({ mutationFn: (marketplaceId: string) => post("/api/channels/amazon", { projectId, marketplaceId }, "PUT"), onSettled: refresh }),
    sync: useMutation({ mutationFn: () => post<SyncResult>("/api/channels/amazon/sync", { projectId }), onSettled: refresh }),
    ackCost: useMutation({ mutationFn: (version: string) => post("/api/channels/x/ack", { version, read: true }), onSettled: refresh }),
    connectX: useMutation({ mutationFn: () => post<{ url: string; redirectUri: string }>("/api/channels/x/connect", {}) }),
    fetchInbox: useMutation({ mutationFn: (channel: "x" | "instagram") => post<{ added: number; read: number; message: string }>("/api/channels/inbox/fetch", { projectId, channel }), onSettled: refresh }),
    send: useMutation({ mutationFn: (b: Omit<SendBody, "projectId">) => post<{ ok: true; id: string; url?: string; item: Item }>("/api/channels/send", { projectId, ...b }), onSettled: refresh }),
    setImage: useMutation({ mutationFn: (b: { itemId: number; imageUrl: string; altText?: string }) => post<Item>("/api/channels/instagram/image", { projectId, ...b }), onSettled: refresh }),
    /** records what the user found on the channel after a send whose outcome is unknown (robustness review S9) */
    resolveSend: useMutation({ mutationFn: (b: { kind: "post" | "reply"; itemId: number; outcome: "not-posted" | "posted" }) => post<{ item: Item }>("/api/channels/send/resolve", { projectId, ...b }), onSettled: refresh }),
    importReviews: useMutation({ mutationFn: (b: { text: string; source?: string; kind?: "review" | "question" }) => post<{ added: number; skipped: number; problems: string[] }>("/api/channels/reviews/import", { projectId, ...b }), onSettled: refresh }),
    toRequirement: useMutation({ mutationFn: (b: { title: string; detail: string; reviewIds: number[] }) => post<{ draftId: number; key: string }>("/api/channels/reviews/requirement", { projectId, ...b }), onSettled: refresh }),
    saveTicks: useMutation({
      mutationFn: (ticks: Record<string, boolean>) => post("/api/channels/instagram/review", { ticks }, "PUT"),
      onSettled: () => qc.invalidateQueries({ queryKey: channelKeys.review() }),
    }),
  };
}
