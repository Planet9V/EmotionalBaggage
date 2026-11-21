import type { PoolClient } from "pg";
import { notFound } from "@/lib/api/route";
import { factsOf, gatesOf, historyOf, type ProcessEvent } from "./server";
import type { GateRecord } from "./evaluate";
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
};

type Runner = Pick<PoolClient, "query">;

export async function processResponse(c: Runner, id: string): Promise<ProcessResponse> {
  const r = await c.query<{ id: string; name: string; one_liner: string; product_type: string; stage: string }>(
    "SELECT id, name, one_liner, product_type, stage FROM projects WHERE id=$1",
    [id]
  );
  if (!r.rows.length) throw notFound("That concept");
  const p = r.rows[0];
  return {
    projectId: p.id,
    name: p.name,
    oneLiner: p.one_liner,
    productType: p.product_type,
    stage: p.stage,
    gates: await gatesOf(c, id),
    history: await historyOf(c, id),
    facts: await factsOf(c, id, p.product_type),
  };
}
