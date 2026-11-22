// Everything the build sheet shows is derived here from the wiring and parts stores.
// Nothing in this file holds a value typed by hand except the three generic check
// sentences, the colour list and the two default estimate settings, all labelled as such in the UI.
import { pinPoints } from "@/lib/geometry/pins3d";
import { pinsByItem, type PinRow } from "@/lib/parts/pins";
import { NET_CLASSES, partsByRef, pinsOf, toWire, type Geometry, type NetClass, type Part, type Wire } from "@/lib/domain";
import type { Item } from "@/lib/types";
import { buildRouteRequest, routeState, type RoutePart } from "@/lib/geometry/routing";

const CLASS_ORDER: readonly NetClass[] = NET_CLASSES;
export const STATUS_FLOW = ["to solder", "soldered", "tested"] as const;

/** Fixed generic bench practice, one sentence per class. */
export const CHECK_TEXT: Record<NetClass, string> = {
  power: "Meter the rail before going on",
  ground: "Continuity to the ground point",
  signal: "Continuity end to end; no short to the neighbouring pin",
  audio: "Continuity end to end; no short to the neighbouring pin",
};

export const DEFAULT_ROUTING = 1.5;
export const DEFAULT_ALLOWANCE = 20;
export const ROUND_TO = 5;

export type PartLite = Part;
export const partMap = partsByRef;

export type Step = { n: number; wire: Wire };

/** Order by wire.order, then class (power, ground, signal, audio), then name. Step numbers are global. */
export function sequence(wires: Wire[]): Step[] {
  const sorted = [...wires].sort(
    (a, b) =>
      a.order - b.order ||
      CLASS_ORDER.indexOf(a.netClass) - CLASS_ORDER.indexOf(b.netClass) ||
      a.name.localeCompare(b.name)
  );
  return sorted.map((wire, i) => ({ n: i + 1, wire }));
}

export function toWires(items: Item[]): Wire[] {
  return items.map(toWire).filter((w): w is Wire => !!w);
}

export const isSoldered = (s: string) => s === "soldered" || s === "tested";
const isTested = (s: string) => s === "tested";

export type Counts = { total: number; soldered: number; tested: number };
export function counts(steps: Step[]): Counts {
  return {
    total: steps.length,
    soldered: steps.filter((s) => isSoldered(s.wire.status)).length,
    tested: steps.filter((s) => isTested(s.wire.status)).length,
  };
}

/** The part touched by the most wires: the board everything else lands on. Ties go to the lower ref. */
export function hubRef(wires: Wire[]): string {
  const n = new Map<string, number>();
  for (const w of wires) {
    for (const r of new Set([w.from, w.to])) n.set(r, (n.get(r) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [r, c] of n) if (c > bestN || (c === bestN && r < best)) { best = r; bestN = c; }
  return best;
}

export type Group = { key: string; ref: string; steps: Step[] };

/**
 * Group steps by the non-hub part they share. A wire with two non-hub ends goes to the end that
 * touches more wires (ties: the from end). A wire with no non-hub end goes to its via part, else
 * to a group for the hub alone. Groups are ordered by their first step.
 */
export function groupByPart(steps: Step[], hub: string): Group[] {
  const touch = new Map<string, number>();
  for (const { wire: w } of steps) for (const r of new Set([w.from, w.to])) touch.set(r, (touch.get(r) ?? 0) + 1);
  const groups = new Map<string, Group>();
  for (const s of steps) {
    const w = s.wire;
    const cands = [w.from, w.to].filter((r) => r !== hub);
    let ref = "";
    if (cands.length === 2) ref = (touch.get(cands[1]) ?? 0) > (touch.get(cands[0]) ?? 0) ? cands[1] : cands[0];
    else if (cands.length === 1) ref = cands[0];
    else ref = hub;
    const g = groups.get(ref) ?? { key: ref, ref, steps: [] };
    g.steps.push(s);
    groups.set(ref, g);
  }
  return [...groups.values()];
}

type ConnRow = {
  pin: string;
  /** "REF.pin" at the other end */
  to: string;
  net: string;
  netClass: NetClass;
  status: string;
  step: number;
  /** number of wire ends meeting at this pin, including this one */
  joint: number;
};

const endKey = (ref: string, pin: string) => `${ref}\u0000${pin}`;

function jointCounts(wires: Wire[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of wires) {
    if (w.fromPin) m.set(endKey(w.from, w.fromPin), (m.get(endKey(w.from, w.fromPin)) ?? 0) + 1);
    if (w.toPin) m.set(endKey(w.to, w.toPin), (m.get(endKey(w.to, w.toPin)) ?? 0) + 1);
  }
  return m;
}

const jointAt = (joints: Map<string, number>, ref: string, pin: string) => joints.get(endKey(ref, pin)) ?? 0;

export type PartConn = { ref: string; rows: ConnRow[] };

/** One block per part that any wire touches, pins sorted by name. A part in series is its own part with two wires. */
export function connectionsByPart(steps: Step[]): PartConn[] {
  const wires = steps.map((s) => s.wire);
  const joints = jointCounts(wires);
  const by = new Map<string, ConnRow[]>();
  const push = (ref: string, row: ConnRow) => by.set(ref, [...(by.get(ref) ?? []), row]);
  for (const { n, wire: w } of steps) {
    const base = { net: w.net, netClass: w.netClass, status: w.status, step: n };
    push(w.from, { ...base, pin: w.fromPin, to: `${w.to}.${w.toPin}`, joint: jointAt(joints, w.from, w.fromPin) });
    push(w.to, { ...base, pin: w.toPin, to: `${w.from}.${w.fromPin}`, joint: jointAt(joints, w.to, w.toPin) });
  }
  return [...by.entries()]
    .map(([ref, rows]) => ({
      ref,
      rows: rows.sort((a, b) => a.pin.localeCompare(b.pin, undefined, { numeric: true }) || a.step - b.step),
    }))
    .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
}

/** Wire colours for signal nets: one per net, taken in order from this fixed list. */
const SIGNAL_COLOURS = ["yellow", "green", "blue", "white", "orange", "purple", "brown", "grey"] as const;
export const COLOUR_SWATCH: Record<string, string> = {
  red: "#C0392B", black: "#18181B", yellow: "#E5B800", green: "#2E8B57", blue: "#2F6FDB",
  white: "#F4F4F5", orange: "#E07B1A", purple: "#7E57C2", brown: "#7B4B2A", grey: "#8E8E93",
};

export function suggestedColour(w: Wire, signalNets: string[]): string {
  if (w.netClass === "power") return "red";
  if (w.netClass === "ground") return "black";
  if (w.netClass === "audio") return "any pair";
  const i = Math.max(0, signalNets.indexOf(w.net));
  return SIGNAL_COLOURS[i % SIGNAL_COLOURS.length];
}

/** Signal nets in order of first appearance in the sequence. */
export function signalNetsOf(steps: Step[]): string[] {
  const out: string[] = [];
  for (const { wire: w } of steps) if (w.netClass === "signal" && !out.includes(w.net)) out.push(w.net);
  return out;
}

/** The domain reader has already checked the position is three finite numbers. */
const validPos = (g?: Geometry | null) => !!g;

/**
 * How long to cut a wire. `source` says where the number came from: "routed" is the planner's path
 * through the enclosure plus the strip and slack allowance; "estimate" is the centre-to-centre
 * guess, used when nothing is routed or the route is out of date (`stale`).
 */
export type Length = {
  source: "routed" | "estimate";
  /** routed: the run through the enclosure; estimate: the straight line between centres */
  straight: number;
  raw: number;
  mm: number;
  from: number[];
  to: number[];
  /** routed only: grid cell the run was computed on, mm */
  cellMm?: number | null;
  /** an estimate used because a stored route no longer matches the model */
  stale?: boolean;
} | null;

/** The routed path length written on the wire row (data.routedLengthMm), or null. Zero, negative and non-numbers are not a route. */
export function routedLengthMm(w: Wire): number | null {
  const v = (w.item.data as Record<string, unknown>).routedLengthMm;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const roundUp = (raw: number) => Math.ceil(raw / ROUND_TO - 1e-9) * ROUND_TO;

/** The length to cut a routed wire: its run plus the strip and slack allowance, rounded up to 5 mm. The cut list and the harness drawing both use it. */
export const cutLengthMm = (routedMm: number, allowance: number) => roundUp(routedMm + allowance);

/** Current route fingerprint per wire row id, from the parts, their pins (rows, else library) and wires as they are now. */
export function routeFingerprints(parts: Map<string, PartLite>, wires: Wire[], pins: PinRow[] = []): Map<number, string> {
  const byItem = pinsByItem(pins);
  const rp: RoutePart[] = [];
  for (const p of parts.values()) if (p.geometry && p.ref) rp.push({ id: p.item.id, ref: p.ref, geometry: p.geometry, pins: pinPoints(p.item, byItem.get(p.item.id) ?? [], p.geometry) });
  return buildRouteRequest(rp, wires.map((w) => ({ id: w.item.id, name: w.name, from: w.from, fromPin: w.fromPin, to: w.to, toPin: w.toPin }))).fingerprints;
}

/**
 * A routed wire: the planner's run plus the allowance, rounded up to 5 mm. Anything else:
 * straight-line distance between the assembled centres x routing factor + allowance, rounded up.
 * `current` is the fingerprint the model gives now; a route made from another one is out of date.
 */
export function estimateLength(w: Wire, parts: Map<string, PartLite>, routing: number, allowance: number, current?: string): Length {
  const a = parts.get(w.from)?.geometry;
  const b = parts.get(w.to)?.geometry;
  const pa = a?.pos.slice(0, 3) ?? [];
  const pb = b?.pos.slice(0, 3) ?? [];
  let stale = false;
  if (w.routed) {
    // A length with no fingerprint was not written by the router (typed in, or imported): there is nothing to compare, so it stands.
    const state = current === undefined || !w.routed.fingerprint ? "current" : routeState({ routedLengthMm: w.routed.lengthMm, routedFingerprint: w.routed.fingerprint }, current);
    if (state === "current") {
      const raw = w.routed.lengthMm + allowance;
      return { source: "routed", straight: w.routed.lengthMm, raw, mm: cutLengthMm(w.routed.lengthMm, allowance), from: pa, to: pb, cellMm: w.routed.cellMm };
    }
    stale = true;
  }
  if (!validPos(a) || !validPos(b)) return null;
  const straight = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
  const raw = straight * routing + allowance;
  return { source: "estimate", straight, raw, mm: roundUp(raw), from: pa, to: pb, ...(stale ? { stale: true } : {}) };
}

export type CutRow = {
  step: number;
  wire: Wire;
  colour: string;
  length: Length;
};

export function cutList(steps: Step[], parts: Map<string, PartLite>, routing: number, allowance: number, pins: PinRow[] = []): CutRow[] {
  const nets = signalNetsOf(steps);
  const fingerprints = routeFingerprints(parts, steps.map((s) => s.wire), pins);
  return steps.map(({ n, wire }) => ({
    step: n,
    wire,
    colour: suggestedColour(wire, nets),
    length: estimateLength(wire, parts, routing, allowance, fingerprints.get(wire.item.id) ?? ""),
  }));
}

export type ClassTotal = { netClass: NetClass; mm: number; counted: number; wires: number; routed: number; estimated: number };
export function totalsByClass(rows: CutRow[]): ClassTotal[] {
  return CLASS_ORDER.map((c) => {
    const of = rows.filter((r) => r.wire.netClass === c);
    return {
      netClass: c, mm: of.reduce((a, r) => a + (r.length?.mm ?? 0), 0), counted: of.filter((r) => r.length).length, wires: of.length,
      routed: of.filter((r) => r.length?.source === "routed").length, estimated: of.filter((r) => r.length?.source === "estimate").length,
    };
  }).filter((t) => t.wires > 0);
}

export type Consumables = {
  joints: number;
  wireJoints: number;
  headers: { ref: string; pins: number }[];
};

export function consumables(wires: Wire[]): Consumables {
  const refs = [...new Set(wires.flatMap((w) => [w.from, w.to]))];
  const headers = refs
    .map((ref) => ({ ref, pins: pinsOf(ref, wires).length }))
    .filter((h) => h.pins >= 3)
    .sort((a, b) => b.pins - a.pins || a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  return {
    wireJoints: wires.length * 2,
    joints: wires.length * 2,
    headers,
  };
}

export type CheckLine = { id: string; label: string; detail: string; result: "pass" | "fail" | "na" };

export function beforePower(wires: Wire[]): CheckLine[] {
  const line = (id: string, label: string, of: Wire[], ok: (w: Wire) => boolean, what: string): CheckLine => {
    if (of.length === 0) return { id, label, detail: "None in the schematic", result: "na" };
    const left = of.filter((w) => !ok(w));
    return {
      id,
      label,
      detail: left.length === 0 ? `${of.length} of ${of.length} ${what}` : `${of.length - left.length} of ${of.length} ${what}; waiting: ${left.map((w) => w.name).join(", ")}`,
      result: left.length === 0 ? "pass" : "fail",
    };
  };
  return [
    line("power", "Every power wire tested", wires.filter((w) => w.netClass === "power"), (w) => isTested(w.status), "tested"),
    line("ground", "Every ground wire tested", wires.filter((w) => w.netClass === "ground"), (w) => isTested(w.status), "tested"),
    line("solder", "No wire still to solder", wires, (w) => isSoldered(w.status), "soldered or tested"),
  ];
}
