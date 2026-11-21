import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { catalogue, health } from "@/lib/slicing/client";
import { slicerUrl } from "@/lib/slicing/config";
import { SLICER_NOT_SET_UP } from "@/lib/slicing/messages";

/** Whether the slicer is set up and answering, and the printers, materials and layer heights it has profiles for. */
export const GET = route(async () => {
  if (!(await slicerUrl())) return NextResponse.json({ configured: false, ok: false, message: SLICER_NOT_SET_UP, printers: [], materials: [] });
  const h = await health();
  if (!h.ok) return NextResponse.json({ configured: true, ok: false, message: h.message, printers: [], materials: [] });
  const cat = await catalogue().catch(() => null);
  return NextResponse.json({ configured: true, ok: !!cat, message: cat ? h.message : "The slicer answered but its profile list could not be read.", orca: cat?.orca ?? null, printers: cat?.printers ?? [], materials: cat?.materials ?? [] });
});
