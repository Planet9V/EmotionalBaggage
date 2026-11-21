import { NextResponse } from "next/server";
import { recordId, route } from "@/lib/api/route";
import { sliceJob } from "@/lib/slicing/flow";

type Ctx = { params: Promise<{ id: string }> };

/** Slices the job's file with the settings on the job. The numbers come from the slicer's own output. Takes up to a few minutes. */
export const POST = route(async (_req: Request, { params }: Ctx) => NextResponse.json({ item: await sliceJob(recordId((await params).id, "That print job")) }));
