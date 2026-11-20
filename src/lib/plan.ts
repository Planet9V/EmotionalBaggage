import type { Item, Plan, PlanNode } from "./types";

type RawNode = { id: string; itemId: number; title: string; section: string; status: string; minutes: number; after: string[] };

/** Any item with data.key is a step; data.after lists the keys it waits on; data.minutes is its duration. */
export function stepsFromItems(items: Item[]): RawNode[] {
  const nodes = items
    .filter((i) => typeof i.data.key === "string" && i.data.key)
    .map((i) => ({
      id: String(i.data.key),
      itemId: i.id,
      title: i.title,
      section: i.section,
      status: i.status,
      minutes: Number(i.data.minutes) || 0,
      after: String(i.data.after ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    }));
  const ids = new Set(nodes.map((n) => n.id));
  return nodes.map((n) => ({ ...n, after: n.after.filter((a) => ids.has(a) && a !== n.id) }));
}

/** Same result shape as the NetworkX planner, computed in-process when that service is not reachable. */
export function planFallback(raw: RawNode[], note?: string): Plan {
  const byId = new Map(raw.map((n) => [n.id, n]));
  const indeg = new Map(raw.map((n) => [n.id, n.after.length]));
  const out = new Map<string, string[]>(raw.map((n) => [n.id, []]));
  raw.forEach((n) => n.after.forEach((a) => out.get(a)!.push(n.id)));
  const wave = new Map<string, number>();
  const start = new Map<string, number>();
  const finish = new Map<string, number>();
  const pred = new Map<string, string | null>();
  const order: string[] = [];
  let frontier = raw.filter((n) => n.after.length === 0).map((n) => n.id);
  let w = 0;
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const n = byId.get(id)!;
      let s = 0;
      let p: string | null = null;
      for (const a of n.after) if ((finish.get(a) ?? 0) > s) { s = finish.get(a)!; p = a; }
      if (p === null && n.after.length) p = n.after[0];
      start.set(id, s); finish.set(id, s + n.minutes); pred.set(id, p); wave.set(id, w); order.push(id);
      for (const o of out.get(id)!) {
        indeg.set(o, indeg.get(o)! - 1);
        if (indeg.get(o) === 0) next.push(o);
      }
    }
    frontier = next;
    w++;
  }
  const stuck = raw.filter((n) => !wave.has(n.id)).map((n) => n.id);
  let end: string | null = null;
  for (const id of order) if (end === null || finish.get(id)! > finish.get(end)!) end = id;
  const critical: string[] = [];
  for (let c = end; c; c = pred.get(c) ?? null) critical.unshift(c);
  const crit = new Set(critical);
  const nodes: PlanNode[] = raw.map((n) => ({
    ...n,
    start: start.get(n.id) ?? 0,
    finish: finish.get(n.id) ?? 0,
    wave: wave.get(n.id) ?? -1,
    critical: crit.has(n.id),
  }));
  return {
    engine: "fallback",
    nodes,
    order,
    criticalPath: critical,
    totalMinutes: end ? finish.get(end)! : 0,
    cycles: stuck.length ? [stuck] : [],
    note,
  };
}
