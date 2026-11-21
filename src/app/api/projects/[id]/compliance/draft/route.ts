import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { HttpError, requireProject, route } from "@/lib/api/route";
import { askForDraft, normalTopic, type DraftContext } from "@/lib/compliance/draft";
import { REGIONS, STORE_COMPLIANCE, type Region } from "@/lib/economics/schemas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Asks the reasoning model for compliance rows and saves each as a draft, with what it was generated
 * from. 503 with the model layer's sentence when no model is chosen; 400 when no sales region is set.
 * Nothing becomes a normal row here: the person confirms each draft (POST /api/items/[id]/confirm).
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const project = await requireProject(id);
  const meta = (await q<{ product_type: string; sales_regions: string[] }>("SELECT product_type, sales_regions FROM projects WHERE id=$1", [id]))[0];
  const regions = REGIONS.filter((r) => meta.sales_regions.includes(r)) as Region[];
  if (!regions.length) throw new HttpError(400, "Choose the sales regions first. The checklist is drafted for the regions you sell in.");

  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section IN ('concept/brief','design/bom',$2) ORDER BY sort, id`, [id, STORE_COMPLIANCE])).map(toItem);
  const ctx: DraftContext = {
    conceptName: project.name,
    oneLiner: project.one_liner,
    productType: meta.product_type,
    regions,
    brief: rows.filter((r) => r.section === "concept/brief"),
    parts: rows.filter((r) => r.section === "design/bom"),
    existing: rows.filter((r) => r.section === STORE_COMPLIANCE).map((r) => r.title),
  };

  // Provider failures leave as plain sentences with a status through the route wrapper.
  const { object, info } = await askForDraft(ctx, req.signal);

  const seen = new Set(ctx.existing.map(normalTopic));
  const fresh = object.rows.filter((r) => {
    const k = normalTopic(r.topic);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const sources = [...ctx.brief, ...ctx.parts].slice(0, 100).map((i) => ({ id: i.id, section: i.section, title: i.title.slice(0, 300) }));
  const at = new Date().toISOString();

  const created = await tx(async (c) => {
    const out: ItemRow[] = [];
    for (const r of fresh) {
      const data = { why: r.why, check: r.check, generated: { sources, model: info.model, at, regions, ...(r.trigger ? { trigger: r.trigger } : {}) } };
      const res = await c.query<ItemRow>(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1,$2,$3,'',$4,'draft',(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1)) RETURNING ${ITEM_COLS}`,
        [id, STORE_COMPLIANCE, r.topic, JSON.stringify(data)]
      );
      out.push(res.rows[0]);
    }
    await logEventIn(c, id, "compliance.drafted", `Drafted ${out.length} compliance ${out.length === 1 ? "row" : "rows"} for ${regions.join(", ")} (drafts, to be confirmed)`, { model: info.model, count: out.length, regions });
    return out;
  });
  return NextResponse.json({ created: created.map(toItem), skipped: object.rows.length - fresh.length, model: info.model }, { status: 201 });
});
