import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { activityQuery, readActivity } from "@/lib/trace/historyRead";

/** Every change in one concept, newest first; filter with `section` and `kind`, page with `before`. */
export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireProject(id);
  const f = activityQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await readActivity(id, f));
});
