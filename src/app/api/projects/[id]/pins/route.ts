import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { pinsOfProject } from "@/lib/parts/server";

type Ctx = { params: Promise<{ id: string }> };

/** Every pin row of the concept's parts. A part with none takes its pins from its library entry or kind. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  return NextResponse.json({ pins: await pinsOfProject(id) });
});
