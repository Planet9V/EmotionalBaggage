import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { ercForProject } from "@/lib/parts/server";

type Ctx = { params: Promise<{ id: string }> };

/** The electrical checks of the concept's parts, pins and wires, worst first (plan 5.4). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  return NextResponse.json(await ercForProject(id));
});
