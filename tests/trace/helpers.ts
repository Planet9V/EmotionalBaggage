// Shared by the traceability tests: a concept of their own, so nothing depends on the example concept.
import { q } from "@/lib/db";
import { rewriteAuditLog } from "../auditBypass";
import { POST as addProject } from "@/app/api/projects/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem, DELETE as removeItem } from "@/app/api/items/[id]/route";
import { ctx, json, read } from "../api/helpers";

export type Item = { id: number; section: string; title: string; body: string; status: string; sort: number; data: Record<string, unknown> };
export type Err = { error: string; issues?: { field: string; problem: string }[] };

export async function newConcept(name: string) {
  const r = await read<{ project: { id: string } }>(await addProject(json("POST", { name: `${name} ${Date.now()}` })));
  return r.body.project.id;
}

export async function add(project: string, section: string, title: string, extra: Record<string, unknown> = {}) {
  return read<{ item: Item } & Err>(await addItem(json("POST", { section, title, ...extra }), ctx(project)));
}

export async function patch(id: number, change: Record<string, unknown>) {
  return read<{ item: Item } & Err>(await patchItem(json("PATCH", change), ctx(String(id))));
}

export async function remove(id: number) {
  return read<{ ok: boolean } & Err>(await removeItem(json("DELETE"), ctx(String(id))));
}

export type Line = { id: number; actor: string; action: string; summary: string; detail: Record<string, unknown> };

/** The audit lines of one concept, oldest first. */
export async function lines(project: string) {
  const rows = await q<{ id: string; actor: string; action: string; summary: string; detail: Record<string, unknown> }>(
    "SELECT id, actor, action, summary, detail FROM audit_log WHERE project_id=$1 ORDER BY id",
    [project]
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) })) as Line[];
}

/** The events of one concept (the concept's own list), oldest first. */
export const events = (project: string) => q<{ kind: string; summary: string; data: Record<string, unknown> }>("SELECT kind, summary, data FROM events WHERE project_id=$1 ORDER BY id", [project]);

export async function drop(project: string) {
  await q("DELETE FROM projects WHERE id=$1", [project]);
  await rewriteAuditLog("DELETE FROM audit_log WHERE project_id=$1", [project]);
}
