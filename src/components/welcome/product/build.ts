// The tag as geometry, part by part, for the product viewer and the hero (ProductCanvas.tsx). Every part of the
// model (model.ts) is built at its own size and place, in millimetres, then laid into the film's units so the
// printed leather-look pieces can wear the film's own material (scenes/film/tag.ts: grain, holes, stitches and the
// stamp are worked out from where a point is on the tag). Two kinds of thing come out:
//  - the leather pieces (the body, the back plate, the two doors): one mesh each, the film's material;
//  - everything else (the strap, the board and its components, the cell, the supercapacitor, the speaker, the
//    tracker, the switches), merged into one mesh with a colour, a finish (matte or metal) and its part's exploded
//    direction on every vertex, so the whole inside is one draw call and still comes apart.
// Its feature edges, for the line drawing, are built the same way.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Kit } from "../scenes/film/kit";
import { STRAP_INK, TAG_ARM } from "../scenes/film/tag";
import { FACE, SLOT, STRAP, TAG_MM, tagOutline, type P2 } from "../scenes/film/tagShape";
import type { PartBody, ProductPart, V3 } from "./model";

const { h: H, t: T } = TAG_MM;
/** One millimetre in the film's units, and the tag's middle below the film tag's pivot. */
export const MM = (TAG_ARM - 0.012) / (H / 2);
const BEVEL = 1;
const SADDLE = "#a8683a";
const INNER = "#9a6238";
const SKIN = 1.6;

/** mm about the tag's middle -> the film's units about the film tag's pivot (what the leather material reads). */
function toFilm(g: THREE.BufferGeometry) {
  return g.scale(MM, MM, MM).translate(0, -TAG_ARM, 0);
}
const v2 = (pts: P2[]) => pts.map(([x, y]) => new THREE.Vector2(x, y));
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number) {
  const s = new THREE.Path();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
const circle = (x: number, y: number, r: number) => new THREE.Path().absarc(x, y, r, 0, Math.PI * 2, false);

/** Marks the faces of a leather piece that are its inside (plain print, no grain or art): surface 1. */
function plainInside(g: THREE.BufferGeometry, inside: (nz: number, z: number) => boolean) {
  g.computeVertexNormals();
  const n = g.getAttribute("normal");
  const p = g.getAttribute("position");
  const s = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) s[i] = inside(n.getZ(i), p.getZ(i)) ? 1 : 2;
  g.setAttribute("surface", new THREE.BufferAttribute(s, 1));
  return g;
}
function leather(parts: THREE.BufferGeometry[], inside: (nz: number, z: number) => boolean) {
  const flat = parts.map((g) => {
    const f = g.index ? g.toNonIndexed() : g;
    f.deleteAttribute("uv");
    return f;
  });
  const g = plainInside(mergeGeometries(flat)!, inside);
  const col = new THREE.Color(SADDLE);
  const plain = new THREE.Color(INNER);
  const s = g.getAttribute("surface");
  const c = new Float32Array(s.count * 3);
  for (let i = 0; i < s.count; i++) c.set(s.getX(i) < 1.5 ? [plain.r, plain.g, plain.b] : [col.r, col.g, col.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return toFilm(g);
}

const plate = FACE.plate;
const slotY = H / 2 - SLOT.down;
const trackerAt: P2 = [-FACE.tracker.x, FACE.tracker.y];

/** The body: its rim all round (bevelled, as the film's), open at the back where the plate drops in, and the front skin with the coin door's opening. */
function shellGeometry() {
  const rim = new THREE.Shape(v2(tagOutline(BEVEL)));
  rim.holes.push(roundRect(plate.x0, plate.y0, plate.x1, plate.y1, 3));
  rim.holes.push(roundRect(-SLOT.w / 2, slotY - SLOT.h / 2, SLOT.w / 2, slotY + SLOT.h / 2, SLOT.h / 2 - 0.1));
  const ring = new THREE.ExtrudeGeometry(rim, { depth: T - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -(T - BEVEL * 2) / 2);
  const face = new THREE.Shape();
  face.curves = roundRect(plate.x0 - 1.2, plate.y0 - 1.2, plate.x1 + 1.2, plate.y1 + 1.2, 3.6).curves;
  face.holes.push(circle(FACE.door.x, FACE.door.y, FACE.door.r));
  const skin = new THREE.ExtrudeGeometry(face, { depth: SKIN, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, T / 2 - SKIN);
  // inside: the skin's back and the opening's walls; the rim's own back face is the tag's back
  return leather([ring, skin], (nz, z) => nz < -0.6 && z > -T / 2 + 0.5);
}
function plateGeometry() {
  const s = new THREE.Shape();
  s.curves = roundRect(plate.x0 + 0.15, plate.y0 + 0.15, plate.x1 - 0.15, plate.y1 - 0.15, 2.9).curves;
  s.holes.push(circle(trackerAt[0], trackerAt[1], FACE.tracker.r));
  return leather([new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: false, curveSegments: 32 }).translate(0, 0, -T / 2)], (nz) => nz > 0.6);
}
function doorGeometry(at: P2, r: number, z0: number, depth: number, front: boolean) {
  const s = new THREE.Shape();
  s.curves = circle(at[0], at[1], r - 0.15).curves;
  return leather([new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 32 }).translate(0, 0, z0)], (nz) => (front ? nz < -0.6 : nz > 0.6));
}

/** The printed pieces that wear the film's leather material, by the part's look. */
function leatherGeometry(look: ProductPart["look"]): THREE.BufferGeometry | null {
  if (look === "shell") return shellGeometry();
  if (look === "plate") return plateGeometry();
  if (look === "trackerDoor") return doorGeometry(trackerAt, FACE.tracker.r, -T / 2, 2, false);
  if (look === "coinDoor") return doorGeometry([FACE.door.x, FACE.door.y], FACE.door.r, T / 2 - SKIN, SKIN, true);
  return null;
}

// ---- everything else: boxes and cylinders in mm, with a colour and a finish --------------------------------------

const ROT: Record<"x" | "y" | "z", V3> = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] };
const metal = (k: Kit, f: () => void) => k.surface(1, f);

function strap(k: Kit, up: number, loop: boolean) {
  const zf = T / 2 + STRAP.t / 2;
  const top = H / 2 + up;
  const meet = H / 2 + 8;
  // through the slot; then, on each face, up to the top edge, in to meet the other strand, and on up as one strap
  k.box([STRAP.w, STRAP.t, zf * 2 + STRAP.t], STRAP_INK, [0, slotY, 0]);
  [1, -1].forEach((side) => {
    k.box([STRAP.w, H / 2 + 0.6 - slotY, STRAP.t], STRAP_INK, [0, (H / 2 + 0.6 + slotY) / 2, side * zf], { r: 0.8, seg: 2 });
    const dz = side * (STRAP.t / 2 - zf);
    const dy = meet - (H / 2 + 0.6);
    k.box([STRAP.w, Math.hypot(dy, dz) + 0.8, STRAP.t], STRAP_INK, [0, (meet + H / 2 + 0.6) / 2, side * (zf + STRAP.t / 2) / 2], { rot: [Math.atan2(dz, dy), 0, 0], r: 0.8, seg: 2 });
    k.box([STRAP.w, top - meet + 0.6, STRAP.t], STRAP_INK, [0, (top + meet) / 2, (side * STRAP.t) / 2], { r: 0.6, seg: 2 });
  });
  // hanging free, the loop is closed over the top
  if (loop) k.box([STRAP.w, STRAP.t, STRAP.t * 2], STRAP_INK, [0, top, 0], { r: 0.8, seg: 2 });
}

function solid(k: Kit, look: ProductPart["look"], b: PartBody, strapUp: number, strapLoop: boolean) {
  const [x, y, z] = b.at;
  const cyl = (d: number, len: number, c: string, at: V3, o: { r2?: number; seg?: number } = {}) => k.cyl(d / 2, len, c, at, { rot: ROT[b.axis], seg: o.seg ?? 40, r2: o.r2 });
  switch (look) {
    case "strap":
      strap(k, strapUp, strapLoop);
      return;
    case "board":
      k.box(b.size as V3, "#1f6a47", b.at, { r: 0.3, seg: 1 });
      return;
    case "cell":
      metal(k, () => {
        cyl(b.size[0]!, b.size[1]! * 0.72, "#c4c8ce", [x, y, z - b.size[1]! * 0.14]);
        cyl(b.size[0]! * 0.86, b.size[1]! * 0.28, "#d9dce0", [x, y, z + b.size[1]! * 0.36]);
      });
      return;
    case "supercap": {
      const along = (t: number): V3 => (b.axis === "y" ? [x, y + t, z] : b.axis === "x" ? [x + t, y, z] : [x, y, z + t]);
      cyl(b.size[0]!, b.size[1]! * 0.9, "#22366b", along(-b.size[1]! * 0.05), { seg: 28 });
      metal(k, () => cyl(b.size[0]! * 0.92, b.size[1]! * 0.1, "#b8bcc4", along(b.size[1]! * 0.45), { seg: 28 }));
      return;
    }
    case "speaker": {
      const d = b.size[0]!;
      const l = b.size[1]!;
      cyl(d, l * 0.22, "#2b2d31", [x, y, z + l * 0.39]);
      // the cone, narrowing to the magnet at the back; its dark face is what shows through the holes
      cyl(d * 0.5, l * 0.5, "#17181b", [x, y, z + l * 0.03], { r2: d * 0.92 / 2 });
      cyl(d * 0.9, 0.3, "#0e0f11", [x, y, z + l * 0.5 - 0.1]);
      metal(k, () => cyl(d * 0.46, l * 0.28, "#7d828b", [x, y, z - l * 0.36]));
      return;
    }
    case "gasket":
      k.geo(new THREE.RingGeometry(b.size[0]! / 2 - 2.5, b.size[0]! / 2, 40), "#0c0c0d", [x, y, z + 0.26]);
      k.geo(new THREE.RingGeometry(b.size[0]! / 2 - 2.5, b.size[0]! / 2, 40), "#0c0c0d", [x, y, z - 0.26], { rot: [Math.PI, 0, 0] });
      return;
    case "tracker": {
      const d = b.size[0]!;
      const l = b.size[1]!;
      cyl(d, l * 0.55, "#f1f0ec", [x, y, z + l * 0.1]);
      cyl(d * 0.7, l * 0.25, "#f6f5f2", [x, y, z + l * 0.375], { r2: d / 2 });
      metal(k, () => cyl(d * 0.8, l * 0.25, "#cfd2d7", [x, y, z - l * 0.3], { r2: d * 0.94 / 2 }));
      return;
    }
    case "switch":
    case "button": {
      const s = b.size as V3;
      metal(k, () => k.box(s, "#a9adb5", b.at, { r: 0.2, seg: 1 }));
      // the actuator, toward the tag's edge
      const side = Math.sign(x) || 1;
      k.box(look === "switch" ? [1.6, 2.2, s[2] * 0.6] : [1.2, 1.6, s[2] * 0.6], "#101113", [x + side * (s[0] / 2 + 0.6), y, z], { r: 0.2, seg: 1 });
      return;
    }
    case "spring":
      metal(k, () => {
        k.box([1.4, 4.4, b.size[2]!], "#d2b05c", [x - 5.5, y, z]);
        k.box([3, 3, b.size[2]!], "#d2b05c", [x + 1, y, z]);
      });
      return;
    case "passive":
      k.box(b.size as V3, "#b79f72", b.at);
      metal(k, () => {
        k.box([b.size[0]! * 0.22, b.size[1]! + 0.02, b.size[2]! + 0.02], "#c9ccd1", [x - b.size[0]! * 0.39, y, z]);
        k.box([b.size[0]! * 0.22, b.size[1]! + 0.02, b.size[2]! + 0.02], "#c9ccd1", [x + b.size[0]! * 0.39, y, z]);
      });
      return;
    default:
      k.box(b.size as V3, "#191b1f", b.at, { r: 0.12, seg: 1 });
  }
}

export type Built = {
  /** the leather pieces, one geometry a part */
  leather: { ref: string; geometry: THREE.BufferGeometry }[];
  /** everything else, merged: colour (with opacity), finish and exploded direction per vertex */
  inner: THREE.BufferGeometry;
  /** the feature edges of every part, for the line drawing */
  edges: THREE.BufferGeometry;
  /** which vertices of `inner` and of `edges` belong to which part */
  ranges: { inner: Map<string, [number, number]>; edges: Map<string, [number, number]> };
  /** each part's middle and half size, assembled, in the film's units about the tag's middle */
  boxes: Map<string, { mid: THREE.Vector3; half: THREE.Vector3 }>;
};

/** The colour a part's lines take in the line drawing, by what it is. */
const LINE: Record<string, string> = { enclosure: "#e9c9a2", board: "#7fd2a4", power: "#f0c36a", audio: "#c5a7f5", controls: "#f08a8a" };

function faceLines(look: ProductPart["look"]): THREE.BufferGeometry | null {
  // what is pressed or printed into a face: drawn as lines, as a product drawing shows them
  const loops: [P2[], number][] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number, r: number) => roundRect(x0, y0, x1, y1, r).getPoints(6).map((p): P2 => [p.x, p.y]);
  const ring = (x: number, y: number, rx: number, ry: number) => Array.from({ length: 48 }, (_, i): P2 => [x + Math.cos((i / 48) * Math.PI * 2) * rx, y + Math.sin((i / 48) * Math.PI * 2) * ry]);
  const f = T / 2 + 0.05;
  if (look === "shell") {
    const { panel: p, speaker: s, oval: o } = FACE;
    loops.push([rect(p.x0, p.y0, p.x1, p.y1, 2.5), f], [rect(s.x0, s.y0, s.x1, s.y1, 1), f], [ring(o.x, o.y, o.rx, o.ry), f], [tagOutline(3, 4), f], [tagOutline(3, 4), -f]);
  } else if (look === "plate") {
    const c = FACE.card;
    loops.push([rect(-c.x1, c.y0, -c.x0, c.y1, 1.6), -f]);
  } else if (look === "coinDoor") {
    loops.push([rect(FACE.door.x - 4, FACE.door.y - 0.5, FACE.door.x + 4, FACE.door.y + 0.5, 0.5), f]);
  } else return null;
  const pos: number[] = [];
  for (const [pts, z] of loops) pts.forEach((p, i) => pos.push(p[0], p[1], z, pts[(i + 1) % pts.length]![0], pts[(i + 1) % pts.length]![1], z));
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
}

/**
 * Builds every part. `strapUp` is how far the strap rises above the tag's top edge in mm; `strapLoop` closes it
 * over the top (the tag standing free) rather than leaving it to run on up (the tag hanging from something).
 */
export function buildProduct(parts: ProductPart[], strapUp: number, strapLoop: boolean): Built {
  const out: Built = { leather: [], inner: new THREE.BufferGeometry(), edges: new THREE.BufferGeometry(), ranges: { inner: new Map(), edges: new Map() }, boxes: new Map() };
  const inner: THREE.BufferGeometry[] = [];
  const edges: THREE.BufferGeometry[] = [];
  let innerAt = 0;
  let edgeAt = 0;
  const withOut = (g: THREE.BufferGeometry, p: ProductPart) => {
    const n = g.getAttribute("position").count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([p.out[0] * MM, p.out[1] * MM, p.out[2] * MM], i * 3);
    g.setAttribute("aOut", new THREE.BufferAttribute(a, 3));
    return n;
  };
  const lines = (g: THREE.BufferGeometry, p: ProductPart) => {
    const e = new THREE.EdgesGeometry(g, 32);
    const extra = faceLines(p.look);
    const all = extra ? mergeGeometries([e, toFilm(extra)])! : e;
    const n = withOut(all, p);
    const c = new THREE.Color(LINE[p.group] ?? "#ffffff");
    const col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b, 1], i * 4);
    all.setAttribute("color", new THREE.BufferAttribute(col, 4));
    out.ranges.edges.set(p.ref, [edgeAt, n]);
    edgeAt += n;
    edges.push(all);
  };
  for (const p of parts) {
    if (!p.body) continue;
    const skin = leatherGeometry(p.look);
    let g: THREE.BufferGeometry;
    if (skin) {
      out.leather.push({ ref: p.ref, geometry: skin });
      g = skin;
      lines(skin, p);
    } else {
      const k = new Kit();
      // every piece carries a finish: matte unless said to be metal
      k.surface(0, () => solid(k, p.look, p.body!, strapUp, strapLoop));
      g = toFilm(k.build());
      const n = withOut(g, p);
      const rgb = g.getAttribute("color");
      const rgba = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) rgba.set([rgb.getX(i), rgb.getY(i), rgb.getZ(i), 1], i * 4);
      g.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
      out.ranges.inner.set(p.ref, [innerAt, n]);
      innerAt += n;
      inner.push(g);
      lines(g, p);
    }
    g.computeBoundingBox();
    const box = g.boundingBox!;
    out.boxes.set(p.ref, { mid: box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, TAG_ARM, 0)), half: box.getSize(new THREE.Vector3()).multiplyScalar(0.5) });
  }
  if (inner.length) out.inner = mergeGeometries(inner)!;
  if (edges.length) out.edges = mergeGeometries(edges)!;
  inner.forEach((g) => g.dispose());
  edges.forEach((g) => g.dispose());
  return out;
}
