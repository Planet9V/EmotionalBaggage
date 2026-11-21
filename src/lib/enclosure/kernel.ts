// The geometry kernel (Manifold, WebAssembly), server side only. One instance per process.
import Module, { type Manifold, type ManifoldToplevel } from "manifold-3d";
import type { GeneratedMesh } from "./types";

let kernel: Promise<ManifoldToplevel> | null = null;

export function getKernel(): Promise<ManifoldToplevel> {
  kernel ??= (async () => {
    const tl = await Module();
    tl.setup();
    return tl;
  })();
  return kernel;
}

/** A Manifold from an indexed mesh. `ok` is false when the mesh is not a closed, consistently oriented solid. */
export async function toManifold(m: GeneratedMesh): Promise<{ manifold: Manifold | null; status: string }> {
  const tl = await getKernel();
  const mesh = new tl.Mesh({ numProp: 3, vertProperties: new Float32Array(m.positions), triVerts: new Uint32Array(m.indices) });
  try {
    const manifold = new tl.Manifold(mesh);
    const status = manifold.status();
    if (status !== "NoError") {
      manifold.delete();
      return { manifold: null, status };
    }
    return { manifold, status };
  } catch (e) {
    return { manifold: null, status: e instanceof Error ? e.message : "NotManifold" };
  }
}

export function fromManifold(m: Manifold): GeneratedMesh {
  const mesh = m.getMesh();
  const n = mesh.numProp;
  const v = mesh.vertProperties;
  const count = v.length / n;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = v[i * n];
    positions[i * 3 + 1] = v[i * n + 1];
    positions[i * 3 + 2] = v[i * n + 2];
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}
