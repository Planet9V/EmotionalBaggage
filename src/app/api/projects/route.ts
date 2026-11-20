import { NextResponse } from "next/server";
import { logEventIn, q, tx } from "@/lib/db";
import { body, route } from "@/lib/api/route";
import { defaultStatus, newProject } from "@/lib/api/schemas";
import { archivedFilter, CONCEPT_SELECT, insertConcept, loadConcept, productTypeField, toConcept, type ConceptRow } from "@/lib/api/concepts";
import { DEFAULT_PRODUCT_TYPE } from "@/lib/productTypes";

const WHERE = {
  active: "WHERE p.archived_at IS NULL",
  archived: "WHERE p.archived_at IS NOT NULL",
  all: "",
} as const;

/** ?archived=1 lists only archived concepts, ?archived=all lists every concept; otherwise archived ones are left out. */
export const GET = route(async (req?: Request) => {
  const filter = archivedFilter(req ? new URL(req.url).searchParams.get("archived") : null);
  const rows = await q<ConceptRow>(`${CONCEPT_SELECT} ${WHERE[filter]} ORDER BY p.created_at, p.id`);
  return NextResponse.json({ projects: rows.map(toConcept) });
});

const createConcept = newProject.extend({ productType: productTypeField.optional() });

export const POST = route(async (req: Request) => {
  const b = await body(req, createConcept);
  const oneLiner = b.oneLiner ?? "";
  const productType = b.productType ?? DEFAULT_PRODUCT_TYPE;
  const id = await tx(async (c) => {
    const made = await insertConcept(c, { name: b.name, oneLiner, productType });
    const items = b.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await c.query(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [made, it.section, it.title, it.body ?? "", JSON.stringify(it.data ?? {}), it.status ?? defaultStatus(it.section), i]
      );
    }
    await logEventIn(c, made, "project.created", `Concept "${b.name}" created`, { productType });
    return made;
  });
  return NextResponse.json({ project: await loadConcept(id) }, { status: 201 });
});
