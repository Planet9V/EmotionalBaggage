import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { optimiseRequest } from "@/lib/ai/drafts/schemas";
import { optimiseState, runOptimise } from "@/lib/ai/drafts/service";

/** The three optimisation actions, each measured now from the rows, with its last run's before. */
export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  return NextResponse.json({ actions: await optimiseState(projectId) });
});

/** Runs one action: the model proposes drafts; the before is measured from the rows and recorded. */
export const POST = route(async (req: Request) => {
  const b = await body(req, optimiseRequest);
  await requireProject(b.projectId);
  const run = await runOptimise(b.projectId, b.action, b.supersede ?? false, req.signal);
  return NextResponse.json(run, { status: 201 });
});
