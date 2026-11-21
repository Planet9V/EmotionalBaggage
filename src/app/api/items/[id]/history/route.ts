import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { notFound, recordId, route } from "@/lib/api/route";
import { historyQuery, readItemHistory } from "@/lib/trace/historyRead";

type Ctx = { params: Promise<{ id: string }> };

/** One row's changes, newest first: who, when, and each field before and after. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That row");
  const rows = await q<{ project_id: string }>("SELECT project_id FROM items WHERE id=$1", [id]);
  if (!rows.length) throw notFound("That row");
  const f = historyQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await readItemHistory(rows[0].project_id, id, f));
});
