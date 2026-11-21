// Server side of the change history: reads the install-wide audit log (which has who and when) for one row or one concept.
import { z } from "zod";
import { currentActor } from "@/lib/actor";
import { pool, q } from "@/lib/db";
import { latestOwnChange } from "./reason";
import { changesOf, type HistoryEntry, type HistoryPage } from "./history";

type Line = { id: string; at: string; actor: string; action: string; summary: string; detail: Record<string, unknown> };

/** A reason added after the change, by whom and when: item.reason lines name the line they explain. */
type Late = Map<number, { reason: string; by: string; at: string }>;

const shape = (r: Line, late: Late = new Map()): HistoryEntry => {
  const d = r.detail ?? {};
  const own = typeof d.reason === "string" ? d.reason : "";
  const l = late.get(Number(r.id));
  return {
    id: Number(r.id),
    at: r.at,
    actor: r.actor,
    kind: r.action,
    summary: r.summary,
    itemId: d.itemId === undefined || d.itemId === null ? null : Number(d.itemId),
    section: typeof d.section === "string" ? d.section : null,
    title: typeof d.title === "string" ? d.title : null,
    changes: changesOf(d, r.action),
    reason: own || l?.reason || "",
    reasonLater: !own && l ? { by: l.by, at: l.at } : null,
    canAddReason: false,
  };
};

/** The reasons added later for these lines, read in one query. */
async function lateReasons(rows: Line[]): Promise<Late> {
  const ids = rows.map((r) => String(r.id));
  const out: Late = new Map();
  if (!ids.length) return out;
  const found = await q<{ at: string; actor: string; detail: Record<string, unknown> }>("SELECT at, actor, detail FROM audit_log WHERE action='item.reason' AND detail->>'forEvent' = ANY($1) ORDER BY id", [ids]);
  for (const f of found) if (typeof f.detail.reason === "string") out.set(Number(f.detail.forEvent), { reason: f.detail.reason, by: f.actor, at: f.at });
  return out;
}

const COLS = "id, at, actor, action, summary, detail";

export const historyQuery = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

/** One row's changes, newest first. `next` is the id to pass as `before` for the following page. */
export async function readItemHistory(projectId: string, itemId: number, f: z.infer<typeof historyQuery>): Promise<HistoryPage> {
  const rows = await q<Line>(
    `SELECT ${COLS} FROM audit_log
     WHERE project_id = $1 AND detail->>'itemId' = $2 AND action <> 'item.reason' AND ($3::bigint IS NULL OR id < $3)
     ORDER BY id DESC LIMIT ${f.limit + 1}`,
    [projectId, String(itemId), f.before ?? null]
  );
  const out = await page(rows, f.limit);
  // "Add reason" is offered on the signed-in person's latest change to this row, while it has none.
  const actor = currentActor();
  const mine = actor ? await latestOwnChange(pool(), projectId, itemId, actor) : null;
  if (mine && !mine.hasReason) for (const e of out.entries) if (e.id === mine.id) e.canAddReason = true;
  return out;
}

/** What the Activity page can filter by: the part of an action before the dot. */
export const ACTIVITY_KINDS = ["item", "claim", "file", "research", "chat", "project"] as const;

export const activityQuery = historyQuery.extend({
  section: z.string().trim().max(80).optional(),
  kind: z.enum(ACTIVITY_KINDS).optional(),
});

/** Every change in one concept, newest first, filtered by the section of the row and by the kind of change. */
export async function readActivity(projectId: string, f: z.infer<typeof activityQuery>): Promise<HistoryPage> {
  const args: unknown[] = [projectId];
  const cond = ["a.project_id = $1"];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    cond.push(sql.replaceAll("?", `$${args.length}`));
  };
  if (f.before) add("a.id < ?", f.before);
  if (f.kind) add("a.action LIKE ?", `${f.kind}.%`);
  // Older lines carry no section; the row they are about, if it still exists, says which one it is in.
  if (f.section) add("COALESCE(a.detail->>'section', (SELECT i.section FROM items i WHERE i.project_id = a.project_id AND i.id::text = a.detail->>'itemId')) = ?", f.section);
  cond.push("a.action <> 'item.reason'");
  const rows = await q<Line>(
    `SELECT a.id, a.at, a.actor, a.action, a.summary, a.detail FROM audit_log a WHERE ${cond.join(" AND ")} ORDER BY a.id DESC LIMIT ${f.limit + 1}`,
    args
  );
  return page(rows, f.limit);
}

async function page(rows: Line[], limit: number): Promise<HistoryPage> {
  const more = rows.length > limit;
  const shown = more ? rows.slice(0, limit) : rows;
  const late = await lateReasons(shown);
  const entries = shown.map((r) => shape(r, late));
  return { entries, next: more ? entries[entries.length - 1].id : null };
}
