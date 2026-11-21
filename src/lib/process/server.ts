import type { PoolClient } from "pg";
import { ITEM_COLS, toItem, type ItemRow } from "@/lib/db";
import type { Item } from "@/lib/types";
import type { GateRecord } from "./evaluate";

// Reading a concept's process state on the server. Writes are in the routes, inside one tx().

export type GateRow = { stage: string; status: string; overridden: boolean; note: string; decided_by: string; decided_at: Date | null };

export const toGate = (r: GateRow): GateRecord => ({
  stage: r.stage,
  status: r.status,
  overridden: r.overridden,
  note: r.note,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
});

/** The kinds of event the Process page lists as its history. */
export const PROCESS_EVENT_KINDS = ["gate.overridden", "stage.advanced", "stage.moved-back"] as const;

export type ProcessEvent = { id: number; kind: string; summary: string; data: Record<string, unknown>; createdAt: string };

type Runner = Pick<PoolClient, "query">;

export async function gatesOf(c: Runner, projectId: string): Promise<GateRecord[]> {
  const r = await c.query<GateRow>("SELECT stage, status, overridden, note, decided_by, decided_at FROM gates WHERE project_id=$1 ORDER BY stage", [projectId]);
  return r.rows.map(toGate);
}

export async function itemsOf(c: Runner, projectId: string): Promise<Item[]> {
  const r = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [projectId]);
  return r.rows.map(toItem);
}

export async function historyOf(c: Runner, projectId: string): Promise<ProcessEvent[]> {
  const r = await c.query<{ id: string; kind: string; summary: string; data: Record<string, unknown>; created_at: Date }>(
    "SELECT id, kind, summary, data, created_at FROM events WHERE project_id=$1 AND kind = ANY($2) ORDER BY id DESC LIMIT 200",
    [projectId, [...PROCESS_EVENT_KINDS]]
  );
  return r.rows.map((e) => ({ id: Number(e.id), kind: e.kind, summary: e.summary, data: e.data ?? {}, createdAt: new Date(e.created_at).toISOString() }));
}
