"use client";

/** Admin hooks for the early-access places (Pricing and tiers) and the Funnel screen, in the pattern of ./client.ts. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import type { EarlyAccessCount } from "@/lib/accessRequests/shared";
import type { FunnelReport } from "@/lib/events/shared";

const keys = {
  places: () => ["admin", "early-access"] as const,
  funnel: (from: string, to: string) => ["admin", "funnel", from, to] as const,
};

export const useEarlyAccessCount = () => useQuery({ queryKey: keys.places(), queryFn: ({ signal }) => api<EarlyAccessCount>("/api/admin/early-access", { signal }) });

/** Saves the number of places; the answer is the new count. */
export function useSaveEarlyAccessLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (limit: number) => api<EarlyAccessCount>("/api/admin/early-access", { method: "PUT", body: JSON.stringify({ limit }) }),
    onSuccess: (v) => {
      qc.setQueryData(keys.places(), v);
      void qc.invalidateQueries({ queryKey: ["admin", "access-requests"] });
    },
  });
}

export const useFunnel = (from: string, to: string) =>
  useQuery({ queryKey: keys.funnel(from, to), queryFn: ({ signal }) => api<FunnelReport>(`/api/admin/funnel?from=${from}&to=${to}`, { signal }), placeholderData: keepPreviousData });

/** Saves how many days funnel events are kept. */
export function useSaveRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (retentionDays: number) => api<{ retentionDays: number }>("/api/admin/funnel", { method: "PUT", body: JSON.stringify({ retentionDays }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "funnel"] }),
  });
}
