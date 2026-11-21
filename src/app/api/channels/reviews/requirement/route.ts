import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { draftRequirement } from "@/lib/channels/reviews";
import { requirementBody } from "@/lib/channels/requests";

/** POST { projectId, title, detail, reviewIds }: a draft requirement citing the reviews; approved on the Drafts page like any draft. */
export const POST = route(async (req: Request) => {
  const b = await body(req, requirementBody);
  await requireProject(b.projectId);
  return NextResponse.json(await draftRequirement(b.projectId, b), { status: 201 });
});
