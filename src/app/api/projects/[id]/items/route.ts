import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { defaultStatus, newItem, STORE_STATUSES, STORES } from "@/lib/api/schemas";
import { assertNewClaim } from "@/lib/research/rules";
import { addedDetail } from "@/lib/trace/changes";
import { assertBuildMayPass, assertLinks } from "@/lib/trace/links";
import { assertNewMarket } from "@/lib/market/rules";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const section = new URL(req.url).searchParams.get("section");
  if (section !== null && !(section in STORE_STATUSES)) {
    throw new HttpError(400, `There is no section "${section}". Sections are: ${STORES.join(", ")}.`);
  }
  const rows = section
    ? await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [id, section])
    : await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [id]);
  return NextResponse.json({ items: rows.map(toItem) });
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, newItem);
  assertNewClaim(b);
  assertNewMarket(b);
  const row = await tx(async (c) => {
    await assertLinks(c, id, b.section, b.data);
    await assertBuildMayPass(c, id, { section: b.section, title: b.title, status: b.status ?? defaultStatus(b.section), data: b.data ?? {} });
    const res = await c.query<ItemRow>(
      `INSERT INTO items (project_id, section, title, body, data, status, sort)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
       RETURNING ${ITEM_COLS}`,
      [id, b.section, b.title, b.body ?? "", JSON.stringify(b.data ?? {}), b.status ?? defaultStatus(b.section)]
    );
    await logEventIn(c, id, "item.added", `Added "${b.title}" to ${b.section}`, addedDetail(res.rows[0]));
    return res.rows[0];
  });
  return NextResponse.json({ item: toItem(row) }, { status: 201 });
});
