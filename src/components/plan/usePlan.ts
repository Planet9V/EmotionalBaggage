"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { messageOf, queries } from "@/lib/queries";

/** The order of operations for a concept, from GET /api/projects/:id/plan. Item writes refresh it (see useItems). */
export function usePlan(projectId: string | undefined) {
  const q = useQuery({ ...queries.plan(projectId ?? ""), enabled: !!projectId });
  const { refetch } = q;
  const reload = useCallback(async () => {
    if (projectId) await refetch();
  }, [projectId, refetch]);
  return { plan: q.data ?? null, error: messageOf(q.error), loading: !!projectId && q.isPending, reload };
}
