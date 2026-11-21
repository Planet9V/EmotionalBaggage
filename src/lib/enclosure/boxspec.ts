// The spec in the box frame (Z up, origin at the outer bottom corner), which is what both generators are given.
// The planner service receives exactly this JSON for YAPP_Box.
import { SCREWS, type EnclosureSpec, type Face, type GeneratedMesh, type LidType, type OpeningShape, type Vec3 } from "./types";

export type BoxOpening = {
  face: Face;
  shape: OpeningShape;
  /** Centre on the outer surface of the face, box frame. */
  center: Vec3;
  /** Along the first and second in-plane axes of the box frame: left/right (Y, Z), front/back (X, Z), top/bottom (X, Y). */
  width: number;
  height: number;
  label: string;
};

export type BoxSpec = {
  outer: Vec3;
  wall: number;
  floor: number;
  lid: number;
  cornerRadius: number;
  clearance: number;
  lidType: LidType;
  screw: { name: string; clearance: number; pin: number; pilot: number; boss: number };
  /** Hole centres in the box frame (X, Y) with the PCB's underside height above the inner floor. */
  standoffs: { holes: { x: number; y: number; diameter: number }[]; height: number; pcbThickness: number } | null;
  openings: BoxOpening[];
  /** Inside parts, box frame, so a generator can keep its own features clear of them. */
  parts: { ref: string; min: Vec3; max: Vec3 }[];
};

export type Frame = { toBox(p: Vec3): Vec3; toConcept(p: Vec3): Vec3 };

/** Concept frame (Y up, origin on the floor centre) to box frame (Z up, origin at the outer bottom corner) and back. */
export function frameOf(spec: Pick<EnclosureSpec, "outer">): Frame {
  const { min, max } = spec.outer;
  return {
    toBox: (p) => [p[0] - min[0], max[2] - p[2], p[1] - min[1]],
    toConcept: (p) => [p[0] + min[0], p[2] + min[1], max[2] - p[1]],
  };
}

export function toBoxSpec(spec: EnclosureSpec): BoxSpec {
  const f = frameOf(spec);
  const { params: p, outer } = spec;
  const screw = SCREWS[p.screwSize];
  return {
    outer: [outer.max[0] - outer.min[0], outer.max[2] - outer.min[2], outer.max[1] - outer.min[1]],
    wall: p.wallThickness,
    floor: p.floorThickness,
    lid: p.lidThickness,
    cornerRadius: p.cornerRadius,
    clearance: p.clearance,
    lidType: p.lidType,
    screw: { name: p.screwSize, clearance: screw.clearance, pin: screw.pin, pilot: screw.pilot, boss: screw.boss },
    standoffs: spec.standoffs
      ? {
          holes: spec.standoffs.holes.map((h) => {
            const b = f.toBox([h.x, 0, h.z]);
            return { x: b[0], y: b[1], diameter: h.diameter };
          }),
          height: spec.standoffs.height,
          pcbThickness: spec.standoffs.pcbThickness,
        }
      : null,
    parts: spec.parts
      .filter((p) => p.role === "inside")
      .map((p) => {
        const a = f.toBox(p.box.min), b = f.toBox(p.box.max);
        return { ref: p.ref || p.title, min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])] as Vec3, max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] as Vec3 };
      }),
    openings: spec.openings.map((o) => {
      // Widths and heights are lengths along in-plane axes; the frame change only renames the axes, so they carry over.
      return { face: o.face, shape: o.shape, center: f.toBox(o.center), width: o.width, height: o.height, label: o.partRef };
    }),
  };
}

/** A generator's mesh (box frame) as concept-frame meshes. The map is a rotation, so triangle winding is kept. */
export function meshToConcept(m: GeneratedMesh, f: Frame): GeneratedMesh {
  const out = new Float32Array(m.positions.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    const c = f.toConcept([m.positions[i], m.positions[i + 1], m.positions[i + 2]]);
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
  }
  return { positions: out, indices: m.indices };
}
