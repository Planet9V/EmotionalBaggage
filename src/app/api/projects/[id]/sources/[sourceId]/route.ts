import { NextResponse } from "next/server";
import { recordId, requireProject, route } from "@/lib/api/route";
import { optionalWhy } from "@/lib/trace/why";
import { removeSource, sourceDetail } from "@/lib/sources/store";

type Ctx = { params: Promise<{ id: string; sourceId: string }> };

/** One source with its whole text, as it was read. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id, sourceId } = await params;
  await requireProject(id);
  return NextResponse.json(await sourceDetail(id, recordId(sourceId, "That source")));
});

/** Removes a source, its passages and (when nothing else points at it) its file. Body: optional { why }. Recorded in the history. */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { id, sourceId } = await params;
  await requireProject(id);
  const why = await optionalWhy(req);
  return NextResponse.json({ ok: true, ...(await removeSource(id, recordId(sourceId, "That source"), why)) });
});
