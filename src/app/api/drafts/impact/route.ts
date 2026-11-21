import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { impactRequest } from "@/lib/ai/drafts/schemas";
import { impactFor } from "@/lib/ai/drafts/service";

/**
 * What a change to one row affects, from the planner service. Always 200 when the row exists:
 * `engine: "unavailable"` with a sentence when the planner cannot be reached within 4 s.
 */
export const POST = route(async (req: Request) => {
  const b = await body(req, impactRequest);
  await requireProject(b.projectId);
  return NextResponse.json(await impactFor(b.projectId, b.itemId));
});
