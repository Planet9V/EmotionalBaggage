import type { Item } from "@/lib/types";
import { NET_CLASSES, type NetClass } from "./schemas";

export type Wire = {
  item: Item;
  /** soldering sequence, lowest first */
  order: number;
  name: string;
  note: string;
  net: string;
  netClass: NetClass;
  /** part refs (a part's `ref` in the parts list) and pin names */
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  status: string;
  /** the routed run through the enclosure from the planner (plan 5.12), or null when this wire was never routed */
  routed: RoutedWire | null;
};

/** What the planner's router left on a wire row. The length is the run itself, with no strip or slack allowance. */
type RoutedWire = {
  lengthMm: number;
  cellMm: number | null;
  at: string;
  fingerprint: string;
  path: [number, number, number][];
};

function readRouted(d: Record<string, unknown>): RoutedWire | null {
  const len = typeof d.routedLengthMm === "number" && Number.isFinite(d.routedLengthMm) && d.routedLengthMm >= 0 ? d.routedLengthMm : null;
  if (len === null) return null;
  const path = Array.isArray(d.routedPath)
    ? d.routedPath.filter((p): p is [number, number, number] => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === "number" && Number.isFinite(n)))
    : [];
  return {
    lengthMm: len,
    cellMm: typeof d.routedCellMm === "number" && Number.isFinite(d.routedCellMm) ? d.routedCellMm : null,
    at: str(d.routedAt),
    fingerprint: str(d.routedFingerprint),
    path,
  };
}

export const CLASS_LABEL: Record<NetClass, string> = { power: "Power", ground: "Ground", signal: "Signal", audio: "Audio" };

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** A row is a wire once it names both ends. */
export function toWire(item: Item): Wire | null {
  const from = str(item.data.from);
  const to = str(item.data.to);
  if (!from || !to) return null;
  const nc = str(item.data.netClass) as NetClass;
  return {
    item,
    order: Number(item.data.order) || 0,
    name: item.title,
    note: item.body,
    net: str(item.data.net),
    netClass: NET_CLASSES.includes(nc) ? nc : "signal",
    from,
    fromPin: str(item.data.fromPin),
    to,
    toPin: str(item.data.toPin),
    status: item.status,
    routed: readRouted(item.data),
  };
}

export function readWires(items: Item[]): Wire[] {
  return items
    .map(toWire)
    .filter((w): w is Wire => !!w)
    .sort((a, b) => a.order - b.order || a.item.id - b.item.id);
}

/** Every pin a part uses, taken from the wires that touch it. */
export function pinsOf(ref: string, wires: Wire[]) {
  const pins = new Set<string>();
  for (const w of wires) {
    if (w.from === ref && w.fromPin) pins.add(w.fromPin);
    if (w.to === ref && w.toPin) pins.add(w.toPin);
  }
  return [...pins];
}

/** One colour role per net class; views map these to token classes or hex for canvas use. */
export const NET_COLOR: Record<NetClass, string> = {
  power: "#E05A10",
  ground: "#71717A",
  signal: "#1849A9",
  audio: "#067647",
};
