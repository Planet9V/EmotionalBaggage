// STL in and out for the enclosure generators, which work on indexed meshes (Manifold and the checks
// need shared vertices). The reading and writing are three's own STLLoader and STLExporter, which run
// under Node without a DOM; what is written here is only the welding of vertices into an index, and
// the 80-byte header name.
import { BufferAttribute, BufferGeometry, Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { GeneratedMesh } from "./types";

/** Vertices are welded on exact position (rounded to 1e-4 mm) so the mesh is indexed, which Manifold and the checks need. */
export function parseStl(data: ArrayBuffer | Uint8Array | string): GeneratedMesh {
  let tri: ArrayLike<number>;
  try {
    const input = typeof data === "string" ? data : data instanceof Uint8Array ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer) : data;
    const geo = new STLLoader().parse(input);
    const pos = geo.getAttribute("position");
    tri = pos ? (pos.array as ArrayLike<number>) : [];
    geo.dispose();
  } catch {
    throw new Error("The file is not a valid STL.");
  }
  if (tri.length < 9 || tri.length % 9 !== 0) throw new Error("The file is not a valid STL.");
  const index = new Map<string, number>();
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < tri.length; i += 3) {
    const key = `${Math.round(tri[i] * 1e4)},${Math.round(tri[i + 1] * 1e4)},${Math.round(tri[i + 2] * 1e4)}`;
    let id = index.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      index.set(key, id);
      positions.push(tri[i], tri[i + 1], tri[i + 2]);
    }
    indices.push(id);
  }
  // Drop triangles that collapsed to a line or point after welding.
  const kept: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
    if (a !== b && b !== c && a !== c) kept.push(a, b, c);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(kept) };
}

export function writeBinaryStl(m: GeneratedMesh, name = "enclosure"): Uint8Array {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(m.positions, 3));
  geo.setIndex(new BufferAttribute(m.indices, 1));
  const view = new STLExporter().parse(new Mesh(geo), { binary: true }) as unknown as DataView;
  geo.dispose();
  const out = new Uint8Array(view.byteLength);
  out.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  out.fill(0, 0, 80);
  out.set(new TextEncoder().encode(name.slice(0, 79)), 0);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
