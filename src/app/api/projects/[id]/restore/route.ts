import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { route } from "@/lib/api/route";
import { loadConceptIn, lockConcept } from "@/lib/api/concepts";

type Ctx = { params: Promise<{ id: string }> };

/** Clears archived_at. Restoring a concept that is not archived is not an error and records nothing. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const out = await tx(async (c) => {
    const was = await lockConcept(c, id);
    const changed = was.archived_at !== null;
    if (changed) {
      await c.query("UPDATE projects SET archived_at = NULL, updated_at = now() WHERE id=$1", [id]);
      await logEventIn(c, id, "project.restored", `Concept "${was.name}" restored from the archive`);
    }
    return { project: await loadConceptIn(c, id), changed };
  });
  return NextResponse.json(out);
});
