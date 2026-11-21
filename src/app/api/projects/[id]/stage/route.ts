import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { currentActor } from "@/lib/actor";
import { body, HttpError, route } from "@/lib/api/route";
import { lockConcept } from "@/lib/api/concepts";
import { STAGES } from "@/lib/menu";
import { processFor } from "@/lib/process/definitions";
import { gatePassed, stageLabel } from "@/lib/process/evaluate";
import { stageBody } from "@/lib/process/schemas";
import { gatesOf, itemsOf } from "@/lib/process/server";
import { processResponse } from "@/lib/process/state";

type Ctx = { params: Promise<{ id: string }> };

const indexOf = (key: string) => STAGES.findIndex((s) => s.key === key);

/**
 * Moves the concept to another stage. Body { stage }.
 * - Forward one stage at a time, and only when the current stage's gate is passed: every check
 *   met, or overridden with a reason. Refused with 409 and the unmet checks in `detail.unmet`.
 * - Back to any earlier stage, always.
 * Gates never block reading or editing (D6); this route is the only thing they hold back.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req, stageBody);
  const out = await tx(async (c) => {
    const p = await lockConcept(c, id);
    // A stored stage the menu no longer has counts as the first stage.
    const from = indexOf(p.stage) >= 0 ? p.stage : STAGES[0].key;
    const fi = indexOf(from);
    const ti = indexOf(b.stage);
    if (ti === fi) throw new HttpError(400, `The concept is already in the ${stageLabel(from)} stage.`);

    if (ti < fi) {
      await c.query("UPDATE projects SET stage=$2, updated_at=now() WHERE id=$1", [id, b.stage]);
      await logEventIn(c, id, "stage.moved-back", `Moved back from ${stageLabel(from)} to ${stageLabel(b.stage)}`, { from, to: b.stage, by: currentActor() });
      return processResponse(c, id);
    }

    if (ti > fi + 1) {
      throw new HttpError(400, `Advance one stage at a time. The next stage is ${stageLabel(STAGES[fi + 1].key)}.`);
    }

    const state = { stage: from, gates: await gatesOf(c, id) };
    const g = gatePassed(processFor(p.product_type), state, from, await itemsOf(c, id), { name: p.name, oneLiner: p.one_liner });
    if (!g.passed) {
      const unmet = g.result.checks.filter((x) => !x.met).map((x) => ({ id: x.id, label: x.label, detail: x.detail, href: x.href }));
      throw new HttpError(
        409,
        `The ${stageLabel(from)} gate is not passed. Meet ${unmet.length === 1 ? "this check" : `these ${unmet.length} checks`}, or override the gate with a reason: ${unmet.map((x) => x.label).join("; ")}.`,
        { unmet }
      );
    }
    if (!g.overridden) {
      // Passed on its checks: record that, and by whom, on the gate row.
      await c.query(
        `INSERT INTO gates (project_id, stage, status, decided_by, decided_at) VALUES ($1, $2, 'go', $3, now())
         ON CONFLICT (project_id, stage) DO UPDATE SET status = 'go', decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at`,
        [id, from, currentActor()]
      );
    }
    await c.query("UPDATE projects SET stage=$2, updated_at=now() WHERE id=$1", [id, b.stage]);
    const how = g.overridden && !g.met ? "override" : "checks";
    await logEventIn(
      c,
      id,
      "stage.advanced",
      `Advanced from ${stageLabel(from)} to ${stageLabel(b.stage)}${how === "override" ? " on an override" : " with every check met"}`,
      { from, to: b.stage, passedBy: how, by: currentActor() }
    );
    return processResponse(c, id);
  });
  return NextResponse.json(out);
});
