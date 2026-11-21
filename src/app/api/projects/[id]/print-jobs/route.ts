import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";
import { PRINTING_SECTION } from "@/lib/slicing/rules";

type Ctx = { params: Promise<{ id: string }> };

/** The print jobs of a concept, newest first; `?buildKey=` keeps those that belong to one build. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const key = new URL(req.url).searchParams.get("buildKey");
  const rows = await q<ItemRow>(
    `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ${key ? "AND data->>'buildKey' = $3" : ""} ORDER BY id DESC`,
    key ? [id, PRINTING_SECTION, key] : [id, PRINTING_SECTION]
  );
  return NextResponse.json({ jobs: rows.map(toItem) });
});
