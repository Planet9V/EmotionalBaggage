import { NextResponse } from "next/server";
import { z } from "zod";
import { body, recordId, route } from "@/lib/api/route";
import { sendJob } from "@/lib/slicing/flow";
import { confirmBody } from "@/lib/slicing/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Needs `confirm: { printer, file }` naming the printer and the file exactly as Send and Start show them. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const b = await body(req, z.object({ confirm: confirmBody.optional() }));
  return NextResponse.json({ item: await sendJob(recordId((await params).id, "That print job"), b.confirm) });
});
