"use client";

// Pins in the browser, through TanStack Query. One cached list per concept; a part's pins are
// replaced as a whole. The change shows at once; if the server refuses, the list goes back and
// the call rejects with the server's reason.
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import type { PinRow } from "./pins";
import type { PinDef } from "./schema";

export const pinKeys = { of: (projectId: string) => ["pins", projectId] as const };

export const pinQueries = {
  of: (projectId: string) =>
    queryOptions({
      queryKey: pinKeys.of(projectId),
      queryFn: ({ signal }) => api<{ pins: PinRow[] }>(`/api/projects/${encodeURIComponent(projectId)}/pins`, { signal }).then((r) => r.pins),
    }),
};

export function usePins(projectId: string | undefined) {
  const qc = useQueryClient();
  const pid = projectId ?? "";
  const query = useQuery({ ...pinQueries.of(pid), enabled: !!projectId });
  const [writeError, setWriteError] = useState("");

  const setM = useMutation({
    mutationFn: ({ itemId, pins }: { itemId: number; pins: PinDef[] }) =>
      api<{ pins: PinRow[] }>(`/api/items/${itemId}/pins`, { method: "PUT", body: JSON.stringify({ pins }) }).then((r) => r.pins),
    onMutate: async ({ itemId, pins }) => {
      setWriteError("");
      await qc.cancelQueries({ queryKey: pinKeys.of(pid) });
      const before = qc.getQueryData<PinRow[]>(pinKeys.of(pid));
      const temp: PinRow[] = pins.map((p, i) => ({ ...p, id: -(i + 1), itemId, sort: i }));
      qc.setQueryData<PinRow[]>(pinKeys.of(pid), (xs) => [...(xs ?? []).filter((x) => x.itemId !== itemId), ...temp]);
      return { before };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(pinKeys.of(pid), ctx.before);
      setWriteError(messageOf(e) || "The pins were not saved.");
    },
    onSuccess: (rows, { itemId }) => {
      qc.setQueryData<PinRow[]>(pinKeys.of(pid), (xs) => [...(xs ?? []).filter((x) => x.itemId !== itemId), ...rows]);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: pinKeys.of(pid) }),
  });

  return {
    pins: query.data ?? [],
    loading: query.isPending && !!projectId,
    error: query.error ? messageOf(query.error) : "",
    reload: () => query.refetch(),
    writeError,
    saving: setM.isPending,
    /** Replaces the part's own pins. Rejects with the server's reason after rolling back. */
    setPins: (itemId: number, pins: PinDef[]) => setM.mutateAsync({ itemId, pins }),
  };
}
