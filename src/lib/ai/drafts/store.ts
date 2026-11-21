// Reading and deciding drafts. Approving turns a draft into an items row (or replaces or removes the
// row it names) in one transaction, checked again against the section's schema, and records
// `draft.approved` with the sources. Rejecting records `draft.rejected`.
import type { PoolClient } from "pg";
import { pinList } from "@/lib/parts/schema";
import { replacePins } from "@/lib/parts/server";
import type { PinKind } from "@/lib/parts/kinds";

/** The drafting generator's words for a pin's role, as the pin kinds the parts library uses. */
const PIN_KIND_OF_ROLE: Record<string, PinKind | undefined> = {
  "power in": "power_in",
  "power out": "power_out",
  ground: "ground",
  input: "input",
  output: "output",
  bidirectional: "bidirectional",
  passive: "passive",
  "not connected": "no_connect",
};
import { currentActor } from "@/lib/actor";
import { HttpError, notFound } from "@/lib/api/route";
import { defaultStatus, STORE_STATUSES } from "@/lib/api/schemas";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { dataSchemaFor } from "@/lib/domain/schemas";
import type { Item } from "@/lib/types";
import { assertDraftAllowed, withFlags } from "@/lib/content/rules";
import type { Draft, DraftOp, DraftSource, DraftStatus } from "./shared";

export const DRAFT_COLS =
  "id, project_id, generator, target_store, title, body, data, sources, model, provider, status, run_id, reason, created_at, decided_at, decided_by, item_id";

export type DraftDbRow = {
  id: string;
  project_id: string;
  generator: string;
  target_store: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sources: DraftSource[];
  model: string;
  provider: string;
  status: DraftStatus;
  run_id: string;
  reason: string;
  created_at: Date | string;
  decided_at: Date | string | null;
  decided_by: string | null;
  item_id: string | null;
};

const iso = (v: Date | string | null) => (v === null ? null : v instanceof Date ? v.toISOString() : String(v));

/** The operation kept in data._draft, read defensively. */
export function readOp(data: Record<string, unknown>): DraftOp {
  const raw = data?._draft as { op?: unknown; reason?: unknown } | undefined;
  const op = raw?.op === "replace" || raw?.op === "remove" ? raw.op : "add";
  return { op, ...(typeof raw?.reason === "string" && raw.reason ? { reason: raw.reason } : {}) };
}

/** The row's data as it would be saved: everything except the `_draft` note. */
export function rowData(data: Record<string, unknown>) {
  const { _draft: _ignored, ...rest } = data ?? {};
  void _ignored;
  return rest;
}

export function toDraftRow(r: DraftDbRow): Draft {
  return {
    id: Number(r.id),
    projectId: r.project_id,
    generator: r.generator,
    targetStore: r.target_store,
    title: r.title,
    body: r.body,
    data: rowData(r.data),
    op: readOp(r.data),
    sources: Array.isArray(r.sources) ? r.sources : [],
    model: r.model,
    provider: r.provider,
    status: r.status,
    runId: r.run_id,
    reason: r.reason,
    createdAt: iso(r.created_at) ?? "",
    decidedAt: iso(r.decided_at),
    decidedBy: r.decided_by,
    itemId: r.item_id === null ? null : Number(r.item_id),
  };
}

export type DraftFilter = { store?: string; status?: DraftStatus | "all"; runId?: string; generator?: string };

export async function listDrafts(projectId: string, f: DraftFilter = {}): Promise<Draft[]> {
  const where = ["project_id=$1"];
  const args: unknown[] = [projectId];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    where.push(sql.replace("?", `$${args.length}`));
  };
  if (f.store) add("target_store=?", f.store);
  if (f.status && f.status !== "all") add("status=?", f.status);
  if (f.runId) add("run_id=?::uuid", f.runId);
  if (f.generator) add("generator=?", f.generator);
  const rows = await q<DraftDbRow>(`SELECT ${DRAFT_COLS} FROM drafts WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id`, args);
  return rows.map(toDraftRow);
}

/** Undecided drafts per target store, for the counts on sections and the Drafts page. */
export async function pendingByStore(projectId: string): Promise<Record<string, number>> {
  const rows = await q<{ target_store: string; n: number }>(
    "SELECT target_store, count(*)::int AS n FROM drafts WHERE project_id=$1 AND status='draft' GROUP BY target_store",
    [projectId]
  );
  return Object.fromEntries(rows.map((r) => [r.target_store, r.n]));
}

async function lockDraft(c: PoolClient, id: number) {
  const r = await c.query<DraftDbRow>(`SELECT ${DRAFT_COLS} FROM drafts WHERE id=$1 FOR UPDATE`, [id]);
  if (!r.rows[0]) throw notFound("That draft");
  return r.rows[0];
}

const decidedAlready = (d: DraftDbRow) =>
  new HttpError(409, `This draft was already ${d.status}${d.reason ? ` (${d.reason})` : ""}${d.decided_by ? ` by ${d.decided_by}` : ""}.`);

/** Checks a draft's fields against its section, the same way a new row is checked. */
export function checkFields(store: string, title: string, body: string, data: Record<string, unknown>, op: DraftOp) {
  if (!(store in STORE_STATUSES)) throw new HttpError(400, `There is no section "${store}".`);
  const t = title.trim();
  if (!t) throw new HttpError(400, "The title cannot be empty.");
  if (t.length > 300) throw new HttpError(400, "The title is longer than 300 characters.");
  if (body.length > 20_000) throw new HttpError(400, "The details are longer than 20,000 characters.");
  if (op.op === "remove") return { title: t, body, data };
  const r = dataSchemaFor(store).safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, `The draft is not valid for this section: data.${i?.path.join(".") || "(value)"}: ${i?.message ?? "invalid"}.`);
  }
  return { title: t, body, data: r.data };
}

export type Edit = { title?: string; body?: string; data?: Record<string, unknown> };

export async function editDraft(id: number, e: Edit): Promise<Draft> {
  return tx(async (c) => {
    const d = await lockDraft(c, id);
    if (d.status !== "draft") throw decidedAlready(d);
    const op = readOp(d.data);
    const next = checkFields(d.target_store, e.title ?? d.title, e.body ?? d.body, e.data ? { ...e.data } : rowData(d.data), op);
    // Content drafts: the no-proof flags are worked out again on the words as edited.
    if (op.op !== "remove") next.data = await withFlags(d.project_id, d.target_store, next.title, next.body, next.data);
    const r = await c.query<DraftDbRow>(`UPDATE drafts SET title=$2, body=$3, data=$4 WHERE id=$1 RETURNING ${DRAFT_COLS}`, [
      id,
      next.title,
      next.body,
      JSON.stringify({ ...next.data, _draft: op }),
    ]);
    await logEventIn(c, d.project_id, "draft.edited", `Edited the AI draft "${next.title}" before deciding`, {
      draftId: id,
      before: { title: d.title, body: d.body, data: rowData(d.data) },
      after: { title: next.title, body: next.body, data: next.data },
    });
    return toDraftRow(r.rows[0]);
  });
}

export type Approved = { draft: Draft; item: Item | null; before: Item | null };

/** Approves one locked draft inside a transaction. */
async function approveIn(c: PoolClient, d: DraftDbRow): Promise<Approved> {
  if (d.status !== "draft") throw decidedAlready(d);
  const op = readOp(d.data);
  const fields = checkFields(d.target_store, d.title, d.body, rowData(d.data), op);
  if (op.op !== "remove") await assertDraftAllowed(d.project_id, d.target_store, fields.title, fields.body, fields.data);
  const actor = currentActor() || null;
  let before: Item | null = null;
  let item: Item | null = null;

  if (op.op === "replace" || op.op === "remove") {
    // The row was deleted after the draft was made (the foreign key cleared item_id).
    if (d.item_id === null) throw new HttpError(409, `The row this draft would ${op.op === "remove" ? "remove" : "change"} no longer exists. Reject the draft.`);
    const was = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3 FOR UPDATE`, [d.item_id, d.project_id, d.target_store]);
    if (!was.rows[0]) throw new HttpError(409, `The row this draft would ${op.op === "remove" ? "remove" : "change"} no longer exists. Reject the draft.`);
    before = toItem(was.rows[0]);
  }

  if (op.op === "remove") {
    await c.query("DELETE FROM items WHERE id=$1", [d.item_id]);
  } else if (op.op === "replace") {
    const r = await c.query<ItemRow>(`UPDATE items SET title=$2, body=$3, data=$4, updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [
      d.item_id,
      fields.title,
      fields.body,
      JSON.stringify(fields.data),
    ]);
    item = toItem(r.rows[0]);
  } else {
    const r = await c.query<ItemRow>(
      `INSERT INTO items (project_id, section, title, body, data, status, sort)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
       RETURNING ${ITEM_COLS}`,
      [d.project_id, d.target_store, fields.title, fields.body, JSON.stringify(fields.data), defaultStatus(d.target_store)]
    );
    item = toItem(r.rows[0]);
  }

  // A drafted part's pins become pin rows, the one place the schematic and the electrical checks read them.
  if (item && d.target_store === "design/bom" && Array.isArray(fields.data.pins) && fields.data.pins.length) {
    const roles = (fields.data.pinRoles ?? {}) as Record<string, string>;
    const defs = pinList.safeParse((fields.data.pins as unknown[]).filter((n): n is string => typeof n === "string" && n.trim() !== "").map((name) => ({ name, kind: PIN_KIND_OF_ROLE[roles[name]] })));
    if (defs.success) await replacePins(c, d.project_id, item.id, defs.data);
  }

  const u = await c.query<DraftDbRow>(`UPDATE drafts SET status='approved', decided_at=now(), decided_by=$2, item_id=$3 WHERE id=$1 RETURNING ${DRAFT_COLS}`, [
    d.id,
    actor,
    item?.id ?? null,
  ]);
  const verb = op.op === "remove" ? `removed "${before!.title}" from` : op.op === "replace" ? `changed "${before!.title}" in` : `added "${fields.title}" to`;
  await logEventIn(c, d.project_id, "draft.approved", `Approved an AI draft: ${verb} ${d.target_store}`, {
    draftId: Number(d.id),
    runId: d.run_id,
    generator: d.generator,
    op: op.op,
    itemId: item?.id ?? (before ? before.id : null),
    model: d.model,
    provider: d.provider,
    sources: d.sources,
    ...(before ? { before: { title: before.title, body: before.body, data: before.data } } : {}),
    ...(item ? { after: { title: item.title, body: item.body, data: item.data } } : {}),
  });
  return { draft: toDraftRow(u.rows[0]), item, before };
}

export async function approveDraft(id: number, projectId?: string): Promise<Approved> {
  return tx(async (c) => {
    const d = await lockDraft(c, id);
    if (projectId && d.project_id !== projectId) throw notFound("That draft");
    return approveIn(c, d);
  });
}

/** Approves every undecided draft of one run, all or nothing. */
export async function approveRun(projectId: string, runId: string): Promise<Approved[]> {
  return tx(async (c) => {
    const rows = await c.query<DraftDbRow>(`SELECT ${DRAFT_COLS} FROM drafts WHERE project_id=$1 AND run_id=$2::uuid AND status='draft' ORDER BY id FOR UPDATE`, [projectId, runId]);
    if (!rows.rows.length) throw new HttpError(409, "Nothing in this run is waiting for a decision.");
    const out: Approved[] = [];
    for (const d of rows.rows) {
      try {
        out.push(await approveIn(c, d));
      } catch (e) {
        // Say which draft stopped the batch; nothing in the batch is kept.
        const msg = e instanceof Error ? e.message : String(e);
        const constraint = (e as { constraint?: string }).constraint;
        const why =
          constraint === "items_key_unique" ? "another row already uses its key" : constraint === "items_part_ref_unique" ? "another part already uses its reference" : msg;
        throw new HttpError(e instanceof HttpError ? e.status : 409, `Nothing was approved: "${d.title}" could not be, because ${why.replace(/\.$/, "")}.`);
      }
    }
    return out;
  });
}

export async function rejectDraft(id: number, reason = "", projectId?: string): Promise<Draft> {
  return tx(async (c) => {
    const d = await lockDraft(c, id);
    if (projectId && d.project_id !== projectId) throw notFound("That draft");
    if (d.status !== "draft") throw decidedAlready(d);
    const r = await c.query<DraftDbRow>(
      `UPDATE drafts SET status='rejected', reason=$3, decided_at=now(), decided_by=$2 WHERE id=$1 RETURNING ${DRAFT_COLS}`,
      [id, currentActor() || null, reason.trim()]
    );
    await logEventIn(c, d.project_id, "draft.rejected", `Rejected the AI draft "${d.title}" for ${d.target_store}`, {
      draftId: id,
      runId: d.run_id,
      generator: d.generator,
      reason: reason.trim(),
      sources: d.sources,
    });
    return toDraftRow(r.rows[0]);
  });
}

export async function getDraft(id: number): Promise<Draft> {
  const r = await q<DraftDbRow>(`SELECT ${DRAFT_COLS} FROM drafts WHERE id=$1`, [id]);
  if (!r[0]) throw notFound("That draft");
  return toDraftRow(r[0]);
}
