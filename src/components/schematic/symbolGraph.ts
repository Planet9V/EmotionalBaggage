// The symbol view's nodes and edges, worked out from the circuit with no React, so it can be tested.
// One node per part (its symbol), one small flag per pin on a power or ground net (a supply or
// ground symbol carrying the net's name), and one edge per wire on every other net.
import type { NetClass, XY } from "@/lib/domain";
import { NET_STROKE } from "@/lib/domain";
import { pinKey, type Circuit, type CircuitPart } from "@/lib/parts/circuit";
import { symbolLayout, type SymbolLayout, type SymPin } from "@/lib/parts/symbols";

/** Pixels per millimetre of symbol drawing. */
export const SCALE = 8;
const PAD_X = 16;
const PAD_TOP = 30;
const PAD_BOTTOM = 26;
const FLAG_GAP = 26;
/** A flag above or below a symbol sits closer: the lead only has to clear the pin's ring, and routes keep clear of the node by more than the flag sticks out. */
const FLAG_GAP_VERTICAL = 12;
export const FLAG_W = 56;
export const FLAG_H = 34;
/** A compact flag (see FlagData.compact): its node is COMPACT_W wide and two COMPACT_H tall, its port at mid height on the side facing the pin. */
export const COMPACT_W = 54;
export const COMPACT_H = 15;
const COMPACT_GAP = 14;
const COMPACT_STEP = 58;

const symbolNodeId = (ref: string) => `s:${ref}`;
const flagNodeId = (ref: string, pin: string) => `f:${ref}\u0000${pin}`;
export const symHandle = (pin: string) => `pin:${pin}`;

export type SymNodeData = {
  ref: string;
  title: string;
  layout: SymbolLayout;
  /** where the symbol's origin sits inside the node, in pixels */
  origin: XY;
  width: number;
  height: number;
  pinsWired: Record<string, boolean>;
  pinClass: Record<string, NetClass | null>;
};
export type FlagData = {
  kind: "vcc" | "ground";
  net: string;
  ref: string;
  pin: string;
  wireIds: number[];
  toward: SymPin["toward"];
  /**
   * Set when several pins on one side of a symbol carry a flag: full-size flags on neighbouring rows would lie
   * over each other, so each is drawn small, beside its pin, with its name on the far side ("left" or "right").
   */
  compact?: "left" | "right";
};
export type SymEdgeData = { wireIds: number[]; net: string; netClass: NetClass; label: boolean; flag: boolean; color: string; route?: XY[]; /** where the net label sits on a routed wire: a spot no other net's wire runs through */ labelAt?: XY };

/**
 * Gives each wire edge elk's orthogonal route (which keeps clear of the symbols) while both of its symbols sit
 * where elk put them. A symbol moved by hand or saved elsewhere drops its wires back to the plain step path.
 */
export function withRoutes(edges: SymEdge[], nodes: SymNode[], laid: Record<string, XY>, routes: Record<string, XY[]>): SymEdge[] {
  const at = new Map(nodes.filter((n) => n.type === "symbol").map((n) => [n.id, n.position]));
  const still = (nodeId: string) => {
    const p = at.get(nodeId), l = laid[nodeId.slice(2)];
    return !!p && !!l && Math.round(p.x) === Math.round(l.x) && Math.round(p.y) === Math.round(l.y);
  };
  const routed = edges.map((e) => {
    const r = e.id.startsWith("w:") ? routes[e.id.slice(2)] : undefined;
    return r && r.length >= 2 && still(e.source) && still(e.target) ? { ...e, data: { ...e.data, route: r } } : e;
  });
  // labels are placed one after another, each keeping clear of the wires and of the labels placed before it
  const taken: { at: XY; w: number }[] = [];
  return routed.map((e) => {
    if (!e.data.label || !e.data.route) return e;
    const at = labelSpot(e, routed, taken);
    taken.push({ at, w: labelWidth(e.data.net) });
    return { ...e, data: { ...e.data, labelAt: at } };
  });
}

/** The rectangle that holds the whole drawing: every symbol, every flag and every routed wire. Null when there is nothing. */
export function drawingBounds(nodes: SymNode[], edges: SymEdge[]): { x: number; y: number; width: number; height: number } | null {
  let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x: number, y: number) => {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  };
  const at = new Map<string, XY>();
  for (const n of nodes) {
    if (n.type !== "symbol") continue;
    at.set(n.id, n.position);
    add(n.position.x, n.position.y);
    add(n.position.x + n.data.width, n.position.y + n.data.height);
  }
  for (const n of nodes) {
    if (n.type !== "flag") continue;
    const p = at.get(n.parentId);
    if (!p) continue;
    add(p.x + n.position.x, p.y + n.position.y);
    add(p.x + n.position.x + (n.data.compact ? COMPACT_W : FLAG_W), p.y + n.position.y + (n.data.compact ? COMPACT_H * 2 : FLAG_H));
  }
  for (const e of edges) for (const pt of e.data.route ?? []) add(pt.x, pt.y);
  return Number.isFinite(x1) ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
}

type Seg = { a: XY; b: XY };
const segsOf = (r: XY[]): Seg[] => r.slice(1).map((b, i) => ({ a: r[i], b }));
const LABEL_H = 16;
/** The width of a net label in pixels: 9 px monospace, with its padding and border. */
const labelWidth = (net: string) => net.length * 5.5 + 12;

/** Does the segment pass through the rectangle centred on `c`? Segments here are horizontal or vertical. */
function crosses(s: Seg, c: XY, w: number, h: number) {
  const [x1, x2] = [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)];
  const [y1, y2] = [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)];
  return x1 < c.x + w / 2 && x2 > c.x - w / 2 && y1 < c.y + h / 2 && y2 > c.y - h / 2;
}

/**
 * Where a routed wire's net label goes: on one of its own straight runs, at a spot no other net's wire passes
 * through and no other label already claimed, on the longest such run. With no clear spot, the least crossed one.
 */
function labelSpot(e: SymEdge, all: SymEdge[], taken: { at: XY; w: number }[]): XY {
  const route = e.data.route!;
  const w = labelWidth(e.data.net) + 6;
  const others = all.filter((o) => o.data.route && o.data.net !== e.data.net).flatMap((o) => segsOf(o.data.route!));
  let best: { at: XY; score: number } | null = null;
  for (const s of segsOf(route)) {
    const len = Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y);
    const horizontal = s.a.y === s.b.y;
    // a label lies along a horizontal run and across a vertical one, so it needs room for its width or its height
    if (len < (horizontal ? w : LABEL_H) + 8) continue;
    for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const at = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      // keep the whole label on the run, clear of its ends
      if (horizontal && Math.min(Math.abs(at.x - s.a.x), Math.abs(at.x - s.b.x)) < w / 2 + 2) continue;
      const hits = others.filter((o) => crosses(o, at, w, LABEL_H + 4)).length + taken.filter((t) => Math.abs(t.at.x - at.x) < (t.w + w) / 2 + 4 && Math.abs(t.at.y - at.y) < LABEL_H + 4).length;
      const score = -hits * 10000 + (horizontal ? len : len / 2) - Math.abs(t - 0.5) * 10;
      if (!best || score > best.score) best = { at, score };
    }
  }
  if (best) return best.at;
  const mid = segsOf(route).reduce((m, s) => (Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y) > Math.abs(m.a.x - m.b.x) + Math.abs(m.a.y - m.b.y) ? s : m));
  return { x: (mid.a.x + mid.b.x) / 2, y: (mid.a.y + mid.b.y) / 2 };
}

export type SymNode =
  | { id: string; type: "symbol"; position: XY; data: SymNodeData; saved: boolean; part: CircuitPart }
  | { id: string; type: "flag"; position: XY; parentId: string; data: FlagData };
export type SymEdge = { id: string; source: string; sourceHandle: string; target: string; targetHandle: string; data: SymEdgeData };

export function symbolNodeSize(layout: SymbolLayout) {
  const b = layout.bbox;
  const width = Math.round((b.x2 - b.x1) * SCALE + PAD_X * 2);
  const height = Math.round((b.y2 - b.y1) * SCALE + PAD_TOP + PAD_BOTTOM);
  const origin = { x: Math.round(-b.x1 * SCALE + PAD_X), y: Math.round(-b.y1 * SCALE + PAD_TOP) };
  return { width, height, origin };
}

export function readSymbolPos(v: unknown): XY | null {
  if (!v || typeof v !== "object") return null;
  const { x, y } = v as { x?: unknown; y?: unknown };
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/** `positions`: computed (elk) positions by ref; a saved `symbolPos` and then `overlay` win over them. */
export function buildSymbolGraph(c: Circuit, positions: Record<string, XY>, overlay: Record<string, XY>, ignoreSaved = false) {
  const nodes: SymNode[] = [];
  const flags: SymNode[] = [];
  const edges: SymEdge[] = [];
  const has = new Map<string, Set<string>>();
  let fallbackX = 0;

  for (const part of c.parts) {
    if (!part.pins.length) continue;
    const layout = symbolLayout(part.symbol, part.pins);
    const { width, height, origin } = symbolNodeSize(layout);
    const saved = ignoreSaved ? null : readSymbolPos(part.item.data.symbolPos);
    const pos = overlay[symbolNodeId(part.ref)] ?? saved ?? positions[part.ref] ?? { x: fallbackX, y: 0 };
    fallbackX += width + 80;
    const pinsWired: Record<string, boolean> = {};
    const pinClass: Record<string, NetClass | null> = {};
    for (const p of part.pins) {
      const net = c.netOf.get(pinKey(part.ref, p.name));
      pinsWired[p.name] = !!net;
      pinClass[p.name] = net?.netClass ?? null;
    }
    nodes.push({ id: symbolNodeId(part.ref), type: "symbol", position: pos, saved: !!saved, part, data: { ref: part.ref, title: part.title, layout, origin, width, height, pinsWired, pinClass } });
    has.set(part.ref, new Set(part.pins.map((p) => p.name)));

    // flags for pins on power and ground nets
    const flagged = layout.pins.filter((sp) => {
      const net = c.netOf.get(pinKey(part.ref, sp.name));
      return net && (net.netClass === "power" || net.netClass === "ground");
    });
    // a side with several flagged pins gets small flags, in two columns so that neighbouring rows never share one
    const column = new Map<string, number>();
    for (const side of ["left", "right"] as const) {
      const onSide = flagged.filter((sp) => sp.side === side).sort((a, b) => a.y - b.y);
      if (onSide.length < 2) continue;
      onSide.forEach((sp, i) => {
        const prev = onSide[i - 1];
        column.set(sp.name, prev && (sp.y - prev.y) * SCALE < COMPACT_H * 2 + 6 ? 1 - column.get(prev.name)! : 0);
      });
    }
    for (const sp of flagged) {
      const net = c.netOf.get(pinKey(part.ref, sp.name))!;
      const kind = net.netClass === "ground" ? "ground" : "vcc";
      const wires = net.wires.filter((w) => (w.from === part.ref && w.fromPin === sp.name) || (w.to === part.ref && w.toPin === sp.name)).map((w) => w.item.id);
      if (column.has(sp.name) && (sp.side === "left" || sp.side === "right")) {
        const dir = sp.side === "left" ? -1 : 1;
        // the flag's port faces the pin, on the pin's own row, so its lead is one straight line
        const portX = origin.x + sp.x * SCALE + dir * (COMPACT_GAP + column.get(sp.name)! * COMPACT_STEP);
        const portY = origin.y + sp.y * SCALE;
        flags.push({
          id: flagNodeId(part.ref, sp.name),
          type: "flag",
          parentId: symbolNodeId(part.ref),
          position: { x: Math.round(dir < 0 ? portX - COMPACT_W : portX), y: Math.round(portY - COMPACT_H) },
          data: { kind, net: net.name, ref: part.ref, pin: sp.name, wireIds: wires, toward: sp.toward, compact: sp.side },
        });
        edges.push({ id: `fe:${part.ref}\u0000${sp.name}`, source: symbolNodeId(part.ref), sourceHandle: symHandle(sp.name), target: flagNodeId(part.ref, sp.name), targetHandle: "f", data: { wireIds: wires, net: net.name, netClass: net.netClass, label: false, flag: true, color: NET_STROKE[net.netClass] } });
        continue;
      }
      const out = { right: [-1, 0], left: [1, 0], down: [0, -1], up: [0, 1] }[sp.toward];
      const px = origin.x + sp.x * SCALE + out[0] * FLAG_GAP;
      const py = origin.y + sp.y * SCALE + out[1] * FLAG_GAP_VERTICAL;
      const wireIds = net.wires.filter((w) => (w.from === part.ref && w.fromPin === sp.name) || (w.to === part.ref && w.toPin === sp.name)).map((w) => w.item.id);
      // the flag's handle is at its top centre (ground) or bottom centre (supply): put that point at (px, py)
      const fx = Math.round(px - FLAG_W / 2);
      const fy = Math.round(kind === "ground" ? py : py - FLAG_H);
      flags.push({ id: flagNodeId(part.ref, sp.name), type: "flag", parentId: symbolNodeId(part.ref), position: { x: fx, y: fy }, data: { kind, net: net.name, ref: part.ref, pin: sp.name, wireIds, toward: sp.toward } });
      edges.push({ id: `fe:${part.ref}\u0000${sp.name}`, source: symbolNodeId(part.ref), sourceHandle: symHandle(sp.name), target: flagNodeId(part.ref, sp.name), targetHandle: "f", data: { wireIds, net: net.name, netClass: net.netClass, label: false, flag: true, color: NET_STROKE[net.netClass] } });
    }
  }

  // one edge per wire on a signal or audio net; the first wire of each net carries the net label
  const labelled = new Set<number>();
  for (const w of c.wires) {
    const net = c.netOf.get(pinKey(w.from, w.fromPin));
    if (!net || net.netClass === "power" || net.netClass === "ground") continue;
    if (!has.get(w.from)?.has(w.fromPin) || !has.get(w.to)?.has(w.toPin)) continue;
    const label = !labelled.has(net.id);
    labelled.add(net.id);
    edges.push({ id: `w:${w.item.id}`, source: symbolNodeId(w.from), sourceHandle: symHandle(w.fromPin), target: symbolNodeId(w.to), targetHandle: symHandle(w.toPin), data: { wireIds: [w.item.id], net: net.name, netClass: net.netClass, label, flag: false, color: NET_STROKE[net.netClass] } });
  }
  // parents before children, as React Flow needs
  return { nodes: [...nodes, ...flags], edges };
}
