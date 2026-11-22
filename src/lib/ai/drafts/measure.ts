// Before and after for the three optimisation actions (plan 4.9). Every figure here is counted or
// summed from the concept's rows. The model never supplies a number that appears here: a substitute
// part has no price until the user enters one, and a changed print job has no time until it is sliced.
import { readParts } from "@/lib/domain";
import type { Item } from "@/lib/types";
import type { Draft } from "./shared";
import { referenceUnitCost } from "@/lib/economics/compute";
import { DEFAULT_CURRENCY, majorText, toMajor } from "@/lib/economics/money";
import { readEconomics, type EconomicsRows } from "@/lib/economics/read";

/** The rows beside the parts list that the unit cost is worked from (cost lines, methods, batches, print jobs). */
export type CostRows = Omit<EconomicsRows, "parts">;
export const NO_COST_ROWS: CostRows = { economics: [], channels: [], methods: [], batches: [] };

export type CostMeasure = {
  parts: number;
  priced: number;
  /** sum of the parts that have a cost, as Unit economics prices them (major units) */
  pricedTotal: number;
  /** the whole list's cost, only when every part has a cost; otherwise null ("not priced") */
  total: number | null;
  /** unpriced parts that replaced a priced one (an approved substitute), and the sum of the prices they replaced */
  substitutes?: number;
  wasTotal?: number;
  /** the unit cost Unit economics shows (parts plus cost lines) at its batch size, major units; absent on a measurement recorded before this was read */
  unitCost?: number;
  batchSize?: number;
  /** false when a cost line beside the parts is not priced */
  unitComplete?: boolean;
};

export type CountMeasure = {
  /** rows in the parts list */
  rows: number;
  /** pieces: the sum of quantities, counting a row with no quantity as one */
  pieces: number;
  /** rows with no quantity entered */
  noQty: number;
  /** pieces that are fasteners: kind "fastener", or a screw, bolt, nut, washer, rivet, standoff or insert by name */
  fasteners: number;
};

export type PrintMeasure = {
  jobs: number;
  /** jobs whose rows hold a print time */
  sliced: number;
  /** total of the times held, in minutes; a range when a row gives one ("4-5 h") */
  low: number;
  high: number;
};

export type Measure = CostMeasure | CountMeasure | PrintMeasure;

/**
 * The cost of the parts and the unit cost, read from the unit economics (referenceUnitCost): the
 * same function, rows and batch size as Unit economics and Pricing, so the pages cannot disagree.
 */
export function measureCost(bom: Item[], rest: CostRows, currency: string): CostMeasure {
  const parts = readParts(bom);
  const unit = referenceUnitCost(readEconomics({ ...rest, parts: parts.map((p) => p.item) }, currency));
  const amount = new Map(unit.lines.filter((l) => l.group === "part").map((l) => [l.rowId, l.amount]));
  const major = (minor: number) => toMajor(minor, currency);
  const priced = parts.filter((p) => (amount.get(p.item.id) ?? null) !== null);
  const pricedTotal = major(unit.partsSubtotal);
  const subs = parts.filter((p) => (amount.get(p.item.id) ?? null) === null && typeof p.item.data.wasLine === "number");
  const wasTotal = Math.round(subs.reduce((a, p) => a + (p.item.data.wasLine as number), 0) * 100) / 100;
  return {
    parts: parts.length,
    priced: priced.length,
    pricedTotal,
    total: parts.length && priced.length === parts.length ? pricedTotal : null,
    ...(subs.length ? { substitutes: subs.length, wasTotal } : {}),
    ...(parts.length ? { unitCost: major(unit.total), batchSize: unit.batchSize, unitComplete: unit.complete } : {}),
  };
}

const FASTENER = /\b(screws?|bolts?|nuts?|washers?|rivets?|standoffs?|inserts?|fasteners?)\b/i;

function isFastener(i: Item) {
  return i.data.kind === "fastener" || FASTENER.test(i.title);
}

export function measureCount(bom: Item[]): CountMeasure {
  const parts = readParts(bom);
  let pieces = 0;
  let noQty = 0;
  let fasteners = 0;
  for (const p of parts) {
    const n = p.qty === null ? 1 : p.qty;
    if (p.qty === null) noQty++;
    pieces += n;
    if (isFastener(p.item)) fasteners += n;
  }
  return { rows: parts.length, pieces, noQty, fasteners };
}

/**
 * The print time a row holds, in minutes, as [low, high], or null when it holds none.
 * The slicer's `slice.seconds` wins, then `printMinutes` (a number); otherwise the `estimate` text is read: "45 min", "5 h", "4-5 h", "1 h 30 min".
 */
export function printMinutes(i: Item): [number, number] | null {
  // The slicer's own figure wins (written only by the slice route).
  const sliced = (i.data.slice as { seconds?: unknown } | undefined)?.seconds;
  if (typeof sliced === "number" && Number.isFinite(sliced) && sliced >= 0) return [sliced / 60, sliced / 60];
  const m = i.data.printMinutes;
  if (typeof m === "number" && Number.isFinite(m) && m >= 0) return [m, m];
  const text = typeof i.data.estimate === "string" ? i.data.estimate : "";
  if (!text.trim()) return null;
  const range = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*h/i.exec(text);
  if (range) return [Number(range[1]) * 60, Number(range[2]) * 60];
  const h = /(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/i.exec(text);
  const min = /(\d+(?:\.\d+)?)\s*min/i.exec(text);
  if (!h && !min) return null;
  const v = (h ? Number(h[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
  return [v, v];
}

export function measurePrint(printing: Item[]): PrintMeasure {
  let low = 0;
  let high = 0;
  let sliced = 0;
  for (const i of printing) {
    const t = printMinutes(i);
    if (!t) continue;
    sliced++;
    low += t[0];
    high += t[1];
  }
  return { jobs: printing.length, sliced, low: Math.round(low), high: Math.round(high) };
}

/** The rows as they would be if every one of these drafts were approved: computed, not predicted. */
export function applyDrafts(rows: Item[], drafts: Draft[]): Item[] {
  const out = new Map(rows.map((r) => [r.id, r]));
  let next = -1;
  for (const d of drafts) {
    if (d.status !== "draft") continue;
    if (d.op.op === "remove") {
      if (d.itemId !== null) out.delete(d.itemId);
    } else if (d.itemId !== null && out.has(d.itemId)) {
      const r = out.get(d.itemId)!;
      out.set(d.itemId, { ...r, title: d.title, body: d.body, data: d.data });
    } else if (d.op.op === "add") {
      out.set(next, { id: next, projectId: d.projectId, section: d.targetStore, title: d.title, body: d.body, data: d.data, status: "", sort: 0 });
      next--;
    }
  }
  return [...out.values()];
}

export const OPTIMISE_ACTIONS = ["cost", "parts", "print"] as const;
export type OptimiseAction = (typeof OPTIMISE_ACTIONS)[number];

export const MEASURE_STORE: Record<OptimiseAction, string> = { cost: "design/bom", parts: "design/bom", print: "prototype/printing" };

export function measure(action: OptimiseAction, rows: Item[], cost: { rest: CostRows; currency: string }): Measure {
  return action === "cost" ? measureCost(rows, cost.rest, cost.currency) : action === "parts" ? measureCount(rows) : measurePrint(rows);
}

const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/** A measurement in words, for the screen and the activity log. */
export function describe(action: OptimiseAction, m: Measure, currency: string = DEFAULT_CURRENCY): string {
  const money = (n: number) => majorText(n, currency);
  if (action === "cost") {
    const c = m as CostMeasure;
    if (!c.parts) return "No parts";
    if (c.total !== null) {
      const unit = c.unitCost === undefined ? "" : `; unit cost ${money(c.unitCost)} at ${c.batchSize ?? 1} ${c.batchSize === 1 ? "unit" : "units"}${c.unitComplete === false ? " (a cost line is not priced)" : ""}`;
      return `${money(c.total)} for ${c.parts} parts${unit}`;
    }
    const was = c.substitutes ? `; ${c.substitutes === 1 ? "1 substitute has" : `${c.substitutes} substitutes have`} no cost yet, was ${money(c.wasTotal ?? 0)}` : "";
    if (!c.priced) return `Not priced (none of ${c.parts} parts has a cost${was})`;
    return `Not priced (${c.priced} of ${c.parts} parts have a cost, adding up to ${money(c.pricedTotal)}${was})`;
  }
  if (action === "parts") {
    const c = m as CountMeasure;
    return `${c.rows} parts, ${c.pieces} pieces, ${c.fasteners} fasteners${c.noQty ? ` (${c.noQty} with no quantity counted as one)` : ""}`;
  }
  const p = m as PrintMeasure;
  if (!p.jobs) return "No print jobs";
  if (!p.sliced) return `Not sliced yet (${p.jobs} print jobs, none with a print time)`;
  const t = p.low === p.high ? hm(p.low) : `${hm(p.low)} to ${hm(p.high)}`;
  return `${t} over ${p.sliced} of ${p.jobs} print jobs${p.sliced < p.jobs ? ` (${p.jobs - p.sliced} not sliced yet)` : ""}`;
}
