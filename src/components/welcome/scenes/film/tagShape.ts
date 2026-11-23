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

/** The strap: black TPU, 16 wide and 2.4 thick as the film and the drawn tag show it. */
export const STRAP = { w: 16, t: 2.4 };

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


/**
 * Saddle stitches along a closed path: a dash every `pitch` mm, `len` long, each turned `slant` off the path. The
 * film paints them on the tag's face (tag.ts) and the drawn tag strokes them (TagArt.tsx): the same stitches.
 */
export function stitchRuns(path: P2[], pitch: number, len: number, slant: number): [P2, P2][] {
  const segs = path.map((p, i) => [p, path[(i + 1) % path.length]!] as const);
  const total = segs.reduce((a, [p, q]) => a + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
  const count = Math.round(total / pitch);
  const step = total / count;
  const out: [P2, P2][] = [];
  let s = step / 2;
  let walked = 0;
  for (const [p, q] of segs) {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    while (s <= walked + l) {
      const f = (s - walked) / l;
      const x = p[0] + (q[0] - p[0]) * f;
      const y = p[1] + (q[1] - p[1]) * f;
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + slant;
      out.push([
        [x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2],
        [x + (Math.cos(a) * len) / 2, y + (Math.sin(a) * len) / 2],
      ]);
      s += step;
    }
    walked += l;
  }
  return out;
}

/** The perforations: 1.3 mm holes on a 2.6 mm hexagonal lattice centred on the coin door (the film's shader has the same rule). */
export const HOLE = { r: 0.65, pitch: 2.6, row: 2.25165 };

/**
 * The holes of the perforated panel as runs along each row of the lattice: `n` holes from (x, y), `pitch` apart,
 * in mm about the tag's middle (y up). `through` runs lie over the speaker and go right through the skin; the rest
 * are blind. No hole sits on the coin door's parting line or its coin slot, or within 1.4 mm of the panel's edge.
 */
export function perforationRuns(): { x: number; y: number; n: number; through: boolean }[] {
  const { panel: p, door: d, speaker: s } = FACE;
  const inside = (x: number, y: number, x0: number, x1: number, y0: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const runs: { x: number; y: number; n: number; through: boolean }[] = [];
  const j0 = Math.ceil((p.y0 - d.y) / HOLE.row);
  const j1 = Math.floor((p.y1 - d.y) / HOLE.row);
  for (let j = j0; j <= j1; j++) {
    const y = d.y + j * HOLE.row;
    const shift = j % 2 === 0 ? 0 : HOLE.pitch / 2;
    let run: { x: number; y: number; n: number; through: boolean } | null = null;
    const i0 = Math.ceil((p.x0 - d.x - shift) / HOLE.pitch);
    const i1 = Math.floor((p.x1 - d.x - shift) / HOLE.pitch);
    for (let i = i0; i <= i1; i++) {
      const x = d.x + shift + i * HOLE.pitch;
      const keep =
        inside(x, y, p.x0 + 1.4, p.x1 - 1.4, p.y0 + 1.4, p.y1 - 1.4) &&
        Math.abs(Math.hypot(x - d.x, y - d.y) - d.r) >= 0.95 &&
        !inside(x - d.x, y - d.y, -5.2, 5.2, -1.6, 1.6);
      const through = inside(x, y, s.x0, s.x1, s.y0, s.y1);
      if (keep && run && run.through === through) run.n++;
      else {
        run = keep ? { x, y, n: 1, through } : null;
        if (run) runs.push(run);
      }
    }
  }
  return runs;
}
