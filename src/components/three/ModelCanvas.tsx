"use client";

/**
 * The three.js scene for the 3D model view. Loaded with next/dynamic (ssr: false) from ModelView.
 * Units are mm, Y up. Renders on demand: frames are drawn only while something moves.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import { bodyOffsets, cylinderAxis, lidLift, sceneBounds, totalExtent, type PartGeometry } from "./layout";
import { lidMesh, shellDims, trayMesh, type Mesh, type ShellParams } from "./stl";

export type CanvasPart = { id: number; ref: string; title: string; geometry: PartGeometry };
export type ShellView = "clear" | "solid";
/** A wire to draw: one line between the centres of two parts. */
export type CanvasWire = {
  id: number;
  /** Hover text: the wire name and what it joins. */
  name: string;
  ends: string;
  color: string;
  a: number;
  b: number;
  /** ref of a part in series, or "" */
  via: string;
};

export type ModelCanvasProps = {
  parts: CanvasPart[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** 0 assembled, 1 fully exploded */
  explode: number;
  labels: boolean;
  shellView: ShellView;
  shellParams: ShellParams;
  resetToken: number;
  dark: boolean;
  uploaded: { mesh: Mesh; key: string } | null;
  /** Wires to draw when wiresOn; both ends must be in `parts`. */
  wires: CanvasWire[];
  wiresOn: boolean;
  /** Target opacity per part id while a part is focused (missing id = 1). null = no fade. */
  fade: ReadonlyMap<number, number> | null;
  /** 1 = this part moves with the explode slider, 0 = it stays put (explode by net). null = all move. */
  weights: ReadonlyMap<number, number> | null;
  /** Part ids to frame; null = the whole product. */
  focusIds: number[] | null;
  onFocusPart: (id: number) => void;
};

/**
 * Explosion progress plus per-part fade and explode weight, all stepped inside the render loop
 * so changes never cause React re-renders.
 */
class Progress {
  private v: number;
  private t: number;
  private fadeV = new Map<number, number>();
  private fadeT = new Map<number, number>();
  private weightV = new Map<number, number>();
  private weightT = new Map<number, number>();
  constructor(start: number) {
    this.v = start;
    this.t = start;
  }
  get value() {
    return this.v;
  }
  get target() {
    return this.t;
  }
  setTarget(t: number) {
    this.t = t;
  }
  /** Sets fade and weight targets for the parts in the scene. */
  setTargets(ids: number[], fade: ReadonlyMap<number, number> | null, weights: ReadonlyMap<number, number> | null) {
    const keep = new Set(ids);
    for (const m of [this.fadeV, this.fadeT, this.weightV, this.weightT]) for (const k of [...m.keys()]) if (!keep.has(k)) m.delete(k);
    for (const id of ids) {
      this.fadeT.set(id, fade?.get(id) ?? 1);
      this.weightT.set(id, weights?.get(id) ?? 1);
      if (!this.fadeV.has(id)) this.fadeV.set(id, this.fadeT.get(id) ?? 1);
      if (!this.weightV.has(id)) this.weightV.set(id, this.weightT.get(id) ?? 1);
    }
  }
  fade(id: number) {
    return this.fadeV.get(id) ?? 1;
  }
  fadeTarget(id: number) {
    return this.fadeT.get(id) ?? 1;
  }
  /** Explosion factor for one part right now. */
  f(id: number) {
    return this.v * (this.weightV.get(id) ?? 1);
  }
  /** Explosion factor for one part once everything has settled. */
  settled(id: number) {
    return this.t * (this.weightT.get(id) ?? 1);
  }
  private static move(cur: Map<number, number>, tgt: Map<number, number>, dt: number, instant: boolean) {
    let moving = false;
    for (const [k, t] of tgt) {
      const c = cur.get(k) ?? t;
      const diff = t - c;
      if (diff === 0) continue;
      moving = true;
      cur.set(k, instant || Math.abs(diff) < 0.003 ? t : c + diff * Math.min(1, dt * 8));
    }
    return moving;
  }
  /** Moves toward the targets; returns true while still moving. */
  step(dt: number, instant: boolean) {
    let moving = false;
    const diff = this.t - this.v;
    if (diff !== 0) {
      moving = true;
      if (instant || Math.abs(diff) < 0.0015) this.v = this.t;
      else this.v += diff * Math.min(1, dt * 7);
    }
    if (Progress.move(this.fadeV, this.fadeT, dt, instant)) moving = true;
    if (Progress.move(this.weightV, this.weightT, dt, instant)) moving = true;
    return moving;
  }
}

/** Fades a material without a React render. Faded parts stop writing depth so they never hide what is behind. */
function applyFade(m: THREE.Material, base: number, f: number, glass: boolean) {
  const o = base * f;
  if (m.opacity !== o) m.opacity = o;
  const tr = glass || f < 0.999;
  if (m.transparent !== tr) {
    m.transparent = tr;
    m.depthWrite = !tr;
    m.needsUpdate = true;
  }
}

const ORANGE = "#E05A10";

function palette(dark: boolean) {
  return dark
    ? { body: ["#7c838e", "#646b75"], shell: "#a8b0bb", edge: "#c7ccd3", leader: "#6b717b", cell: "#22252c", section: "#3a3f48", uploaded: "#8e98a6" }
    : { body: ["#b9b3a8", "#9f998e"], shell: "#8d877c", edge: "#6f6a61", leader: "#a9a39a", cell: "#e8e3da", section: "#cfc8bb", uploaded: "#a7aeb8" };
}

/** Triangle soup in print coordinates (Z up) to a BufferGeometry rotated into the scene. */
function soupToGeometry(mesh: Mesh, rotateX: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(mesh.slice(), 3));
  g.rotateX(rotateX);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/** Disposes a three.js resource when it is replaced or the component unmounts. */
function useDispose(value: { dispose: () => void }) {
  useEffect(() => () => value.dispose(), [value]);
}

function Animator({ progress, explode, onLabels }: { progress: Progress; explode: number; onLabels: (v: boolean) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const shown = useRef(false);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useEffect(() => {
    progress.setTarget(explode);
    invalidate();
  }, [explode, progress, invalidate]);
  useFrame((_, dt) => {
    if (progress.step(dt, reduced.current)) invalidate();
    const want = progress.value > 0.15;
    if (want !== shown.current) {
      shown.current = want;
      onLabels(want);
    }
  });
  return null;
}

type Controls = { target: THREE.Vector3; update: () => void };
type Bounds = { min: number[]; max: number[] };

/** Camera placement that shows the bounds from direction `dir`, far enough to see all of it. */
function viewFor(camera: THREE.PerspectiveCamera, { min, max }: Bounds, dir: THREE.Vector3, minRadius: number) {
  const c = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const r = Math.max(minRadius, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
  const dist = (r / Math.sin(((camera.fov || 40) * Math.PI) / 360)) * 1.05;
  return { target: c, position: c.clone().add(dir.clone().normalize().multiplyScalar(dist)), near: Math.max(0.5, dist / 200), far: dist * 20 };
}

const DEFAULT_DIR = new THREE.Vector3(0.62, 0.48, 0.92);

/** Points the camera at the middle of the bounds from a three-quarter view, far enough to see all of it. */
function frameCamera(camera: THREE.PerspectiveCamera, controls: Controls, bounds: Bounds) {
  const v = viewFor(camera, bounds, DEFAULT_DIR, 30);
  camera.position.copy(v.position);
  camera.near = v.near;
  camera.far = v.far;
  camera.updateProjectionMatrix();
  controls.target.copy(v.target);
  controls.update();
}

/** Moves a two-point line. */
function setSegment(line: THREE.Line, x0: number, x1: number, y: number, z: number) {
  const a = line.geometry.attributes.position as THREE.BufferAttribute;
  a.setXYZ(0, x0, y, z);
  a.setXYZ(1, x1, y, z);
  a.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function setOpacity(m: THREE.Material, o: number) {
  m.opacity = o;
}

function touch(a: THREE.BufferAttribute) {
  a.needsUpdate = true;
}

/** Sets the line picking reach on a raycaster and returns the previous value. */
function setLineReach(rc: THREE.Raycaster, v: number) {
  const was = rc.params.Line?.threshold ?? 1;
  if (rc.params.Line) rc.params.Line.threshold = v;
  return was;
}

type Fly = { t: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3 };

/** Applies the clip planes for the new framing and returns the glide to it (null when motion is reduced: it jumps). */
function startFly(cam: THREE.PerspectiveCamera, controls: Controls, bounds: Bounds, minRadius: number, reduced: boolean): Fly | null {
  const dir = cam.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-6) dir.copy(DEFAULT_DIR);
  const v = viewFor(cam, bounds, dir, minRadius);
  cam.near = v.near;
  cam.far = v.far;
  cam.updateProjectionMatrix();
  if (reduced) {
    cam.position.copy(v.position);
    controls.target.copy(v.target);
    controls.update();
    return null;
  }
  return { t: 0, fromPos: cam.position.clone(), toPos: v.position, fromTarget: controls.target.clone(), toTarget: v.target };
}

function stepFly(f: Fly, dt: number, cam: THREE.Camera, controls: Controls) {
  f.t = Math.min(1, f.t + dt / 0.55);
  const e = 1 - Math.pow(1 - f.t, 3);
  cam.position.lerpVectors(f.fromPos, f.toPos, e);
  controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
  controls.update();
  return f.t >= 1;
}

function CameraRig({ resetToken, boundsOf, focusKey, focusBoundsOf }: {
  resetToken: number;
  boundsOf: () => Bounds;
  focusKey: string;
  focusBoundsOf: () => Bounds | null;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  const boundsRef = useRef(boundsOf);
  const focusRef = useRef(focusBoundsOf);
  useEffect(() => {
    boundsRef.current = boundsOf;
    focusRef.current = focusBoundsOf;
  }, [boundsOf, focusBoundsOf]);
  useEffect(() => {
    if (!controls) return;
    frameCamera(camera as THREE.PerspectiveCamera, controls, boundsRef.current());
    invalidate();
  }, [resetToken, controls, camera, invalidate]);

  // Focus and return: glide to the new framing, keeping the direction the user is looking from.
  const lastKey = useRef(focusKey);
  const fly = useRef<Fly | null>(null);
  useEffect(() => {
    if (!controls || focusKey === lastKey.current) return;
    lastKey.current = focusKey;
    const bounds = (focusKey ? focusRef.current() : null) ?? boundsRef.current();
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fly.current = startFly(camera as THREE.PerspectiveCamera, controls, bounds, focusKey ? 16 : 30, reduced);
    invalidate();
  }, [focusKey, controls, camera, invalidate]);
  useFrame((_, dt) => {
    const f = fly.current;
    if (!f || !controls) return;
    if (stepFly(f, dt, camera, controls)) fly.current = null;
    invalidate();
  });
  return null;
}

function setCursor(v: string) {
  if (typeof document !== "undefined") document.body.style.cursor = v;
}

function clickSelect(id: number, onSelect: (id: number) => void, shell = false) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    if (shell) {
      // A see-through shell lets clicks reach the part behind it.
      const behind = e.intersections.some((h) => typeof h.object.userData.partId === "number" && h.object.userData.partId !== id);
      if (behind) return;
    }
    e.stopPropagation();
    onSelect(id);
  };
}

type LabelInfo = { side: 1 | -1; column: number };

function Leader({ progress, part, info, selected, color, onSelect, lift = 0, yOffset = 0 }: {
  progress: Progress;
  part: CanvasPart;
  info: LabelInfo;
  selected: boolean;
  color: string;
  onSelect: (id: number) => void;
  lift?: number;
  yOffset?: number;
}) {
  const g = part.geometry;
  const ext = totalExtent(g);
  const labelRef = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  // The scene renders on demand: ask for a frame so a new label is placed right away.
  useEffect(() => invalidate(), [invalidate]);
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  }, [color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );
  useFrame(() => {
    const p = progress.f(part.id);
    const x = g.pos[0] + g.explode[0] * p;
    const y = g.pos[1] + yOffset + (g.explode[1] + lift) * p;
    const z = g.pos[2] + g.explode[2] * p;
    setSegment(line, x + (info.side * ext[0]) / 2, info.column, y, z);
    labelRef.current?.position.set(info.column, y, z);
  });
  return (
    <>
      <primitive object={line} />
      <group ref={labelRef}>
        <Html zIndexRange={[20, 0]} style={{ transform: `translate(${info.side > 0 ? "4px" : "calc(-100% - 4px)"}, -50%)` }}>
          <button
            type="button"
            onClick={() => onSelect(part.id)}
            className={`whitespace-nowrap rounded-md border bg-surface px-1.5 py-0.5 text-left text-[11px] text-primary shadow-xs transition-colors duration-150 ${
              selected ? "border-dutchOrange" : "border-hairline hover:border-dutchOrange/40"
            }`}
          >
            {part.ref && <span className="font-mono text-link">{part.ref} </span>}
            {part.title}
          </button>
        </Html>
      </group>
    </>
  );
}

function BodyPart({ part, progress, selected, onSelect, onFocusPart, colors, index }: {
  part: CanvasPart;
  progress: Progress;
  selected: boolean;
  onSelect: (id: number) => void;
  onFocusPart: (id: number) => void;
  colors: ReturnType<typeof palette>;
  index: number;
}) {
  const g = part.geometry;
  const group = useRef<THREE.Group>(null);
  const [sx, sy, sz = 0] = g.size;
  const shape = g.shape;
  const axis = shape === "cylinder" ? cylinderAxis(g) : "y";
  const geometry = useMemo<THREE.BufferGeometry>(() => {
    if (shape === "cylinder") {
      const geo = new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 48);
      if (axis === "x") geo.rotateZ(Math.PI / 2);
      if (axis === "z") geo.rotateX(Math.PI / 2);
      return geo;
    }
    return new THREE.BoxGeometry(sx, sy, sz);
  }, [shape, sx, sy, sz, axis]);
  useDispose(geometry);
  const offsets = bodyOffsets(g);
  const color = selected ? ORANGE : colors.body[index % 2];
  // One material per part, shared by its identical bodies; the meshes opt out of R3F disposal (dispose={null})
  // because they share this material and geometry, so both are disposed here.
  const material = useMemo(() => {
    const f = progress.fade(part.id);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0.05,
      emissive: selected ? ORANGE : "#000000",
      emissiveIntensity: selected ? 0.18 : 0,
      transparent: f < 0.999,
      opacity: f,
      depthWrite: f >= 0.999,
    });
  }, [color, selected, progress, part.id]);
  useDispose(material);
  useFrame(() => {
    const p = progress.f(part.id);
    group.current?.position.set(g.pos[0] + g.explode[0] * p, g.pos[1] + g.explode[1] * p, g.pos[2] + g.explode[2] * p);
    applyFade(material, 1, progress.fade(part.id), false);
  });
  return (
    <group ref={group} position={g.pos as [number, number, number]}>
      {offsets.map((o, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={o}
          dispose={null}
          userData={{ partId: part.id }}
          onClick={clickSelect(part.id, onSelect)}
          onDoubleClick={clickSelect(part.id, onFocusPart)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setCursor("pointer");
          }}
          onPointerOut={() => setCursor("auto")}
        />
      ))}
    </group>
  );
}

function ShellPart({ part, progress, selected, onSelect, onFocusPart, colors, view, params, lift }: {
  part: CanvasPart;
  progress: Progress;
  selected: boolean;
  onSelect: (id: number) => void;
  onFocusPart: (id: number) => void;
  colors: ReturnType<typeof palette>;
  view: ShellView;
  params: ShellParams;
  lift: number;
}) {
  const g = part.geometry;
  const [sx, sy, sz] = g.size;
  const { wallMm, clearanceMm, lipMm } = params;
  // A shell too small for the wall settings still shows as its envelope, so it never disappears.
  const { tray, lid } = useMemo(() => {
    const size = [sx, sy, sz];
    const p = { wallMm, clearanceMm, lipMm };
    if (shellDims(size, p).problems.length) {
      return { tray: new THREE.BoxGeometry(sx, sy, sz).translate(0, sy / 2, 0), lid: new THREE.BufferGeometry() };
    }
    return { tray: soupToGeometry(trayMesh(size, p), -Math.PI / 2), lid: soupToGeometry(lidMesh(size, p), Math.PI / 2) };
  }, [sx, sy, sz, wallMm, clearanceMm, lipMm]);
  useDispose(tray);
  useDispose(lid);
  const edgesOf = (geo: THREE.BufferGeometry) => (geo.getAttribute("position") ? new THREE.EdgesGeometry(geo, 20) : new THREE.BufferGeometry());
  const trayEdges = useMemo(() => edgesOf(tray), [tray]);
  const lidEdges = useMemo(() => edgesOf(lid), [lid]);
  useDispose(trayEdges);
  useDispose(lidEdges);
  const trayRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const H = g.size[1];
  const clear = view === "clear";
  const color = selected ? ORANGE : colors.shell;
  const edge = selected ? ORANGE : colors.edge;
  const material = useMemo(() => {
    const f = progress.fade(part.id);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0,
      transparent: clear || f < 0.999,
      opacity: (clear ? 0.16 : 1) * f,
      depthWrite: !(clear || f < 0.999),
      side: clear ? THREE.DoubleSide : THREE.FrontSide,
    });
  }, [color, clear, progress, part.id]);
  useDispose(material);
  const edgeMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: progress.fade(part.id) }), [edge, progress, part.id]);
  useDispose(edgeMaterial);
  useFrame(() => {
    const p = progress.f(part.id);
    const x = g.pos[0] + g.explode[0] * p;
    const z = g.pos[2] + g.explode[2] * p;
    trayRef.current?.position.set(x, g.pos[1] - H / 2 + g.explode[1] * p, z);
    lidRef.current?.position.set(x, g.pos[1] + H / 2 + (g.explode[1] + lift) * p, z);
    const f = progress.fade(part.id);
    applyFade(material, clear ? 0.16 : 1, f, clear);
    setOpacity(edgeMaterial, f);
  });
  const handlers = {
    onClick: clickSelect(part.id, onSelect, clear),
    onDoubleClick: clickSelect(part.id, onFocusPart, clear),
    onPointerOver: () => setCursor("pointer"),
    onPointerOut: () => setCursor("auto"),
  };
  return (
    <>
      <group ref={trayRef} position={[g.pos[0], g.pos[1] - H / 2, g.pos[2]]}>
        <mesh geometry={tray} material={material} dispose={null} userData={{ partId: part.id }} renderOrder={clear ? 2 : 0} {...handlers} />
        <lineSegments geometry={trayEdges} material={edgeMaterial} dispose={null} renderOrder={clear ? 2 : 0} />
      </group>
      <group ref={lidRef} position={[g.pos[0], g.pos[1] + H / 2, g.pos[2]]}>
        <mesh geometry={lid} material={material} dispose={null} userData={{ partId: part.id }} renderOrder={clear ? 2 : 0} {...handlers} />
        <lineSegments geometry={lidEdges} material={edgeMaterial} dispose={null} renderOrder={clear ? 2 : 0} />
      </group>
    </>
  );
}

const WIRE_STEPS = 20;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

type WireEnds = { a: CanvasPart; b: CanvasPart };

function centreOf(part: CanvasPart, f: number, out: THREE.Vector3) {
  const g = part.geometry;
  return out.set(g.pos[0] + g.explode[0] * f, g.pos[1] + g.explode[1] * f, g.pos[2] + g.explode[2] * f);
}

/** One wire: a quadratic curve between two part centres, lifted on y so overlapping wires separate. */
function WireLine({ wire, ends, index, progress, sphere, showVia, onHover }: {
  wire: CanvasWire;
  ends: WireEnds;
  index: number;
  progress: Progress;
  sphere: THREE.SphereGeometry;
  showVia: boolean;
  onHover: (h: { wire: CanvasWire; point: THREE.Vector3 } | null) => void;
}) {
  const marker = useRef<THREE.Group>(null);
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((WIRE_STEPS + 1) * 3), 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: wire.color, transparent: true, opacity: 0.95 }));
    l.frustumCulled = false;
    return l;
  }, [wire.color]);
  const dot = useMemo(() => new THREE.MeshBasicMaterial({ color: wire.color, transparent: true }), [wire.color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );
  useDispose(dot);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate, wire, ends]);
  const hasVia = wire.via !== "";
  useFrame(() => {
    const fa = progress.f(ends.a.id);
    const fb = progress.f(ends.b.id);
    centreOf(ends.a, fa, _a);
    centreOf(ends.b, fb, _b);
    const len = _a.distanceTo(_b);
    const lift = 4 + len * 0.14 + (index % 4) * 3.5;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= WIRE_STEPS; i++) {
      const t = i / WIRE_STEPS;
      const u = 1 - t;
      // Quadratic bezier whose control point is the midpoint raised by 2 x lift, so the curve peaks at lift.
      pos.setXYZ(
        i,
        u * u * _a.x + 2 * u * t * ((_a.x + _b.x) / 2) + t * t * _b.x,
        u * u * _a.y + 2 * u * t * ((_a.y + _b.y) / 2 + lift * 2) + t * t * _b.y,
        u * u * _a.z + 2 * u * t * ((_a.z + _b.z) / 2) + t * t * _b.z
      );
    }
    touch(pos);
    line.geometry.computeBoundingSphere();
    if (hasVia && marker.current) {
      const m = Math.round(WIRE_STEPS / 2);
      marker.current.position.set(pos.getX(m), pos.getY(m), pos.getZ(m));
    }
    const o = 0.95 * Math.min(progress.fade(ends.a.id), progress.fade(ends.b.id));
    setOpacity(line.material as THREE.Material, o);
    setOpacity(dot, o);
  });
  return (
    <>
      <primitive
        object={line}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => onHover({ wire, point: e.point.clone() })}
        onPointerOut={() => onHover(null)}
      />
      {hasVia && (
        <group ref={marker}>
          <mesh geometry={sphere} material={dot} dispose={null} />
          {showVia && (
            <Html zIndexRange={[15, 0]} style={{ pointerEvents: "none", transform: "translate(6px, -50%)" }}>
              <span className="whitespace-nowrap rounded-sm border border-hairline bg-surface px-1 font-mono text-[10px] text-primary">{wire.via}</span>
            </Html>
          )}
        </group>
      )}
    </>
  );
}

/** The wiring overlay. Hover state lives here, so a hover re-renders only the wires. */
function WiresLayer({ wires, parts, progress }: { wires: CanvasWire[]; parts: CanvasPart[]; progress: Progress }) {
  const raycaster = useThree((s) => s.raycaster);
  const sphere = useMemo(() => new THREE.SphereGeometry(1.2, 12, 8), []);
  useDispose(sphere);
  // Thin lines are hard to hit: give the picker some reach, and put it back on the way out.
  useEffect(() => {
    const was = setLineReach(raycaster, 1.6);
    return () => {
      setLineReach(raycaster, was);
    };
  }, [raycaster]);
  const [hover, setHover] = useState<{ wire: CanvasWire; point: THREE.Vector3 } | null>(null);
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const rows = useMemo(
    () =>
      wires.flatMap((w, i) => {
        const a = byId.get(w.a);
        const b = byId.get(w.b);
        return a && b ? [{ w, i, ends: { a, b } }] : [];
      }),
    [wires, byId]
  );
  const shownHover = hover && wires.some((w) => w.id === hover.wire.id) ? hover : null;
  return (
    <>
      {rows.map(({ w, i, ends }) => (
        <WireLine
          key={w.id}
          wire={w}
          ends={ends}
          index={i}
          progress={progress}
          sphere={sphere}
          showVia={progress.fadeTarget(w.a) >= 0.5 && progress.fadeTarget(w.b) >= 0.5}
          onHover={setHover}
        />
      ))}
      {shownHover && (
        <Html position={shownHover.point} zIndexRange={[30, 0]} style={{ pointerEvents: "none", transform: "translate(10px, -110%)" }}>
          <div className="whitespace-nowrap rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-primary shadow-xs">
            <span className="block font-medium">{shownHover.wire.name}</span>
            <span className="block font-mono text-[10px] text-secondary">{shownHover.wire.ends}</span>
          </div>
        </Html>
      )}
    </>
  );
}

function Uploaded({ mesh, color }: { mesh: Mesh; color: string }) {
  const geometry = useMemo(() => {
    // STL files are Z up by convention: stand it up in this Y-up scene, centre it and rest it on the floor.
    const geo = soupToGeometry(mesh, -Math.PI / 2);
    const b = geo.boundingBox ?? new THREE.Box3();
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    geo.computeBoundingBox();
    return geo;
  }, [mesh]);
  useDispose(geometry);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

function Scene(props: ModelCanvasProps & { progress: Progress }) {
  const { parts, selectedId, onSelect, explode, labels, shellView, shellParams, resetToken, dark, uploaded, progress, wires, wiresOn, fade, weights, focusIds, onFocusPart } = props;
  const colors = palette(dark);
  const invalidate = useThree((s) => s.invalidate);
  const [labelsOn, setLabelsOn] = useState(false);

  const geoms = useMemo(() => parts.map((p) => p.geometry), [parts]);
  // Fade and explode-weight targets are handed to the render loop, not rendered by React.
  useEffect(() => {
    progress.setTargets(parts.map((p) => p.id), fade, weights);
    invalidate();
  }, [parts, fade, weights, progress, invalidate]);
  const shellLift = useMemo(() => {
    const out = new Map<number, number>();
    for (const p of parts) if (p.geometry.shape === "shell") out.set(p.id, lidLift(p.geometry, geoms.filter((g) => g !== p.geometry)));
    return out;
  }, [parts, geoms]);

  const labelInfo = useMemo(() => {
    let maxX = 0;
    for (const g of geoms) {
      const e = totalExtent(g);
      maxX = Math.max(maxX, Math.abs(g.pos[0]) + e[0] / 2, Math.abs(g.pos[0] + g.explode[0]) + e[0] / 2);
    }
    const out = new Map<number, LabelInfo>();
    for (const p of parts) {
      const g = p.geometry;
      const side: 1 | -1 = g.pos[0] + g.explode[0] < 0 ? -1 : 1;
      out.set(p.id, { side, column: side * (maxX + 22) });
    }
    return out;
  }, [parts, geoms]);

  const uploadedBounds = useMemo(() => {
    if (!uploaded) return null;
    const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    const m = uploaded.mesh;
    for (let i = 0; i < m.length; i += 3) {
      // Z-up file coordinates: x, z (up), y (depth)
      const v = [m[i], m[i + 2], m[i + 1]];
      for (let k = 0; k < 3; k++) {
        b.min[k] = Math.min(b.min[k], v[k]);
        b.max[k] = Math.max(b.max[k], v[k]);
      }
    }
    const w = b.max[0] - b.min[0];
    const h = b.max[1] - b.min[1];
    const d = b.max[2] - b.min[2];
    return { min: [-w / 2, 0, -d / 2], max: [w / 2, h, d / 2] };
  }, [uploaded]);

  const floor = useMemo(() => {
    let lo = 0;
    for (const g of geoms) lo = Math.min(lo, g.pos[1] - totalExtent(g)[1] / 2);
    return lo - 0.05;
  }, [geoms]);

  const boundsOf = useMemo(
    () => () => {
      const exploded = progress.target > 0.5;
      const b = sceneBounds(geoms, exploded);
      if (exploded) {
        for (const p of parts) {
          const lift = shellLift.get(p.id);
          if (lift) b.max[1] = Math.max(b.max[1], p.geometry.pos[1] + p.geometry.size[1] / 2 + p.geometry.explode[1] + lift);
        }
      }
      if (uploadedBounds) {
        if (!geoms.length) return uploadedBounds;
        for (let k = 0; k < 3; k++) {
          b.min[k] = Math.min(b.min[k], uploadedBounds.min[k]);
          b.max[k] = Math.max(b.max[k], uploadedBounds.max[k]);
        }
      }
      return b;
    },
    [geoms, parts, shellLift, uploadedBounds, progress]
  );

  const focusKey = focusIds && focusIds.length ? focusIds.join(",") : "";
  const focusBoundsOf = useMemo(
    () => () => {
      if (!focusIds || !focusIds.length) return null;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const p of parts) {
        if (!focusIds.includes(p.id)) continue;
        const g = p.geometry;
        const e = totalExtent(g);
        const f = progress.settled(p.id);
        for (let k = 0; k < 3; k++) {
          const c = g.pos[k] + g.explode[k] * f;
          min[k] = Math.min(min[k], c - e[k] / 2);
          max[k] = Math.max(max[k], c + e[k] / 2);
        }
        const lift = shellLift.get(p.id);
        if (lift) max[1] += lift * f;
      }
      return min[0] === Infinity ? null : { min, max };
    },
    [focusIds, parts, shellLift, progress]
  );

  const span = useMemo(() => {
    const b = sceneBounds(geoms, true);
    const u = uploadedBounds ? Math.max(uploadedBounds.max[0] - uploadedBounds.min[0], uploadedBounds.max[2] - uploadedBounds.min[2]) : 0;
    return Math.ceil((Math.max(200, u, geoms.length ? Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) : 0) * 4) / 100) * 100;
  }, [geoms, uploadedBounds]);

  return (
    <>
      <Animator progress={progress} explode={explode} onLabels={setLabelsOn} />
      <CameraRig resetToken={resetToken} boundsOf={boundsOf} focusKey={focusKey} focusBoundsOf={focusBoundsOf} />
      <hemisphereLight args={[dark ? "#c9d1dc" : "#ffffff", dark ? "#1a1c20" : "#d9d2c6", dark ? 1.1 : 1.25]} />
      <directionalLight position={[120, 220, 160]} intensity={dark ? 1.4 : 1.6} />
      <directionalLight position={[-160, 90, -120]} intensity={0.45} />
      <Grid
        position={[0, floor, 0]}
        args={[span, span]}
        cellSize={10}
        cellThickness={0.6}
        cellColor={colors.cell}
        sectionSize={50}
        sectionThickness={1}
        sectionColor={colors.section}
        fadeDistance={span / 2}
        fadeStrength={1.5}
      />
      {parts.map((p, i) =>
        p.geometry.shape === "shell" ? (
          <ShellPart
            key={p.id}
            part={p}
            progress={progress}
            selected={p.id === selectedId}
            onSelect={onSelect}
            onFocusPart={onFocusPart}
            colors={colors}
            view={shellView}
            params={shellParams}
            lift={shellLift.get(p.id) ?? 20}
          />
        ) : (
          <BodyPart key={p.id} part={p} progress={progress} selected={p.id === selectedId} onSelect={onSelect} onFocusPart={onFocusPart} colors={colors} index={i} />
        )
      )}
      {labels &&
        labelsOn &&
        parts.map((p) => {
          const info = labelInfo.get(p.id);
          if (!info || (fade?.get(p.id) ?? 1) < 0.5) return null;
          const isShell = p.geometry.shape === "shell";
          return (
            <Leader
              key={p.id}
              progress={progress}
              part={p}
              info={info}
              selected={p.id === selectedId}
              color={p.id === selectedId ? ORANGE : colors.leader}
              onSelect={onSelect}
              lift={isShell ? shellLift.get(p.id) ?? 20 : 0}
              yOffset={isShell ? p.geometry.size[1] / 2 : 0}
            />
          );
        })}
      {wiresOn && wires.length > 0 && <WiresLayer wires={wires} parts={parts} progress={progress} />}
      {uploaded && <Uploaded mesh={uploaded.mesh} color={colors.uploaded} />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
    </>
  );
}

export default function ModelCanvas(props: ModelCanvasProps) {
  const [progress] = useState(() => new Progress(props.explode));
  useEffect(() => () => setCursor("auto"), []);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 40, near: 1, far: 20000, position: [180, 140, 260] }}
      style={{ touchAction: "none" }}
    >
      <Scene {...props} progress={progress} />
    </Canvas>
  );
}
