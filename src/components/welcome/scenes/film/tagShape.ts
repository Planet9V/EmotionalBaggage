// The outline of the owner's tag (Rev D, direction A "Heritage"), in mm, and where things sit on its faces: pure
// numbers, shared by the film (tag.ts builds and paints it) and the drawn frames (Still.tsx draws its outline), so
// the tag is the same shape everywhere on the page. Taken from the design's dimensioned sheet and its meshes.

/** The tag's size in mm: 62 wide, 92 long, 12.8 thick (the strap left out). */
export const TAG_MM = { w: 62, h: 92, t: 12.8 };
const { w: W, h: H } = TAG_MM;
/** The shoulders: cut at 45 degrees, this far down the side (and in from the side) from the corner. */
const SHOULDER = 12.4;
/** The strap slot, 18 by 3.2, its middle this far below the top edge. */
export const SLOT = { w: 18, h: 3.2, down: 7 };

export type P2 = [number, number];

/** A polygon with each corner rounded by its own radius (a fillet), sampled with `n` points per corner. */
export function rounded(pts: P2[], radii: number[], n = 5): P2[] {
  const out: P2[] = [];
  pts.forEach((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length]!;
    const b = pts[(i + 1) % pts.length]!;
    const r = radii[i] ?? 0;
    const ua = norm2([a[0] - p[0], a[1] - p[1]]);
    const ub = norm2([b[0] - p[0], b[1] - p[1]]);
    const half = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]))) / 2;
    if (r <= 0 || half < 1e-3) {
      out.push(p);
      return;
    }
    const along = r / Math.tan(half);
    const bis = norm2([ua[0] + ub[0], ua[1] + ub[1]]);
    const c: P2 = [p[0] + (bis[0] * r) / Math.sin(half), p[1] + (bis[1] * r) / Math.sin(half)];
    const s: P2 = [p[0] + ua[0] * along, p[1] + ua[1] * along];
    const e: P2 = [p[0] + ub[0] * along, p[1] + ub[1] * along];
    const a0 = Math.atan2(s[1] - c[1], s[0] - c[0]);
    let a1 = Math.atan2(e[1] - c[1], e[0] - c[0]);
    // the short way round
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
    while (a0 - a1 > Math.PI) a1 += Math.PI * 2;
    for (let k = 0; k <= n; k++) {
      const t = a0 + ((a1 - a0) * k) / n;
      out.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]);
    }
  });
  return out;
}
function norm2(v: P2): P2 {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/**
 * The tag's outline in mm about its middle (y up), drawn `inset` mm inside the real edge, counter-clockwise. The
 * same function gives the body (inset by the edge's rounding) and the stitch line (3 mm in).
 */
export function tagOutline(inset = 0, n = 5): P2[] {
  const w = W / 2 - inset;
  const top = H / 2 - inset;
  const k = Math.SQRT2 - 1;
  const xt = W / 2 - SHOULDER - inset * k;
  const ys = H / 2 - SHOULDER - inset * k;
  const r = (v: number) => Math.max(0.4, v - inset * 0.5);
  return rounded(
    [
      [-w, -top],
      [w, -top],
      [w, ys],
      [xt, top],
      [-xt, top],
      [-w, ys],
    ],
    [r(4.5), r(4.5), r(2.5), r(2.5), r(2.5), r(2.5)],
    n,
  );
}

/**
 * The outline as an SVG path, y down, with the top edge's middle at (0, 0): `s` drawing units per mm, `inset` mm
 * inside the edge. For the drawn frames.
 */
export function tagPath(s: number, inset = 0): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `M${tagOutline(inset, 3)
    .map(([x, y]) => `${r(x * s)} ${r((H / 2 - y) * s)}`)
    .join("L")}Z`;
}

/** Places on the face, in mm about the tag's middle (front as seen from the front, back as seen from the back). */
export const FACE = {
  panel: { x0: -27.5, x1: 27.5, y0: -1.5, y1: 29.5 },
  door: { x: -14.7, y: 14.1, r: 11.9 },
  speaker: { x0: 1.4, x1: 26.6, y0: 3.8, y1: 23.6 },
  oval: { x: 0, y: -18.6, rx: 25, ry: 10.5 },
  card: { x0: -23.6, x1: 23.6, y0: -0.9, y1: 28 },
  plate: { x0: -27.8, x1: 27.8, y0: -42.9, y1: 33.6 },
  tracker: { x: -6.2, y: -23.1, r: 18 },
};

