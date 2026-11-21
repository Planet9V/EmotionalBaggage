import { z } from "zod";
import type { PoolClient } from "pg";
import { q } from "@/lib/db";
import { slugify } from "@/lib/format";
import { HttpError, notFound } from "@/lib/api/route";
import { STAGES } from "@/lib/menu";
import { DEFAULT_PRODUCT_TYPE, PRODUCT_TYPE_KEYS } from "@/lib/productTypes";

// Schemas and shared SQL for the concept routes (/api/projects and /api/projects/[id]/*).

export const STAGE_KEYS = STAGES.map((s) => s.key) as [string, ...string[]];

const name = z.string().max(120).trim().min(1, "A concept needs a name.");
const oneLiner = z.string().max(400).trim();
export const productTypeField = z.enum(PRODUCT_TYPE_KEYS, { message: `must be one of: ${PRODUCT_TYPE_KEYS.join(", ")}` });
export const stageField = z.enum(STAGE_KEYS, { message: `must be one of: ${STAGE_KEYS.join(", ")}` });

/** Unknown keys (an `id` sent back with the whole concept, say) are ignored: the id never changes. */
export const conceptPatch = z
  .object({ name: name.optional(), oneLiner: oneLiner.optional(), productType: productTypeField.optional(), stage: stageField.optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

export const duplicateBody = z.object({ name });

/** `?archived=` on the list: absent or 0 = active only, 1 = archived only, all = both. */
export function archivedFilter(value: string | null): "active" | "archived" | "all" {
  if (value === null || value === "" || value === "0") return "active";
  if (value === "1") return "archived";
  if (value === "all") return "all";
  throw new HttpError(400, `archived must be 0, 1 or all, not "${value}".`);
}

export type ConceptRow = {
  id: string;
  name: string;
  one_liner: string;
  product_type: string;
  stage: string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date | null;
  rows_by_stage: Record<string, number>;
};

/**
 * Every concept field the API returns, in one statement: the latest event time and the
 * row counts per stage (first segment of items.section) come from correlated subqueries,
 * so a list of any length is still one round trip.
 */
export const CONCEPT_SELECT = `
  SELECT p.id, p.name, p.one_liner, p.product_type, p.stage, p.archived_at, p.created_at, p.updated_at,
         (SELECT max(e.created_at) FROM events e WHERE e.project_id = p.id) AS last_activity_at,
         COALESCE((SELECT jsonb_object_agg(s.stage, s.n)
                     FROM (SELECT split_part(i.section, '/', 1) AS stage, count(*)::int AS n
                             FROM items i WHERE i.project_id = p.id GROUP BY 1) s), '{}'::jsonb) AS rows_by_stage
    FROM projects p`;

export function toConcept(r: ConceptRow) {
  // Every stage of the menu is present (0 when empty); a section outside the menu keeps its own key.
  const rowsByStage: Record<string, number> = Object.fromEntries(STAGE_KEYS.map((k) => [k, 0]));
  for (const [k, n] of Object.entries(r.rows_by_stage ?? {})) rowsByStage[k] = n;
  return {
    id: r.id,
    name: r.name,
    oneLiner: r.one_liner,
    productType: r.product_type,
    stage: r.stage,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastActivityAt: r.last_activity_at,
    rowCount: Object.values(rowsByStage).reduce((a, b) => a + b, 0),
    rowsByStage,
  };
}

export type Concept = ReturnType<typeof toConcept>;

/**
 * Inserts a concept under the first free id made from its name: "foo", then "foo-2", "foo-3"…
 * The insert itself is the check, so two requests with the same name at once cannot collide.
 */
export async function insertConcept(
  c: PoolClient,
  v: { name: string; oneLiner: string; productType?: string; stage?: string }
): Promise<string> {
  const base = slugify(v.name, { max: 48, fallback: "concept" });
  for (let n = 1; n <= 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const res = await c.query<{ id: string }>(
      `INSERT INTO projects (id, name, one_liner, product_type, stage) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [candidate, v.name, v.oneLiner, v.productType ?? DEFAULT_PRODUCT_TYPE, v.stage ?? STAGE_KEYS[0]]
    );
    if (res.rows[0]) return res.rows[0].id;
  }
  throw new HttpError(409, "Too many concepts already use that name. Choose a different one.");
}

/** The tables a concept owns; the database cascades a concept delete to each of them. */
export const OWNED_TABLES = ["items", "files", "events", "messages", "research", "gates"] as const;

/** Version of the export document. Raise it when the shape changes in a way a reader must know about. */
export const EXPORT_FORMAT = 1;

/** One concept in the API shape, or a 404. */
export async function loadConcept(id: string): Promise<Concept> {
  const rows = await q<ConceptRow>(`${CONCEPT_SELECT} WHERE p.id=$1`, [id]);
  if (!rows.length) throw notFound("That concept");
  return toConcept(rows[0]);
}

/** The same inside a transaction. */
export async function loadConceptIn(c: PoolClient, id: string): Promise<Concept> {
  const res = await c.query<ConceptRow>(`${CONCEPT_SELECT} WHERE p.id=$1`, [id]);
  if (!res.rows.length) throw notFound("That concept");
  return toConcept(res.rows[0]);
}

/** Locks the concept row for the rest of the transaction, or answers 404. */
export async function lockConcept(c: PoolClient, id: string) {
  const res = await c.query<{ id: string; name: string; one_liner: string; product_type: string; stage: string; archived_at: Date | null }>(
    "SELECT id, name, one_liner, product_type, stage, archived_at FROM projects WHERE id=$1 FOR UPDATE",
    [id]
  );
  if (!res.rows.length) throw notFound("That concept");
  return res.rows[0];
}
