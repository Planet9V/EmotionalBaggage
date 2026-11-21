import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { reportSections } from "@/lib/report/sections";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The computed sections of the report and the overview: unit economics, compliance, builds, the
 * enclosure choice and checks, the electrical checks, the launch plan's dates and the campaigns'
 * verdicts, each only where the concept holds rows it is worked from. Read only.
 */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  return NextResponse.json({ sections: await reportSections(id) });
});
