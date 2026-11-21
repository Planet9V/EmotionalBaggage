import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_COLS, logEvent, q, toItem, type ItemRow } from "@/lib/db";
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
  await logEvent(
    id,
    "enclosure.generated",
    `Generated an enclosure with ${results.map((r) => `${r.key}${r.ok ? "" : " (failed)"}`).join(" and ")}`,
    { generators: results.map((r) => ({ key: r.key, ok: r.ok, checks: r.ok ? r.checks.map((c) => ({ key: c.key, ok: c.ok })) : undefined, error: r.ok ? undefined : r.error })) }
  );
  return NextResponse.json({
    outer: spec.outer,
    inner: spec.inner,
    openings: spec.openings.length,
    results,
  });
});
