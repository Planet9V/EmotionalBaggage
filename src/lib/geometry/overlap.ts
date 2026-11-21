// When two parts' boxes overlap: a collision, or one part held inside the other (a battery in its holder,
// a module in its socket). Browser-safe, shared by the layout checks and the enclosure checks.
type B = { min: number[]; max: number[] };

/** Fraction of the smaller box's volume that lies inside the larger. */
function insideFraction(a: B, b: B): number {
  const d = [0, 1, 2].map((k) => Math.max(0, Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k])));
  const inter = d[0] * d[1] * d[2];
  const vol = (x: B) => (x.max[0] - x.min[0]) * (x.max[1] - x.min[1]) * (x.max[2] - x.min[2]);
  const small = Math.min(vol(a), vol(b));
  return small > 0 ? inter / small : 0;
}

/** At least this share of the smaller box inside the larger reads as one part held in the other. */
export const CONTAINED_SHARE = 0.9;

export type Relation = { kind: "contained"; inner: string; outer: string; why: "row" | "share" } | { kind: "collision" };

/**
 * `insideOf` is the part row's own statement (data.insideOf, the reference of the part that holds it).
 * Without one, a box at least 90% inside the other is taken as held by it.
 */
export function relationOf(a: { ref: string; box: B; insideOf?: string }, b: { ref: string; box: B; insideOf?: string }): Relation {
  if (a.insideOf && a.insideOf === b.ref) return { kind: "contained", inner: a.ref, outer: b.ref, why: "row" };
  if (b.insideOf && b.insideOf === a.ref) return { kind: "contained", inner: b.ref, outer: a.ref, why: "row" };
  if (insideFraction(a.box, b.box) >= CONTAINED_SHARE) {
    const va = (a.box.max[0] - a.box.min[0]) * (a.box.max[1] - a.box.min[1]) * (a.box.max[2] - a.box.min[2]);
    const vb = (b.box.max[0] - b.box.min[0]) * (b.box.max[1] - b.box.min[1]) * (b.box.max[2] - b.box.min[2]);
    return va <= vb ? { kind: "contained", inner: a.ref, outer: b.ref, why: "share" } : { kind: "contained", inner: b.ref, outer: a.ref, why: "share" };
  }
  return { kind: "collision" };
}

export const insideOfOf = (data: Record<string, unknown> | undefined) => (typeof data?.insideOf === "string" && data.insideOf.trim() ? data.insideOf.trim() : undefined);
