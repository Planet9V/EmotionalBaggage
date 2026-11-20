import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { body, route } from "@/lib/api/route";
import { PRINTER_COLS, requireFamily, resolveAccess, toPrinterView, type PrinterRow } from "@/lib/admin/printers";
import { printerPost } from "@/lib/admin/schemas";

export const GET = route(async () => {
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers ORDER BY id`);
  return NextResponse.json({ printers: rows.map(toPrinterView) });
});

export const POST = route(async (req: Request) => {
  const b = await body(req, printerPost);
  const fam = requireFamily(b.family);
  const { address, access } = resolveAccess(fam, b.access);
  const rows = await q<PrinterRow>(
    `INSERT INTO printers (name, family, model, address, access, enabled) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${PRINTER_COLS}`,
    [b.name, fam.id, b.model ?? "", address, JSON.stringify(access), b.enabled ?? true]
  );
  return NextResponse.json({ printer: toPrinterView(rows[0]) }, { status: 201 });
});
