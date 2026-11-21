import { NextResponse } from "next/server";
import { auditIn, logEventIn, tx } from "@/lib/db";
import { body, HttpError, route } from "@/lib/api/route";
import { conceptPatch, loadConcept, loadConceptIn, lockConcept, OWNED_TABLES } from "@/lib/api/concepts";
import { SETTING } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return NextResponse.json({ project: await loadConcept(id) });
});

const COLUMN = { name: "name", oneLiner: "one_liner", productType: "product_type", stage: "stage" } as const;
type Field = keyof typeof COLUMN;

/** Changes name, oneLiner, productType or stage. The id never changes. Only fields that really change are recorded. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req, conceptPatch);
  const project = await tx(async (c) => {
    const was = await lockConcept(c, id);
    const current: Record<Field, string> = { name: was.name, oneLiner: was.one_liner, productType: was.product_type, stage: was.stage };
    const before: Partial<Record<Field, string>> = {};
    const after: Partial<Record<Field, string>> = {};
    for (const f of Object.keys(COLUMN) as Field[]) {
      const v = b[f];
      if (v !== undefined && v !== current[f]) {
        before[f] = current[f];
        after[f] = v;
      }
    }
    const changed = Object.keys(after) as Field[];
    if (changed.length) {
      const sets = changed.map((f, i) => `${COLUMN[f]} = $${i + 2}`);
      await c.query(`UPDATE projects SET ${sets.join(", ")}, updated_at = now() WHERE id=$1`, [id, ...changed.map((f) => after[f])]);
      const summary = changed.map((f) => `${f} from "${before[f]}" to "${after[f]}"`).join("; ");
      await logEventIn(c, id, "project.edited", `Changed ${summary}`, { before, after });
    }
    return loadConceptIn(c, id);
  });
  return NextResponse.json({ project });
});

/**
 * Deletes the concept and, by the database's cascade, everything it owns.
 * The body must be { "confirm": "<the concept's exact name>" }.
 * If Admin's default concept is this one, the setting is cleared in the same transaction,
 * so it never names a concept that no longer exists.
 */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  let raw: unknown = undefined;
  try {
    raw = await req.json();
  } catch {
    raw = undefined;
  }
  const confirm = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { confirm?: unknown }).confirm : undefined;
  const deleted = await tx(async (c) => {
    const was = await lockConcept(c, id);
    if (typeof confirm !== "string" || confirm !== was.name) {
      throw new HttpError(400, `To delete this concept, send { "confirm": "<its exact name>" }. Its name is "${was.name}".`);
    }
    const counts: Record<string, number> = {};
    for (const t of OWNED_TABLES) {
      const r = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t} WHERE project_id=$1`, [id]);
      counts[t] = r.rows[0].n;
    }
    await c.query("DELETE FROM projects WHERE id=$1", [id]);
    const cleared = await c.query("DELETE FROM settings WHERE key=$1 AND value = to_jsonb($2::text)", [SETTING.defaultConcept, id]);
    const defaultCleared = (cleared.rowCount ?? 0) > 0;
    if (defaultCleared) {
      await auditIn(c, {
        action: "setting.cleared",
        summary: `Setting ${SETTING.defaultConcept} cleared because the concept it named was deleted`,
        detail: { key: SETTING.defaultConcept, value: null, was: id },
      });
    }
    // The concept's own activity list goes with it; this line does not.
    await auditIn(c, {
      action: "project.deleted",
      summary: `Concept "${was.name}" deleted with everything in it`,
      detail: { counts, defaultCleared },
      projectId: id,
      projectName: was.name,
    });
    return { concept: id, name: was.name, ...counts, defaultCleared };
  });
  return NextResponse.json({ deleted });
});
