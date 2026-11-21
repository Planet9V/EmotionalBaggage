import type { Item } from "@/lib/types";
import { geometry, xy, type Geometry, type XY } from "./schemas";
import { readSourcing } from "@/lib/sourcing/schemas";

/**
 * A row of the parts list, read once, for every view.
 * A quantity or a cost nobody entered is null. It is never turned into 0 or 1 here;
 * a view that needs a number for arithmetic says which one it assumes.
 */
export type Part = {
  item: Item;
  ref: string;
  title: string;
  spec: string;
  qty: number | null;
  source: string;
  search: string;
  line: number | null;
  asin: string;
  geometry: Geometry | null;
  pins: string[];
  schematic: XY | null;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Geometry that does not satisfy the schema reads as no geometry. */
export function readGeometry(raw: unknown): Geometry | null {
  const r = geometry.safeParse(raw);
  return r.success ? r.data : null;
}

function readXY(raw: unknown): XY | null {
  const r = xy.safeParse(raw);
  return r.success ? r.data : null;
}

export function toPart(item: Item): Part {
  const d = item.data ?? {};
  const pins = Array.isArray(d.pins) ? [...new Set(d.pins.map((p) => String(p ?? "").trim()).filter(Boolean))] : [];
  return {
    item,
    ref: str(d.ref).trim(),
    title: item.title,
    spec: item.body,
    qty: num(d.qty),
    source: str(d.source),
    search: str(d.search),
    line: num(d.line),
    asin: str(d.asin),
    geometry: readGeometry(d.geometry),
    pins,
    schematic: readXY(d.schematic),
  };
}

export const readParts = (items: Item[]) => items.map(toPart);

/** Parts that can be wired or placed: the ones with a reference designator. First one wins on a repeat. */
export function partsByRef(items: Item[]): Map<string, Part> {
  const m = new Map<string, Part>();
  for (const p of readParts(items)) if (p.ref && !m.has(p.ref)) m.set(p.ref, p);
  return m;
}

/**
 * The one price of a part, the same on every screen. A chosen offer wins: unit (pack price over pack size)
 * x quantity, from that supplier, checked on that day. Otherwise the line cost typed on the parts list, an
 * entered estimate. A quantity nobody set counts as 1 for an offer, and `qtyAssumed` says so.
 */
export type PartPrice =
  | { basis: "offer"; unit: number; qty: number; qtyAssumed: boolean; line: number; supplier: string; checkedAt: string; offerId: string }
  | { basis: "estimate"; line: number }
  | { basis: "none"; line: null };

export function partPrice(p: Part): PartPrice {
  const s = readSourcing(p.item.data ?? {});
  const o = s.offers.find((x) => x.id === s.chosen);
  if (o) {
    const unit = Math.round((o.price / o.packSize) * 1e6) / 1e6;
    const qty = p.qty ?? 1;
    return { basis: "offer", unit, qty, qtyAssumed: p.qty === null, line: Math.round(unit * qty * 100) / 100, supplier: o.supplier, checkedAt: o.checkedAt, offerId: o.id };
  }
  return p.line !== null ? { basis: "estimate", line: p.line } : { basis: "none", line: null };
}

/** Where a part is bought: the chosen offer's supplier, else the source typed on the parts list. */
export const partSource = (p: Part) => {
  const pr = partPrice(p);
  return pr.basis === "offer" ? pr.supplier : p.source;
};

export const sumLine = (parts: Part[]) => parts.reduce((a, p) => a + (partPrice(p).line ?? 0), 0);

/**
 * Where a part's size comes from, in words. A size said to be "stated in a document" names that document;
 * when none is named it reads as entered by hand, so the screen never claims a source it cannot show.
 */
export function basisText(g: { basis: "doc" | "typical" | "library"; basisSource?: string }): string {
  if (g.basis === "library") return g.basisSource ? `Taken from the parts library: ${g.basisSource}` : "Taken from the parts library";
  if (g.basis === "doc") return g.basisSource ? `Stated in ${g.basisSource}` : "Entered by hand; no document is named";
  return "Typical size for this kind of part; not measured";
}
