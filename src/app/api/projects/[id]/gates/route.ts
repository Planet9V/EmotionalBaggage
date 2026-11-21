import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { currentActor } from "@/lib/actor";
import { body, HttpError, route } from "@/lib/api/route";
import { lockConcept } from "@/lib/api/concepts";
import { processFor } from "@/lib/process/definitions";
import { evaluateGate, gateOf, stageLabel } from "@/lib/process/evaluate";
import { overrideBody, withdrawBody } from "@/lib/process/schemas";
import { factsOf, itemsOf, type GateRow } from "@/lib/process/server";
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
    const result = evaluateGate(gateOf(processFor(p.product_type), b.stage), await itemsOf(c, id), { name: p.name, oneLiner: p.one_liner }, await factsOf(c, id, p.product_type));
    if (result.met) throw new HttpError(409, `Every check of the ${stageLabel(b.stage)} gate is met, so there is nothing to override.`);
    const unmet = result.checks.filter((x) => !x.met).map((x) => ({ id: x.id, label: x.label, detail: x.detail }));
    await c.query(
      `INSERT INTO gates (project_id, stage, status, overridden, note, decided_by, decided_at)
       VALUES ($1, $2, 'go', true, $3, $4, now())
       ON CONFLICT (project_id, stage) DO UPDATE
         SET status = 'go', overridden = true, note = EXCLUDED.note, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at`,
      [id, b.stage, b.reason, currentActor()]
    );
    await logEventIn(c, id, "gate.overridden", `Overrode the ${stageLabel(b.stage)} gate: ${b.reason}`, {
      stage: b.stage,
      reason: b.reason,
      unmet,
      by: currentActor(),
      before: { overridden: false },
      after: { overridden: true, note: b.reason, decidedBy: currentActor() },
    });
    return processResponse(c, id);
  });
  return NextResponse.json(out);
});

/**
 * Withdraws an override. Body { stage }. The gate is judged on its checks again; the stage does not
 * move (moving back is the stage route's job). Who withdrew it and when are kept on the gate row and in
 * the history, with the reason that was withdrawn.
 */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req, withdrawBody);
  const out = await tx(async (c) => {
    await lockConcept(c, id);
    const was = await c.query<GateRow>("SELECT stage, status, overridden, note, decided_by, decided_at FROM gates WHERE project_id=$1 AND stage=$2 FOR UPDATE", [id, b.stage]);
    const g = was.rows[0];
    if (!g || !g.overridden) throw new HttpError(409, `The ${stageLabel(b.stage)} gate is not overridden, so there is nothing to withdraw.`);
    const by = currentActor();
    await c.query("UPDATE gates SET status='open', overridden=false, note='', decided_by=$3, decided_at=now() WHERE project_id=$1 AND stage=$2", [id, b.stage, by]);
    await logEventIn(c, id, "gate.override-withdrawn", `Withdrew the override of the ${stageLabel(b.stage)} gate`, {
      stage: b.stage,
      by,
      before: { overridden: true, note: g.note, decidedBy: g.decided_by, decidedAt: g.decided_at ? new Date(g.decided_at).toISOString() : null },
      after: { overridden: false, note: "", decidedBy: by },
    });
    return processResponse(c, id);
  });
  return NextResponse.json(out);
});
