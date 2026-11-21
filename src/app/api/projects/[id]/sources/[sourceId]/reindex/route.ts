import { NextResponse } from "next/server";
import { recordId, requireProject, route } from "@/lib/api/route";
import { reindexSource } from "@/lib/sources/store";

type Ctx = { params: Promise<{ id: string; sourceId: string }> };

/** Reads the source's stored file again: new passages, and search by meaning updated when it is set up. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { id, sourceId } = await params;
  await requireProject(id);
  return NextResponse.json(await reindexSource(id, recordId(sourceId, "That source")));
});
