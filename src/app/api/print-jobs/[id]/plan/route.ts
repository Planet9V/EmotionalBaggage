import { NextResponse } from "next/server";
import { recordId, route } from "@/lib/api/route";
import { describePlan } from "@/lib/slicing/flow";

type Ctx = { params: Promise<{ id: string }> };

/** What Send and Start would do: the printer, the file name the confirm must repeat, and what the printer can do from here. */
export const GET = route(async (_req: Request, { params }: Ctx) => NextResponse.json(await describePlan(recordId((await params).id, "That print job"))));
