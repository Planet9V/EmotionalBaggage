import { NextResponse } from "next/server";
import { body, recordId, route } from "@/lib/api/route";
import { recordResult } from "@/lib/slicing/flow";
import { resultBody } from "@/lib/slicing/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Records time, material, outcome, photos (stored files of this concept) and notes against the job and its build. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const b = await body(req, resultBody);
  return NextResponse.json({ item: await recordResult(recordId((await params).id, "That print job"), b) });
});
