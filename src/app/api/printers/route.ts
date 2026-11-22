import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { q } from "@/lib/db";
import { PRINTER_COLS, toPrinterChoice, type PrinterRow } from "@/lib/admin/printers";

/**
 * The printers to choose from in a concept's print flow, for any signed-in account: name, family, model and whether
 * it is switched on. Addresses and access values stay in Admin, Printers (/api/admin/printers), which is the platform
 * administrator's while the new sign-in is on (cut-over review B3).
 */
export const GET = route(async () => {
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers ORDER BY id`);
  return NextResponse.json({ printers: rows.map(toPrinterChoice) });
});
