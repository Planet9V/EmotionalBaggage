import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { body, notFound, recordId, route } from "@/lib/api/route";
import { assertStatus, itemPatch, parseData } from "@/lib/api/schemas";
import { assertClaimChange } from "@/lib/research/rules";
import { assertMarketChange } from "@/lib/market/rules";

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
    const data = parseData(was.section, b.data);
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
    if (b.status && b.status !== was.status) {
      await logEventIn(c, row.project_id, "item.status", `"${row.title}" moved from ${was.status} to ${row.status}`, { itemId: row.id });
    } else {
      await logEventIn(c, row.project_id, "item.edited", `Edited "${row.title}" in ${row.section}`, { itemId: row.id });
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
    await logEventIn(c, row.project_id, "item.removed", `Removed "${row.title}" from ${row.section}`);
  });
  return NextResponse.json({ ok: true });
});
