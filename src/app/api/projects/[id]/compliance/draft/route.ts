import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { runGenerator } from "@/lib/ai/drafts/run";
import { COMPLIANCE_GENERATOR_ID } from "@/lib/compliance/draft";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Drafts the compliance checklist on the shared drafting engine: the reasoning model's rows are saved
 * as drafts with what they were generated from, for review in Draft with AI. Approving a draft is the
 * only path to a row; the row is then confirmed on the Compliance page as before. 503 with the model
 * layer's sentence when no model is chosen; 400 when no sales region is set; 409 while earlier drafts
 * wait (body `{ "supersede": true }` replaces them).
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  let supersede = false;
  try {
    const b = (await req.json()) as { supersede?: unknown };
    supersede = b?.supersede === true;
  } catch {
    supersede = false;
  }
  const result = await runGenerator({ projectId: id, generatorId: COMPLIANCE_GENERATOR_ID, supersede, signal: req.signal });
  return NextResponse.json(result, { status: 201 });
});
