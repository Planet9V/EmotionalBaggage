// Shared readers for the two design stores every concept uses the same way.
// Views import these so the decision tree, schematic, layout, build sheet and
// 3D model all agree on the shape of a decision and a wire.
import type { Item } from "./types";

export type DecisionOption = { id: string; label: string; outcome: string };

export type Decision = {
  item: Item;
  key: string;
  /** key of the parent decision, "" for the root */
  parent: string;
  question: string;
  context: string;
  options: DecisionOption[];
  /** option id, "" while undecided */
  chosen: string;
  /** keys of decisions that must be decided first */
  dependsOn: string[];
  /** stage/section store keys (or free text) this decision opens up */
  unlocks: string[];
  source: string;
  status: string;
};

const list = (v: unknown) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const DECISION_STORE = "concept/decisions";
export const WIRING_STORE = "design/wiring";
export const PARTS_STORE = "design/bom";

export function toDecision(item: Item): Decision | null {
  const key = typeof item.data.key === "string" ? item.data.key : "";
  if (!key) return null;
  const raw = Array.isArray(item.data.options) ? (item.data.options as unknown[]) : [];
  const options = raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => ({ id: String(o.id ?? ""), label: String(o.label ?? ""), outcome: String(o.outcome ?? "") }))
    .filter((o) => o.id && o.label);
  return {
    item,
    key,
    parent: String(item.data.parent ?? ""),
    question: item.title,
    context: item.body,
    options,
    chosen: String(item.data.chosen ?? ""),
    dependsOn: list(item.data.dependsOn),
    unlocks: list(item.data.unlocks),
    source: String(item.data.source ?? ""),
    status: item.status,
  };
}

/** A decision is ready when every decision it depends on has been decided. */
export function decisionReady(d: Decision, all: Decision[]) {
  const byKey = new Map(all.map((x) => [x.key, x]));
  return d.dependsOn.every((k) => !!byKey.get(k)?.chosen);
}

export type NetClass = "power" | "ground" | "signal" | "audio";

export type Wire = {
  item: Item;
  /** soldering sequence, lowest first */
  order: number;
  name: string;
  note: string;
  net: string;
  netClass: NetClass;
  /** part refs (Item.data.ref of a part in design/bom) and pin names */
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  /** ref of a part in series on this wire (a resistor), or "" */
  via: string;
  status: string;
};

const CLASSES: NetClass[] = ["power", "ground", "signal", "audio"];

export function toWire(item: Item): Wire | null {
  const from = String(item.data.from ?? "");
  const to = String(item.data.to ?? "");
  if (!from || !to) return null;
  const nc = String(item.data.netClass ?? "signal") as NetClass;
  return {
    item,
    order: Number(item.data.order) || 0,
    name: item.title,
    note: item.body,
    net: String(item.data.net ?? ""),
    netClass: CLASSES.includes(nc) ? nc : "signal",
    from,
    fromPin: String(item.data.fromPin ?? ""),
    to,
    toPin: String(item.data.toPin ?? ""),
    via: String(item.data.via ?? ""),
    status: item.status,
  };
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
