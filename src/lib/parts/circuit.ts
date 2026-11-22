// The circuit as one structure: parts (with their pins), wires, and the nets the wires make.
// Pure: rows in, structure out. The electrical checks, the symbol view and the KiCad export all
// read this, so they agree on what is connected to what.
import type { Item } from "@/lib/types";
import { readWires, type NetClass, type Wire } from "@/lib/domain";
import { partKind } from "./kinds";
import { partPins, pinsByItem, type PartPins, type Pin, type PinRow } from "./pins";

export type CircuitPart = { ref: string; item: Item; title: string } & PartPins;

type NetMember = { ref: string; pin: string; def: Pin | null };

export type Net = {
  /** stable within one build of the circuit */
  id: number;
  name: string;
  /** the net name typed on its wires, if any */
  typed: string;
  netClass: NetClass;
  members: NetMember[];
  wires: Wire[];
};

export type Circuit = {
  parts: CircuitPart[];
  byRef: Map<string, CircuitPart>;
  wires: Wire[];
  nets: Net[];
  /** "REF\0PIN" to its net */
  netOf: Map<string, Net>;
  /** refs on more than one part row: the first row is used */
  duplicateRefs: string[];
};

export const pinKey = (ref: string, pin: string) => `${ref}\u0000${pin}`;
export const pinLabel = (ref: string, pin: string) => `${ref}.${pin || "?"}`;

const byNumeric = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function buildCircuit(partItems: Item[], wireItems: Item[], pinRows: PinRow[]): Circuit {
  const wires = readWires(wireItems);
  const rows = pinsByItem(pinRows);
  const wireNames = new Map<string, string[]>();
  for (const w of wires) {
    if (w.fromPin) wireNames.set(w.from, [...(wireNames.get(w.from) ?? []), w.fromPin]);
    if (w.toPin) wireNames.set(w.to, [...(wireNames.get(w.to) ?? []), w.toPin]);
  }

  const parts: CircuitPart[] = [];
  const byRef = new Map<string, CircuitPart>();
  const seen = new Map<string, number>();
  for (const item of partItems) {
    const ref = typeof item.data.ref === "string" ? item.data.ref.trim() : "";
    if (!ref) continue;
    seen.set(ref, (seen.get(ref) ?? 0) + 1);
    if (byRef.has(ref)) continue;
    const cp: CircuitPart = { ref, item, title: item.title, ...partPins(item, rows.get(item.id) ?? [], wireNames.get(ref) ?? []) };
    parts.push(cp);
    byRef.set(ref, cp);
  }

  // union-find over wire ends
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    if (!parent.has(k)) parent.set(k, k);
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  for (const w of wires) {
    const a = pinKey(w.from, w.fromPin);
    const b = pinKey(w.to, w.toPin);
    parent.set(find(a), find(b));
  }
  const groups = new Map<string, { keys: Set<string>; wires: Wire[] }>();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, { keys: new Set(), wires: [] });
    groups.get(r)!.keys.add(k);
  }
  for (const w of wires) groups.get(find(pinKey(w.from, w.fromPin)))!.wires.push(w);

  const defOf = (ref: string, pin: string) => byRef.get(ref)?.pins.find((p) => p.name === pin) ?? null;
  const draft = [...groups.values()].map((g) => {
    const members = [...g.keys]
      .map((k) => {
        const [ref, pin] = k.split("\u0000");
        return { ref, pin, def: defOf(ref, pin) };
      })
      .sort((a, b) => byNumeric(pinLabel(a.ref, a.pin), pinLabel(b.ref, b.pin)));
    const typedNames = [...new Set(g.wires.map((w) => w.net.trim()).filter(Boolean))];
    const kinds = members.map((m) => m.def?.kind);
    const netClass: NetClass = kinds.includes("ground")
      ? "ground"
      : kinds.includes("power_out") || kinds.includes("power_in")
        ? "power"
        : (g.wires[0]?.netClass ?? "signal");
    const powerPin = members.find((m) => m.def?.kind === "power_out") ?? members.find((m) => m.def?.kind === "ground") ?? members.find((m) => m.def?.kind === "power_in");
    const typed = typedNames.join("/");
    const base = typed || (powerPin ? powerPin.pin : "");
    return { members, wires: g.wires, netClass, typed, base };
  });
  const uses = new Map<string, number>();
  for (const n of draft) uses.set(n.base, (uses.get(n.base) ?? 0) + 1);
  const nets: Net[] = draft
    .map((n) => {
      const first = n.members[0];
      const tag = `${first.ref}-${first.pin || "?"}`;
      const name = !n.base ? `Net-(${tag})` : (uses.get(n.base) ?? 0) > 1 ? `${n.base}-(${tag})` : n.base;
      return { id: 0, name, typed: n.typed, netClass: n.netClass, members: n.members, wires: n.wires };
    })
    .sort((a, b) => byNumeric(a.name, b.name))
    .map((n, i) => ({ ...n, id: i + 1 }));
  const netOf = new Map<string, Net>();
  for (const n of nets) for (const m of n.members) netOf.set(pinKey(m.ref, m.pin), n);

  return { parts, byRef, wires, nets, netOf, duplicateRefs: [...seen].filter(([, c]) => c > 1).map(([r]) => r) };
}

/**
 * The nets the wires make when only the wires are known (no part or pin definitions): the same joining
 * and naming as buildCircuit, so a wire list and a full circuit never disagree on what is one net.
 */
export function wireNets(wires: Wire[]): Net[] {
  return buildCircuit([], wires.map((w) => w.item), []).nets;
}

/**
 * Nets joined through closed switches form one supply group: a supply on one side of a power
 * switch reaches the other side. Returns, for each net id, the ids of the nets in its group.
 */
export function supplyGroups(c: Circuit): Map<number, number[]> {
  const parent = new Map<number, number>(c.nets.map((n) => [n.id, n.id]));
  const find = (k: number): number => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  for (const p of c.parts) {
    if (!partKind(p.kindId)?.conducts) continue;
    const ids = [...new Set(p.pins.map((pin) => c.netOf.get(pinKey(p.ref, pin.name))?.id).filter((x): x is number => !!x))];
    for (let i = 1; i < ids.length; i++) parent.set(find(ids[i]), find(ids[0]));
  }
  const groups = new Map<number, number[]>();
  for (const n of c.nets) groups.set(find(n.id), [...(groups.get(find(n.id)) ?? []), n.id]);
  const out = new Map<number, number[]>();
  for (const ids of groups.values()) for (const id of ids) out.set(id, ids);
  return out;
}
