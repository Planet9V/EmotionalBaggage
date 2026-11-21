import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { currentActor } from "@/lib/actor";
import { body, HttpError, route } from "@/lib/api/route";
import { lockConcept } from "@/lib/api/concepts";
import { processFor } from "@/lib/process/definitions";
import { evaluateGate, gateOf, stageLabel } from "@/lib/process/evaluate";
import { overrideBody } from "@/lib/process/schemas";
import { itemsOf } from "@/lib/process/server";
import { processResponse } from "@/lib/process/state";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Overrides one stage's gate (owner's decision D6: gates warn, an override is allowed and recorded).
 * Body { stage, reason }. The reason, who and when are kept on the gate row, and the override is
 * written to the concept's history and the audit log with the checks that were not met.
 * A gate whose checks are all met needs no override and is refused.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req, overrideBody);
  const out = await tx(async (c) => {
    const p = await lockConcept(c, id);
    const result = evaluateGate(gateOf(processFor(p.product_type), b.stage), await itemsOf(c, id), { name: p.name, oneLiner: p.one_liner });
    if (result.met) throw new HttpError(409, `Every check of the ${stageLabel(b.stage)} gate is met, so there is nothing to override.`);
    const unmet = result.checks.filter((x) => !x.met).map((x) => ({ id: x.id, label: x.label, detail: x.detail }));
    await c.query(
      `INSERT INTO gates (project_id, stage, status, overridden, note, decided_by, decided_at)
       VALUES ($1, $2, 'go', true, $3, $4, now())
       ON CONFLICT (project_id, stage) DO UPDATE
         SET status = 'go', overridden = true, note = EXCLUDED.note, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at`,
      [id, b.stage, b.reason, currentActor()]
    );
    await logEventIn(c, id, "gate.overridden", `Overrode the ${stageLabel(b.stage)} gate: ${b.reason}`, { stage: b.stage, reason: b.reason, unmet, by: currentActor() });
    return processResponse(c, id);
  });
  return NextResponse.json(out);
});
