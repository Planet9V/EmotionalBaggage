import { NextResponse } from "next/server";
import { z } from "zod";
import { logEventIn, q, tx } from "@/lib/db";
import { body, notFound, requireProject, route } from "@/lib/api/route";
import { REGIONS } from "@/lib/economics/schemas";

type Ctx = { params: Promise<{ id: string }> };

const patch = z
  .object({
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "must be a three-letter currency code such as USD or EUR").optional(),
    regions: z.array(z.enum(REGIONS, { message: `must be one of: ${REGIONS.join(", ")}` })).max(REGIONS.length).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

type Row = { currency: string; sales_regions: string[]; product_type: string };
const shape = (r: Row) => ({ currency: r.currency, regions: r.sales_regions, productType: r.product_type });

/** The concept's currency and sales regions, and its product type (so a screen can hide what does not apply). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const rows = await q<Row>("SELECT currency, sales_regions, product_type FROM projects WHERE id=$1", [id]);
  if (!rows[0]) throw notFound("That concept");
  return NextResponse.json(shape(rows[0]));
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, patch);
  const next = await tx(async (c) => {
    const was = await c.query<Row>("SELECT currency, sales_regions, product_type FROM projects WHERE id=$1 FOR UPDATE", [id]);
    if (!was.rows[0]) throw notFound("That concept");
    const regions = b.regions === undefined ? undefined : REGIONS.filter((r) => b.regions!.includes(r));
    const res = await c.query<Row>(
      `UPDATE projects SET currency = COALESCE($2, currency), sales_regions = COALESCE($3::jsonb, sales_regions), updated_at = now()
       WHERE id=$1 RETURNING currency, sales_regions, product_type`,
      [id, b.currency ?? null, regions === undefined ? null : JSON.stringify(regions)]
    );
    const now = res.rows[0];
    if (now.currency !== was.rows[0].currency) {
      await logEventIn(c, id, "project.currency", `Currency changed from ${was.rows[0].currency} to ${now.currency}`, { before: was.rows[0].currency, after: now.currency });
    }
    if (JSON.stringify(now.sales_regions) !== JSON.stringify(was.rows[0].sales_regions)) {
      await logEventIn(c, id, "project.regions", `Sales regions set to ${now.sales_regions.join(", ") || "none"}`, { before: was.rows[0].sales_regions, after: now.sales_regions });
    }
    return now;
  });
  return NextResponse.json(shape(next));
});
