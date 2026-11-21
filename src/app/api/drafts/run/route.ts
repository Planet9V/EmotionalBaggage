import { NextResponse } from "next/server";
import { body, route } from "@/lib/api/route";
import { runRequest } from "@/lib/ai/drafts/schemas";
import { runGenerator } from "@/lib/ai/drafts/run";

/**
 * Runs one generator. 409 with `detail.pending` when earlier drafts of it are undecided and
 * `supersede` is not set; 503, 502 or 504 with the model layer's sentence when the model cannot answer.
 */
export const POST = route(async (req: Request) => {
  const b = await body(req, runRequest);
  const result = await runGenerator({
    projectId: b.projectId,
    generatorId: b.generator,
    supersede: b.supersede,
    reviseIds: b.reviseIds,
    why: b.why,
    critique: b.critique,
    params: b.params,
    signal: req.signal,
  });
  return NextResponse.json(result, { status: 201 });
});
