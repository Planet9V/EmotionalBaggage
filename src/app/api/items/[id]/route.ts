import { NextResponse } from "next/server";
import { ITEM_COLS, logEvent, q, toItem, type ItemRow } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** data is merged key by key, so a view can patch one field without resending the rest. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as {
    title?: string; body?: string; data?: Record<string, unknown>; status?: string; sort?: number;
  };
  const before = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1`, [id]);
  if (!before.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rows = await q<ItemRow>(
    `UPDATE items SET
       title = COALESCE($2, title),
       body = COALESCE($3, body),
       data = data || COALESCE($4::jsonb, '{}'::jsonb),
       status = COALESCE($5, status),
       sort = COALESCE($6, sort),
       updated_at = now()
     WHERE id=$1 RETURNING ${ITEM_COLS}`,
    [id, b.title ?? null, b.body ?? null, b.data ? JSON.stringify(b.data) : null, b.status ?? null, b.sort ?? null]
  );
  const was = before[0];
  const now = rows[0];
  if (b.status && b.status !== was.status) {
    await logEvent(now.project_id, "item.status", `"${now.title}" moved from ${was.status} to ${now.status}`, { itemId: now.id });
  } else {
    await logEvent(now.project_id, "item.edited", `Edited "${now.title}" in ${now.section}`, { itemId: now.id });
  }
  return NextResponse.json({ item: toItem(now) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rows = await q<ItemRow>(`DELETE FROM items WHERE id=$1 RETURNING ${ITEM_COLS}`, [id]);
  if (rows.length) await logEvent(rows[0].project_id, "item.removed", `Removed "${rows[0].title}" from ${rows[0].section}`);
  return NextResponse.json({ ok: true });
}
