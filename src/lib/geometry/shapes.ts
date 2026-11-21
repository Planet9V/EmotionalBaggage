/**
 * The one place a part's solid is built, for the 3D view and for every export, so what you see
 * and what you print are the same shape. Scene units: mm, Y up, a part's centre at its `pos`.
 */
import * as THREE from "three";
import type { Geometry } from "@/lib/domain";
import { cylinderAxis } from "@/components/three/layout";
import { lidMesh, shellDims, trayMesh, type Mesh, type ShellParams } from "@/components/three/stl";

/** Triangle soup in print coordinates (Z up) to a BufferGeometry rotated into the scene. */
export function soupToGeometry(mesh: Mesh, rotateX: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.slice(), 3));
  g.rotateX(rotateX);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/** A box or cylinder body, centred on its own origin. */
export function bodyGeometry(g: Pick<Geometry, "shape" | "size" | "axis">): THREE.BufferGeometry {
  const [sx, sy, sz = 0] = g.size;
  if (g.shape === "cylinder") {
    const geo = new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 48);
    const axis = cylinderAxis(g as Geometry);
    if (axis === "x") geo.rotateZ(Math.PI / 2);
    if (axis === "z") geo.rotateX(Math.PI / 2);
    return geo;
  }
  return new THREE.BoxGeometry(sx, sy, sz);
}

/**
 * The tray and lid of an enclosure shell, each centred on its own origin in the scene: the tray's
 * floor is at y = 0 and the lid's underside at y = 0 (the caller lifts them into place). A shell
 * too small for the wall settings is returned as its plain envelope with an empty lid.
 */
export function shellGeometries(size: number[], p: ShellParams): { tray: THREE.BufferGeometry; lid: THREE.BufferGeometry; plain: boolean } {
  const [sx, sy, sz] = size;
  if (shellDims(size, p).problems.length) {
    return { tray: new THREE.BoxGeometry(sx, sy, sz).translate(0, sy / 2, 0), lid: new THREE.BufferGeometry(), plain: true };
  }
  return { tray: soupToGeometry(trayMesh(size, p), -Math.PI / 2), lid: soupToGeometry(lidMesh(size, p), Math.PI / 2), plain: false };
}

/**
 * An attached file's triangles in the scene: file axes are Z up, the scene is Y up, so the file is
 * stood up, scaled by the unit factor the user confirmed, and centred on its bounding box.
 * Returns the positions and the bounding box size in scene axes.
 */
export function fileToScene(soup: Float32Array, scale = 1): { positions: Float32Array; size: [number, number, number] } {
  const out = new Float32Array(soup.length);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i += 3) {
    const x = soup[i] * scale;
    const y = soup[i + 2] * scale; // file z is scene y
    const z = -soup[i + 1] * scale; // file y is scene -z
    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
    if (x < lo[0]) lo[0] = x;
    if (y < lo[1]) lo[1] = y;
    if (z < lo[2]) lo[2] = z;
    if (x > hi[0]) hi[0] = x;
    if (y > hi[1]) hi[1] = y;
    if (z > hi[2]) hi[2] = z;
  }
  if (!soup.length) return { positions: out, size: [0, 0, 0] };
  const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  for (let i = 0; i < out.length; i += 3) {
    out[i] -= c[0];
    out[i + 1] -= c[1];
    out[i + 2] -= c[2];
  }
  return { positions: out, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

/** Scene-space positions (already centred) to a BufferGeometry with normals. */
export function sceneGeometry(positions: Float32Array) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}
