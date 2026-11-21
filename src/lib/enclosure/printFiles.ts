// The files that leave the Enclosure page: Z up, as slicers read them, each piece sitting on z = 0.
// Browser and server both import this (the downloads and the stored concept files are made the same way).
//
// The concept frame is Y up (see types.ts). Turning it to Z up maps concept (x, y, z) to file (x, -z, y),
// the same turn `toZUp` in src/lib/geometry/export.ts gives the 3D model's export. The lid is turned over
// first (180 degrees about x, a rotation, so the winding is kept) so its outer face lies on the plate.
import * as THREE from "three";
import { exportTo3MF } from "three-3mf-exporter";
import type { GeneratedMesh } from "./types";

export type Bounds = { min: [number, number, number]; max: [number, number, number] };

export function boundsOf(m: GeneratedMesh): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = m.positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  return { min, max };
}

function turn(m: GeneratedMesh, f: (x: number, y: number, z: number) => [number, number, number]): GeneratedMesh {
  const p = new Float32Array(m.positions.length);
  for (let i = 0; i < p.length; i += 3) {
    const [x, y, z] = f(m.positions[i], m.positions[i + 1], m.positions[i + 2]);
    p[i] = x;
    p[i + 1] = y;
    p[i + 2] = z;
  }
  // lowered onto the plate, and centred on the origin in x and y as slicers expect
  const b = boundsOf({ positions: p, indices: m.indices });
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
  for (let i = 0; i < p.length; i += 3) {
    p[i] -= cx;
    p[i + 1] -= cy;
    p[i + 2] -= b.min[2];
  }
  return { positions: p, indices: m.indices };
}

/** The base as it prints: open side up, floor on z = 0. Concept (x, y, z) to file (x, -z, y). */
export const basePrintMesh = (base: GeneratedMesh): GeneratedMesh => turn(base, (x, y, z) => [x, -z, y]);

/** The lid as it prints: turned over, outer face on z = 0. Concept (x, y, z) turned to (x, -y, -z), then to file (x, z, -y). */
export const lidPrintMesh = (lid: GeneratedMesh): GeneratedMesh => turn(lid, (x, y, z) => [x, z, -y]);

export type PrintPiece = { name: string; mesh: GeneratedMesh };

/**
 * One 3MF holding the pieces side by side, 10 mm apart along x, each its own object so a slicer can move
 * it. Millimetres, Z up. Written by three-3mf-exporter.
 */
export async function piecesTo3mf(pieces: PrintPiece[], title = "enclosure", gap = 10): Promise<Uint8Array> {
  const root = new THREE.Group();
  let x = 0;
  for (const p of pieces) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p.mesh.positions), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(p.mesh.indices), 1));
    geo.computeBoundingBox();
    const bb = geo.boundingBox as THREE.Box3;
    geo.translate(x - bb.min.x, -(bb.min.y + bb.max.y) / 2, -bb.min.z);
    x += bb.max.x - bb.min.x + gap;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#c8c8c8" }));
    m.name = p.name;
    root.add(m);
  }
  root.updateMatrixWorld(true);
  const blob = await exportTo3MF(root, { metadata: { Application: "concept-to-realization", ApplicationTitle: title } });
  return new Uint8Array(await blob.arrayBuffer());
}
