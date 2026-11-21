"use client";
// TanStack Query hooks for the print flow. One key per resource; every action refreshes the concept's items.
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { keys } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { PortStatus } from "./printerPort";

export type SlicerState = {
  configured: boolean;
  ok: boolean;
  message: string;
  orca?: { version: string; commit: string } | null;
  materials: string[];
  printers: { maker: string; model: string; available: boolean; reason: string; materials: string[]; layerHeights: number[]; note: string }[];
};

export type Plan = {
  status: string;
  printer: { id: number; name: string; family: string; familyLabel: string } | null;
  capabilities: { status: boolean; upload: boolean; start: boolean; pause: boolean; resume: boolean; cancel: boolean; fileTypes: string[]; notes: string[]; experimental?: boolean };
  fileOnly: boolean;
  send: { name: string; fileId: number; kind: string } | null;
  download: { gcodeFileId: number | null; projectFileId: number | null } | null;
};

export const printKeys = {
  slicer: () => ["slicer"] as const,
  plan: (id: number) => ["print-plan", id] as const,
  track: (id: number) => ["print-track", id] as const,
};

export const slicerQuery = () => queryOptions({ queryKey: printKeys.slicer(), queryFn: ({ signal }) => api<SlicerState>("/api/slicer", { signal }), staleTime: 30_000 });
export const planQuery = (id: number) => queryOptions({ queryKey: printKeys.plan(id), queryFn: ({ signal }) => api<Plan>(`/api/print-jobs/${id}/plan`, { signal }) });

export const useSlicer = () => useQuery(slicerQuery());
export const usePlan = (id: number, enabled: boolean) => useQuery({ ...planQuery(id), enabled });

/** Asks the printer every 10 s while the job is sent or printing. A finished print moves the job on the server. */
export function useTrack(projectId: string, id: number, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: printKeys.track(id),
    enabled,
    refetchInterval: 10_000,
    queryFn: async ({ signal }) => {
      const r = await api<{ job: Item; printer: PortStatus | null; message: string }>(`/api/print-jobs/${id}/track`, { signal });
      void qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) });
      return r;
    },
  });
}

type Confirm = { printer: string; file: string };

export function usePrintActions(projectId: string, id: number) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) });
    await qc.invalidateQueries({ queryKey: printKeys.plan(id) });
    await qc.invalidateQueries({ queryKey: printKeys.track(id) });
  };
  const post = <T,>(path: string, body?: unknown) => api<T>(`/api/print-jobs/${id}/${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  const opts = { onSettled: refresh };
  return {
    slice: useMutation({ mutationFn: () => post("slice"), ...opts }),
    send: useMutation({ mutationFn: (confirm: Confirm) => post("send", { confirm }), ...opts }),
    start: useMutation({ mutationFn: (confirm: Confirm) => post("start", { confirm }), ...opts }),
    control: useMutation({ mutationFn: (v: { action: "pause" | "resume" | "cancel"; confirm?: Confirm }) => post("control", v), ...opts }),
    result: useMutation({
      mutationFn: (v: { outcome: string; actualSeconds?: number; actualG?: number; notes?: string; photoFileIds: number[] }) => post("result", v),
      ...opts,
    }),
  };
}
