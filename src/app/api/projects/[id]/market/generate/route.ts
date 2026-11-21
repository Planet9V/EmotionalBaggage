import { NextResponse } from "next/server";
import { z } from "zod";
import { body, requireProject, route } from "@/lib/api/route";
import { GENERATOR_IDS } from "@/lib/market/generators";
import { runGenerator } from "@/lib/ai/drafts/run";
import { marketGeneratorId } from "@/lib/market/drafting";

type Ctx = { params: Promise<{ id: string }> };

const generate = z.object({
  generator: z.enum(GENERATOR_IDS),
  /** competitors: the saved research answer to read */
  researchId: z.number().int().positive().optional(),
  /** voice-check: the text to check */
  text: z.string().max(6000).optional(),
  /** personas and names: how many to draft */
  count: z.number().int().min(1).max(10).optional(),
  /** a note for this batch */
  note: z.string().trim().max(500).optional(),
  /** names: only names, only taglines, or both when absent */
  kind: z.enum(["Name", "Tagline"]).optional(),
  /** mark earlier undecided drafts of this generator superseded and run again */
  supersede: z.boolean().optional(),
});

/**
 * Runs one marketing generator on the shared drafting engine: its rows are saved as drafts in the
 * drafts table with their sources, for review in Draft with AI; approving a draft is the only path to
 * a row. Answers 503 with the model layer's sentence when no reasoning model is chosen, 400 when the
 * concept does not yet hold what the generator reads, 409 while earlier drafts of it wait for a
 * decision (pass `supersede: true` to replace them). Nothing is saved on a failure.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const { generator, supersede, ...rest } = await body(req, generate);
  const result = await runGenerator({ projectId: id, generatorId: marketGeneratorId(generator), params: rest, supersede, signal: req.signal });
  return NextResponse.json(result, { status: 201 });
});
