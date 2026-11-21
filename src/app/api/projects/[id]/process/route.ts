import { NextResponse } from "next/server";
import { pool, ready } from "@/lib/db";
import { route } from "@/lib/api/route";
import { processResponse } from "@/lib/process/state";

type Ctx = { params: Promise<{ id: string }> };

/** The concept's stage, its stored gates (overrides with who, when and why) and the history of gate and stage events. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await ready();
  return NextResponse.json(await processResponse(pool(), id));
});
