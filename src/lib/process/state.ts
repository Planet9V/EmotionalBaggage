import type { PoolClient } from "pg";
import { notFound } from "@/lib/api/route";
import { factsOf, gatesOf, historyOf, itemsOf, type ProcessEvent } from "./server";
import { skippedGates, type GateRecord, type SkippedGate } from "./evaluate";
import { processFor } from "./definitions";
import type { GateFacts } from "./computed";

/** What GET /api/projects/[id]/process answers, and what the stage and gate routes answer after a change. */
export type ProcessResponse = {
  projectId: string;
  name: string;
  oneLiner: string;
  productType: string;
  stage: string;
  gates: GateRecord[];
  history: ProcessEvent[];
  /** what the gates need beyond the rows (currency, electrical check counts), worked out on the server */
  facts: GateFacts;
  /** stages before the current one whose gate is neither passed nor overridden (worked out against today's rows) */
  skipped: SkippedGate[];
};

type Runner = Pick<PoolClient, "query">;

export async function processResponse(c: Runner, id: string): Promise<ProcessResponse> {
  const r = await c.query<{ id: string; name: string; one_liner: string; product_type: string; stage: string }>(
    "SELECT id, name, one_liner, product_type, stage FROM projects WHERE id=$1",
    [id]
  );
  if (!r.rows.length) throw notFound("That concept");
  const p = r.rows[0];
  const gates = await gatesOf(c, id);
  const facts = await factsOf(c, id, p.product_type);
  const skipped = skippedGates(processFor(p.product_type), { stage: p.stage, gates }, await itemsOf(c, id), { name: p.name, oneLiner: p.one_liner }, facts);
  return {
    projectId: p.id,
    name: p.name,
    oneLiner: p.one_liner,
    productType: p.product_type,
    stage: p.stage,
    gates,
    history: await historyOf(c, id),
    facts,
    skipped,
  };
}
