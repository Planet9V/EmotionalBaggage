/**
 * Printable mesh generation in plain TypeScript (no three.js), so the same code runs in the
 * browser and in a Node check script. Writing and reading STL files is done by three.js'
 * STLExporter and STLLoader (see src/lib/geometry).
 *
 * Meshes are triangle soups: a Float32Array with 9 numbers per triangle (three xyz vertices),
 * wound counter-clockwise seen from outside, so normals face outward.
 *
 * Print coordinates: millimetres, Z up, the body sits on z = 0 and is centred on x/y.
 * Scene coordinates elsewhere in the app are Y up; ModelCanvas rotates these meshes into place.
 */

export type Mesh = Float32Array;
type V3 = [number, number, number];

class Builder {
  private out: number[] = [];
  tri(a: V3, b: V3, c: V3) {
    this.out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  /** Quad a-b-c-d, counter-clockwise seen from the side the normal points to. */
  quad(a: V3, b: V3, c: V3, d: V3) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
  done(): Mesh {
    return new Float32Array(this.out);
  }
}

/** Rectangle corners at height z, counter-clockwise seen from +z. */
function rect(w: number, d: number, z: number): V3[] {
  const x = w / 2;
  const y = d / 2;
  return [
    [-x, -y, z],
    [x, -y, z],
    [x, y, z],
    [-x, y, z],
  ];
}

/** Flat face over a CCW (from +z) loop. up = normal +z, else -z. */
function cap(b: Builder, loop: V3[], up: boolean) {
  for (let i = 1; i < loop.length - 1; i++) {
    if (up) b.tri(loop[0], loop[i], loop[i + 1]);
    else b.tri(loop[0], loop[i + 1], loop[i]);
  }
}

/** Ring between an outer and an inner loop at the same height (both CCW, same vertex count). */
function annulus(b: Builder, outer: V3[], inner: V3[], up: boolean) {
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (up) b.quad(outer[i], outer[j], inner[j], inner[i]);
    else b.quad(outer[i], inner[i], inner[j], outer[j]);
  }
}

/** Side walls from a lower loop to an upper loop (both CCW). outward = normals away from the axis. */
function walls(b: Builder, lower: V3[], upper: V3[], outward: boolean) {
  const n = lower.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (outward) b.quad(lower[i], lower[j], upper[j], upper[i]);
    else b.quad(lower[i], upper[i], upper[j], lower[j]);
  }
}

/** Solid box, w along x, d along y, h along z. */
export function boxMesh(w: number, d: number, h: number): Mesh {
  const b = new Builder();
  const lo = rect(w, d, 0);
  const hi = rect(w, d, h);
  cap(b, lo, false);
  cap(b, hi, true);
  walls(b, lo, hi, true);
  return b.done();
}

/** Solid cylinder standing on its end: diameter, length along z, `segments` sides. */
export function cylinderMesh(diameter: number, length: number, segments = 64): Mesh {
  const b = new Builder();
  const r = diameter / 2;
  const lo: V3[] = [];
  const hi: V3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    lo.push([x, y, 0]);
    hi.push([x, y, length]);
  }
  const c0: V3 = [0, 0, 0];
  const c1: V3 = [0, 0, length];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    b.tri(c0, lo[j], lo[i]);
    b.tri(c1, hi[i], hi[j]);
  }
  walls(b, lo, hi, true);
  return b.done();
}

export type ShellParams = { wallMm: number; clearanceMm: number; lipMm: number };
export const SHELL_DEFAULTS: ShellParams = { wallMm: 2, clearanceMm: 0.2, lipMm: 3 };

/** Dimensions of the two shell bodies for an envelope W (x) x H (up) x D (depth). */
export function shellDims(size: number[], p: ShellParams) {
  const [W, H, D] = size;
  const t = p.wallMm;
  const c = p.clearanceMm;
  const trayH = H - t;
  const lipOuterW = W - 2 * t - 2 * c;
  const lipOuterD = D - 2 * t - 2 * c;
  const lipInnerW = lipOuterW - 2 * t;
  const lipInnerD = lipOuterD - 2 * t;
  const lipH = Math.min(p.lipMm, Math.max(0, trayH - t - 0.5));
  const problems: string[] = [];
  if (!(t > 0)) problems.push("Wall thickness must be above 0 mm.");
  if (!(c >= 0)) problems.push("Clearance cannot be negative.");
  if (!(trayH > t)) problems.push("The envelope is too low for this wall thickness.");
  if (!(lipInnerW > 0 && lipInnerD > 0)) problems.push("The envelope is too small for this wall thickness and clearance.");
  if (!(lipH > 0)) problems.push("There is no room for a locating lip.");
  return { W, H, D, t, c, trayH, lipOuterW, lipOuterD, lipInnerW, lipInnerD, lipH, problems };
}

/**
 * Open tray: floor plus four walls, one closed surface built from explicit vertices.
 * Outer W x D x trayH, cavity (W-2t) x (D-2t) from z = t to the rim.
 */
export function trayMesh(size: number[], p: ShellParams = SHELL_DEFAULTS): Mesh {
  const s = shellDims(size, p);
  const b = new Builder();
  const outLo = rect(s.W, s.D, 0);
  const outHi = rect(s.W, s.D, s.trayH);
  const inHi = rect(s.W - 2 * s.t, s.D - 2 * s.t, s.trayH);
  const inLo = rect(s.W - 2 * s.t, s.D - 2 * s.t, s.t);
  cap(b, outLo, false); // underside
  walls(b, outLo, outHi, true); // outer walls
  annulus(b, outHi, inHi, true); // rim
  walls(b, inLo, inHi, false); // inner walls, facing the cavity
  cap(b, inLo, true); // cavity floor
  return b.done();
}

/**
 * Lid in print orientation: plate W x D x t on the bed, with a rectangular locating lip on top that
 * drops into the tray opening with `clearance` per side. One closed surface.
 */
export function lidMesh(size: number[], p: ShellParams = SHELL_DEFAULTS): Mesh {
  const s = shellDims(size, p);
  const b = new Builder();
  const z1 = s.t;
  const z2 = s.t + s.lipH;
  const plateLo = rect(s.W, s.D, 0);
  const plateHi = rect(s.W, s.D, z1);
  const lipOutLo = rect(s.lipOuterW, s.lipOuterD, z1);
  const lipOutHi = rect(s.lipOuterW, s.lipOuterD, z2);
  const lipInHi = rect(s.lipInnerW, s.lipInnerD, z2);
  const lipInLo = rect(s.lipInnerW, s.lipInnerD, z1);
  cap(b, plateLo, false);
  walls(b, plateLo, plateHi, true);
  annulus(b, plateHi, lipOutLo, true); // plate top outside the lip
  walls(b, lipOutLo, lipOutHi, true);
  annulus(b, lipOutHi, lipInHi, true); // lip top
  walls(b, lipInLo, lipInHi, false);
  cap(b, lipInLo, true); // plate top inside the lip
  return b.done();
}

/** Expected solid volumes (mm3) for checking. */
export function trayVolume(size: number[], p: ShellParams = SHELL_DEFAULTS) {
  const s = shellDims(size, p);
  return s.W * s.D * s.trayH - (s.W - 2 * s.t) * (s.D - 2 * s.t) * (s.trayH - s.t);
}
export function lidVolume(size: number[], p: ShellParams = SHELL_DEFAULTS) {
  const s = shellDims(size, p);
  return s.W * s.D * s.t + (s.lipOuterW * s.lipOuterD - s.lipInnerW * s.lipInnerD) * s.lipH;
}

/** Signed volume of a closed triangle soup (positive when the normals face outward). */
export function signedVolume(m: Mesh) {
  let v = 0;
  for (let i = 0; i < m.length; i += 9) {
    const ax = m[i], ay = m[i + 1], az = m[i + 2];
    const bx = m[i + 3], by = m[i + 4], bz = m[i + 5];
    const cx = m[i + 6], cy = m[i + 7], cz = m[i + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

/** Axis-aligned bounds of a triangle soup. */
export function bounds(m: Mesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = m[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

/** Counts edges not shared by exactly two triangles (0 means watertight), after welding vertices. */
export function openEdges(m: Mesh, tol = 1e-4) {
  const key = (i: number) => `${Math.round(m[i] / tol)},${Math.round(m[i + 1] / tol)},${Math.round(m[i + 2] / tol)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < m.length; t += 9) {
    const k = [key(t), key(t + 3), key(t + 6)];
    for (let e = 0; e < 3; e++) {
      const a = k[e];
      const b = k[(e + 1) % 3];
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(id, (edges.get(id) ?? 0) + 1);
    }
  }
  let bad = 0;
  for (const c of edges.values()) if (c !== 2) bad++;
  return { edges: edges.size, bad };
}
