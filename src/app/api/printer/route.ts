import { NextResponse } from "next/server";
import { plainNetworkReason } from "@/lib/net/plain";
import { route } from "@/lib/api/route";
import { firstEnabledPrinter, valuesOf } from "@/lib/admin/printers";
import { printerFamily } from "@/lib/admin/printerFamilies";
import { PrinterError, scrub, type PrinterAdapter } from "@/lib/printers/adapter";
import { adapterForRow, createAdapter } from "@/lib/printers/factory";

// Read-only status of the first enabled printer saved in Admin. When Admin has no printer, the old environment settings
// (PRINTER_KIND, PRINTER_URL, PRINTER_API_KEY) still apply. The answer keeps the shape the Printing screen has always read
// (state as the printer words it, file, progress, secondsLeft). Every enabled printer's full status, with temperatures, is at
// GET /api/printers/status; this route is the one-printer summary.
const TIMEOUT_MS = 4000;

type Target = { adapter: PrinterAdapter | null; secrets: (string | undefined)[]; kind: string; name?: string; printerId?: number; source: "admin" | "environment" };

async function target(): Promise<Target | null> {
  const row = await firstEnabledPrinter();
  if (row) {
    const v = valuesOf(row);
    const secretNames = (printerFamily(row.family)?.fields ?? []).filter((f) => f.secret).map((f) => f.name);
    return { adapter: adapterForRow(row, { timeoutMs: TIMEOUT_MS }), secrets: secretNames.map((n) => v[n]), kind: row.family, name: row.name, printerId: Number(row.id), source: "admin" };
  }
  const kind = (process.env.PRINTER_KIND ?? "").toLowerCase();
  const url = (process.env.PRINTER_URL ?? "").replace(/\/$/, "");
  if (!kind || !url) return null;
  const apiKey = process.env.PRINTER_API_KEY ?? "";
  try {
    return { adapter: createAdapter(kind, { address: url, ...(apiKey ? { apiKey } : {}) }, { timeoutMs: TIMEOUT_MS }), secrets: [apiKey], kind, source: "environment" };
  } catch {
    // an unknown kind in the environment: said below, as before
    return { adapter: null, secrets: [], kind, source: "environment" };
  }
}

export const GET = route(async () => {
  let t: Target | null;
  try {
    t = await target();
  } catch (e) {
    return NextResponse.json({ configured: false, error: `Could not read the printers: ${plainNetworkReason(e)}.` });
  }
  if (!t) {
    return NextResponse.json({ configured: false, note: "No printer is set up. Add one in Admin, Printers." });
  }
  const who = { configured: true, kind: t.kind, source: t.source, ...(t.name ? { name: t.name, printerId: t.printerId } : {}) };
  if (!t.adapter) return NextResponse.json({ ...who, error: `There is no connection for the printer family "${t.kind}". Built: octoprint, moonraker, prusalink, duet, bambu, creality, elegoo.` });
  if (t.kind === "file-only") {
    return NextResponse.json({ ...who, note: "This printer is file-only: download the file and start the print yourself." });
  }
  try {
    const s = await t.adapter.status();
    return NextResponse.json({
      ...who, state: s.rawState ?? undefined, file: s.file, progress: s.progress, secondsLeft: s.secondsLeft, normalizedState: s.state, temperatures: s.temperatures,
      ...(s.message ? { message: s.message } : {}),
    });
  } catch (e) {
    const msg = e instanceof PrinterError ? e.message : scrub(String((e as Error)?.message ?? e), t.secrets);
    return NextResponse.json({ ...who, error: msg });
  } finally {
    await t.adapter?.close().catch(() => undefined);
  }
});
