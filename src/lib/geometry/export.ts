/**
 * STL and 3MF export from the scene shapes. The writers are three.js' STLExporter and the
 * three-3mf-exporter package; this file only arranges what goes into them.
 *
 * Two kinds of export:
 *  - the assembly (or one part) where it sits in the model, turned to Z up for slicers;
 *  - printed parts laid out on a bed, each in print orientation (3MF, and the per-body STL).
 */
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { exportTo3MF } from "three-3mf-exporter";
import type { Geometry } from "@/lib/domain";
import { bodyOffsets } from "@/components/three/layout";
import { type Mesh, type ShellParams } from "@/components/three/stl";
import { bodyGeometry, sceneGeometry, shellGeometries, soupToGeometry } from "./shapes";
import { degToRad } from "./rotation";

export type ExportPart = {
  id: number;
  ref: string;
  title: string;
  geometry: Geometry;
  /** scene-space positions of an attached file's shape (centred, in mm), when it has one */
  shape?: Float32Array | null;
};

const mat = () => new THREE.MeshBasicMaterial();

function bodyObjects(p: ExportPart): THREE.Mesh[] {
  const g = p.geometry;
  if (p.shape && g.file) return [new THREE.Mesh(sceneGeometry(p.shape), mat())];
  const geo = bodyGeometry(g);
  return bodyOffsets(g).map((o) => {
    const m = new THREE.Mesh(geo, mat());
    m.position.set(o[0], o[1], o[2]);
    return m;
  });
}

/** One part as it sits in the model: rotated and placed at its position. Shells become a tray and a lid. */
export function partObject(p: ExportPart, shell: ShellParams): THREE.Group {
  const g = p.geometry;
  const group = new THREE.Group();
  group.name = p.ref || p.title;
  if (g.shape === "shell") {
    const { tray, lid } = shellGeometries(g.size, shell);
    const t = new THREE.Mesh(tray, mat());
    t.name = `${group.name} tray`;
    t.position.set(g.pos[0], g.pos[1] - g.size[1] / 2, g.pos[2]);
    group.add(t);
    if (lid.getAttribute("position")) {
      const l = new THREE.Mesh(lid, mat());
      l.name = `${group.name} lid`;
      l.position.set(g.pos[0], g.pos[1] + g.size[1] / 2, g.pos[2]);
      group.add(l);
    }
    return group;
  }
  const inner = new THREE.Group();
  for (const m of bodyObjects(p)) inner.add(m);
  const r = g.rotation ?? [0, 0, 0];
  inner.rotation.set(degToRad(r[0]), degToRad(r[1]), degToRad(r[2]), "XYZ");
  inner.position.set(g.pos[0], g.pos[1], g.pos[2]);
  group.add(inner);
  return group;
}

/** The assembled model, or one part, in scene coordinates (Y up). */
export function assemblyGroup(parts: ExportPart[], shell: ShellParams, onlyId?: number): THREE.Group {
  const root = new THREE.Group();
  for (const p of parts) if (onlyId === undefined || p.id === onlyId) root.add(partObject(p, shell));
  root.updateMatrixWorld(true);
  return root;
}

/** The scene is Y up; STL and slicers are Z up. */
function toZUp(root: THREE.Object3D) {
  const wrap = new THREE.Group();
  wrap.rotation.x = Math.PI / 2;
  wrap.add(root);
  wrap.updateMatrixWorld(true);
  return wrap;
}

function dataViewBytes(dv: DataView): ArrayBuffer {
  return dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength) as ArrayBuffer;
}

/** Binary STL of the assembly or one part, with three's STLExporter. */
export function assemblyStl(parts: ExportPart[], shell: ShellParams, onlyId?: number): ArrayBuffer {
  const wrap = toZUp(assemblyGroup(parts, shell, onlyId));
  return dataViewBytes(new STLExporter().parse(wrap, { binary: true }) as DataView);
}

/** Binary STL of a triangle soup already in print coordinates (Z up, on the bed). */
export function soupToStl(mesh: Mesh): ArrayBuffer {
  const m = new THREE.Mesh(soupToGeometry(mesh, 0), mat());
  m.updateMatrixWorld(true);
  return dataViewBytes(new STLExporter().parse(m, { binary: true }) as DataView);
}

export type PrintBody = { name: string; mesh: Mesh };

/**
 * Printed bodies side by side on one bed, 10 mm apart along x, each already in print orientation.
 * Used for 3MF: every body is its own object so a slicer can move them.
 */
export function bedGroup(bodies: PrintBody[], gap = 10): THREE.Group {
  const root = new THREE.Group();
  let x = 0;
  for (const b of bodies) {
    const geo = soupToGeometry(b.mesh, 0);
    const bb = geo.boundingBox as THREE.Box3;
    const w = bb.max.x - bb.min.x;
    geo.translate(x - bb.min.x, -(bb.min.y + bb.max.y) / 2, 0);
    x += w + gap;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#c8c8c8" }));
    m.name = b.name;
    root.add(m);
  }
  root.updateMatrixWorld(true);
  return root;
}

/** 3MF of printed bodies in print orientation. Millimetres. */
export async function bodies3mf(bodies: PrintBody[], title = "concept-to-realization"): Promise<ArrayBuffer> {
  const blob = await exportTo3MF(bedGroup(bodies), { metadata: { Application: "concept-to-realization", ApplicationTitle: title } });
  return blob.arrayBuffer();
}

/** 3MF of the assembly or one part where it sits, Z up. */
export async function assembly3mf(parts: ExportPart[], shell: ShellParams, onlyId?: number): Promise<ArrayBuffer> {
  const wrap = toZUp(assemblyGroup(parts, shell, onlyId));
  const blob = await exportTo3MF(wrap, { metadata: { Application: "concept-to-realization" } });
  return blob.arrayBuffer();
}
