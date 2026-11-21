// Wire gauge, colour, length and strip length for the build sheet. Pure functions: nothing here reads a database or the browser.
//
// Gauge comes from the current a wire carries, and only when a current is set. A current is set on the wire row (data.currentMa,
// typed on the sheet) or, failing that, on a part at one of its ends (data.currentMa on the part, mA drawn). With neither the gauge
// is "unknown" and a gauge typed on the wire (data.gauge) is shown as the user's. Nothing is guessed.
import type { Part, Wire } from "@/lib/domain";
import { COLOUR_SWATCH, CLASS_ORDER, estimateLength, signalNetsOf, suggestedColour, type Length, type PartLite, type Step } from "./derive";

/**
 * Maximum current for chassis wiring, copper, by AWG. Chassis wiring means wires inside equipment, in free air and not bundled
 * tightly, which is what a prototype's internal wiring is. Source: PowerStream, "Wire Gauge and Current Limits", column
 * "Maximum amps for chassis wiring", https://www.powerstream.com/Wire_Size.htm (read 21 Nov 2026). The page says the figures are
 * for single wires and are not for long bundles; a bundle or a hot enclosure needs a larger gauge than this table gives.
 */
export const AMPACITY_CHASSIS: readonly { awg: number; amps: number }[] = [
  { awg: 30, amps: 0.86 }, { awg: 28, amps: 1.4 }, { awg: 26, amps: 2.2 }, { awg: 24, amps: 3.5 }, { awg: 22, amps: 7 },
  { awg: 20, amps: 11 }, { awg: 18, amps: 16 }, { awg: 16, amps: 22 }, { awg: 14, amps: 32 }, { awg: 12, amps: 41 }, { awg: 10, amps: 55 },
];
export const AMPACITY_SOURCE = { label: "PowerStream, Wire Gauge and Current Limits (chassis wiring)", url: "https://www.powerstream.com/Wire_Size.htm" };

export type GaugeChoice =
  | { kind: "chosen"; awg: number; amps: number; mA: number }
  | { kind: "above"; mA: number; maxAmps: number }
  | { kind: "unknown" };

/** The thinnest wire in the table that carries the current. Current in mA; zero or negative is treated as not set. */
export function gaugeFor(mA: number | null): GaugeChoice {
  if (mA === null || !Number.isFinite(mA) || mA <= 0) return { kind: "unknown" };
  const A = mA / 1000;
  const hit = AMPACITY_CHASSIS.find((r) => r.amps >= A - 1e-12);
  if (!hit) return { kind: "above", mA, maxAmps: AMPACITY_CHASSIS[AMPACITY_CHASSIS.length - 1].amps };
  return { kind: "chosen", awg: hit.awg, amps: hit.amps, mA };
}

const numOf = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type Current = { mA: number | null; basis: "wire" | "part" | "none"; from?: string };

/** The wire's own figure first; else the larger of the two end parts' figures (the safe side), naming which part it came from. */
export function wireCurrent(w: Wire, parts: Map<string, PartLite>): Current {
  const own = numOf((w.item.data as Record<string, unknown>).currentMa);
  if (own !== null) return { mA: own, basis: "wire" };
  const ends = [w.from, w.to].map((r) => ({ ref: r, mA: numOf(parts.get(r)?.item.data.currentMa) })).filter((e) => e.mA !== null) as { ref: string; mA: number }[];
  if (!ends.length) return { mA: null, basis: "none" };
  const top = ends.reduce((a, b) => (b.mA > a.mA ? b : a));
  return { mA: top.mA, basis: "part", from: top.ref };
}

/** The gauge shown for a wire: the user's typed one wins and says so; else the table's choice from the current. */
export type Gauge = { awg: number | null; label: string; why: string; set: "user" | "table" | "none" };

export function gaugeOf(w: Wire, cur: Current): Gauge {
  const typed = numOf((w.item.data as Record<string, unknown>).gauge);
  if (typed !== null) return { awg: Math.round(typed), label: `${Math.round(typed)} AWG`, why: "set on this wire", set: "user" };
  const g = gaugeFor(cur.mA);
  if (g.kind === "chosen")
    return { awg: g.awg, label: `${g.awg} AWG`, why: `${cur.mA} mA${cur.basis === "part" ? ` from ${cur.from}` : ""}; ${g.awg} AWG carries up to ${g.amps} A as chassis wiring`, set: "table" };
  if (g.kind === "above") return { awg: null, label: "over table", why: `${g.mA} mA is more than the ${g.maxAmps} A the table goes to`, set: "none" };
  return { awg: null, label: "not set", why: "no current is set for this wire or its parts", set: "none" };
}

// ------------------------------------------------------------------ strip lengths

export const CONNECTIONS = [
  { key: "solder", label: "Soldered to a pad or pin", strip: 4 },
  { key: "dupont", label: "Dupont 2.54 mm crimp", strip: 3 },
  { key: "jst-xh", label: "JST XH crimp", strip: 2.5 },
  { key: "jst-ph", label: "JST PH crimp", strip: 2 },
  { key: "molex-kk", label: "Molex KK 2.54 mm crimp", strip: 2.5 },
  { key: "ferrule", label: "Ferrule in a screw terminal", strip: 8 },
  { key: "screw", label: "Bare wire in a screw terminal", strip: 6 },
  { key: "lug", label: "Ring or spade lug", strip: 6 },
] as const;
export type ConnectionKey = (typeof CONNECTIONS)[number]["key"];

/**
 * Starting strip lengths in mm. They are general bench practice, not taken from a connector's data sheet, and the sheet says so
 * and lets each be changed. A crimp's data sheet gives the strip length for that exact terminal and wire; use it when it differs.
 */
export const DEFAULT_STRIP: Record<string, number> = Object.fromEntries(CONNECTIONS.map((c) => [c.key, c.strip]));

export const connectionOf = (p: PartLite | undefined): string => {
  const v = p?.item.data.connection;
  return typeof v === "string" && CONNECTIONS.some((c) => c.key === v) ? v : "";
};

export type SpecRow = {
  step: number;
  wire: Wire;
  colour: string;
  colourSet: boolean;
  current: Current;
  gauge: Gauge;
  length: Length;
  /** strip length at each end in mm, or null when the end part has no connection type */
  stripFrom: number | null;
  stripTo: number | null;
};

const COLOUR_ORDER = ["red", "black", "yellow", "green", "blue", "white", "orange", "purple", "brown", "grey", "any pair"];
const colourRank = (c: string) => { const i = COLOUR_ORDER.indexOf(c); return i < 0 ? COLOUR_ORDER.length : i; };

export function specRows(steps: Step[], parts: Map<string, PartLite>, routing: number, allowance: number, strips: Record<string, number> = DEFAULT_STRIP): SpecRow[] {
  const nets = signalNetsOf(steps);
  const stripOf = (ref: string) => { const k = connectionOf(parts.get(ref)); return k && k in strips ? strips[k] : null; };
  const rows = steps.map(({ n, wire }): SpecRow => {
    const typed = (wire.item.data as Record<string, unknown>).colour;
    const colourSet = typeof typed === "string" && typed.trim() !== "";
    const current = wireCurrent(wire, parts);
    return {
      step: n, wire, colour: colourSet ? String(typed).trim().toLowerCase() : suggestedColour(wire, nets), colourSet, current, gauge: gaugeOf(wire, current),
      length: estimateLength(wire, parts, routing, allowance), stripFrom: stripOf(wire.from), stripTo: stripOf(wire.to),
    };
  });
  // Cut list order: colour, then the thicker gauge first (unknown last), then soldering step.
  return rows.sort((a, b) => colourRank(a.colour) - colourRank(b.colour) || a.colour.localeCompare(b.colour) || (a.gauge.awg ?? 99) - (b.gauge.awg ?? 99) || a.step - b.step);
}

export type ColourTotal = { colour: string; gauge: string; wires: number; mm: number; withLength: number; routed: number };

/** Total wire to cut per colour and gauge, from the lengths shown. A wire with no length adds nothing and is counted apart. */
export function totalsByColour(rows: SpecRow[]): ColourTotal[] {
  const by = new Map<string, ColourTotal>();
  for (const r of rows) {
    const key = `${r.colour}\u0000${r.gauge.label}`;
    const t = by.get(key) ?? { colour: r.colour, gauge: r.gauge.label, wires: 0, mm: 0, withLength: 0, routed: 0 };
    t.wires += 1;
    if (r.length) { t.mm += r.length.mm; t.withLength += 1; if (r.length.source === "routed") t.routed += 1; }
    by.set(key, t);
  }
  return [...by.values()];
}

/** One distinct strip instruction per connection type used, with how many wire ends use it. */
export function stripSummary(rows: SpecRow[], parts: Map<string, PartLite>, strips: Record<string, number> = DEFAULT_STRIP) {
  const counts = new Map<string, number>();
  for (const r of rows) for (const ref of [r.wire.from, r.wire.to]) { const k = connectionOf(parts.get(ref)); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  const unset = new Set<string>();
  for (const r of rows) for (const ref of [r.wire.from, r.wire.to]) if (!connectionOf(parts.get(ref))) unset.add(ref);
  return {
    used: CONNECTIONS.filter((c) => counts.has(c.key)).map((c) => ({ key: c.key, label: c.label, ends: counts.get(c.key)!, strip: strips[c.key] ?? c.strip })),
    unset: [...unset].sort(),
  };
}

export const swatch = (c: string) => COLOUR_SWATCH[c];
export { CLASS_ORDER };
export type { Part };
