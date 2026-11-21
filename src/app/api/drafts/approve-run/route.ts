import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { approveRunRequest } from "@/lib/ai/drafts/schemas";
import { approveRun } from "@/lib/ai/drafts/store";

/** Approve every undecided draft of one run, all or nothing. Needs `confirm: true`. */
export const POST = route(async (req: Request) => {
  const b = await body(req, approveRunRequest);
  await requireProject(b.projectId);
  const approved = await approveRun(b.projectId, b.runId);
  return NextResponse.json({ approved });
});
