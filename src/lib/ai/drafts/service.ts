// What the routes call: generator listings with counts, the impact of a change, and optimisation runs.
import { plannerUrl } from "@/lib/admin/planner";
import { HttpError } from "@/lib/api/route";
import { getReasoning } from "@/lib/ai/models";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import type { Item } from "@/lib/types";
import { BUILD_SHEET, impactGraph, type ImpactGroup, type ImpactReply, type PlannerImpact } from "./impact";
import { applyDrafts, describe, measure, MEASURE_STORE, OPTIMISE_ACTIONS, type Measure, type OptimiseAction } from "./measure";
import { GENERATORS, OPTIMISE_GENERATOR, generator as findGenerator, generatorsFor } from "./registry";
import { buildContext, readConcept, runGenerator } from "./run";
import { listDrafts } from "./store";
import { readsText, type Draft, type GeneratorInfo, type GeneratorsReply, type RunResult } from "./shared";
import { safeFetch } from "@/lib/net/outbound";
import { currencyOf } from "@/lib/economics/currency";
import { sectionLabel } from "@/lib/menuLookup";

/** The generators for a concept (optionally only those writing one store), with what each would read. */
export async function generatorsInfo(projectId: string, opts: { store?: string; kind?: "section" | "optimise" | "links" } = {}): Promise<GeneratorsReply> {
  const concept = await readConcept(projectId);
  const reasoning = await getReasoning();
  const pending = await q<{ generator: string; n: number }>("SELECT generator, count(*)::int AS n FROM drafts WHERE project_id=$1 AND status='draft' GROUP BY generator", [projectId]);
  const pendingBy = new Map(pending.map((p) => [p.generator, p.n]));
  const list = GENERATORS.filter((g) => (!opts.store || g.to === opts.store) && (opts.kind ? g.kind === opts.kind : g.kind !== "links") && g.applies(concept.productType));
  const generators: GeneratorInfo[] = [];
  for (const g0 of list) {
    const g = g0 as unknown as Parameters<typeof buildContext>[0];
    const ctx = await buildContext(g, concept);
    // The target's own rows are read too (to avoid repeats), but the button names only what it works from.
    const counts = Object.fromEntries(g.from.filter((s) => s !== g.to).map((s) => [s, ctx.rows[s]?.length ?? 0]));
    const reads = Object.values(counts).reduce((a, n) => a + n, 0);
    generators.push({
      id: g.id,
      label: g.label,
      action: g.action,
      from: g.from,
      to: g.to,
      kind: g.kind,
      counts,
      reads,
      readsText: `from ${readsText(counts)}`,
      blocked: g.blocked(ctx),
      pending: pendingBy.get(g.id) ?? 0,
    });
  }
  return { configured: reasoning.ok, reason: reasoning.ok ? "" : reasoning.reason, model: reasoning.ok ? reasoning.info.model : "", generators };
}

const PLANNER_DOWN = "The planner is not reachable, so what this change affects cannot be worked out. Start the planner service, or set its address in Admin.";

/** Everything downstream of one row, from the planner service, grouped by section with why. */
export async function impactFor(projectId: string, itemId: number, timeoutMs = 4000): Promise<ImpactReply> {
  const concept = await readConcept(projectId);
  const items = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [projectId])).map(toItem);
  const changedItem = items.find((i) => i.id === itemId);
  if (!changedItem) throw new HttpError(404, "That row was not found in this concept.");
  const changed = { itemId, section: changedItem.section, title: changedItem.title };
  const graph = impactGraph(items);
  const url = await plannerUrl();
  if (!url) return { engine: "unavailable", changed, note: `${PLANNER_DOWN} (No planner address is set.)` };
  let res: Response;
  try {
    res = await safeFetch(`${url}/impact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: graph.nodes.map((n) => ({ id: n.id, section: n.section })), edges: graph.edges.map((e) => [e.from, e.to]), changed: [`i${itemId}`] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return { engine: "unavailable", changed, note: `${PLANNER_DOWN} (${err.name === "TimeoutError" ? `no answer within ${timeoutMs / 1000} s` : err.message ?? "unreachable"}.)` };
  }
  if (!res.ok) return { engine: "unavailable", changed, note: `The planner answered with an error (${res.status}), so what this change affects cannot be worked out.` };
  const body = (await res.json()) as PlannerImpact;
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const whyOf = new Map(graph.edges.map((e) => [`${e.from}>${e.to}`, e.why]));
  const groups = new Map<string, ImpactGroup>();
  for (const a of body.affected ?? []) {
    const n = nodeById.get(a.id);
    if (!n) continue;
    const steps = a.path.slice(1).map((id, k) => {
      const from = nodeById.get(a.path[k]);
      const why = whyOf.get(`${a.path[k]}>${id}`) ?? "";
      return `${from?.title ?? a.path[k]}: ${why}`;
    });
    const store = n.section;
    const g = groups.get(store) ?? {
      section: store,
      label: store === BUILD_SHEET ? "Wiring and soldering" : sectionLabel(store),
      rows: [],
      // The build sheet is the wires seen in another section: the wiring generator revises them.
      generator: generatorsFor(store === BUILD_SHEET ? "design/wiring" : store, concept.productType)[0]?.id ?? null,
    };
    g.rows.push({ itemId: n.itemId, nodeId: n.id, section: store, title: n.title, why: steps.join(" then "), path: a.path });
    groups.set(store, g);
  }
  const list = [...groups.values()];
  return { engine: "networkx", changed, total: list.reduce((a, g) => a + g.rows.length, 0), groups: list };
}

/** Realignment: run each relevant generator restricted to the affected rows of its store. */
export async function proposeUpdates(projectId: string, itemId: number, groups: { generator: string; itemIds: number[] }[], supersede: boolean, signal?: AbortSignal) {
  const items = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2`, [itemId, projectId]);
  if (!items.length) throw new HttpError(404, "That row was not found in this concept.");
  const changed: Item = toItem(items[0]);
  const why = `This row changed: [${changed.section}] "${changed.title}"${changed.body ? `: ${changed.body.slice(0, 600)}` : ""}. Bring the rows below in line with it.`;
  const runs: RunResult[] = [];
  for (const g of groups) {
    runs.push(await runGenerator({ projectId, generatorId: g.generator, reviseIds: [...new Set(g.itemIds)], why, supersede, signal, record: { realignment: { itemId } } }));
  }
  return runs;
}

// ---------------------------------------------------------------------------------------------
// Optimisation

export type OptimiseState = {
  id: OptimiseAction;
  generator: string;
  label: string;
  action: string;
  store: string;
  /** measured now, from the rows */
  now: { measure: Measure; text: string };
  last: null | {
    runId: string;
    at: string;
    before: { measure: Measure; text: string };
    /** the rows as they would be if every draft of the run still waiting were approved */
    ifApproved: { measure: Measure; text: string };
    drafts: { waiting: number; approved: number; rejected: number };
  };
};

export async function optimiseState(projectId: string): Promise<OptimiseState[]> {
  await readConcept(projectId);
  const currency = await currencyOf(projectId);
  const out: OptimiseState[] = [];
  for (const id of OPTIMISE_ACTIONS) {
    const g = findGenerator(OPTIMISE_GENERATOR[id])!;
    const store = MEASURE_STORE[id];
    const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [projectId, store])).map(toItem);
    const m = measure(id, rows);
    const ev = await q<{ data: { runId?: string; optimise?: { before?: Measure } }; created_at: Date }>(
      "SELECT data, created_at FROM events WHERE project_id=$1 AND kind='draft.run' AND data->>'generator'=$2 ORDER BY id DESC LIMIT 1",
      [projectId, g.id]
    );
    let last: OptimiseState["last"] = null;
    if (ev[0]?.data.runId && ev[0].data.optimise?.before) {
      const drafts: Draft[] = await listDrafts(projectId, { runId: ev[0].data.runId, status: "all" });
      const before = ev[0].data.optimise.before;
      const projected = measure(id, applyDrafts(rows, drafts));
      last = {
        runId: ev[0].data.runId,
        at: ev[0].created_at instanceof Date ? ev[0].created_at.toISOString() : String(ev[0].created_at),
        before: { measure: before, text: describe(id, before, currency) },
        ifApproved: { measure: projected, text: describe(id, projected, currency) },
        drafts: {
          waiting: drafts.filter((d) => d.status === "draft").length,
          approved: drafts.filter((d) => d.status === "approved").length,
          rejected: drafts.filter((d) => d.status === "rejected").length,
        },
      };
    }
    out.push({ id, generator: g.id, label: g.label, action: g.action, store, now: { measure: m, text: describe(id, m, currency) }, last });
  }
  return out;
}

export async function runOptimise(projectId: string, id: OptimiseAction, supersede: boolean, signal?: AbortSignal) {
  const g = findGenerator(OPTIMISE_GENERATOR[id])!;
  const store = MEASURE_STORE[id];
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [projectId, store])).map(toItem);
  if (!rows.length) throw new HttpError(400, store === "prototype/printing" ? "There are no print jobs yet." : "The parts list is empty.");
  const before = measure(id, rows);
  const currency = await currencyOf(projectId);
  return runGenerator({
    projectId,
    generatorId: g.id,
    reviseIds: rows.map((r) => r.id),
    why: "Propose only changes that serve the goal stated above.",
    supersede,
    signal,
    record: { optimise: { action: id, before, beforeText: describe(id, before, currency) } },
  });
}
