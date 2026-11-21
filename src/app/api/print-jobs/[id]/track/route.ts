import { NextResponse } from "next/server";
import { recordId, route } from "@/lib/api/route";
import { trackJob } from "@/lib/slicing/flow";

type Ctx = { params: Promise<{ id: string }> };

/** Asks the printer for its status. Moves a printing job to done when the printer says it finished; changes nothing else. */
export const GET = route(async (_req: Request, { params }: Ctx) => NextResponse.json(await trackJob(recordId((await params).id, "That print job"))));
