// A part's pins, worked out once for every view and check.
// Pins a part defines itself (rows of `pins`) win; otherwise the library entry it names; otherwise
// its kind's default pins; otherwise the pin names its wires use (a part nobody has described yet).
import type { Item } from "@/lib/types";
import { defaultSide, partKind, type PinKind, type Side, type SymbolId } from "./kinds";
import { libraryEntryById } from "./library";
import type { BusRef, PinDef, PinPosition, Voltage } from "./schema";

/** A row of the `pins` table as the API returns it. */
export type PinRow = PinDef & { id: number; itemId: number; sort: number };

/** Where a part's pin list came from. "wires": nobody described the part; its pins are the names its wires use. */
type PinSource = "own" | "library" | "kind" | "wires";

export type Pin = {
  name: string;
  number: string;
  kind: PinKind | null;
  side: Side;
  /** false when the side is the kind's default rather than stated for this pin */
  sideSet?: boolean;
  position: PinPosition | null;
  voltage: Voltage | null;
  currentMax: number | null;
  bus: BusRef | null;
  analog: boolean;
  pullUp: boolean;
  optional: boolean;
};

export type PartPins = { pins: Pin[]; source: PinSource; symbol: SymbolId; kindId: string | null; libraryId: string | null };

export function toPin(d: PinDef, i: number): Pin {
  const kind = d.kind ?? null;
  return {
    name: d.name.trim(),
    number: d.number ?? String(i + 1),
    kind,
    side: d.side ?? defaultSide(kind),
    sideSet: !!d.side,
    position: d.position ?? null,
    voltage: d.voltage ?? null,
    currentMax: d.current?.max ?? null,
    bus: d.bus ?? null,
    analog: !!d.analog,
    pullUp: !!d.pullUp,
    optional: !!d.optional,
  };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The kind and library entry a part row names (data.kind, data.library). Unknown values read as none. */
export function partTypeOf(item: Item): { kindId: string | null; libraryId: string | null } {
  const lib = libraryEntryById(str(item.data.library));
  const kind = partKind(str(item.data.kind)) ?? (lib ? partKind(lib.kind) : null);
  return { kindId: kind?.id ?? null, libraryId: lib?.id ?? null };
}

/** `wireNames`: pin names the part's wires use, in wire order; only used when nothing else describes the part. */
export function partPins(item: Item, own: PinRow[], wireNames: string[] = []): PartPins {
  const { kindId, libraryId } = partTypeOf(item);
  const lib = libraryEntryById(libraryId);
  const kind = partKind(kindId);
  const symbol: SymbolId = lib?.symbol ?? kind?.symbol ?? "box";
  if (own.length) {
    const sorted = [...own].sort((a, b) => a.sort - b.sort || a.id - b.id);
    return { pins: sorted.map(toPin), source: "own", symbol, kindId, libraryId };
  }
  if (lib) return { pins: lib.pins.map(toPin), source: "library", symbol, kindId, libraryId };
  if (kind && kind.defaultPins.length) {
    return { pins: kind.defaultPins.map((p, i) => toPin({ name: p.name, kind: p.kind }, i)), source: "kind", symbol, kindId, libraryId };
  }
  const names = [...new Set(wireNames.map((n) => n.trim()).filter(Boolean))];
  return { pins: names.map((n, i) => toPin({ name: n, kind: null }, i)), source: "wires", symbol, kindId, libraryId };
}

/** Pin rows grouped by the part row they belong to. */
export function pinsByItem(rows: PinRow[]): Map<number, PinRow[]> {
  const m = new Map<number, PinRow[]>();
  for (const r of rows) m.set(r.itemId, [...(m.get(r.itemId) ?? []), r]);
  return m;
}

/** A pin as worked out, back as a definition to store (the "make these pins the part's own" path). */
export function pinToDef(p: Pin): PinDef {
  const d: PinDef = { name: p.name, kind: p.kind };
  if (p.number) d.number = p.number;
  if (p.position) d.position = p.position;
  if (p.voltage) d.voltage = p.voltage;
  if (p.currentMax != null) d.current = { max: p.currentMax };
  if (p.bus) d.bus = p.bus;
  if (p.analog) d.analog = true;
  if (p.pullUp) d.pullUp = true;
  if (p.optional) d.optional = true;
  return d;
}
