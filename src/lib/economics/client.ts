"use client";

// Browser hooks for the economics screens: the concept's currency and regions, and the rows
// of every store the figures are worked from. Rows come through the shared query keys, so a change
// made on any screen refreshes every figure that reads it.
import { useCallback, useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { messageOf, queries } from "@/lib/queries";
import type { Item } from "@/lib/types";
import { DEFAULT_CURRENCY } from "./money";
import type { ReadinessRows } from "./readiness";
import { STORE_BATCHES, STORE_COMPLIANCE, STORE_ECONOMICS, STORE_CHANNELS, STORE_METHODS, STORE_SUPPLIERS, type Region } from "./schemas";

export type ProductionSettings = { currency: string; regions: Region[]; productType: string };

export const settingsKey = (projectId: string) => ["production-settings", projectId] as const;

const NONE: Item[] = [];

export function useProductionSettings(projectId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: settingsKey(projectId),
    queryFn: ({ signal }) => api<ProductionSettings>(`/api/projects/${encodeURIComponent(projectId)}/production-settings`, { signal }),
    enabled: !!projectId,
  });
  const m = useMutation({
    mutationFn: (change: Partial<Pick<ProductionSettings, "currency" | "regions">>) =>
      api<ProductionSettings>(`/api/projects/${encodeURIComponent(projectId)}/production-settings`, { method: "PATCH", body: JSON.stringify(change) }),
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: settingsKey(projectId) });
      const before = qc.getQueryData<ProductionSettings>(settingsKey(projectId));
      if (before) qc.setQueryData<ProductionSettings>(settingsKey(projectId), { ...before, ...change });
      return { before };
    },
    // A refused save puts the screen back; the caller shows the server's sentence.
    onError: (_e, _c, ctx) => {
      if (ctx?.before) qc.setQueryData(settingsKey(projectId), ctx.before);
    },
    onSuccess: (row) => qc.setQueryData(settingsKey(projectId), row),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["events", projectId] });
    },
  });
  const { mutateAsync } = m;
  const save = useCallback((change: Partial<Pick<ProductionSettings, "currency" | "regions">>) => mutateAsync(change).then(() => undefined), [mutateAsync]);
  return {
    settings: query.data,
    currency: query.data?.currency ?? DEFAULT_CURRENCY,
    regions: query.data?.regions ?? ([] as Region[]),
    productType: query.data?.productType ?? "electronics",
    loading: query.isPending,
    error: messageOf(query.error),
    saving: m.isPending,
    save,
    reload: () => query.refetch(),
  };
}

const STORES = ["design/bom", STORE_ECONOMICS, STORE_CHANNELS, STORE_METHODS, STORE_BATCHES, STORE_SUPPLIERS, "prototype/tests", STORE_COMPLIANCE] as const;

/** Every row the economics, the batch plan and the readiness panel read, loaded in parallel. */
export function useEconomicsRows(projectId: string) {
  const results = useQueries({ queries: STORES.map((s) => ({ ...queries.items(projectId, s), enabled: !!projectId })) });
  const [parts, economics, channels, methods, batches, suppliers, tests, compliance] = results.map((r) => r.data ?? NONE);
  const rows: ReadinessRows = useMemo(
    () => ({ parts, economics, channels, methods, batches, suppliers, tests, compliance }),
    [parts, economics, channels, methods, batches, suppliers, tests, compliance],
  );
  const failed = results.find((r) => r.error);
  const refetchAll = () => Promise.all(results.map((r) => r.refetch()));
  return { rows, loading: results.some((r) => r.isPending), error: messageOf(failed?.error), reload: refetchAll };
}
