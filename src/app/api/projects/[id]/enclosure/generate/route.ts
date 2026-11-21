import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { specFingerprint } from "@/lib/enclosure/fingerprint";
import { addedDetail, changedDetail, itemDiff } from "@/lib/trace/changes";
import { ENCLOSURE_STORE, type EnclosureChecked } from "@/lib/process/computed";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { buildSpec, enclosureOffered, validateSpec } from "@/lib/enclosure/spec";
import { paramsSchema } from "@/lib/enclosure/validate";
import { runGenerator } from "@/lib/enclosure/run";
import { GENERATOR_KEYS } from "@/lib/enclosure/types";
import type { Item } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const input = z.object({
  generators: z.array(z.enum(GENERATOR_KEYS)).min(1, "choose at least one generator").max(2).transform((g) => [...new Set(g)]),
  params: paramsSchema,
});

/**
 * Builds the spec from the concept's parts, refuses it when it has errors, then runs each chosen generator
 * and computes the checks on what came out. A generator that cannot run is reported in its own entry, not as a failed request.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, input);
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section='design/bom' ORDER BY sort, id`, [id]);
  const items = rows.map(toItem) as unknown as Item[];
  if (!enclosureOffered(items)) throw new HttpError(409, "No part has a box yet, so there is nothing to build an enclosure around. Place the parts in Physical layout first.");
  const spec = buildSpec({ items, params: b.params });
  const errors = validateSpec(spec).filter((i) => i.severity === "error");
  if (errors.length) throw new HttpError(409, `The enclosure cannot be generated yet: ${errors.map((e) => e.message).join(" ")}`);
  const results = await Promise.all(b.generators.map((g) => runGenerator(g, spec)));
  // The checks are kept on the saved choice (design/enclosure) with a fingerprint of what they were
  // measured on, so the Design gate can tell they still describe today's parts and settings.
  const fingerprint = specFingerprint(spec);
  const at = new Date().toISOString();
  const checked: Record<string, EnclosureChecked> = {};
  for (const r of results) if (r.ok) checked[r.key] = { fingerprint, at, checks: r.checks.map((c) => ({ key: c.key, label: c.label, ok: c.ok, detail: c.detail })) };
  await tx(async (c) => {
    const saved = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id LIMIT 1 FOR UPDATE`, [id, ENCLOSURE_STORE])).rows[0];
    let change: Record<string, unknown> = {};
    if (Object.keys(checked).length) {
      if (saved) {
        const was = (saved.data ?? {}) as { checked?: Record<string, EnclosureChecked> };
        const now = (await c.query<ItemRow>(`UPDATE items SET data = data || jsonb_build_object('checked', $2::jsonb), updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [saved.id, JSON.stringify({ ...(was.checked ?? {}), ...checked })])).rows[0];
        change = changedDetail(now, itemDiff(saved, now));
      } else {
        const now = (await c.query<ItemRow>(
          `INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1, $2, 'Enclosure settings', '', $3::jsonb, 'open', 0) RETURNING ${ITEM_COLS}`,
          [id, ENCLOSURE_STORE, JSON.stringify({ enclosureGenerator: b.generators[0], params: spec.params, checked })]
        )).rows[0];
        change = addedDetail(now);
      }
    }
    await logEventIn(
      c,
      id,
      "enclosure.generated",
      `Generated an enclosure with ${results.map((r) => `${r.key}${r.ok ? "" : " (failed)"}`).join(" and ")}`,
      { ...change, before: (change as { before?: unknown }).before ?? null, after: (change as { after?: unknown }).after ?? null, generators: results.map((r) => ({ key: r.key, ok: r.ok, checks: r.ok ? r.checks.map((x) => ({ key: x.key, ok: x.ok })) : undefined, error: r.ok ? undefined : r.error })) }
    );
  });
  return NextResponse.json({
    outer: spec.outer,
    inner: spec.inner,
    openings: spec.openings.length,
    results,
  });
});
