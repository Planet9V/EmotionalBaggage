// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { assembly3mf, assemblyStl, bodies3mf, soupToStl, type ExportPart } from "@/lib/geometry/export";
import { fileToScene } from "@/lib/geometry/shapes";
import { formatOf, parseShape, parseStl, parseStep, type Occt } from "@/lib/geometry/meshFile";
import { boxMesh, lidMesh, trayMesh, SHELL_DEFAULTS, bounds, signedVolume, openEdges, trayVolume, lidVolume } from "@/components/three/stl";
import { geometry } from "@/lib/domain/schemas";

const g = (o: object) => geometry.parse({ basis: "typical", pos: [0, 0, 0], ...o });
const part = (id: number, o: object): ExportPart => ({ id, ref: `P${id}`, title: `Part ${id}`, geometry: g(o) });

function stlStats(buf: ArrayBuffer) {
  const geo = new STLLoader().parse(buf);
  geo.computeBoundingBox();
  const bb = geo.boundingBox as THREE.Box3;
  const n = geo.getAttribute("position").count;
  return { triangles: n / 3, min: bb.min.toArray(), max: bb.max.toArray(), size: bb.getSize(new THREE.Vector3()).toArray() };
}
const near = (a: number[], b: number[], d = 1e-3) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(d));

describe("STL export with three's exporter, read back with three's loader", () => {
  it("a box: 12 triangles, exact bounding box, Z up", () => {
    // scene box 10 wide (x), 20 high (y), 30 deep (z), centred at (5, 10, -3)
    const buf = assemblyStl([part(1, { shape: "box", size: [10, 20, 30], pos: [5, 10, -3] })], SHELL_DEFAULTS);
    const s = stlStats(buf);
    expect(s.triangles).toBe(12);
    // Z-up: x stays, file y = -scene z, file z = scene y
    near(s.size, [10, 30, 20]);
    near(s.min, [0, 3 - 15, 0]);
    near(s.max, [10, 3 + 15, 20]);
  });

  it("honours rotation: a quarter turn about y swaps x and z", () => {
    const buf = assemblyStl([part(1, { shape: "box", size: [10, 20, 30], pos: [0, 10, 0], rotation: [0, 90, 0] })], SHELL_DEFAULTS);
    near(stlStats(buf).size, [30, 10, 20]);
  });

  it("a single part, not the assembly, when asked", () => {
    const parts = [part(1, { shape: "box", size: [10, 10, 10], pos: [0, 5, 0] }), part(2, { shape: "box", size: [4, 4, 4], pos: [50, 2, 0] })];
    expect(stlStats(assemblyStl(parts, SHELL_DEFAULTS)).triangles).toBe(24);
    expect(stlStats(assemblyStl(parts, SHELL_DEFAULTS, 2)).triangles).toBe(12);
    near(stlStats(assemblyStl(parts, SHELL_DEFAULTS, 2)).size, [4, 4, 4]);
  });

  it("an enclosure shell exports a tray and a lid with the generator's own triangle count", () => {
    const size = [80, 42, 60];
    const buf = assemblyStl([part(1, { shape: "shell", size, pos: [0, 21, 0], print: true })], SHELL_DEFAULTS);
    const expected = (trayMesh(size).length + lidMesh(size).length) / 9;
    expect(stlStats(buf).triangles).toBe(expected);
  });

  it("a cylinder lying along z is exported at its true length", () => {
    const buf = assemblyStl([part(1, { shape: "cylinder", size: [10, 30], pos: [0, 5, 0], axis: "z" })], SHELL_DEFAULTS);
    const s = stlStats(buf);
    near(s.size, [10, 30, 10], 0.05);
  });

  it("a print body written by the exporter keeps its triangles and volume", () => {
    const mesh = boxMesh(20, 10, 5);
    const buf = soupToStl(mesh);
    const s = stlStats(buf);
    expect(s.triangles).toBe(mesh.length / 9);
    near(s.size, [20, 10, 5]);
    const back = new STLLoader().parse(buf).getAttribute("position").array as Float32Array;
    expect(signedVolume(back)).toBeCloseTo(1000, 3);
    expect(openEdges(back).bad).toBe(0);
    expect(trayVolume([80, 42, 60])).toBeGreaterThan(0);
    expect(lidVolume([80, 42, 60])).toBeGreaterThan(0);
  });
});

describe("shape files in", () => {
  const stlOf = (mesh: Float32Array) => soupToStl(mesh);
  it("reads a binary STL through three's loader", () => {
    const p = parseStl(stlOf(boxMesh(10, 20, 30)));
    expect(p.triangles).toBe(12);
    near(p.extent, [10, 20, 30]);
  });
  it("reads an ASCII STL", () => {
    const text = `solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 4 0 0\nvertex 0 3 0\nendloop\nendfacet\nendsolid t\n`;
    const p = parseStl(new TextEncoder().encode(text).buffer as ArrayBuffer);
    expect(p.triangles).toBe(1);
    near(p.extent, [4, 3, 0]);
  });
  it("refuses a file that is not an STL, saying so", () => {
    expect(() => parseStl(new TextEncoder().encode("hello, not a model").buffer as ArrayBuffer)).toThrow(/not a readable STL/);
    expect(() => parseStl(new ArrayBuffer(10))).toThrow(/not a readable STL/);
  });
  it("names the format by extension", () => {
    expect(formatOf("a.STL")).toBe("stl");
    expect(formatOf("a.stp")).toBe("step");
    expect(formatOf("a.STEP")).toBe("step");
    expect(formatOf("a.obj")).toBeNull();
  });
  it("centres and stands an attached file up, in the scene's axes, without rescaling", () => {
    // file: 10 (x) x 20 (y) x 30 (z, up), sitting anywhere
    const soup = boxMesh(10, 20, 30).map((v, i) => v + [100, 50, 7][i % 3]);
    const { positions, size } = fileToScene(soup as Float32Array);
    near(size, [10, 30, 20]);
    const b = bounds(positions);
    near(b.min, [-5, -15, -10]);
    near(b.max, [5, 15, 10]);
  });
  it("applies only the scale the user confirmed", () => {
    const soup = boxMesh(0.03, 0.02, 0.01);
    near(fileToScene(soup, 1).size, [0.03, 0.01, 0.02], 1e-6);
    near(fileToScene(soup, 1000).size, [30, 10, 20], 1e-3);
  });
  it("parseShape refuses an unknown extension", async () => {
    await expect(parseShape("a.obj", new ArrayBuffer(4))).rejects.toThrow(/STL or STEP/);
  });
});

describe("STEP read with occt-import-js", () => {
  const dir = join(process.cwd(), "node_modules/occt-import-js/test/testfiles/");
  const occt = () => import("occt-import-js").then((m) => (m.default as unknown as () => Promise<Occt>)());
  const read = (f: string) => {
    const b = readFileSync(dir + f);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };
  it("a 10 mm cube reads as 10 mm", async () => {
    const p = await parseStep(read("cube-10x10mm/Cube 10x10.stp"), await occt());
    expect(p.format).toBe("step");
    near(p.extent, [10, 10, 10], 1e-3);
    expect(p.triangles).toBeGreaterThanOrEqual(12);
  }, 60_000);
  it("STEP files carry their unit: the same cube in metres and in inches both come out in mm", async () => {
    const o = await occt();
    const m = await parseStep(read("cube-units/cube-m.step"), o);
    const inch = await parseStep(read("cube-units/cube-in.step"), o);
    const mm = await parseStep(read("cube-units/cube-mm.step"), o);
    expect(m.extent[0]).toBeCloseTo(mm.extent[0], 3);
    expect(inch.extent[0]).toBeCloseTo(mm.extent[0], 3);
  }, 60_000);
  it("a file that is not STEP is refused", async () => {
    await expect(parseStep(new TextEncoder().encode("ISO-10303-21; garbage").buffer as ArrayBuffer, await occt())).rejects.toThrow(/STEP/);
  }, 60_000);
});

describe("3MF export, read back with three's 3MFLoader", () => {
  function load(buf: ArrayBuffer) {
    const group = new ThreeMFLoader().parse(buf);
    let triangles = 0;
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes.push(m);
      const pos = m.geometry.getAttribute("position");
      const idx = m.geometry.getIndex();
      triangles += idx ? idx.count / 3 : pos.count / 3;
      m.geometry.computeBoundingBox();
      box.union((m.geometry.boundingBox as THREE.Box3).clone().applyMatrix4(m.matrixWorld));
    });
    return { triangles, size: box.getSize(new THREE.Vector3()).toArray(), meshes: meshes.length };
  }

  it("the enclosure: a tray and a lid, same triangle count as the generator, right size", async () => {
    const size = [80, 42, 60];
    const tray = trayMesh(size);
    const lid = lidMesh(size);
    const buf = await bodies3mf([{ name: "tray", mesh: tray }, { name: "lid", mesh: lid }]);
    const r = load(buf);
    expect(r.meshes).toBe(2);
    expect(r.triangles).toBe((tray.length + lid.length) / 9);
    // laid side by side 10 mm apart: widths add up, depth is the larger of the two
    near([r.size[0]], [80 + 10 + 80]);
    near([r.size[1]], [60]);
    const trayH = 40; // 42 - wall 2
    expect(Math.abs(r.size[2] - trayH)).toBeLessThan(1e-3);
  }, 30_000);

  it("a printed box part, single body", async () => {
    const buf = await bodies3mf([{ name: "bracket", mesh: boxMesh(20, 10, 5) }]);
    const r = load(buf);
    expect(r.triangles).toBe(12);
    near(r.size, [20, 10, 5]);
  }, 30_000);

  it("the assembly where it sits, Z up", async () => {
    const parts = [part(1, { shape: "box", size: [10, 20, 30], pos: [0, 10, 0] }), part(2, { shape: "box", size: [10, 10, 10], pos: [30, 5, 0] })];
    const r = load(await assembly3mf(parts, SHELL_DEFAULTS));
    expect(r.triangles).toBe(24);
    near(r.size, [40, 30, 20], 1e-2);
  }, 30_000);
});
