import { NextResponse } from "next/server";
import { ITEM_COLS, logEvent, q, toItem, type ItemRow } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const section = new URL(req.url).searchParams.get("section");
  const rows = section
    ? await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [id, section])
    : await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [id]);
  return NextResponse.json({ items: rows.map(toItem) });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as {
    section?: string; title?: string; body?: string; data?: unknown; status?: string;
  };
  if (!b.section || !b.title?.trim()) return NextResponse.json({ error: "section and title are required" }, { status: 400 });
  const rows = await q<ItemRow>(
    `INSERT INTO items (project_id, section, title, body, data, status, sort)
     VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
     RETURNING ${ITEM_COLS}`,
    [id, b.section, b.title.trim(), b.body ?? "", JSON.stringify(b.data ?? {}), b.status ?? "open"]
  );
  await logEvent(id, "item.added", `Added "${b.title.trim()}" to ${b.section}`, { itemId: rows[0].id });
  return NextResponse.json({ item: toItem(rows[0]) }, { status: 201 });
}
