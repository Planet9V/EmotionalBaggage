// Where a part's pins are in the 3D model, from the pin rows of the part or its library entry
// (src/lib/parts/pins.ts resolves which applies). A pin position is on the part's footprint in mm
// from its centre: x along the part's width, y along its depth. In the scene (Y up, mm) that is the
// part's own x and z, on its top face. A library entry's positions are scaled to the part's size when
// the part was drawn bigger or smaller than the entry's outline; the part's own pin rows are taken
// as typed. Pins with no position are left out, and routing then uses the face centre and says so.
// Pure: used by the route request on the server and by the 3D view's fingerprint in the browser, so
// both work from the same points.
import { bodyExtent } from "@/components/three/layout";
import type { Geometry, Part } from "@/lib/domain";
import type { Item } from "@/lib/types";
import { libraryEntryById } from "@/lib/parts/library";
import { partPins, pinsByItem, type PinRow } from "@/lib/parts/pins";
import type { V3 } from "./rotation";
import type { RoutePart } from "./routing";
import { clamp } from "@/lib/math";

export type PinPoint3 = { name: string; pos: V3 };

/** The pins of one part that have a position, in the part's own frame (before its rotation and position). */
export function pinPoints(item: Item, own: PinRow[], geometry: Geometry): PinPoint3[] {
  const pp = partPins(item, own);
  const e = bodyExtent(geometry);
  const lib = pp.source === "library" ? libraryEntryById(pp.libraryId) : undefined;
  const sx = lib ? e[0] / lib.size.w : 1;
  const sz = lib ? e[2] / lib.size.d : 1;
  const out: PinPoint3[] = [];
  for (const p of pp.pins) {
    if (!p.position || !p.name) continue;
    out.push({ name: p.name, pos: [clamp(p.position.x * sx, -e[0] / 2, e[0] / 2), e[1] / 2, clamp(p.position.y * sz, -e[2] / 2, e[2] / 2)] });
  }
  return out;
}

/** The pin names of a part as every view resolves them (own rows, library, kind, then the names its wires use). */
export function pinNames(item: Item, own: PinRow[], wireNames: string[] = []): string[] {
  return partPins(item, own, wireNames).pins.map((p) => p.name).filter(Boolean);
}

/**
 * The parts the router reads: every part with a reference and geometry, with its pins' positions from
 * its pin rows or library entry. The one place the route request, the harness lengths and the 3D
 * view's route fingerprints get their parts, so all three agree on where each wire ends.
 */
export function routePartsOf(parts: Part[], pins: PinRow[]): RoutePart[] {
  const byItem = pinsByItem(pins);
  return parts
    .filter((p) => p.geometry && p.ref)
    .map((p) => ({ id: p.item.id, ref: p.ref, geometry: p.geometry!, pins: pinPoints(p.item, byItem.get(p.item.id) ?? [], p.geometry!) }));
}
