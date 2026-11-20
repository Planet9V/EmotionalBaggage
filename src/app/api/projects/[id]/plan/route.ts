import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";
import { planFallback, stepsFromItems } from "@/lib/plan";
import type { Plan, PlanNode } from "@/lib/types";

/** Order of operations for a concept: the step graph goes to the NetworkX planner service. */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireProject(id);
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [id]);
  const raw = stepsFromItems(rows.map(toItem));
  const url = process.env.PLANNER_URL;
  if (!url) return NextResponse.json(planFallback(raw, "PLANNER_URL is not set, so the order was computed in the web app."));
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: raw.map((n) => ({ id: n.id, minutes: n.minutes })),
        edges: raw.flatMap((n) => n.after.map((a) => [a, n.id])),
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`planner answered ${res.status}`);
    const p = (await res.json()) as {
      order: string[]; wave: Record<string, number>; start: Record<string, number>; finish: Record<string, number>;
      critical_path: string[]; total_minutes: number; cycles: string[][];
    };
    const crit = new Set(p.critical_path);
    const nodes: PlanNode[] = raw.map((n) => ({
      ...n, start: p.start[n.id] ?? 0, finish: p.finish[n.id] ?? 0, wave: p.wave[n.id] ?? -1, critical: crit.has(n.id),
    }));
    const plan: Plan = { engine: "networkx", nodes, order: p.order, criticalPath: p.critical_path, totalMinutes: p.total_minutes, cycles: p.cycles };
    return NextResponse.json(plan);
  } catch (e) {
    return NextResponse.json(planFallback(raw, `The planner service did not answer (${(e as Error).message}); the order was computed in the web app.`));
  }
});
