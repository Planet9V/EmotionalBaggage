import { NextResponse } from "next/server";
import { changedDetail, itemDiff } from "@/lib/trace/changes";
import { z } from "zod";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { HttpError, body, requireProject, route } from "@/lib/api/route";
import { plannerUrl } from "@/lib/admin/planner";
import { STORE, toPart, toWire, type Wire } from "@/lib/domain";
import { routePartsOf } from "@/lib/geometry/pins3d";
import { pinsOfProject } from "@/lib/parts/server";
import { ROUTED_KEYS, buildRouteRequest, toRoutedFields, type PlannerResult, type RouteOutcome, type RoutePart, type RouteWire } from "@/lib/geometry/routing";
import { safeFetch } from "@/lib/net/outbound";

type Ctx = { params: Promise<{ id: string }> };

/** The planner's own cost is about 4 s per 100,000 cells; its grid limit keeps a run near 6 s. */
/** Seconds to wait for the planner; ROUTE_PLANNER_SECONDS lets a test or a slow host change it. */
const plannerSeconds = () => (Number(process.env.ROUTE_PLANNER_SECONDS) > 0 ? Number(process.env.ROUTE_PLANNER_SECONDS) : 30);

const input = z.object({
  /** grid cell in mm; the planner grows it when the enclosure would need more than 150,000 cells */
  cell: z.number().min(0.5).max(10).default(2),
  /** wall thickness the shell is pulled in by, mm */
  wallMm: z.number().min(0).max(20).default(2),
});

/**
 * Routes every wire whose two parts have geometry, through the planner service, and stores each
 * routed length and path on its wire row. One transaction writes them all and one line records it.
 * The planner answers with a time limit; "not reachable" and "too slow" are reported as such.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const opts = await body(req, input);

  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [id, [STORE.parts, STORE.wiring]]);
  const items = rows.map(toItem);
  // Wire ends at real pin positions (pin rows, else the library entry), the face centre otherwise.
  const bom = items.filter((i) => i.section === STORE.parts).map(toPart);
  const parts: RoutePart[] = routePartsOf(bom, await pinsOfProject(id));
  const wires = items.filter((i) => i.section === STORE.wiring).map(toWire).filter((w): w is Wire => w !== null);
  const routeWires: RouteWire[] = wires.map((w) => ({ id: w.item.id, name: w.name || w.net || `${w.from} to ${w.to}`, from: w.from, fromPin: w.fromPin, to: w.to, toPin: w.toPin }));

  if (!wires.length) throw new HttpError(400, "There are no wires to route. Add them in Schematic first.");
  const built = buildRouteRequest(parts, routeWires, { cell: opts.cell, wallMm: opts.wallMm, bomRefs: new Set(bom.map((p) => p.ref).filter(Boolean)) });
  if (!built.space) throw new HttpError(400, "There is no space to route in. Give the enclosure shell a size, or place at least one part with geometry.");
  if (!built.request) {
    throw new HttpError(400, "No wire has geometry on both of its parts, so there is nothing to route.", { skipped: built.skipped });
  }

  const url = await plannerUrl();
  if (!url) {
    throw new HttpError(503, "The planner service is not set up, so wires cannot be routed. Set its address in Admin or in PLANNER_URL.", { reason: "not-configured" });
  }
  const started = Date.now();
  let res: Response;
  try {
    res = await safeFetch(`${url}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built.request),
      signal: AbortSignal.timeout(plannerSeconds() * 1000),
    });
  } catch (e) {
    const timedOut = (e as { name?: string }).name === "TimeoutError";
    throw new HttpError(
      timedOut ? 504 : 503,
      timedOut
        ? `The planner did not answer within ${plannerSeconds()} seconds. Try a larger grid cell, or fewer wires. Nothing was changed.`
        : "The planner service is not reachable, so wires cannot be routed. Nothing was changed.",
      { reason: timedOut ? "timeout" : "unreachable" }
    );
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    throw new HttpError(502, `The planner refused the routing request (${res.status}). Nothing was changed.`, { reason: "refused", planner: text });
  }
  const result = (await res.json()) as PlannerResult;
  const plannerMs = Date.now() - started;
  const at = new Date().toISOString();

  const byNet = new Map(result.nets.map((n) => [n.id, n]));
  const failed: RouteOutcome["failed"] = [];
  let routed = 0;
  await tx(async (c) => {
    for (const w of wires) {
      const net = byNet.get(`w${w.item.id}`);
      if (!net) continue;
      const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 FOR UPDATE`, [w.item.id, id])).rows[0];
      if (!was) continue;
      // each wire's routed fields, before and after, so its History shows the length it had and has
      const record = async (now: ItemRow | undefined, summary: string) => {
        if (!now) return;
        const d = itemDiff(was, now);
        if (Object.keys(d.before).length || Object.keys(d.after).length) await logEventIn(c, id, "wire.routed", summary, changedDetail(now, d));
      };
      if (net.ok) {
        const fields = toRoutedFields(net, result.cell, at, built.fingerprints.get(w.item.id) ?? "");
        const now = (await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb, updated_at = now() WHERE id=$1 AND project_id=$3 RETURNING ${ITEM_COLS}`, [w.item.id, JSON.stringify(fields), id])).rows[0];
        await record(now, `Routed "${w.name || w.net || "wire"}": ${fields.routedLengthMm} mm`);
        routed++;
      } else {
        // A wire that no longer routes must not keep an old length.
        const now = (await c.query<ItemRow>(`UPDATE items SET data = data - $2::text[], updated_at = now() WHERE id=$1 AND project_id=$3 RETURNING ${ITEM_COLS}`, [w.item.id, [...ROUTED_KEYS], id])).rows[0];
        await record(now, `"${w.name || w.net || "wire"}" no longer routes; its old length was removed`);
        failed.push({ wireId: w.item.id, name: w.name || w.net || `${w.from} to ${w.to}`, reasons: net.problems.map((p) => `${p.terminal}: ${p.reason}`) });
      }
    }
    await logEventIn(c, id, "wiring.routed", `Routed ${routed} wire${routed === 1 ? "" : "s"} through the enclosure (${result.cell} mm cells, ${plannerMs} ms)`, {
      routed,
      failed: failed.length,
      skipped: built.skipped.length,
      cellMm: result.cell,
      requestedCellMm: result.requested_cell,
      cells: result.grid.cells,
      plannerMs,
      // each wire's own change is its own "wire.routed" event with before and after; this is the run
      after: { routed, failed: failed.map((f) => f.wireId) },
    });
  });

  const out: RouteOutcome = {
    routed,
    failed,
    skipped: built.skipped,
    faceEnds: [...built.pinSources.values()].reduce((n, [a, b]) => n + (a === "face" ? 1 : 0) + (b === "face" ? 1 : 0), 0),
    cell: result.cell,
    requestedCell: result.requested_cell,
    cells: result.grid.cells,
    plannerMs,
  };
  return NextResponse.json(out);
});
