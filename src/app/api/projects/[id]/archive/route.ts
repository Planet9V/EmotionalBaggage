import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { route } from "@/lib/api/route";
import { loadConceptIn, lockConcept } from "@/lib/api/concepts";
import { optionalWhy, reasonDetail } from "@/lib/trace/why";

type Ctx = { params: Promise<{ id: string }> };

/** Sets archived_at. Archiving an archived concept is not an error: it keeps its first archive time and records nothing. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const why = await optionalWhy(req);
  const out = await tx(async (c) => {
    const was = await lockConcept(c, id);
    const changed = was.archived_at === null;
    if (changed) {
      await c.query("UPDATE projects SET archived_at = now(), updated_at = now() WHERE id=$1", [id]);
      await logEventIn(c, id, "project.archived", `Concept "${was.name}" archived`, reasonDetail(why));
    }
    return { project: await loadConceptIn(c, id), changed };
  });
  return NextResponse.json(out);
});
