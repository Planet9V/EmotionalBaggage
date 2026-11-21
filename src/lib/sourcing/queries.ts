"use client";
// TanStack Query hook for the one billed call in sourcing. It saves drafts on the server; the part list is refreshed after.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { keys } from "@/lib/queries";
import type { ResearchOutcome, Kind } from "./research";

export function useSourcingResearch(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { partId: number; kind: Kind }) =>
      api<ResearchOutcome>(`/api/projects/${projectId}/sourcing/research`, { method: "POST", body: JSON.stringify({ ...v, confirm: true }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) }),
  });
}
