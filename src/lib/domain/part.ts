import type { Item } from "@/lib/types";
import { geometry, xy, type Geometry, type XY } from "./schemas";

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

export const sumLine = (parts: Part[]) => parts.reduce((a, p) => a + (p.line ?? 0), 0);
