/**
 * Scene layout for parts with geometry (Y up, mm, origin at the centre of the enclosure floor).
 * Pure functions, no three.js, shared by the canvas and the view.
 */
import type { Geometry, Item } from "@/lib/types";

/** Geometry as stored, plus an optional cylinder axis. Without one, a cylinder shorter than it is wide lies flat (axis y), otherwise it lies along z. */
export type PartGeometry = Geometry & { axis?: "x" | "y" | "z" };
export type Axis = "x" | "y" | "z";

export type Part = {
  item: Item;
  ref: string;
  qty: number;
  source: string;
  line: number | null;
  geometry: PartGeometry | null;
};

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const vec = (v: unknown, n: number): number[] | null => {
  if (!Array.isArray(v) || v.length < n) return null;
  const out = v.slice(0, n).map((x) => num(x, NaN));
  return out.every(Number.isFinite) ? out : null;
};

/** Reads data.geometry defensively. Returns null when it is missing or unusable. */
export function readGeometry(raw: unknown): PartGeometry | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  const shape = g.shape === "box" || g.shape === "cylinder" || g.shape === "shell" ? g.shape : null;
  if (!shape) return null;
  const size = vec(g.size, shape === "cylinder" ? 2 : 3);
  if (!size || size.some((s) => s <= 0)) return null;
  const out: PartGeometry = {
    shape,
    size,
    pos: vec(g.pos, 3) ?? [0, 0, 0],
    explode: vec(g.explode, 3) ?? [0, 0, 0],
    basis: g.basis === "doc" ? "doc" : "typical",
  };
  const count = Math.round(num(g.count, 1));
  if (count > 1) out.count = count;
  if (g.print === true) out.print = true;
  if (g.axis === "x" || g.axis === "y" || g.axis === "z") out.axis = g.axis;
  return out;
}

export function toPart(item: Item): Part {
  const d = item.data ?? {};
  const line = num(d.line, NaN);
  return {
    item,
    ref: typeof d.ref === "string" ? d.ref : "",
    qty: num(d.qty, 1),
    source: typeof d.source === "string" ? d.source : "",
    line: Number.isFinite(line) ? line : null,
    geometry: readGeometry(d.geometry),
  };
}

export function cylinderAxis(g: PartGeometry): Axis {
  if (g.axis) return g.axis;
  return g.size[1] < g.size[0] ? "y" : "z";
}

/** Extent of one body along scene x, y, z. */
export function bodyExtent(g: PartGeometry): [number, number, number] {
  if (g.shape !== "cylinder") return [g.size[0], g.size[1], g.size[2]];
  const [d, l] = g.size;
  const a = cylinderAxis(g);
  return a === "x" ? [l, d, d] : a === "y" ? [d, l, d] : [d, d, l];
}

/** Offsets of each identical body from pos, laid side by side and centred on pos. */
export function bodyOffsets(g: PartGeometry): [number, number, number][] {
  const n = Math.max(1, g.count ?? 1);
  if (n === 1) return [[0, 0, 0]];
  const e = bodyExtent(g);
  // Spread across x, unless the body is a cylinder lying along x: then across z.
  const along = g.shape === "cylinder" && cylinderAxis(g) === "x" ? 2 : 0;
  const pitch = e[along] * 1.05;
  return Array.from({ length: n }, (_, i) => {
    const o: [number, number, number] = [0, 0, 0];
    o[along] = (i - (n - 1) / 2) * pitch;
    return o;
  });
}

/** Total extent including every body of a counted part. */
export function totalExtent(g: PartGeometry): [number, number, number] {
  const e = bodyExtent(g);
  const offs = bodyOffsets(g);
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const lo = Math.min(...offs.map((o) => o[k])) - e[k] / 2;
    const hi = Math.max(...offs.map((o) => o[k])) + e[k] / 2;
    out[k] = hi - lo;
  }
  return out;
}

/**
 * Extra height the shell lid rises at full explosion, so it clears every exploded part above it.
 * Never less than 20 mm.
 */
export function lidLift(shell: PartGeometry, others: PartGeometry[]) {
  const top = shell.pos[1] + shell.explode[1] + shell.size[1] / 2;
  let highest = top;
  for (const g of others) {
    const t = g.pos[1] + g.explode[1] + totalExtent(g)[1] / 2;
    if (t > highest) highest = t;
  }
  return Math.max(20, highest - top + 15);
}

/** Bounding box of the assembled scene, for framing the camera. */
export function sceneBounds(gs: PartGeometry[], exploded = false) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const g of gs) {
    const e = totalExtent(g);
    for (let k = 0; k < 3; k++) {
      const c = g.pos[k] + (exploded ? g.explode[k] : 0);
      min[k] = Math.min(min[k], c - e[k] / 2);
      max[k] = Math.max(max[k], c + e[k] / 2);
    }
  }
  if (!gs.length) return { min: [-50, 0, -50], max: [50, 50, 50] };
  return { min, max };
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

/** "80 x 42 x 60 mm" or "36 mm dia x 5 mm". */
export function describeSize(g: PartGeometry) {
  if (g.shape === "cylinder") return `${fmt(g.size[0])} mm dia x ${fmt(g.size[1])} mm long`;
  return `${g.size.map(fmt).join(" x ")} mm`;
}
