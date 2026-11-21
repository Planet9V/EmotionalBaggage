"use client";

/**
 * The process in the browser: the stored state (stage, gates, history) from
 * GET /api/projects/[id]/process, and the concept's rows from the shared all-items query. The
 * gates are evaluated here with the same pure functions the stage route uses, so a row saved on
 * any screen changes the next step at once, without another request.
 *
 * The state's key starts with `keys.concepts()`, so editing a concept (its type, name or stage)
 * refreshes it with the concept lists.
 */
import { useMemo } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { keys, messageOf, queries } from "@/lib/queries";
import { STAGES } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { processFor, type ProcessDefinition } from "./definitions";
import { gatePassed, nextStep, recordOf, type GateRecord, type GateResult, type NextStep } from "./evaluate";
import type { ProcessResponse } from "./state";

const enc = encodeURIComponent;

export const processKey = (projectId: string) => [...keys.concepts(), "process", projectId] as const;

export const processQuery = (projectId: string) =>
  queryOptions({
    queryKey: processKey(projectId),
    queryFn: ({ signal }) => api<ProcessResponse>(`/api/projects/${enc(projectId)}/process`, { signal }),
  });

export type StageView = {
  key: string;
  n: number;
  label: string;
  goal: string;
  /** "done": a stage before the current one; "current"; "upcoming" */
  position: "done" | "current" | "upcoming";
  result: GateResult;
  /** every check met, or overridden */
  passed: boolean;
  overridden: boolean;
  record?: GateRecord;
};

export type ProcessView = {
  definition: ProcessDefinition;
  state: ProcessResponse;
  stages: StageView[];
  current: StageView;
  next: NextStep;
};

/** Pure: the state and rows laid out stage by stage. Exported for tests. */
export function processView(state: ProcessResponse, rows: Item[]): ProcessView {
  const definition = processFor(state.productType);
  const concept = { name: state.name, oneLiner: state.oneLiner };
  const ci = Math.max(0, STAGES.findIndex((s) => s.key === state.stage));
  const stages: StageView[] = STAGES.map((s, i) => {
    const g = gatePassed(definition, state, s.key, rows, concept);
    return {
      key: s.key, n: s.n, label: s.label, goal: s.goal,
      position: i < ci ? "done" : i === ci ? "current" : "upcoming",
      result: g.result, passed: g.passed, overridden: g.overridden, record: recordOf(state, s.key),
    };
  });
  return { definition, state, stages, current: stages[ci], next: nextStep(definition, { ...state, stage: STAGES[ci].key }, rows, concept) };
}

/** The process of one concept. `view` is null until both the state and the rows have loaded. */
export function useProcess(projectId: string | null | undefined) {
  const id = projectId ?? "";
  const stateQ = useQuery({ ...processQuery(id), enabled: !!projectId });
  const rowsQ = useQuery({ ...queries.items(id, null), enabled: !!projectId });
  const view = useMemo(() => (stateQ.data && rowsQ.data ? processView(stateQ.data, rowsQ.data) : null), [stateQ.data, rowsQ.data]);
  return {
    view,
    loading: !!projectId && (stateQ.isPending || rowsQ.isPending),
    error: messageOf(stateQ.error) || messageOf(rowsQ.error),
    retry: () => {
      void stateQ.refetch();
      void rowsQ.refetch();
    },
  };
}

function useProcessMutation<V>(projectId: string, send: (v: V) => Promise<ProcessResponse>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (state) => {
      qc.setQueryData(processKey(projectId), state);
      // The stage shows in the concept lists, and the change is a new event.
      void qc.invalidateQueries({ queryKey: keys.concepts() });
      void qc.invalidateQueries({ queryKey: keys.events(projectId) });
    },
  });
}

/** Override a stage's gate with a typed reason. A refusal rejects with the server's sentence. */
export const useOverrideGate = (projectId: string) =>
  useProcessMutation(projectId, (v: { stage: string; reason: string }) =>
    api<ProcessResponse>(`/api/projects/${enc(projectId)}/gates`, { method: "POST", body: JSON.stringify(v) })
  );

/** Move to another stage: forward one when the gate is passed, back any time. */
export const useMoveStage = (projectId: string) =>
  useProcessMutation(projectId, (stage: string) =>
    api<ProcessResponse>(`/api/projects/${enc(projectId)}/stage`, { method: "POST", body: JSON.stringify({ stage }) })
  );
