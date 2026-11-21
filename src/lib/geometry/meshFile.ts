/**
 * Reading shape files. STL goes through three's own STLLoader; STEP through occt-import-js (the
 * OpenCascade kernel compiled to WebAssembly), which tessellates it to triangles in millimetres.
 * Neither parser is written here.
 */
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export type ShapeFormat = "stl" | "step";

/** Triangles as a flat soup (9 numbers per triangle) in the file's own axes. */
export type ParsedShape = {
  format: ShapeFormat;
  soup: Float32Array;
  triangles: number;
  /** bounding box size in the file's own axes and units */
  extent: [number, number, number];
  /** STL only: how the file was written */
  encoding?: "binary" | "ascii";
};

export const formatOf = (name: string): ShapeFormat | null => {
  const m = /\.(stl|stp|step)$/i.exec(name);
  if (!m) return null;
  return m[1].toLowerCase() === "stl" ? "stl" : "step";
};

function extentOf(soup: Float32Array): [number, number, number] {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = soup[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  }
  return soup.length ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] : [0, 0, 0];
}

/** Binary or ASCII STL. Throws an Error with a plain sentence when the file holds no triangles. */
export function parseStl(buf: ArrayBuffer): ParsedShape {
  let soup: Float32Array;
  try {
    const geo = new STLLoader().parse(buf);
    const pos = geo.getAttribute("position");
    soup = pos ? new Float32Array(pos.array as ArrayLike<number>) : new Float32Array(0);
    geo.dispose();
  } catch {
    soup = new Float32Array(0);
  }
  if (soup.length < 9 || soup.some((v) => !Number.isFinite(v))) {
    throw new Error("This file is not a readable STL: it holds no triangles.");
  }
  // A binary STL is exactly 84 bytes plus 50 per triangle; anything else that parsed is ASCII.
  const count = buf.byteLength >= 84 ? new DataView(buf).getUint32(80, true) : -1;
  const encoding = count >= 0 && 84 + 50 * count === buf.byteLength ? "binary" : "ascii";
  return { format: "stl", soup, triangles: soup.length / 9, extent: extentOf(soup), encoding };
}

type OcctMesh = { attributes: { position: { array: ArrayLike<number> } }; index?: { array: ArrayLike<number> } };
type OcctResult = { success: boolean; meshes: OcctMesh[] };
export type Occt = { ReadStepFile: (c: Uint8Array, p: object | null) => OcctResult };
type OcctFactory = (o?: { locateFile?: (f: string) => string }) => Promise<Occt>;

let occtPromise: Promise<Occt> | null = null;

/** Where the browser finds the reader and its WebAssembly file (copied into /public/vendor/occt). */
const OCCT_BASE = "/vendor/occt/";

/**
 * Loads occt-import-js once. In the browser it is a script tag from /vendor/occt (the library is a
 * classic script that fetches its .wasm at run time); in Node it is the npm package. A failure
 * resets so the next try starts again.
 */
function loadOcct(): Promise<Occt> {
  if (!occtPromise) {
    const p: Promise<Occt> =
      typeof window === "undefined"
        ? (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ "occt-import-js") as unknown as Promise<{ default: OcctFactory }>).then((m) => m.default())
        : loadScript(`${OCCT_BASE}occt-import-js.js`).then(() => {
            const f = (window as unknown as { occtimportjs?: OcctFactory }).occtimportjs;
            if (!f) throw new Error("The STEP reader loaded but did not start.");
            return f({ locateFile: (name) => `${OCCT_BASE}${name}` });
          });
    occtPromise = p.catch((e) => {
      occtPromise = null;
      throw e;
    });
  }
  return occtPromise;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) && (window as unknown as { occtimportjs?: unknown }).occtimportjs) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("The STEP reader could not be downloaded."));
    document.head.appendChild(s);
  });
}

/** STEP to triangles in millimetres. Throws an Error with a plain sentence when it cannot be read. */
export async function parseStep(buf: ArrayBuffer, occt?: Occt): Promise<ParsedShape> {
  const reader = occt ?? (await loadOcct());
  let result: OcctResult;
  try {
    result = reader.ReadStepFile(new Uint8Array(buf), { linearUnit: "millimeter" });
  } catch {
    throw new Error("This file could not be read as STEP.");
  }
  if (!result.success || !result.meshes.length) throw new Error("This file could not be read as STEP, or it holds no solids.");
  const parts: number[] = [];
  for (const m of result.meshes) {
    const p = m.attributes.position.array;
    const idx = m.index?.array;
    if (idx) for (let i = 0; i < idx.length; i++) parts.push(p[idx[i] * 3], p[idx[i] * 3 + 1], p[idx[i] * 3 + 2]);
    else for (let i = 0; i < p.length; i++) parts.push(p[i]);
  }
  const soup = new Float32Array(parts);
  if (soup.length < 9) throw new Error("This STEP file holds no surfaces.");
  return { format: "step", soup, triangles: soup.length / 9, extent: extentOf(soup) };
}

/** Reads a shape file by its name's extension. */
export async function parseShape(name: string, buf: ArrayBuffer): Promise<ParsedShape> {
  const f = formatOf(name);
  if (f === "stl") return parseStl(buf);
  if (f === "step") return parseStep(buf);
  throw new Error("Use an STL or STEP file (.stl, .stp, .step).");
}
