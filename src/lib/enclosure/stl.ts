// STL in and out. Binary STL is written; binary and ASCII are read (OpenSCAD writes ASCII). No dependencies.
import type { GeneratedMesh } from "./types";

/** Vertices are welded on exact position (rounded to 1e-4 mm) so the mesh is indexed, which Manifold and the checks need. */
export function parseStl(data: ArrayBuffer | Uint8Array | string): GeneratedMesh {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const tri: number[] = [];
  const head = new TextDecoder().decode(bytes.subarray(0, 5));
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const binary = bytes.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === bytes.byteLength;
  if (binary || head !== "solid") {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 !== bytes.byteLength) throw new Error("The file is not a valid STL.");
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let v = 0; v < 9; v++) tri.push(dv.getFloat32(o + v * 4, true));
    }
  } else {
    const text = new TextDecoder().decode(bytes);
    const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) tri.push(Number(m[1]), Number(m[2]), Number(m[3]));
    if (tri.length % 9 !== 0) throw new Error("The ASCII STL has a facet without three vertices.");
  }
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
  const n = m.indices.length / 3;
  const out = new Uint8Array(84 + n * 50);
  const dv = new DataView(out.buffer);
  out.set(new TextEncoder().encode(name.slice(0, 79)), 0);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const p = [0, 1, 2].map((k) => m.indices[t * 3 + k] * 3);
    const a = [0, 1, 2].map((k) => m.positions[p[0] + k]);
    const b = [0, 1, 2].map((k) => m.positions[p[1] + k]);
    const c = [0, 1, 2].map((k) => m.positions[p[2] + k]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    const o = 84 + t * 50;
    [nx / len, ny / len, nz / len, ...a, ...b, ...c].forEach((x, i) => dv.setFloat32(o + i * 4, x, true));
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
