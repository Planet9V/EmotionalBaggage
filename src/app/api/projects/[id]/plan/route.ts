import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";
import { planFromService, planGraph, plannerRequest, planUnavailable, type PlannerResponse } from "@/lib/plan";

const NOT_RUNNING =
  "The planner service is not running, so the order of operations cannot be worked out. The steps and decisions are listed without an order until it is started.";

/**
 * Order of operations for a concept. The graph is built here; the NetworkX planner service is
 * the only thing that orders it. When the service cannot be reached the answer is still 200,
 * with engine "unavailable", the nodes and no order.
 */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireProject(id);
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [id]);
  const graph = planGraph(rows.map(toItem));
  const url = process.env.PLANNER_URL;
  if (!url) return NextResponse.json(planUnavailable(graph, `${NOT_RUNNING} (PLANNER_URL is not set.)`));
  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plannerRequest(graph)),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    return NextResponse.json(planUnavailable(graph, `${NOT_RUNNING} (${(e as Error).message}.)`));
  }
  if (!res.ok) {
    return NextResponse.json(
      planUnavailable(graph, `The planner service answered with an error (${res.status}), so the order of operations cannot be worked out.`)
    );
  }
  return NextResponse.json(planFromService(graph, (await res.json()) as PlannerResponse));
});
