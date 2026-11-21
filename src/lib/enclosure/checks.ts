// Checks computed on what a generator returned, never on what was asked for (plan 5.9). Server side: uses Manifold.
//  - watertight: Manifold accepts the mesh as a closed, consistently oriented solid with a volume above zero.
//  - fit: each part sits inside the cavity measured from the result, with the stated clearance, and touches no printed material.
//  - openings: the hole found in the wall is where the part is, and the size that was asked for.
//  - lid: base and lid have the same footprint, meet without a gap and make the stated height.
import type { Manifold } from "manifold-3d";
import { fromManifold, getKernel, toManifold } from "./kernel";
import { FACE_AXES, type Box, type CheckResult, type EnclosureSpec, type GeneratorOutput, type Opening, type Vec3 } from "./types";

/** A part resting on the floor touches it; surfaces closer than this (mm) are contact, not a clash. */
const CONTACT = 0.05;
const shrink = (b: Box): Box => ({ min: b.min.map((v) => v + CONTACT) as Vec3, max: b.max.map((v) => v - CONTACT) as Vec3 });

export const TOL = { footprint: 0.1, height: 0.2, openingCenter: 0.5, openingSize: 0.6, interference: 1 };

function bboxOf(m: { positions: Float32Array }): Box {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], m.positions[i + k]);
    hi[k] = Math.max(hi[k], m.positions[i + k]);
  }
  return { min: lo, max: hi };
}

export async function boxSolid(b: Box): Promise<Manifold> {
  const tl = await getKernel();
  return tl.Manifold.cube([b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]], false).translate(b.min);
}

async function median(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

/** Distance from `from` along axis `ax` in direction `sign` to the first material, probing a thin column. Infinity when the column is empty. */
async function probe(solid: Manifold, from: Vec3, ax: 0 | 1 | 2, sign: 1 | -1, reach: number): Promise<number> {
  const w = 0.6;
  const lo: Vec3 = [from[0] - w / 2, from[1] - w / 2, from[2] - w / 2];
  const hi: Vec3 = [from[0] + w / 2, from[1] + w / 2, from[2] + w / 2];
  if (sign > 0) hi[ax] = from[ax] + reach; else lo[ax] = from[ax] - reach;
  const col = await boxSolid({ min: lo, max: hi });
  const hit = col.intersect(solid);
  col.delete();
  if (hit.isEmpty()) { hit.delete(); return Infinity; }
  const bb = hit.boundingBox();
  hit.delete();
  return sign > 0 ? bb.min[ax] - from[ax] : from[ax] - bb.max[ax];
}

/** Where the walls and lid really are, from a grid of probes through the cavity: the median distance in each direction. */
async function measuredCavity(solid: Manifold, spec: EnclosureSpec): Promise<Box> {
  const { inner } = spec;
  const c: Vec3 = [(inner.min[0] + inner.max[0]) / 2, (inner.min[1] + inner.max[1]) / 2, (inner.min[2] + inner.max[2]) / 2];
  const reach = 200;
  const out: Box = { min: [0, 0, 0], max: [0, 0, 0] };
  const fr = [0.25, 0.5, 0.75];
  for (const ax of [0, 1, 2] as const) {
    for (const sign of [-1, 1] as const) {
      const others = ([0, 1, 2] as const).filter((k) => k !== ax);
      const ds: number[] = [];
      for (const f1 of fr) for (const f2 of fr) {
        const p: Vec3 = [...c];
        p[others[0]] = inner.min[others[0]] + (inner.max[others[0]] - inner.min[others[0]]) * f1;
        p[others[1]] = inner.min[others[1]] + (inner.max[others[1]] - inner.min[others[1]]) * f2;
        ds.push(await probe(solid, p, ax, sign, reach));
      }
      const d = await median(ds);
      (sign < 0 ? out.min : out.max)[ax] = c[ax] + sign * d;
    }
  }
  return out;
}

function inPlaneAxes(o: Opening) { return FACE_AXES[o.face]; }

/** The hole actually cut in the wall for an opening, measured on the solid: its centre and size in the face's two axes. */
export async function measureOpening(solid: Manifold, spec: EnclosureSpec, o: Opening) {
  const [a, b] = inPlaneAxes(o);
  const { outer, params } = spec;
  const normal = ([0, 1, 2] as const).find((k) => k !== a && k !== b)!;
  const positive = o.face === "right" || o.face === "front" || o.face === "top";
  const thick = o.face === "top" ? params.lidThickness : o.face === "bottom" ? params.floorThickness : params.wallThickness;
  const pad = 1.5;
  const lo: Vec3 = [0, 0, 0];
  const hi: Vec3 = [0, 0, 0];
  lo[a] = o.center[a] - o.width / 2 - pad; hi[a] = o.center[a] + o.width / 2 + pad;
  lo[b] = o.center[b] - o.height / 2 - pad; hi[b] = o.center[b] + o.height / 2 + pad;
  // The slab is the wall's own thickness, a hair inside the outer surface so a flush face does not count as material-free.
  if (positive) { lo[normal] = outer.max[normal] - thick + 0.01; hi[normal] = outer.max[normal] - 0.01; }
  else { lo[normal] = outer.min[normal] + 0.01; hi[normal] = outer.min[normal] + thick - 0.01; }
  const win = await boxSolid({ min: lo, max: hi });
  const open = win.subtract(solid);
  win.delete();
  if (open.isEmpty()) { open.delete(); return null; }
  // A lid-to-base seam can leave a thin slot in the window; the opening is the largest open piece.
  const pieces = open.decompose();
  open.delete();
  pieces.sort((p, q) => q.volume() - p.volume());
  const bb = pieces[0].boundingBox();
  pieces.forEach((p) => p.delete());
  return { center: [(bb.min[a] + bb.max[a]) / 2, (bb.min[b] + bb.max[b]) / 2], size: [bb.max[a] - bb.min[a], bb.max[b] - bb.min[b]] };
}

const mm = (n: number) => `${Math.round(n * 100) / 100} mm`;

export async function computeChecks(spec: EnclosureSpec, out: GeneratorOutput): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const tl = await getKernel();
  const base = await toManifold(out.base);
  const lid = await toManifold(out.lid);
  const watertight = (name: string, m: { manifold: Manifold | null; status: string }) => {
    if (!m.manifold) return { key: `watertight-${name}`, label: `The ${name} is watertight`, ok: false, detail: `Manifold refused the ${name} mesh: ${m.status}.` };
    const parts = m.manifold.decompose().length;
    const vol = m.manifold.volume();
    const ok = vol > 0 && parts === 1;
    return {
      key: `watertight-${name}`,
      label: `The ${name} is watertight`,
      ok,
      detail: `Closed solid, volume ${Math.round(vol)} mm3, ${parts} separate ${parts === 1 ? "piece" : "pieces"}${parts === 1 ? "" : " (a part must print as one piece; the extra pieces are floating)"}. Checked with manifold-3d.`,
    };
  };
  results.push(watertight("base", base), watertight("lid", lid));
  if (!base.manifold || !lid.manifold) {
    base.manifold?.delete();
    lid.manifold?.delete();
    return results;
  }
  const solid = tl.Manifold.union([base.manifold, lid.manifold]);

  // Lid closes.
  const bb = bboxOf(out.base), lb = bboxOf(out.lid);
  const dx = Math.max(Math.abs(bb.min[0] - lb.min[0]), Math.abs(bb.max[0] - lb.max[0]));
  const dz = Math.max(Math.abs(bb.min[2] - lb.min[2]), Math.abs(bb.max[2] - lb.max[2]));
  const topErr = Math.abs(lb.max[1] - spec.outer.max[1]);
  const botErr = Math.abs(bb.min[1] - spec.outer.min[1]);
  const gap = lb.min[1] - bb.max[1];
  const closes = dx <= TOL.footprint && dz <= TOL.footprint && gap <= 0.05 && topErr <= TOL.height && botErr <= TOL.height;
  results.push({
    key: "lid-closes",
    label: "The lid closes on the base",
    ok: closes,
    detail: `Footprints differ by ${mm(Math.max(dx, dz))} (limit ${mm(TOL.footprint)}); the lid ${gap <= 0 ? `overlaps the base rim by ${mm(-gap)}` : `is ${mm(gap)} above the base`}; assembled height is ${mm(lb.max[1] - bb.min[1])} against ${mm(spec.outer.max[1] - spec.outer.min[1])} asked for.`,
  });

  // Parts fit.
  const cavity = await measuredCavity(solid, spec);
  const fitFails: string[] = [];
  const worst: { ref: string; gap: number }[] = [];
  for (const p of spec.parts.filter((x) => x.role === "inside")) {
    const label = p.ref || p.title;
    const gaps = [p.box.min[0] - cavity.min[0], cavity.max[0] - p.box.max[0], p.box.min[2] - cavity.min[2], cavity.max[2] - p.box.max[2], cavity.max[1] - p.box.max[1]];
    const g = Math.min(...gaps);
    worst.push({ ref: label, gap: g });
    if (g < spec.params.clearance - 0.01) fitFails.push(`${label} has ${mm(g)} to the wall or lid`);
    if (p.kind !== "pcb") {
      const pb = await boxSolid(shrink(p.box));
      const hit = pb.intersect(solid);
      const vol = hit.volume();
      pb.delete();
      hit.delete();
      if (vol > TOL.interference) fitFails.push(`${label} runs into printed material (${Math.round(vol)} mm3)`);
    }
  }
  worst.sort((a, b) => a.gap - b.gap);
  results.push({
    key: "parts-fit",
    label: "Every part fits inside with the clearance",
    ok: fitFails.length === 0,
    detail: fitFails.length ? fitFails.join("; ") + "." : `${worst.length} parts checked against the cavity measured from the result (${mm(cavity.max[0] - cavity.min[0])} by ${mm(cavity.max[2] - cavity.min[2])} by ${mm(cavity.max[1] - cavity.min[1])} high); the tightest is ${worst[0]?.ref ?? "none"} at ${mm(worst[0]?.gap ?? 0)} against ${mm(spec.params.clearance)} required.`,
  });

  // Openings line up.
  const lineFails: string[] = [];
  let worstOff = 0;
  for (const o of spec.openings) {
    const m = await measureOpening(solid, spec, o);
    if (!m) { lineFails.push(`${o.partRef}: no opening found in the ${o.face} wall`); continue; }
    const [a, b] = inPlaneAxes(o);
    const off = Math.hypot(m.center[0] - o.center[a], m.center[1] - o.center[b]);
    const ds = Math.max(Math.abs(m.size[0] - o.width), Math.abs(m.size[1] - o.height));
    worstOff = Math.max(worstOff, off);
    if (off > TOL.openingCenter) lineFails.push(`${o.partRef}: opening centre is ${mm(off)} from the part`);
    else if (ds > TOL.openingSize) lineFails.push(`${o.partRef}: opening is ${mm(ds)} off the size asked for`);
    const part = spec.parts.find((p) => p.id === o.partId);
    if (part?.role === "through") {
      const pb = await boxSolid(shrink(part.box));
      const hit = pb.intersect(solid);
      const vol = hit.volume();
      pb.delete();
      hit.delete();
      if (vol > TOL.interference) lineFails.push(`${o.partRef}: the part still touches the wall (${Math.round(vol)} mm3)`);
    }
  }
  results.push({
    key: "openings-line-up",
    label: "Every opening lines up with its part",
    ok: lineFails.length === 0,
    detail: spec.openings.length === 0 ? "No openings were asked for." : lineFails.length ? lineFails.join("; ") + "." : `${spec.openings.length} openings measured in the walls; the furthest is ${mm(worstOff)} from its part (limit ${mm(TOL.openingCenter)}).`,
  });

  solid.delete();
  base.manifold.delete();
  lid.manifold.delete();
  void fromManifold;
  return results;
}
