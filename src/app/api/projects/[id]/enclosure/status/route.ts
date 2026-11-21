import { NextResponse } from "next/server";
import { plannerAddress } from "@/lib/admin/planner";
import { requireProject, route } from "@/lib/api/route";
import { safeFetch } from "@/lib/net/outbound";

type Ctx = { params: Promise<{ id: string }> };

/** Whether each generator can run: CaseMaker always (it runs in this server); YAPP_Box only when the planner answers and has OpenSCAD. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const { url } = await plannerAddress();
  let yapp: { available: boolean; code?: string; reason?: string; openscad?: string } = { available: false, code: "not-configured", reason: "No planner address is set. Set it in Admin or in PLANNER_URL." };
  if (url) {
    try {
      const r = await safeFetch(`${url}/enclosure/health`, { signal: AbortSignal.timeout(2500) });
      const j = (await r.json().catch(() => ({}))) as { openscad?: string | null; yapp?: string };
      if (!r.ok) yapp = { available: false, code: "unreachable", reason: `The planner answered ${r.status}; it may be an older build without the enclosure service.` };
      else if (!j.openscad) yapp = { available: false, code: "no-openscad", reason: "The planner is running but OpenSCAD is not installed in it." };
      else yapp = { available: true, openscad: j.openscad };
    } catch (e) {
      yapp = { available: false, code: "unreachable", reason: `The planner service is not reachable (${(e as Error).name === "TimeoutError" ? "no answer in 2.5 seconds" : (e as Error).message}).` };
    }
  }
  return NextResponse.json({ casemaker: { available: true }, yapp });
});
