import { NextResponse } from "next/server";
import { body as readBody, requireProject, route } from "@/lib/api/route";
import { indexProject } from "@/lib/ai/embeddings";
import { indexRequest } from "@/lib/ai/schemas";

// Re-index a concept for search by meaning: embeds every row whose text changed for the current
// embedding model. Answers the counts, or 503 with the reason when pgvector or the model is missing.
export const POST = route(async (req: Request) => {
  const b = await readBody(req, indexRequest);
  await requireProject(b.projectId);
  const r = await indexProject(b.projectId, { signal: req.signal });
  if (!r.ok) return NextResponse.json({ error: r.reason, missing: r.missing }, { status: 503 });
  return NextResponse.json(r);
});
