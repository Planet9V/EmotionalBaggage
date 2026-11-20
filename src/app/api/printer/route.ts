import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { firstEnabledPrinter, valuesOf } from "@/lib/admin/printers";
import { printerFamily } from "@/lib/admin/printerFamilies";

// Read-only printer status for the first enabled printer saved in Admin. When Admin has no printer, the old
// environment settings (PRINTER_KIND, PRINTER_URL, PRINTER_API_KEY) still apply.
// OctoPrint and Moonraker (Klipper) answer over HTTP; the other families have no adapter yet.

type Target = { kind: string; url: string; apiKey: string; name?: string; printerId?: number; source: "admin" | "environment" };

async function target(): Promise<Target | null> {
  const row = await firstEnabledPrinter();
  if (row) {
    const v = valuesOf(row);
    return { kind: row.family, url: (v.address ?? "").replace(/\/$/, ""), apiKey: v.apiKey ?? "", name: row.name, printerId: Number(row.id), source: "admin" };
  }
  const kind = (process.env.PRINTER_KIND ?? "").toLowerCase();
  const url = (process.env.PRINTER_URL ?? "").replace(/\/$/, "");
  if (!kind || !url) return null;
  return { kind, url, apiKey: process.env.PRINTER_API_KEY ?? "", source: "environment" };
}

export const GET = route(async () => {
  let t: Target | null;
  try {
    t = await target();
  } catch (e) {
    return NextResponse.json({ configured: false, error: `Could not read the printers: ${(e as Error).message}` });
  }
  if (!t) {
    return NextResponse.json({ configured: false, note: "No printer is set up. Add one in Admin, Printers." });
  }
  const { kind, url } = t;
  const who = { configured: true, kind, source: t.source, ...(t.name ? { name: t.name, printerId: t.printerId } : {}) };
  if (kind === "file-only") {
    return NextResponse.json({ ...who, note: "This printer is file-only: download the file and start the print yourself." });
  }
  try {
    if (kind === "octoprint") {
      const r = await fetch(`${url}/api/job`, { headers: { "X-Api-Key": t.apiKey }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`OctoPrint answered ${r.status}`);
      const j = (await r.json()) as { state?: string; job?: { file?: { name?: string } }; progress?: { completion?: number; printTimeLeft?: number } };
      return NextResponse.json({ ...who, state: j.state, file: j.job?.file?.name ?? null, progress: j.progress?.completion ?? null, secondsLeft: j.progress?.printTimeLeft ?? null });
    }
    if (kind === "moonraker") {
      const headers: Record<string, string> = t.apiKey ? { "X-Api-Key": t.apiKey } : {};
      const r = await fetch(`${url}/printer/objects/query?print_stats&display_status`, { headers, signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`Moonraker answered ${r.status}`);
      const j = (await r.json()) as { result?: { status?: { print_stats?: { state?: string; filename?: string }; display_status?: { progress?: number } } } };
      const s = j.result?.status;
      return NextResponse.json({ ...who, state: s?.print_stats?.state, file: s?.print_stats?.filename || null, progress: s?.display_status?.progress != null ? s.display_status.progress * 100 : null, secondsLeft: null });
    }
    const label = printerFamily(kind)?.label ?? kind;
    return NextResponse.json({ ...who, error: `No adapter for ${label} yet. Built: octoprint, moonraker.` });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ ...who, error: t.apiKey ? msg.split(t.apiKey).join("[hidden]") : msg });
  }
});
