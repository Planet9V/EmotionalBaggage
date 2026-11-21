import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { body, HttpError, notFound, recordId, route } from "@/lib/api/route";
import { CONFIRM_STATUSES, STORE_COMPLIANCE } from "@/lib/economics/schemas";

type Ctx = { params: Promise<{ id: string }> };

const confirm = z.object({ status: z.enum(CONFIRM_STATUSES, { message: `must be one of: ${CONFIRM_STATUSES.join(", ")}` }).default("to check") });

/** Turns a drafted compliance row into a normal one, with the status the person chooses. The row keeps what it was generated from. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  const b = await body(req, confirm);
  const row = await tx(async (c) => {
    const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!was) throw notFound("That row");
    if (was.section !== STORE_COMPLIANCE) throw new HttpError(400, "Only a drafted compliance row can be confirmed.");
    if (was.status !== "draft") throw new HttpError(409, "That row is not a draft. It was already confirmed.");
    const res = await c.query<ItemRow>(
      `UPDATE items SET status=$2, data = jsonb_set(data, '{generated,confirmedAt}', to_jsonb($3::text), true), updated_at=now()
       WHERE id=$1 RETURNING ${ITEM_COLS}`,
      [id, b.status, new Date().toISOString()]
    );
    await logEventIn(c, was.project_id, "compliance.confirmed", `Confirmed compliance row "${was.title}" as ${b.status}`, { itemId: id });
    return res.rows[0];
  });
  return NextResponse.json({ item: toItem(row) });
});
