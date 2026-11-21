import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { approveRunRequest } from "@/lib/ai/drafts/schemas";
import { approveRun } from "@/lib/ai/drafts/store";
import { scheduleAttacks } from "@/lib/ai/drafts/attack";

/** Approve every undecided draft of one run, all or nothing. Needs `confirm: true`. */
export const POST = route(async (req: Request) => {
  const b = await body(req, approveRunRequest);
  await requireProject(b.projectId);
  const approved = await approveRun(b.projectId, b.runId);
  scheduleAttacks(b.projectId, approved.filter((a) => a.item && a.draft.op.op === "add").map((a) => a.item!));
  return NextResponse.json({ approved });
});
