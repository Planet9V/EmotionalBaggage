// Wire gauge, colour, length and strip length for the build sheet. Pure functions: nothing here reads a database or the browser.
//
// Gauge comes from the current a wire carries, and only when a current is set. A current is set on the wire row (data.currentMa,
// typed on the sheet) or, failing that, on a part at one of its ends (data.currentMa on the part, mA drawn). With neither the gauge
// is "unknown" and a gauge typed on the wire (data.gauge) is shown as the user's. Nothing is guessed.
import type { Wire } from "@/lib/domain";
import { COLOUR_SWATCH, estimateLength, signalNetsOf, suggestedColour, type Length, type PartLite, type Step } from "./derive";

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

/**
 * The gauge shown for a wire and the rule that decided it. A gauge typed on the wire wins. Otherwise the thicker of
 * the gauge the current needs (the ampacity table, single wire in free air) and the thinnest wire the connectors at
 * its ends accept (their makers' data sheets). `decided` says which, in words, for the sheet; `warning` flags a wire
 * that is too thick or too thin for a connector.
 */
export type Gauge = { awg: number | null; label: string; why: string; set: "user" | "table" | "connector" | "none"; decided: string; warning?: string };

type EndRange = { ref: string; label: string; range: WireRange | null };

const ASSUMPTION = "single wire in free air; a tight bundle or a warm enclosure needs a thicker wire";

export function gaugeOf(w: Wire, cur: Current, ends: EndRange[] = []): Gauge {
  const ranged = ends.filter((e): e is EndRange & { range: WireRange } => !!e.range);
  const unsourced = ends.filter((e) => !e.range && e.label);
  const unsourcedNote = unsourced.length ? ` ${[...new Set(unsourced.map((e) => e.label))].join(", ")}: accepted wire sizes not sourced, so not checked.` : "";
  const fits = (awg: number) => {
    const bad = ranged.filter((e) => awg < e.range.thickest || awg > e.range.thinnest);
    return bad.length ? `${awg} AWG is outside what ${bad.map((e) => `${e.label} at ${e.ref} takes (${e.range.thickest} to ${e.range.thinnest} AWG)`).join(" and ")}.` : undefined;
  };
  const typed = numOf((w.item.data as Record<string, unknown>).gauge);
  if (typed !== null) {
    const awg = Math.round(typed);
    return { awg, label: `${awg} AWG`, why: "set on this wire", set: "user", decided: `Typed on this wire.${unsourcedNote}`, warning: fits(awg) };
  }
  // the connectors' thinnest accepted wire, the most demanding end
  const floor = ranged.length ? ranged.reduce((a, b) => (b.range.thinnest < a.range.thinnest ? b : a)) : null;
  const g = gaugeFor(cur.mA);
  const curText = cur.mA !== null ? `${cur.mA} mA${cur.basis === "part" ? ` from ${cur.from}` : ""}` : "";
  if (g.kind === "above") return { awg: null, label: "over table", why: `${g.mA} mA is more than the ${g.maxAmps} A the table goes to`, set: "none", decided: `${g.mA} mA is more than the table covers. Size it from the wire maker's data.` };
  if (g.kind === "chosen") {
    if (floor && floor.range.thinnest < g.awg) {
      const awg = floor.range.thinnest;
      return {
        awg, label: `${awg} AWG`, set: "connector",
        why: `${curText} needs only ${g.awg} AWG, but ${floor.label} at ${floor.ref} takes ${floor.range.thickest} to ${floor.range.thinnest} AWG`,
        decided: `Connector: ${floor.label} at ${floor.ref} holds ${floor.range.thinnest} AWG at the thinnest (${floor.range.source.label}); the current alone (${curText}) would allow ${g.awg} AWG.${unsourcedNote}`,
        warning: fits(awg),
      };
    }
    return {
      awg: g.awg, label: `${g.awg} AWG`, set: "table",
      why: `${curText}; ${g.awg} AWG carries up to ${g.amps} A as chassis wiring`,
      decided: `Current: ${curText} needs ${g.awg} AWG, which carries up to ${g.amps} A (${ASSUMPTION}).${floor ? ` ${floor.label} accepts it.` : ""}${unsourcedNote}`,
      warning: fits(g.awg),
    };
  }
  if (floor) {
    const awg = floor.range.thinnest;
    return { awg, label: `${awg} AWG`, set: "connector", why: `no current set; ${floor.label} at ${floor.ref} takes ${floor.range.thickest} to ${floor.range.thinnest} AWG`, decided: `Connector only: no current is set, so this is the thinnest wire ${floor.label} at ${floor.ref} holds (${floor.range.source.label}). Set the current to check it carries enough.${unsourcedNote}`, warning: fits(awg) };
  }
  return { awg: null, label: "not set", why: "no current is set for this wire or its parts", set: "none", decided: `No current is set for this wire or its parts.${unsourcedNote}` };
}

// ------------------------------------------------------------------ strip lengths

/**
 * Connection types, their starting strip lengths and the wire sizes each terminal accepts. `awg` is taken from the
 * terminal maker's own data sheet and names it; null means no maker's figure could be read for a type this generic,
 * so nothing is constrained and the sheet says "not sourced". Read on 21 Nov 2026:
 *  - Dupont 2.54 mm: the name comes from the Berg (now Amphenol FCI) Mini-PV terminal; FCI's data sheet for the
 *    Mini-PV Basics+ crimp 48051-000LF gives 22 to 26 AWG. Unbranded "Dupont" terminals copy it and may differ.
 *  - JST XH: JST's XH data sheet, applicable wire AWG #30 to #22 (contact 001 for 28 to 22, 002 for 30 to 26).
 *  - JST PH: JST's PH data sheet, applicable wire AWG #32 to #24.
 *  - Molex KK 254, ferrules, screw terminals and lugs: each depends on the exact terminal; not sourced.
 */
export type WireRange = { thickest: number; thinnest: number; source: { label: string; url: string } };

export const CONNECTIONS = [
  { key: "solder", label: "Soldered to a pad or pin", strip: 4, awg: null },
  { key: "dupont", label: "Dupont 2.54 mm crimp", strip: 3, awg: { thickest: 22, thinnest: 26, source: { label: "Amphenol FCI Mini-PV Basics+ 48051-000LF data sheet", url: "https://nonprod.docs.rs-online.com/ab4f/0900766b8145084a.pdf" } } },
  { key: "jst-xh", label: "JST XH crimp", strip: 2.5, awg: { thickest: 22, thinnest: 30, source: { label: "JST XH connector data sheet", url: "https://www.jst-mfg.com/product/pdf/eng/eXH.pdf" } } },
  { key: "jst-ph", label: "JST PH crimp", strip: 2, awg: { thickest: 24, thinnest: 32, source: { label: "JST PH connector data sheet", url: "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf" } } },
  { key: "molex-kk", label: "Molex KK 2.54 mm crimp", strip: 2.5, awg: null },
  { key: "ferrule", label: "Ferrule in a screw terminal", strip: 8, awg: null },
  { key: "screw", label: "Bare wire in a screw terminal", strip: 6, awg: null },
  { key: "lug", label: "Ring or spade lug", strip: 6, awg: null },
] as const satisfies readonly { key: string; label: string; strip: number; awg: WireRange | null }[];

/**
 * Starting strip lengths in mm. They are general bench practice, not taken from a connector's data sheet, and the sheet says so
 * and lets each be changed. A crimp's data sheet gives the strip length for that exact terminal and wire; use it when it differs.
 */
export const DEFAULT_STRIP: Record<string, number> = Object.fromEntries(CONNECTIONS.map((c) => [c.key, c.strip]));

export const connectionOf = (p: PartLite | undefined): string => {
  const v = p?.item.data.connection;
  return typeof v === "string" && CONNECTIONS.some((c) => c.key === v) ? v : "";
};

/** The connection type at each end of a wire, with the wire sizes its terminal accepts (null: not sourced). */
function endRanges(w: Wire, parts: Map<string, PartLite>): EndRange[] {
  return [w.from, w.to].flatMap((ref) => {
    const c = CONNECTIONS.find((x) => x.key === connectionOf(parts.get(ref)));
    return c ? [{ ref, label: c.label, range: c.awg as WireRange | null }] : [];
  });
}

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
      step: n, wire, colour: colourSet ? String(typed).trim().toLowerCase() : suggestedColour(wire, nets), colourSet, current, gauge: gaugeOf(wire, current, endRanges(wire, parts)),
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
