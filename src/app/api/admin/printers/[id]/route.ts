import { NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { body, notFound, recordId, route } from "@/lib/api/route";
import { PRINTER_COLS, requireFamily, resolveAccess, toPrinterView, valuesOf, type PrinterRow } from "@/lib/admin/printers";
import { printerPatch } from "@/lib/admin/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Changes any of name, family, model, enabled, access. Blank access values are unchanged; null removes one. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That printer");
  const b = await body(req, printerPatch);
  const row = await tx(async (c) => {
    const found = await c.query<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers WHERE id=$1 FOR UPDATE`, [id]);
    const was = found.rows[0];
    if (!was) throw notFound("That printer");
    const fam = requireFamily(b.family ?? was.family);
    const { address, access } = resolveAccess(fam, b.access, valuesOf(was));
    const res = await c.query<PrinterRow>(
      `UPDATE printers SET name=$2, family=$3, model=$4, address=$5, access=$6, enabled=$7, updated_at=now() WHERE id=$1 RETURNING ${PRINTER_COLS}`,
      [id, b.name ?? was.name, fam.id, b.model ?? was.model, address, JSON.stringify(access), b.enabled ?? was.enabled]
    );
    return res.rows[0];
  });
  return NextResponse.json({ printer: toPrinterView(row) });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That printer");
  const rows = await tx(async (c) => (await c.query("DELETE FROM printers WHERE id=$1 RETURNING id", [id])).rows);
  if (!rows.length) throw notFound("That printer");
  return NextResponse.json({ deleted: id });
});
