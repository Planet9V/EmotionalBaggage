/**
 * A vector drawing of the example's 3D model, worked out from the parts' own geometry rows (size, position,
 * shape, count, explode vector): every box and cylinder projected with the 3D view's own three-quarter view
 * direction (canvasRig.tsx), its faces that face the viewer kept and drawn far to near, each shaded by how it
 * faces the light. No three.js, no canvas: the result is SVG paths, sharp at any pixel density and light enough
 * for the hero. The 3D stage shows the same drawing while its live view is not mounted, so the two always agree.
 * Pure: tested in tests/welcome/projection.test.ts.
 */
import { bodyOffsets, cylinderAxis, lidLift, type PartGeometry } from "@/components/three/layout";
import type { ShellOutline } from "@/components/three/canvasTypes";

/** The 3D view's default direction from the model to the camera (canvasRig.tsx DEFAULT_DIR). */
const VIEW: [number, number, number] = norm([0.62, 0.48, 0.92]);
const UP: [number, number, number] = [0, 1, 0];
const LIGHT: [number, number, number] = norm([0.35, 0.9, 0.45]);
const SEGMENTS = 20;

type V = [number, number, number];
function norm(v: V): V {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const RIGHT = norm(cross(UP, VIEW));
const SCREEN_UP = norm(cross(VIEW, RIGHT));

/** Screen x (right), screen y (down) and depth (larger is nearer the viewer) of a scene point, in mm. */
export function project(p: V): { x: number; y: number; depth: number } {
  return { x: dot(p, RIGHT), y: -dot(p, SCREEN_UP), depth: dot(p, VIEW) };
}

/** A part's colour as a theme token, chosen by its kind; the enclosure is the accent. */
const KIND_TOKEN: Record<string, string> = {
  "circuit board": "--success",
  microcontroller: "--net-signal",
  sensor: "--net-signal",
  module: "--net-signal",
  speaker: "--text-secondary",
  battery: "--warning",
  switch: "--danger",
  button: "--danger",
  enclosure: "--accent-orange",
  mechanical: "--text-muted",
};
export const toneOf = (kind: string, ref: string) => (/^BAT/i.test(ref) ? "--net-power" : (KIND_TOKEN[kind] ?? "--text-muted"));

export type StillInput = { id: number; ref: string; title: string; kind: string; geometry: PartGeometry; step: number };
type StillFace = {
  part: number;
  /** the path, in the drawing's own units (mm on screen) */
  d: string;
  /** 0 (facing away from the light) to 1 (facing it) */
  shade: number;
  shell: boolean;
  /** a shell's lid (its faces that look up): it lifts off when the model is pulled apart */
  lid: boolean;
  depth: number;
};
type StillPart = { id: number; ref: string; title: string; tone: string; step: number; shell: boolean; at: [number, number]; explode: [number, number] };
export type Still = {
  box: [number, number, number, number];
  faces: StillFace[];
  parts: StillPart[];
  /** pulled apart: how far the shell's lid rises on screen (as the 3D view lifts it), and the box that then holds everything */
  lift: number;
  apart: [number, number, number, number];
};

type Face = { pts: V[]; normal: V };

function boxFaces(c: V, s: V): Face[] {
  const [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2];
  const p = (x: number, y: number, z: number): V => [c[0] + x * hx, c[1] + y * hy, c[2] + z * hz];
  return [
    { normal: [1, 0, 0], pts: [p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)] },
    { normal: [-1, 0, 0], pts: [p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), p(-1, -1, -1)] },
    { normal: [0, 1, 0], pts: [p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1)] },
    { normal: [0, -1, 0], pts: [p(-1, -1, 1), p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1)] },
    { normal: [0, 0, 1], pts: [p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)] },
    { normal: [0, 0, -1], pts: [p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1)] },
  ];
}

function cylinderFaces(c: V, diameter: number, length: number, axis: "x" | "y" | "z"): Face[] {
  const r = diameter / 2;
  const h = length / 2;
  // the circle's plane and the axis, in scene axes
  const at = (a: number, t: number): V => {
    const u = Math.cos(a) * r;
    const v = Math.sin(a) * r;
    return axis === "y" ? [c[0] + u, c[1] + t, c[2] + v] : axis === "x" ? [c[0] + t, c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2] + t];
  };
  const ax: V = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const faces: Face[] = [];
  const ring = Array.from({ length: SEGMENTS }, (_, i) => (i / SEGMENTS) * Math.PI * 2);
  faces.push({ normal: ax, pts: ring.map((a) => at(a, h)) });
  faces.push({ normal: [-ax[0], -ax[1], -ax[2]], pts: [...ring].reverse().map((a) => at(a, -h)) });
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % SEGMENTS]!;
    const m = (a + b) / 2;
    const n0 = at(m, 0);
    faces.push({ normal: norm([n0[0] - c[0], n0[1] - c[1], n0[2] - c[2]]), pts: [at(a, -h), at(b, -h), at(b, h), at(a, h)] });
  });
  return faces;
}

/** A shell with an outline of its own: the outline as floor and lid, a wall under each of its edges, and the lid's openings. */
function outlineFaces(c: V, height: number, o: ShellOutline): Face[] {
  const hy = height / 2;
  const at = (p: readonly [number, number], y: number): V => [c[0] + p[0], c[1] + y, c[2] + p[1]];
  const faces: Face[] = [
    { normal: [0, 1, 0], pts: o.outer.map((p) => at(p, hy)) },
    { normal: [0, -1, 0], pts: o.outer.map((p) => at(p, -hy)) },
  ];
  o.outer.forEach((p, i) => {
    const q = o.outer[(i + 1) % o.outer.length]!;
    const run = norm([q[0] - p[0], 0, q[1] - p[1]]);
    // the outline's middle is inside it: the wall faces away from there
    const out: V = [run[2], 0, -run[0]];
    const side = dot(out, [(p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2]) >= 0 ? 1 : -1;
    faces.push({ normal: [out[0] * side, 0, out[2] * side], pts: [at(p, -hy), at(q, -hy), at(q, hy), at(p, hy)] });
  });
  for (const h of o.lidHoles ?? []) faces.push({ normal: [0, 1, 0], pts: h.map((p) => at(p, hy)) });
  return faces;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The drawing of the assembled model: faces far to near, and for each part its tone, its place in the assembly
 * (`step`, for a staged reveal), the screen point of its middle and the screen direction of its explode vector.
 * Rotated parts are drawn unrotated (the example has none). `outline` gives a shell an outline of its own (by its
 * size); a shell without one is drawn as its box.
 */
export function stillOf(parts: StillInput[], pad = 6, outline?: (size: number[]) => ShellOutline | undefined): Still {
  const faces: StillFace[] = [];
  const out: StillPart[] = [];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  // the same again with every part at its exploded place and the lid lifted
  const far = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const shellPart = parts.find((p) => p.geometry.shape === "shell");
  const lift = shellPart ? r1(-project([0, lidLift(shellPart.geometry, parts.filter((p) => p !== shellPart).map((p) => p.geometry)), 0]).y) : 0;
  for (const part of parts) {
    const g = part.geometry;
    const shell = g.shape === "shell";
    const pos = g.pos as V;
    const bodies: Face[] = [];
    const own = shell ? outline?.(g.size) : undefined;
    if (own) bodies.push(...outlineFaces(pos, g.size[1]!, own));
    else if (g.shape === "cylinder") {
      const axis = cylinderAxis(g);
      for (const o of bodyOffsets(g)) bodies.push(...cylinderFaces(add(pos, o), g.size[0]!, g.size[1]!, axis));
    } else {
      for (const o of bodyOffsets(g)) bodies.push(...boxFaces(add(pos, o), [g.size[0]!, g.size[1]!, g.size[2] ?? g.size[0]!]));
    }
    for (const f of bodies) {
      // a see-through shell keeps its far faces too, drawn behind everything else
      const facing = dot(f.normal, VIEW) > 1e-6;
      if (!facing && !shell) continue;
      const pts = f.pts.map(project);
      const lid = shell && f.normal[1] > 0.5;
      const ex = project(g.explode as V);
      const [dx, dy] = [ex.x, ex.y - (lid ? lift : 0)];
      for (const p of pts) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
        far.x0 = Math.min(far.x0, p.x + dx);
        far.x1 = Math.max(far.x1, p.x + dx);
        far.y0 = Math.min(far.y0, p.y + dy);
        far.y1 = Math.max(far.y1, p.y + dy);
      }
      const depth = shell ? (facing ? Infinity : -Infinity) : pts.reduce((a, p) => a + p.depth, 0) / pts.length;
      faces.push({ part: part.id, d: `M${pts.map((p) => `${r1(p.x)} ${r1(p.y)}`).join("L")}Z`, shade: Math.max(0, Math.min(1, 0.5 + 0.5 * dot(f.normal, LIGHT))), shell, lid, depth });
    }
    const mid = project(pos);
    const ex = project(add(pos, g.explode as V));
    out.push({ id: part.id, ref: part.ref, title: part.title, tone: toneOf(part.kind, part.ref), step: part.step, shell, at: [r1(mid.x), r1(mid.y)], explode: [r1(ex.x - mid.x), r1(ex.y - mid.y)] });
  }
  faces.sort((a, b) => a.depth - b.depth);
  if (!Number.isFinite(x0)) return { box: [0, 0, 1, 1], faces: [], parts: out, lift: 0, apart: [0, 0, 1, 1] };
  return { lift, apart: [r1(far.x0 - pad), r1(far.y0 - pad), r1(far.x1 - far.x0 + 2 * pad), r1(far.y1 - far.y0 + 2 * pad)], box: [r1(x0 - pad), r1(y0 - pad), r1(x1 - x0 + 2 * pad), r1(y1 - y0 + 2 * pad)], faces: faces.map((f) => ({ ...f, depth: Number.isFinite(f.depth) ? r1(f.depth) : f.depth > 0 ? 1e6 : -1e6 })), parts: out };
}
