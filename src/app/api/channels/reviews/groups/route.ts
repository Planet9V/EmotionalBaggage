import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { groupsQuery, queryOf } from "@/lib/channels/requests";
import { whatTheyAsk } from "@/lib/channels/reviews";

/** GET ?projectId&mode=auto|tags: "What customers keep asking", grouped by meaning (embedding model) or by the user's tags. */
export const GET = route(async (req: Request) => {
  const p = groupsQuery.parse(queryOf(req));
  await requireProject(p.projectId);
  return NextResponse.json(await whatTheyAsk(p.projectId, p.mode));
});
