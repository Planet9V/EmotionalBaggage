import type { Item, Plan, PlanDropped, PlanEdge, PlanNode } from "./types";
import { isStep, keys, toDecision } from "./domain";
import { CLOSED, STAGES, storeKey } from "./menu";

export { stepsFromItems } from "./domain/step";

/** The section that holds the decision tree. */
export const DECISIONS_STORE = "concept/decisions";

/** A node of the plan graph before it is scheduled. */
export type GraphNode = Omit<PlanNode, "start" | "finish" | "wave" | "critical" | "blocked">;

export type PlanGraphResult = {
  nodes: GraphNode[];
  edges: PlanEdge[];
  dropped: PlanDropped[];
  duplicates: string[];
};

/**
 * Section paths and store keys, each mapped to the store whose rows that section shows.
 * Several sections are views onto one store (Sourcing and Physical layout show design/bom;
 * Schematic and Wiring show design/wiring), so `prototype/sourcing` resolves to `design/bom`.
 */
export const UNLOCK_STORES: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const stage of STAGES) {
    for (const section of stage.sections) {
      const store = storeKey(stage, section);
      m.set(`${stage.key}/${section.key}`, store);
      if (!m.has(store)) m.set(store, store);
    }
  }
  return m;
})();

/**
 * The order-of-operations graph of a concept. Pure: no I/O.
 *
 * - every row with a key is a step, except keyed rows in concept/decisions, which are decisions;
 * - a step's remaining minutes are 0 once its status is closed; a decision is a zero-minute
 *   milestone, done once an option is chosen;
 * - edges: `a -> b` for each key in step b's `after`; `d1 -> d2` for each key in decision d2's
 *   `dependsOn`; `d -> s` for every step s in a section listed in decision d's `unlocks`
 *   (entries that are not sections are ignored);
 * - links to keys that do not exist, and links from a node to itself, are dropped and listed.
 */
export function planGraph(items: Item[]): PlanGraphResult {
  type Draft = GraphNode & { wants: string[]; unlocks: string[] };
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const i of items) {
    if (!isStep(i)) continue;
    const id = String(i.data.key);
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }
    seen.add(id);
    const base = { id, itemId: i.id, title: i.title, section: i.section, status: i.status, after: [] as string[] };
    const d = i.section === DECISIONS_STORE ? toDecision(i) : null;
    if (d) {
      drafts.push({ ...base, kind: "decision", minutes: 0, remaining: 0, done: d.chosen !== "", wants: d.dependsOn, unlocks: d.unlocks });
    } else {
      const minutes = Math.max(0, Number(i.data.minutes) || 0);
      const done = CLOSED.has(i.status);
      drafts.push({ ...base, kind: "step", minutes, remaining: done ? 0 : minutes, done, wants: keys(i.data.after), unlocks: [] });
    }
  }

  const ids = new Set(drafts.map((n) => n.id));
  const edges: PlanEdge[] = [];
  const dropped: PlanDropped[] = [];
  const pairs = new Set<string>();
  const add = (from: string, to: string, rule: PlanEdge["rule"]) => {
    if (from === to) return void dropped.push({ from, to, rule, reason: "self" });
    if (!ids.has(from) || !ids.has(to)) return void dropped.push({ from, to, rule, reason: "unknown key" });
    const k = `${from}\u0000${to}`;
    if (pairs.has(k)) return;
    pairs.add(k);
    edges.push({ from, to, rule });
  };

  for (const n of drafts) for (const a of n.wants) add(a, n.id, n.kind === "step" ? "after" : "dependsOn");

  const stepsByStore = new Map<string, string[]>();
  for (const n of drafts) if (n.kind === "step") stepsByStore.set(n.section, [...(stepsByStore.get(n.section) ?? []), n.id]);
  for (const n of drafts) {
    const stores = new Set(n.unlocks.map((u) => UNLOCK_STORES.get(u)).filter((s): s is string => !!s));
    for (const store of stores) for (const s of stepsByStore.get(store) ?? []) add(n.id, s, "unlocks");
  }

  const nodes: GraphNode[] = drafts.map((n) => {
    const { wants, unlocks: _unlocks, ...rest } = n;
    void _unlocks;
    return { ...rest, after: wants.filter((a) => a !== n.id && ids.has(a)) };
  });
  return { nodes, edges, dropped, duplicates: [...duplicates] };
}

/** What the NetworkX service takes at POST /plan. */
export function plannerRequest(g: PlanGraphResult) {
  return {
    nodes: g.nodes.map((n) => ({ id: n.id, minutes: n.minutes, remaining: n.remaining })),
    edges: g.edges.map((e) => [e.from, e.to] as [string, string]),
  };
}

/** What the NetworkX service answers. */
export type PlannerResponse = {
  order: string[];
  wave: Record<string, number>;
  start: Record<string, number>;
  finish: Record<string, number>;
  critical_path: string[];
  total_minutes: number;
  planned_minutes: number;
  cycles: string[][];
  blocked: string[];
};

/** The planner's answer laid onto the graph. */
export function planFromService(g: PlanGraphResult, p: PlannerResponse): Plan {
  const crit = new Set(p.critical_path);
  const blocked = new Set(p.blocked);
  const nodes: PlanNode[] = g.nodes.map((n) => {
    const scheduled = n.id in p.wave && !blocked.has(n.id);
    return {
      ...n,
      start: scheduled ? (p.start[n.id] ?? 0) : 0,
      finish: scheduled ? (p.finish[n.id] ?? 0) : 0,
      wave: scheduled ? p.wave[n.id] : -1,
      critical: crit.has(n.id),
      blocked: blocked.has(n.id),
    };
  });
  return {
    engine: "networkx",
    nodes,
    edges: g.edges,
    order: p.order,
    criticalPath: p.critical_path,
    totalMinutes: p.total_minutes,
    plannedMinutes: p.planned_minutes,
    cycles: p.cycles,
    dropped: g.dropped,
    duplicates: g.duplicates,
  };
}

/** The planner did not answer: list the nodes, give no order. Never invents one. */
export function planUnavailable(g: PlanGraphResult, note: string): Plan {
  return {
    engine: "unavailable",
    nodes: g.nodes.map((n) => ({ ...n, start: 0, finish: 0, wave: -1, critical: false, blocked: false })),
    edges: g.edges,
    order: [],
    criticalPath: [],
    totalMinutes: 0,
    plannedMinutes: 0,
    cycles: [],
    dropped: g.dropped,
    duplicates: g.duplicates,
    note,
  };
}
