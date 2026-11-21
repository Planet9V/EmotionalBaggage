// A reason added after the change (History's "Add reason", the board's "moved" toast). The audit log is
// append-only, so the line stays as it was and a new line, item.reason, says which line it explains and why.
import type { PoolClient } from "pg";
import { currentActor } from "@/lib/actor";
import { HttpError } from "@/lib/api/route";
import { logEventIn } from "@/lib/db";

/** The change lines a late reason may attach to. */
const REASONABLE = ["item.status", "item.edited"] as const;

type Runner = Pick<PoolClient, "query">;

/** The newest change to this row made by this person (an automatic move back is nobody's change). */
export async function latestOwnChange(c: Runner, projectId: string, itemId: number, actor: string) {
  const r = await c.query<{ id: string; detail: Record<string, unknown> }>(
    `SELECT id, detail FROM audit_log
     WHERE project_id=$1 AND detail->>'itemId'=$2 AND action = ANY($3) AND actor=$4 AND COALESCE(detail->>'auto','') <> 'true'
     ORDER BY id DESC LIMIT 1`,
    [projectId, String(itemId), [...REASONABLE], actor]
  );
  const row = r.rows[0];
  if (!row) return null;
  const late = await c.query("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='item.reason' AND detail->>'forEvent'=$2 LIMIT 1", [projectId, row.id]);
  const has = typeof row.detail?.reason === "string" && row.detail.reason !== "";
  return { id: Number(row.id), hasReason: has || (late.rowCount ?? 0) > 0 };
}

/** Writes the reason for the signed-in person's latest change to a row. `forEvent`, when given, must be that change. */
export async function addLateReason(c: PoolClient, row: { id: number | string; project_id: string; section: string; title: string }, why: string, forEvent?: number) {
  const actor = currentActor();
  const latest = await latestOwnChange(c, row.project_id, Number(row.id), actor);
  if (!latest) throw new HttpError(409, "You have not changed this row, so there is no change of yours to add a reason to.");
  if (forEvent !== undefined && forEvent !== latest.id) throw new HttpError(409, "A reason can be added only to your latest change to this row.");
  if (latest.hasReason) throw new HttpError(409, "That change already has a reason.");
  await logEventIn(c, row.project_id, "item.reason", `Added a reason to a change to "${row.title}"`, {
    itemId: Number(row.id),
    section: row.section,
    title: row.title,
    forEvent: latest.id,
    reason: why,
  });
  return latest.id;
}
