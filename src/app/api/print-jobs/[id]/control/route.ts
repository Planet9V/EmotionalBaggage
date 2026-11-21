import { NextResponse } from "next/server";
import { z } from "zod";
import { body, recordId, route } from "@/lib/api/route";
import { controlJob } from "@/lib/slicing/flow";
import { confirmBody } from "@/lib/slicing/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** pause, resume, or cancel. Cancel needs the same confirm as Start. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const b = await body(req, z.object({ action: z.enum(["pause", "resume", "cancel"]), confirm: confirmBody.optional() }));
  return NextResponse.json({ item: await controlJob(recordId((await params).id, "That print job"), b.action, b.confirm) });
});
