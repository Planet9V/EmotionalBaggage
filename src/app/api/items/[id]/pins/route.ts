import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_COLS, logEventIn, tx, type ItemRow } from "@/lib/db";
import { body, HttpError, notFound, recordId, route } from "@/lib/api/route";
import { STORE } from "@/lib/domain/schemas";
import { pinList } from "@/lib/parts/schema";
import { pinsOfItem, replacePins } from "@/lib/parts/server";

type Ctx = { params: Promise<{ id: string }> };

const putBody = z.object({ pins: pinList });

/**
 * Replaces the pins a part defines itself, in one transaction, recorded with before and after.
 * An empty list removes them, so the part takes its pins from its library entry or kind again.
 */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That part");
  const b = await body(req, putBody);
  const result = await tx(async (c) => {
    const found = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [id]);
    const part = found.rows[0];
    if (!part) throw notFound("That part");
    if (part.section !== STORE.parts) throw new HttpError(400, "Only a row of the bill of materials has pins.");
    const before = await pinsOfItem(c, id);
    const after = await replacePins(c, part.project_id, id, b.pins);
    const ref = typeof part.data.ref === "string" && part.data.ref ? ` (${part.data.ref})` : "";
    const strip = (rows: typeof after) =>
      rows.map((r) => {
        const rest: Record<string, unknown> = { ...r };
        delete rest.id;
        delete rest.itemId;
        delete rest.sort;
        return rest;
      });
    await logEventIn(
      c,
      part.project_id,
      "pins.replaced",
      after.length ? `Set ${after.length} ${after.length === 1 ? "pin" : "pins"} on "${part.title}"${ref}` : `Removed the own pins of "${part.title}"${ref}`,
      { itemId: id, before: { pins: strip(before) }, after: { pins: strip(after) } }
    );
    return after;
  });
  return NextResponse.json({ pins: result });
});
