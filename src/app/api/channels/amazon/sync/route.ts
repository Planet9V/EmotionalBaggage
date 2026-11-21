import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { syncAmazon } from "@/lib/channels/amazonSync";
import { projectOnly } from "@/lib/channels/requests";

/** POST { projectId }: "Sync now". Reads orders and daily totals from Amazon (read only) into the sales monitor. */
export const POST = route(async (req: Request) => {
  const b = await body(req, projectOnly);
  await requireProject(b.projectId);
  return NextResponse.json(await syncAmazon(b.projectId));
});
