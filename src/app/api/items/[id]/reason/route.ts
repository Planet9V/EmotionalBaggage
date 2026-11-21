import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_COLS, tx, type ItemRow } from "@/lib/db";
import { body, notFound, recordId, route } from "@/lib/api/route";
import { addLateReason } from "@/lib/trace/reason";
import { WHY_MAX } from "@/lib/trace/why";

type Ctx = { params: Promise<{ id: string }> };

const reasonBody = z.object({
  why: z.string().max(WHY_MAX, `Keep the reason under ${WHY_MAX.toLocaleString("en")} characters.`).trim().min(1, "Type the reason."),
  /** the history line it explains; when given it must be the signed-in person's latest change to the row */
  forEvent: z.number().int().positive().optional(),
});

/**
 * Adds a reason to the signed-in person's latest change to this row, after the fact. The line it explains is not
 * rewritten: a new line (item.reason) names it, and History shows the reason on the change.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  const b = await body(req, reasonBody);
  const forEvent = await tx(async (c) => {
    // Locking the row keeps two reasons for one change from both being written.
    const r = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [id]);
    if (!r.rows[0]) throw notFound("That row");
    return addLateReason(c, r.rows[0], b.why, b.forEvent);
  });
  return NextResponse.json({ ok: true, forEvent });
});
