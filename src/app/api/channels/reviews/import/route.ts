import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { importReviews } from "@/lib/channels/reviews";
import { importBody } from "@/lib/channels/requests";

/** POST { projectId, text, source?, kind? }: CSV with a header row, or pasted text, into Reviews and questions. Repeats are skipped. */
export const POST = route(async (req: Request) => {
  const b = await body(req, importBody);
  await requireProject(b.projectId);
  return NextResponse.json(await importReviews(b.projectId, b.text, { source: b.source, kind: b.kind }));
});
