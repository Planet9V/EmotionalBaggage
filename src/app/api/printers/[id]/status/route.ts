import { NextResponse } from "next/server";
import { notFound, recordId, route } from "@/lib/api/route";
import { printerStatusFor } from "@/lib/printers/readings";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That printer");
  const reading = await printerStatusFor(id);
  if (!reading) throw notFound("That printer (or it is switched off)");
  return NextResponse.json({ printer: reading });
});
