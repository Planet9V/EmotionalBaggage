// Realignment (plan 4.8): what is downstream of a changed row. The graph is built here from the rows,
// with no I/O; the NetworkX planner service (`POST /impact`) works out what is reachable and by which
// path. Nodes are rows ("i<id>"); a wire also has a build-sheet line ("b<id>"), the same row as seen in
// Wiring and soldering.
//
// Edges, each from a row to what depends on it:
//   requirement (key)  -> acceptance tests and parts that list the key in `requirements`
//   part (ref)         -> wires that name it (from, to or via), assembly steps that list it in `parts`,
//                         and every unit-economics line (the landed cost is made of the parts)
//   wire               -> its build-sheet line, and assembly steps that list either of its parts
//   decision (key)     -> every row of the sections it unlocks, and decisions that depend on it
//   any keyed row      -> rows that list its key in `after` (they wait on it)
import { keys, toDecision, toWire } from "@/lib/domain";
import { UNLOCK_STORES } from "@/lib/plan";
import type { Item } from "@/lib/types";

type ImpactNode = { id: string; itemId: number; section: string; title: string };
type ImpactEdge = { from: string; to: string; why: string };
export type ImpactGraph = { nodes: ImpactNode[]; edges: ImpactEdge[] };

/** Sections whose rows, when changed, prompt a realignment check. */
export const WATCHED_STORES = new Set(["concept/decisions", "design/requirements", "design/bom"]);

export const BUILD_SHEET = "prototype/wiring";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function impactGraph(items: Item[]): ImpactGraph {
  const nodes: ImpactNode[] = items.map((i) => ({ id: `i${i.id}`, itemId: i.id, section: i.section, title: i.title }));
  const edges: ImpactEdge[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string, why: string) => {
    if (from === to) return;
    const k = `${from}>${to}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ from, to, why });
  };

  const bySection = (s: string) => items.filter((i) => i.section === s);
  const byKey = new Map<string, Item>();
  for (const i of items) {
    const k = str(i.data.key);
    if (k && !byKey.has(k)) byKey.set(k, i);
  }
  const parts = bySection("design/bom");
  const byRef = new Map<string, Item>();
  for (const p of parts) {
    const r = str(p.data.ref);
    if (r && !byRef.has(r)) byRef.set(r, p);
  }
  const steps = bySection("prototype/assembly");
  const stepParts = steps.map((s) => ({ s, refs: new Set(keys(s.data.parts)) }));

  // requirement -> tests and parts
  for (const i of [...bySection("prototype/tests"), ...parts]) {
    for (const k of keys(i.data.requirements)) {
      const req = byKey.get(k);
      if (req && req.section === "design/requirements") add(`i${req.id}`, `i${i.id}`, `${i.section === "design/bom" ? "serves" : "checks"} requirement ${k}`);
    }
  }

  // part -> wires, steps, economics
  const economics = bySection("production/economics");
  for (const w of bySection("design/wiring")) {
    const wire = toWire(w);
    if (!wire) continue;
    nodes.push({ id: `b${w.id}`, itemId: w.id, section: BUILD_SHEET, title: `Build sheet: ${w.title}` });
    add(`i${w.id}`, `b${w.id}`, "soldered from this wire");
    for (const [ref, role] of [[wire.from, "from"], [wire.to, "to"]] as const) {
      const p = ref ? byRef.get(ref) : undefined;
      if (p) add(`i${p.id}`, `i${w.id}`, `wire runs ${role} ${ref}`);
    }
    for (const { s, refs } of stepParts) {
      if ((wire.from && refs.has(wire.from)) || (wire.to && refs.has(wire.to))) add(`i${w.id}`, `i${s.id}`, "the step works on a part this wire joins");
    }
  }
  for (const [ref, p] of byRef) {
    for (const { s, refs } of stepParts) if (refs.has(ref)) add(`i${p.id}`, `i${s.id}`, `the step uses ${ref}`);
    for (const e of economics) add(`i${p.id}`, `i${e.id}`, "the landed cost includes every part");
  }

  // decision -> unlocked sections, dependent decisions
  for (const i of bySection("concept/decisions")) {
    const d = toDecision(i);
    if (!d) continue;
    for (const u of d.unlocks) {
      const store = UNLOCK_STORES.get(u);
      if (!store) continue;
      for (const row of bySection(store)) add(`i${i.id}`, `i${row.id}`, `the decision opens ${u}`);
    }
    for (const other of bySection("concept/decisions")) {
      const od = toDecision(other);
      if (od && od.dependsOn.includes(d.key)) add(`i${i.id}`, `i${other.id}`, `depends on decision ${d.key}`);
    }
  }

  // keyed row -> rows waiting on it
  for (const i of items) {
    for (const k of keys(i.data.after)) {
      const up = byKey.get(k);
      if (up) add(`i${up.id}`, `i${i.id}`, `waits on ${k}`);
    }
  }
  return { nodes, edges };
}

type ImpactRow = { itemId: number; nodeId: string; section: string; title: string; why: string; path: string[] };
export type ImpactGroup = { section: string; label: string; rows: ImpactRow[]; generator: string | null };

export type ImpactReply =
  | { engine: "networkx"; changed: { itemId: number; section: string; title: string }; total: number; groups: ImpactGroup[] }
  | { engine: "unavailable"; changed: { itemId: number; section: string; title: string } | null; note: string };

/** What the planner answers to POST /impact. */
export type PlannerImpact = { affected: { id: string; section: string; path: string[] }[] };
