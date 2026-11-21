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
export const FLAG_W = 56;
export const FLAG_H = 34;

export const symbolNodeId = (ref: string) => `s:${ref}`;
export const flagNodeId = (ref: string, pin: string) => `f:${ref}\u0000${pin}`;
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
export type FlagData = { kind: "vcc" | "ground"; net: string; ref: string; pin: string; wireIds: number[]; toward: SymPin["toward"] };
export type SymEdgeData = { wireIds: number[]; net: string; netClass: NetClass; label: boolean; flag: boolean; color: string; route?: XY[] };

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
  return edges.map((e) => {
    const r = e.id.startsWith("w:") ? routes[e.id.slice(2)] : undefined;
    return r && r.length >= 2 && still(e.source) && still(e.target) ? { ...e, data: { ...e.data, route: r } } : e;
  });
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
    for (const sp of layout.pins) {
      const net = c.netOf.get(pinKey(part.ref, sp.name));
      if (!net || (net.netClass !== "power" && net.netClass !== "ground")) continue;
      const kind = net.netClass === "ground" ? "ground" : "vcc";
      const out = { right: [-1, 0], left: [1, 0], down: [0, -1], up: [0, 1] }[sp.toward];
      const px = origin.x + sp.x * SCALE + out[0] * FLAG_GAP;
      const py = origin.y + sp.y * SCALE + out[1] * FLAG_GAP;
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
