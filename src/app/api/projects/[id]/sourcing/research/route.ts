import { NextResponse } from "next/server";
import { z } from "zod";
import { body, requireProject, route } from "@/lib/api/route";
import { researchPart } from "@/lib/sourcing/research";

type Ctx = { params: Promise<{ id: string }> };

/** Find alternates or Check prices for one part. Billed by Perplexity, so `confirm: true` is required. Saves drafts, never facts. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, z.object({ partId: z.number().int().positive(), kind: z.enum(["prices", "alternates"]), confirm: z.boolean() }));
  return NextResponse.json(await researchPart(id, b.partId, b.kind, b.confirm, req.signal), { status: 201 });
});
