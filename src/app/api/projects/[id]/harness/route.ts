import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { HttpError, requireProject, route } from "@/lib/api/route";
import { plannerUrl } from "@/lib/admin/planner";
import { STORE, toPart, toWire, type Wire } from "@/lib/domain";
import { pinNames, routePartsOf } from "@/lib/geometry/pins3d";
import { pinsByItem } from "@/lib/parts/pins";
import { pinsOfProject } from "@/lib/parts/server";
import { buildHarnessRequest, type HarnessOutcome } from "@/lib/geometry/harness";
import { buildRouteRequest, routeState, type RoutePart } from "@/lib/geometry/routing";
import { safeFetch } from "@/lib/net/outbound";

type Ctx = { params: Promise<{ id: string }> };
const SECONDS = 30;

/**
 * Draws the harness for a concept's wiring: the planner runs WireViz (a separate program) on the
 * parts and wires. Lengths on the drawing are routed lengths only; a wire that was never routed
 * (or whose route is out of date) is drawn with no length.
 */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await requireProject(id);
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [id, [STORE.parts, STORE.wiring]]);
  const items = rows.map(toItem);
  const parts = items.filter((i) => i.section === STORE.parts).map(toPart);
  const wires = items.filter((i) => i.section === STORE.wiring).map(toWire).filter((w): w is Wire => w !== null);
  if (!wires.length) throw new HttpError(400, "There are no wires to draw. Add them in Schematic first.");

  const pins = await pinsOfProject(id);
  const routeParts: RoutePart[] = routePartsOf(parts, pins);
  const built = buildRouteRequest(routeParts, wires.map((w) => ({ id: w.item.id, name: w.name, from: w.from, fromPin: w.fromPin, to: w.to, toPin: w.toPin })));
  const lengths = new Map<number, number>();
  for (const w of wires) {
    const fp = built.fingerprints.get(w.item.id);
    if (w.routed && fp && routeState({ routedLengthMm: w.routed.lengthMm, routedFingerprint: w.routed.fingerprint }, fp) === "current") lengths.set(w.item.id, w.routed.lengthMm);
  }
  const byItem = pinsByItem(pins);
  const wireNames = (ref: string) => wires.flatMap((w) => [w.from === ref ? w.fromPin : "", w.to === ref ? w.toPin : ""]).filter(Boolean);
  const { request, problems } = buildHarnessRequest(project.name, parts, wires, lengths, (p) => pinNames(p.item, byItem.get(p.item.id) ?? [], wireNames(p.ref)));
  if (!request) throw new HttpError(400, "No wire joins two parts that are in the bill of materials, so there is nothing to draw.", { problems });

  const url = await plannerUrl();
  if (!url) throw new HttpError(503, "The planner service is not set up, so the harness cannot be drawn. Set its address in Admin or in PLANNER_URL.", { reason: "not-configured" });
  let res: Response;
  try {
    res = await safeFetch(`${url}/harness`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(SECONDS * 1000),
    });
  } catch (e) {
    const timedOut = (e as { name?: string }).name === "TimeoutError";
    throw new HttpError(timedOut ? 504 : 503, timedOut ? `The planner did not answer within ${SECONDS} seconds.` : "The planner service is not reachable, so the harness cannot be drawn.", { reason: timedOut ? "timeout" : "unreachable" });
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const why = typeof j.detail === "string" ? j.detail : "";
    throw new HttpError(res.status === 503 || res.status === 504 ? res.status : 502, why || `The planner could not draw the harness (${res.status}).`, { reason: "planner" });
  }
  const out = (await res.json()) as { svg: string; yaml: string; bom: Record<string, string>[]; seconds: number; wireviz: string };
  const outcome: HarnessOutcome = { ...out, problems, withLength: request.wires.filter((w) => w.lengthMm !== undefined).length, withoutLength: request.wires.filter((w) => w.lengthMm === undefined).length };
  return NextResponse.json(outcome);
});
