/**
 * Pure geometry for the physical layout editor: the three orthographic views, part footprints,
 * and the live checks. No React. Units are mm; x width, y up, z depth; origin at the centre of
 * the enclosure floor. Placement of counted bodies comes from the 3D view's own helpers so both
 * views agree.
 */
import type { Geometry } from "../../lib/types";
import { bodyExtent, bodyOffsets, cylinderAxis, totalExtent, type PartGeometry } from "../three/layout";

export type ViewKey = "top" | "front" | "side";

export type ViewDef = {
  key: ViewKey;
  label: string;
  /** scene axis shown left to right */
  h: 0 | 2;
  /** scene axis shown top to bottom (or bottom to top when flipped) */
  v: 1 | 2;
  /** true when scene +v points up the screen */
  flip: boolean;
  /** scene axis you look along (not visible in this view) */
  omitted: 0 | 1 | 2;
  hName: string;
  vName: string;
};

export const VIEW_DEFS: Record<ViewKey, ViewDef> = {
  top: { key: "top", label: "Top", h: 0, v: 2, flip: false, omitted: 1, hName: "x", vName: "z" },
  front: { key: "front", label: "Front", h: 0, v: 1, flip: true, omitted: 2, hName: "x", vName: "y" },
  side: { key: "side", label: "Side", h: 2, v: 1, flip: true, omitted: 0, hName: "z", vName: "y" },
};
export const VIEW_ORDER: ViewKey[] = ["top", "front", "side"];

export type LayoutPart = {
  id: number;
  ref: string;
  /** what to call the part in sentences: ref, else title */
  label: string;
  geometry: PartGeometry;
};

export type Box = { min: [number, number, number]; max: [number, number, number] };

/** Bounding box of a whole part, every body included. */
export function boxOf(g: PartGeometry, pos: number[] = g.pos): Box {
  const e = totalExtent(g);
  return {
    min: [pos[0] - e[0] / 2, pos[1] - e[1] / 2, pos[2] - e[2] / 2],
    max: [pos[0] + e[0] / 2, pos[1] + e[1] / 2, pos[2] + e[2] / 2],
  };
}

/** Scene point to drawing point in a view. Drawing x right, y down, in mm. */
export function toScreen(view: ViewDef, p: number[]): [number, number] {
  return [p[view.h], view.flip ? -p[view.v] : p[view.v]];
}

/** Drawing point back to the two scene coordinates it edits, as [h value, v value]. */
export function fromScreen(view: ViewDef, sx: number, sy: number): [number, number] {
  return [sx, view.flip ? -sy : sy];
}

export type Body =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

/** The footprint of each body of a part in a view (a rect, or a circle for a cylinder seen end-on). */
export function bodiesInView(view: ViewDef, g: PartGeometry, pos: number[] = g.pos): Body[] {
  const e = bodyExtent(g);
  const end = g.shape === "cylinder" && axisIndex(cylinderAxis(g)) === view.omitted;
  return bodyOffsets(g).map((o) => {
    const c = [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]];
    const [cx, cy] = toScreen(view, c);
    if (end) return { kind: "circle", cx, cy, r: e[view.h] / 2 };
    const w = e[view.h];
    const h = e[view.v];
    return { kind: "rect", x: cx - w / 2, y: cy - h / 2, w, h };
  });
}

function axisIndex(a: "x" | "y" | "z"): 0 | 1 | 2 {
  return a === "x" ? 0 : a === "y" ? 1 : 2;
}

/** Footprint of the whole part in a view as a rect. */
export function footprint(view: ViewDef, g: PartGeometry, pos: number[] = g.pos) {
  return boxRect(view, boxOf(g, pos));
}

/** A box as a rect in a view. */
export function boxRect(view: ViewDef, b: Box) {
  return { x: b.min[view.h], y: view.flip ? -b.max[view.v] : b.min[view.v], w: b.max[view.h] - b.min[view.h], h: b.max[view.v] - b.min[view.v] };
}

// ───────── checks

export const OVERLAP_TOLERANCE = 0.1;

export type Overlap = { a: LayoutPart; b: LayoutPart; depth: [number, number, number] };
export type Outside = { part: LayoutPart; amounts: { side: string; mm: number }[] };
export type Floating = { part: LayoutPart; gap: number };

export type CheckResult = {
  overlaps: Overlap[];
  outside: Outside[];
  floating: Floating[];
  overlapping: Set<number>;
  hasEnvelope: boolean;
};

/** Depth of the intersection of two boxes on each axis (negative when apart on that axis). */
export function overlapDepth(a: Box, b: Box): [number, number, number] {
  return [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k])) as [number, number, number];
}

/** Pairs whose bounding boxes intersect by more than the tolerance on all three axes. The shell is never in `parts`. */
export function findOverlaps(parts: LayoutPart[], tol = OVERLAP_TOLERANCE): Overlap[] {
  const out: Overlap[] = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const d = overlapDepth(boxOf(parts[i].geometry), boxOf(parts[j].geometry));
      if (d.every((v) => v > tol)) out.push({ a: parts[i], b: parts[j], depth: d });
    }
  }
  return out;
}

/** The space inside the walls: the shell box pulled in by the wall thickness on every face. */
export function innerBox(shell: PartGeometry, wall: number): Box {
  const b = boxOf(shell);
  return {
    min: [b.min[0] + wall, b.min[1] + wall, b.min[2] + wall],
    max: [b.max[0] - wall, b.max[1] - wall, b.max[2] - wall],
  };
}

const SIDE_LOW = ["on the left", "below the floor", "at the back"];
const SIDE_HIGH = ["on the right", "above the top", "at the front"];

/** Parts whose bounding box leaves the inner volume by more than the tolerance. */
export function findOutside(parts: LayoutPart[], inner: Box, tol = OVERLAP_TOLERANCE): Outside[] {
  const out: Outside[] = [];
  for (const p of parts) {
    const b = boxOf(p.geometry);
    const amounts: Outside["amounts"] = [];
    for (let k = 0; k < 3; k++) {
      const lo = inner.min[k] - b.min[k];
      const hi = b.max[k] - inner.max[k];
      if (lo > tol) amounts.push({ side: SIDE_LOW[k], mm: lo });
      if (hi > tol) amounts.push({ side: SIDE_HIGH[k], mm: hi });
    }
    if (amounts.length) out.push({ part: p, amounts });
  }
  return out;
}

/** Height of the floor surface the parts rest on: the inner floor when there is a shell, else y = 0. */
export function floorLevel(shell: PartGeometry | null, wall: number) {
  return shell ? boxOf(shell).min[1] + wall : 0;
}

/**
 * Parts whose bottom is above the floor with nothing under them. "Under" means another part that
 * overlaps it in plan and whose top is within 1 mm of this part's bottom, or higher.
 */
export function findFloating(parts: LayoutPart[], floor: number, tol = OVERLAP_TOLERANCE): Floating[] {
  const out: Floating[] = [];
  for (const p of parts) {
    const b = boxOf(p.geometry);
    if (b.min[1] <= floor + tol) continue;
    const supported = parts.some((o) => {
      if (o === p) return false;
      const ob = boxOf(o.geometry);
      const dx = Math.min(b.max[0], ob.max[0]) - Math.max(b.min[0], ob.min[0]);
      const dz = Math.min(b.max[2], ob.max[2]) - Math.max(b.min[2], ob.min[2]);
      return dx > tol && dz > tol && ob.min[1] < b.min[1] && ob.max[1] >= b.min[1] - 1;
    });
    if (!supported) out.push({ part: p, gap: b.min[1] - floor });
  }
  return out;
}

export function runChecks(parts: LayoutPart[], shell: PartGeometry | null, wall: number): CheckResult {
  const overlaps = findOverlaps(parts);
  const outside = shell ? findOutside(parts, innerBox(shell, wall)) : [];
  const floating = findFloating(parts, floorLevel(shell, wall));
  const overlapping = new Set<number>();
  for (const o of overlaps) {
    overlapping.add(o.a.id);
    overlapping.add(o.b.id);
  }
  return { overlaps, outside, floating, overlapping, hasEnvelope: !!shell };
}

// ───────── numbers

export const fmtMm = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export function snapTo(v: number, step: number) {
  const s = Math.round(v / step) * step;
  return Number((Object.is(s, -0) ? 0 : s).toFixed(3));
}

export function round3(v: number) {
  const s = Number(v.toFixed(3));
  return Object.is(s, -0) ? 0 : s;
}

/** The whole geometry again with a new position, as the server's shallow merge needs. */
export function withPos(g: Geometry, pos: number[]): Geometry {
  return { ...g, pos: pos.map(round3) };
}

/** A nice ruler step in mm for a zoom, so labels sit at least ~60 px apart. */
export function niceStep(pxPerMm: number, minPx = 60) {
  const raw = minPx / pxPerMm;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/** A BOM part being placed from the tray: not saved until three sizes and a basis are set. */
export type Draft = {
  size: (number | null)[];
  basis: "doc" | "typical" | "";
  x: number;
  /** null until set: the part then rests on the floor once sized */
  y: number | null;
  z: number;
};

export const BASIS_TEXT: Record<"doc" | "typical", string> = {
  doc: "Dimension stated in the source documents",
  typical: "Typical size for this kind of part; not measured",
};
