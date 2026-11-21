// Builds the enclosure spec from a concept's parts (plan 5.9). Pure: rows in, spec out, no I/O.
import { toPart } from "@/lib/domain";
import { totalExtent } from "@/components/three/layout";
import type { Item } from "@/lib/types";
import {
  DEFAULT_PARAMS,
  FACES,
  FACE_AXES,
  OPENING_KINDS,
  PART_KINDS,
  SCREWS,
  type Box,
  type EnclosureParams,
  type EnclosureSpec,
  type Face,
  type Hole,
  type Issue,
  type Opening,
  type OpeningOverride,
  type PartKind,
  type SpecPart,
  type Vec3,
} from "./types";
import { validateParams } from "./validate";

const EPS = 1e-6;
/** A part this close to the inner wall (mm) counts as against it. */
export const NEAR_WALL = 2;
/** Default PCB mounting holes when the part row gives none: this far in from each corner, M2. */
export const DEFAULT_HOLE_INSET = 3.5;
export const DEFAULT_HOLE_DIAMETER = 2.2;

const isKind = (v: unknown): v is PartKind => typeof v === "string" && (PART_KINDS as readonly string[]).includes(v);

/**
 * What the enclosure does with a part of each shared kind (src/lib/parts/kinds.ts, the list `data.kind`
 * is checked against). A kind not listed here (mechanical, generic, printed part, fastener and the
 * like) says nothing the enclosure can use, so the part's role is worked out from its words instead.
 */
export const ENCLOSURE_ROLE_OF_KIND: Readonly<Record<string, PartKind>> = {
  speaker: "speaker",
  display: "display",
  button: "button",
  switch: "switch",
  led: "led",
  connector: "connector",
  sensor: "sensor",
  microphone: "microphone",
  battery: "battery",
  module: "module",
  microcontroller: "module",
  regulator: "module",
  "circuit board": "pcb",
  enclosure: "shell",
  resistor: "other",
  capacitor: "other",
  diode: "other",
  motor: "other",
};

/** The kind a row states in `data.kind` (a shared kind, read through ENCLOSURE_ROLE_OF_KIND), else one worked out from its reference and words. Sensors are never guessed: an IMU needs no window. */
export function partKind(item: Item, shape: string): { kind: PartKind; from: "row" | "inferred" } {
  const stated = typeof item.data?.kind === "string" ? item.data.kind.trim().toLowerCase() : "";
  const role = ENCLOSURE_ROLE_OF_KIND[stated];
  if (role) return { kind: role, from: "row" };
  // A row saved before kinds were shared may hold one of the enclosure's own words ("pcb", "shell").
  if (isKind(stated) && stated !== "other") return { kind: stated, from: "row" };
  if (shape === "shell") return { kind: "shell", from: "inferred" };
  const p = toPart(item);
  const words = `${p.title} ${p.spec}`.toLowerCase();
  const ref = p.ref.toUpperCase();
  if (/^PCB/.test(ref) || /\b(pcb|perfboard|carrier board)\b/.test(words) || /^carrier\b/.test(p.title.toLowerCase())) return { kind: "pcb", from: "inferred" };
  if (/\bspeaker\b/.test(words)) return { kind: "speaker", from: "inferred" };
  if (/\b(display|screen|lcd|oled|tft)\b/.test(words)) return { kind: "display", from: "inferred" };
  if (/\b(push ?button|button)\b/.test(words)) return { kind: "button", from: "inferred" };
  if (/\bswitch\b/.test(words)) return { kind: "switch", from: "inferred" };
  if (/\bled\b|indicator light/.test(words)) return { kind: "led", from: "inferred" };
  if (/\b(usb|jack|connector|socket|port)\b/.test(words)) return { kind: "connector", from: "inferred" };
  if (/\bbatter(y|ies)\b/.test(words)) return { kind: "battery", from: "inferred" };
  return { kind: "other", from: "inferred" };
}

const overlap1 = (aMin: number, aMax: number, bMin: number, bMax: number) => aMin < bMax - EPS && bMin < aMax - EPS;
const inside = (a: Box, b: Box) => [0, 1, 2].every((k) => a.min[k] >= b.min[k] - EPS && a.max[k] <= b.max[k] + EPS);
const disjoint = (a: Box, b: Box) => ![0, 1, 2].every((k) => overlap1(a.min[k], a.max[k], b.min[k], b.max[k]));

function readOverride(item: Item): OpeningOverride | null {
  const o = item.data?.opening;
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
  const out: OpeningOverride = {};
  if (r.off === true) out.off = true;
  if (typeof r.face === "string" && (FACES as readonly string[]).includes(r.face)) out.face = r.face as Face;
  if (r.shape === "rect" || r.shape === "circle") out.shape = r.shape;
  out.width = num(r.width) ?? num(r.diameter);
  out.height = num(r.height);
  if (Array.isArray(r.shift) && r.shift.length === 2 && r.shift.every((n) => typeof n === "number")) out.shift = [r.shift[0], r.shift[1]] as [number, number];
  return out;
}

/** The face of `inner` a box is nearest to, and the gap to it. Faces on which the box already crosses the wall have a negative gap. */
export function nearestFace(box: Box, inner: Box): { face: Face; gap: number } {
  const g: [Face, number][] = [
    ["left", box.min[0] - inner.min[0]],
    ["right", inner.max[0] - box.max[0]],
    ["back", box.min[2] - inner.min[2]],
    ["front", inner.max[2] - box.max[2]],
    ["bottom", box.min[1] - inner.min[1]],
    ["top", inner.max[1] - box.max[1]],
  ];
  g.sort((a, b) => a[1] - b[1]);
  return { face: g[0][0], gap: g[0][1] };
}

const centerOf = (b: Box): Vec3 => [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2) as Vec3;

/** Point on the outer surface of `face`, in line with `c` along the face's two in-plane axes. */
function onFace(face: Face, c: Vec3, outer: Box): Vec3 {
  const p: Vec3 = [...c];
  switch (face) {
    case "left": p[0] = outer.min[0]; break;
    case "right": p[0] = outer.max[0]; break;
    case "back": p[2] = outer.min[2]; break;
    case "front": p[2] = outer.max[2]; break;
    case "bottom": p[1] = outer.min[1]; break;
    case "top": p[1] = outer.max[1]; break;
  }
  return p;
}

function makeOpening(part: SpecPart, face: Face, outer: Box, params: EnclosureParams, source: Opening["source"], reason: string, ov: OpeningOverride | null): Opening {
  const [a, b] = FACE_AXES[face];
  const ext: [number, number] = [part.box.max[a] - part.box.min[a], part.box.max[b] - part.box.min[b]];
  const m = params.openingMargin;
  // A speaker shows through a round window a little smaller than its cone; everything else gets the part's footprint plus the margin.
  const shape = ov?.shape ?? (part.kind === "speaker" || (part.shape === "cylinder" && Math.abs(ext[0] - ext[1]) < 0.5) ? "circle" : "rect");
  let w = ov?.width ?? (part.kind === "speaker" ? ext[0] * 0.75 : ext[0] + 2 * m);
  let h = ov?.height ?? (part.kind === "speaker" ? ext[1] * 0.75 : ext[1] + 2 * m);
  if (shape === "circle") {
    const d = ov?.width ?? (part.kind === "speaker" ? Math.min(ext[0], ext[1]) * 0.75 : Math.max(ext[0], ext[1]) + 2 * m);
    w = d;
    h = d;
  }
  const c = centerOf(part.box);
  if (ov?.shift) {
    c[a] += ov.shift[0];
    c[b] += ov.shift[1];
  }
  return {
    partRef: part.ref || part.title,
    partId: part.id,
    face,
    shape,
    center: onFace(face, c, outer),
    width: round(w),
    height: round(h),
    source,
    reason,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export type BuildInput = { items: Item[]; params?: Partial<EnclosureParams> };

/** Parts of the concept that have a box. An enclosure is only offered when there is at least one that is not the shell. */
export function boxedParts(items: Item[]) {
  return items.map(toPart).filter((p) => p.geometry);
}

export function buildSpec({ items, params: given }: BuildInput): EnclosureSpec {
  const params: EnclosureParams = { ...DEFAULT_PARAMS, ...(given ?? {}) };
  const issues: Issue[] = [...validateParams(params)];
  const parts: SpecPart[] = [];
  for (const item of items) {
    const p = toPart(item);
    const g = p.geometry;
    if (!g) continue;
    // The box after rotation: totalExtent turns the part by geometry.rotation ([x, y, z] degrees, Euler
    // XYZ, as the 3D editor writes it through src/lib/geometry/shapes.ts). It is not turned twice.
    const ext = totalExtent(g) as Vec3;
    const pos = g.pos as Vec3;
    const box: Box = { min: [0, 1, 2].map((k) => pos[k] - ext[k] / 2) as Vec3, max: [0, 1, 2].map((k) => pos[k] + ext[k] / 2) as Vec3 };
    const { kind, from } = partKind(item, g.shape);
    parts.push({ id: item.id, ref: p.ref, title: p.title, kind, kindFrom: from, box, shape: g.shape, role: "inside" });
  }

  const shell = parts.find((p) => p.kind === "shell");
  const others = parts.filter((p) => p !== shell);
  const t = params;
  let outer: Box;
  let innerBox: Box;
  let envelope: EnclosureSpec["envelope"];

  if (shell) {
    envelope = "shell";
    outer = shell.box;
    shell.role = "shell";
    innerBox = {
      min: [outer.min[0] + t.wallThickness, outer.min[1] + t.floorThickness, outer.min[2] + t.wallThickness],
      max: [outer.max[0] - t.wallThickness, outer.max[1] - t.lidThickness, outer.max[2] - t.wallThickness],
    };
    for (const p of others) {
      if (disjoint(p.box, outer)) p.role = "outside";
      else if (inside(p.box, innerBox)) p.role = "inside";
      else p.role = "through";
    }
  } else {
    envelope = "parts";
    const cand = others.filter((p) => !(p.kind === "other" && false));
    if (!cand.length) {
      const z: Box = { min: [0, 0, 0], max: [0, 0, 0] };
      return { outer: z, inner: z, envelope, params, parts, openings: [], standoffs: null, issues: [...issues, { severity: "error", code: "no-parts", message: "No part has a box yet. Give a part a size and position in Physical layout, then come back." }] };
    }
    const lo: Vec3 = [Infinity, Infinity, Infinity];
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of cand) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.box.min[k]); hi[k] = Math.max(hi[k], p.box.max[k]); }
    // Parts rest on the floor; the sides and the lid keep the clearance.
    innerBox = { min: [lo[0] - t.clearance, lo[1], lo[2] - t.clearance], max: [hi[0] + t.clearance, hi[1] + t.clearance, hi[2] + t.clearance] };
    outer = {
      min: [innerBox.min[0] - t.wallThickness, innerBox.min[1] - t.floorThickness, innerBox.min[2] - t.wallThickness],
      max: [innerBox.max[0] + t.wallThickness, innerBox.max[1] + t.lidThickness, innerBox.max[2] + t.wallThickness],
    };
  }

  const dims: Vec3 = [outer.max[0] - outer.min[0], outer.max[1] - outer.min[1], outer.max[2] - outer.min[2]];
  if (t.cornerRadius * 2 >= Math.min(dims[0], dims[2]) - 0.01) {
    issues.push({ severity: "error", code: "radius-too-large", about: "cornerRadius", message: `The corner radius ${t.cornerRadius} mm is too large for a box ${round(dims[0])} by ${round(dims[2])} mm. It must be under half the narrowest side.` });
  }

  const openings: Opening[] = [];
  for (const p of others) {
    if (p.role === "outside") continue;
    const item = items.find((i) => i.id === p.id)!;
    const ov = readOverride(item);
    if (ov?.off) continue;
    const near = nearestFace(p.box, innerBox);
    const wantsKind = (OPENING_KINDS as readonly string[]).includes(p.kind);
    if (ov && (ov.face || ov.width || ov.height || ov.shape || ov.shift)) {
      const face = ov.face ?? near.face;
      openings.push(makeOpening(p, face, outer, t, "row", `Set on the part row (data.opening).`, ov));
    } else if (p.role === "through") {
      const face = near.face;
      openings.push(makeOpening(p, face, outer, t, "crossing", `${p.ref || p.title} crosses the ${face} wall, so the wall is opened for it.`, null));
    } else if (wantsKind && near.gap <= NEAR_WALL + EPS) {
      openings.push(makeOpening(p, near.face, outer, t, "kind", `A ${p.kind} ${round(Math.max(near.gap, 0))} mm from the ${near.face} wall: opened so it can be used.`, null));
    }
  }

  // Mounting holes and standoffs for the PCB (the lowest one when there are several).
  let standoffs: EnclosureSpec["standoffs"] = null;
  const pcb = others.filter((p) => p.kind === "pcb" && p.role === "inside").sort((a, b) => a.box.min[1] - b.box.min[1])[0];
  if (pcb) {
    const item = items.find((i) => i.id === pcb.id)!;
    const c = centerOf(pcb.box);
    const raw = item.data?.mountingHoles;
    let holes: Hole[];
    let assumed = false;
    if (Array.isArray(raw)) {
      holes = raw
        .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
        .map((h) => ({ x: c[0] + Number(h.x ?? 0), z: c[2] + Number(h.z ?? 0), diameter: Number(h.diameter ?? DEFAULT_HOLE_DIAMETER) }))
        .filter((h) => Number.isFinite(h.x) && Number.isFinite(h.z) && h.diameter > 0);
    } else {
      assumed = true;
      const hx = (pcb.box.max[0] - pcb.box.min[0]) / 2 - DEFAULT_HOLE_INSET;
      const hz = (pcb.box.max[2] - pcb.box.min[2]) / 2 - DEFAULT_HOLE_INSET;
      holes = hx > 0 && hz > 0 ? ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => ({ x: c[0] + sx * hx, z: c[2] + sz * hz, diameter: DEFAULT_HOLE_DIAMETER })) : [];
    }
    // Assumed holes that a part sits over (the lid's screw column comes down from above, the standoff goes up from below) are dropped.
    const dropped: string[] = [];
    if (assumed) {
      const boss = SCREWS[t.screwSize].boss / 2 + 0.2;
      holes = holes.filter((h) => {
        const hit = others.find((p) => p !== pcb && p.role === "inside" && p.kind !== "battery" && p.box.max[1] > pcb.box.min[1] && p.box.min[1] < innerBox.max[1] && Math.hypot(Math.max(p.box.min[0] - h.x, 0, h.x - p.box.max[0]), Math.max(p.box.min[2] - h.z, 0, h.z - p.box.max[2])) < boss);
        if (hit) dropped.push(`${hit.ref || hit.title}`);
        return !hit;
      });
    }
    const height = pcb.box.min[1] - innerBox.min[1];
    if (holes.length && height > 0.4) standoffs = { holes, partRef: pcb.ref || pcb.title, height: round(height), pcbThickness: round(pcb.box.max[1] - pcb.box.min[1]), assumed, dropped };
  }

  const spec: EnclosureSpec = { outer, inner: innerBox, envelope, params, parts, openings, standoffs, issues };
  spec.issues.push(...validateSpec(spec));
  return spec;
}

/** Problems with the parts and openings in a spec: what does not fit, what lies outside a wall. */
export function validateSpec(spec: EnclosureSpec): Issue[] {
  const out: Issue[] = [];
  const { inner, outer, params } = spec;
  const innerH = inner.max[1] - inner.min[1];
  for (const p of spec.parts) {
    if (p.role === "outside" || p.role === "shell") continue;
    const label = p.ref || p.title;
    const h = p.box.max[1] - p.box.min[1];
    if (h > innerH + EPS) out.push({ severity: "error", code: "part-taller", about: label, message: `${label} is ${round(h)} mm tall and the inside is ${round(innerH)} mm high.` });
    if (p.role !== "inside") continue;
    if (h > innerH + EPS) continue;
    else if (p.box.max[1] > inner.max[1] - params.clearance + EPS) out.push({ severity: "error", code: "part-hits-lid", about: label, message: `${label} comes within ${round(Math.max(inner.max[1] - p.box.max[1], 0))} mm of the lid; the clearance is ${params.clearance} mm.` });
    if (p.box.min[1] < inner.min[1] - EPS) out.push({ severity: "error", code: "part-below-floor", about: label, message: `${label} sits ${round(inner.min[1] - p.box.min[1])} mm below the top of the floor.` });
    const sides: [string, number][] = [
      ["left wall", p.box.min[0] - inner.min[0]],
      ["right wall", inner.max[0] - p.box.max[0]],
      ["back wall", p.box.min[2] - inner.min[2]],
      ["front wall", inner.max[2] - p.box.max[2]],
    ];
    for (const [name, gap] of sides) {
      if (gap < params.clearance - EPS) out.push({ severity: "error", code: "part-hits-wall", about: label, message: `${label} is ${round(Math.max(gap, 0))} mm from the ${name}; the clearance is ${params.clearance} mm.` });
    }
  }
  for (const p of spec.parts) {
    if (p.role === "through" && !spec.openings.some((o) => o.partId === p.id)) {
      out.push({ severity: "error", code: "crossing-no-opening", about: p.ref || p.title, message: `${p.ref || p.title} crosses a wall and has no opening.` });
    }
  }
  const wall = params.wallThickness;
  for (const o of spec.openings) {
    const [a, b] = FACE_AXES[o.face];
    // The flat part of a face: inside the wall on every edge, and the rounded corners for the vertical faces' sides.
    const lim = (axis: 0 | 1 | 2) => {
      const vertical = o.face !== "top" && o.face !== "bottom";
      const edge = axis === 1 ? params.floorThickness : Math.max(wall, params.cornerRadius);
      void vertical;
      return [outer.min[axis] + edge, outer.max[axis] - edge] as const;
    };
    const la = lim(a), lb = lim(b);
    const ok = o.center[a] - o.width / 2 >= la[0] - EPS && o.center[a] + o.width / 2 <= la[1] + EPS && o.center[b] - o.height / 2 >= lb[0] - EPS && o.center[b] + o.height / 2 <= lb[1] + EPS;
    if (!ok) out.push({ severity: "error", code: "opening-outside-wall", about: o.partRef, message: `The opening for ${o.partRef} on the ${o.face} face does not fit inside that wall. It would reach the edge or the corner.` });
  }
  for (let i = 0; i < spec.openings.length; i++) {
    for (let j = i + 1; j < spec.openings.length; j++) {
      const A = spec.openings[i], B = spec.openings[j];
      if (A.face !== B.face) continue;
      const [a, b] = FACE_AXES[A.face];
      if (overlap1(A.center[a] - A.width / 2, A.center[a] + A.width / 2, B.center[a] - B.width / 2, B.center[a] + B.width / 2) && overlap1(A.center[b] - A.height / 2, A.center[b] + A.height / 2, B.center[b] - B.height / 2, B.center[b] + B.height / 2)) {
        out.push({ severity: "warning", code: "openings-overlap", about: A.partRef, message: `The openings for ${A.partRef} and ${B.partRef} on the ${A.face} face overlap.` });
      }
    }
  }
  return out;
}

/** Whether this concept can be given an enclosure at all: at least one part with a box that is not a shell. */
export function enclosureOffered(items: Item[]): boolean {
  return boxedParts(items).some((p) => p.geometry!.shape !== "shell");
}
