import { NextResponse } from "next/server";
import { z } from "zod";
import { body, requireProject, route } from "@/lib/api/route";
import { GENERATOR_IDS } from "@/lib/market/generators";
import { runGenerator } from "@/lib/market/run";

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
});

/**
 * Runs one marketing generator and saves its rows as drafts (status "draft", data.generatedFrom).
 * Answers 503 with the model layer's sentence when no reasoning model is chosen, 409 when the
 * concept does not yet hold what the generator reads. Nothing is saved on a failure.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await requireProject(id);
  const { generator, ...rest } = await body(req, generate);
  const result = await runGenerator(project, generator, rest, req.signal);
  return NextResponse.json(result, { status: 201 });
});
