import { NextResponse } from "next/server";

// Read-only printer status. OctoPrint and Moonraker (Klipper) answer over HTTP.
// Bambu Lab printers speak MQTT on the local network; that adapter is not built yet.
export async function GET() {
  const kind = (process.env.PRINTER_KIND ?? "").toLowerCase();
  const url = (process.env.PRINTER_URL ?? "").replace(/\/$/, "");
  if (!kind || !url) {
    return NextResponse.json({ configured: false, note: "Set PRINTER_KIND (octoprint or moonraker) and PRINTER_URL." });
  }
  try {
    if (kind === "octoprint") {
      const r = await fetch(`${url}/api/job`, { headers: { "X-Api-Key": process.env.PRINTER_API_KEY ?? "" }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`OctoPrint answered ${r.status}`);
      const j = (await r.json()) as { state?: string; job?: { file?: { name?: string } }; progress?: { completion?: number; printTimeLeft?: number } };
      return NextResponse.json({ configured: true, kind, state: j.state, file: j.job?.file?.name ?? null, progress: j.progress?.completion ?? null, secondsLeft: j.progress?.printTimeLeft ?? null });
    }
    if (kind === "moonraker") {
      const r = await fetch(`${url}/printer/objects/query?print_stats&display_status`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`Moonraker answered ${r.status}`);
      const j = (await r.json()) as { result?: { status?: { print_stats?: { state?: string; filename?: string }; display_status?: { progress?: number } } } };
      const s = j.result?.status;
      return NextResponse.json({ configured: true, kind, state: s?.print_stats?.state, file: s?.print_stats?.filename || null, progress: s?.display_status?.progress != null ? s.display_status.progress * 100 : null, secondsLeft: null });
    }
    return NextResponse.json({ configured: true, kind, error: `No adapter for "${kind}" yet. Built: octoprint, moonraker.` });
  } catch (e) {
    return NextResponse.json({ configured: true, kind, error: (e as Error).message });
  }
}
