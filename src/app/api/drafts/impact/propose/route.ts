import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { proposeRequest } from "@/lib/ai/drafts/schemas";
import { proposeUpdates } from "@/lib/ai/drafts/service";

/** "Propose updates": each generator revises only the affected rows of its section; the results are drafts. */
export const POST = route(async (req: Request) => {
  const b = await body(req, proposeRequest);
  await requireProject(b.projectId);
  const runs = await proposeUpdates(b.projectId, b.itemId, b.groups, b.supersede ?? false, req.signal);
  return NextResponse.json({ runs }, { status: 201 });
});
