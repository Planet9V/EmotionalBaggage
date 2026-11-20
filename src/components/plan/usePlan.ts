"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Plan } from "@/lib/types";

/** The order of operations for a concept, from GET /api/projects/:id/plan. */
export function usePlan(projectId: string | undefined) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId) return;
    try {
      const p = await api<Plan>(`/api/projects/${projectId}/plan`);
      setPlan(p);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    api<Plan>(`/api/projects/${projectId}/plan`)
      .then((p) => {
        if (!alive) return;
        setPlan(p);
        setError("");
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [projectId]);

  return { plan, error, loading, reload };
}
