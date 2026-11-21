import type { PoolClient } from "pg";
import { notFound } from "@/lib/api/route";
import { gatesOf, historyOf, type ProcessEvent } from "./server";
import type { GateRecord } from "./evaluate";

/** What GET /api/projects/[id]/process answers, and what the stage and gate routes answer after a change. */
export type ProcessResponse = {
  projectId: string;
  name: string;
  oneLiner: string;
  productType: string;
  stage: string;
  gates: GateRecord[];
  history: ProcessEvent[];
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
  };
}
