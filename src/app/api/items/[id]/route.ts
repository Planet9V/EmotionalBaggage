import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { body, notFound, recordId, route } from "@/lib/api/route";
import { assertStatus, itemPatch, parseData } from "@/lib/api/schemas";
import { assertClaimChange } from "@/lib/research/rules";
import { changedDetail, itemDiff, removedDetail } from "@/lib/trace/changes";
import { assertBuildMayPass, assertLinks, relinkKey } from "@/lib/trace/links";
import { keyOf } from "@/lib/trace/spec";
import { assertMarketChange } from "@/lib/market/rules";
import { assertPrintChange } from "@/lib/slicing/rules";
import { assertContentAllowed, withFlags } from "@/lib/content/rules";
import { CONTENT_STORES } from "@/lib/content/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** data is merged key by key, so a view can patch one field without resending the rest. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  const b = await body(req, itemPatch);
  const now = await tx(async (c) => {
    const before = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [id]);
    const was = before.rows[0];
    if (!was) throw notFound("That row");
    assertStatus(was.section, b.status);
    // Claims: evidence only through /api/research/evidence; a hand-set status the evidence allows.
    assertClaimChange(was, b);
    // Positioning: approval needs the reviewer's critique, which only its own route writes.
    assertMarketChange(was, b);
    // Print jobs: slicing, sending and starting only through their own routes.
    assertPrintChange(was, b);
    let data = parseData(was.section, b.data);
    // Content rows: the no-proof flags are worked out again on the words as they will be, and a row past
    // draft may not carry a flagged line or break a platform limit.
    if (CONTENT_STORES.has(was.section)) {
      const merged = { ...was.data, ...(data ?? {}) };
      data = await withFlags(was.project_id, was.section, b.title ?? was.title, b.body ?? was.body, merged);
      await assertContentAllowed(was.project_id, was.section, b.status ?? was.status, b.title ?? was.title, b.body ?? was.body, data, Number(was.id));
    }
    await assertLinks(c, was.project_id, was.section, data);
    await assertBuildMayPass(c, was.project_id, { section: was.section, title: b.title ?? was.title, status: b.status ?? was.status, data: { ...was.data, ...(data ?? {}) } });
    const res = await c.query<ItemRow>(
      `UPDATE items SET
         title = COALESCE($2, title),
         body = COALESCE($3, body),
         data = data || COALESCE($4::jsonb, '{}'::jsonb),
         status = COALESCE($5, status),
         sort = COALESCE($6, sort),
         updated_at = now()
       WHERE id=$1 RETURNING ${ITEM_COLS}`,
      [id, b.title ?? null, b.body ?? null, data ? JSON.stringify(data) : null, b.status ?? null, b.sort ?? null]
    );
    const row = res.rows[0];
    const diff = itemDiff(was, row);
    // A key that changed or went away takes the links that named it with it, in this transaction.
    const oldKey = keyOf(was.data);
    const newKey = keyOf(row.data);
    if (oldKey && oldKey !== newKey) await relinkKey(c, row, oldKey, newKey || null, newKey ? `the key ${oldKey} became ${newKey}` : `the key ${oldKey} was removed`);
    // A write that changes nothing leaves no line: the record holds changes, not clicks.
    if (Object.keys(diff.after).length || Object.keys(diff.before).length) {
      const detail = changedDetail(row, diff);
      if (b.status && b.status !== was.status) {
        await logEventIn(c, row.project_id, "item.status", `"${row.title}" moved from ${was.status} to ${row.status}`, detail);
      } else {
        await logEventIn(c, row.project_id, "item.edited", `Edited "${row.title}" in ${row.section}`, detail);
      }
    }
    return row;
  });
  return NextResponse.json({ item: toItem(now) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  await tx(async (c) => {
    const res = await c.query<ItemRow>(`DELETE FROM items WHERE id=$1 RETURNING ${ITEM_COLS}`, [id]);
    const row = res.rows[0];
    if (!row) throw notFound("That row");
    // Rows that linked to this one lose the link in the same transaction, each recorded.
    const unlinked = await relinkKey(c, row, keyOf(row.data), null, `the linked row "${row.title}" was deleted`);
    await logEventIn(c, row.project_id, "item.removed", `Removed "${row.title}" from ${row.section}`, removedDetail(row, unlinked.length ? { unlinked: unlinked.map((u) => ({ itemId: u.id, title: u.title, field: u.field })) } : {}));
  });
  return NextResponse.json({ ok: true });
});
