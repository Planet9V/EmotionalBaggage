"use client";

/**
 * The three.js scene for the 3D model view. Loaded with next/dynamic (ssr: false) from ModelView.
 * Units are mm, Y up. Renders on demand: frames are drawn only while something moves.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Grid, Html, OrbitControls } from "@react-three/drei";
import { bodyOffsets, cylinderAxis, lidLift, sceneBounds, totalExtent, type PartGeometry } from "./layout";
import { lidMesh, shellDims, trayMesh, type Mesh, type ShellParams } from "./stl";

export type CanvasPart = { id: number; ref: string; title: string; geometry: PartGeometry };
export type ShellView = "clear" | "solid";

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
};

/** Explosion progress, stepped inside the render loop without React re-renders. */
class Progress {
  private v: number;
  private t: number;
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
  /** Moves toward the target; returns true while still moving. */
  step(dt: number, instant: boolean) {
    const diff = this.t - this.v;
    if (diff === 0) return false;
    if (instant || Math.abs(diff) < 0.0015) this.v = this.t;
    else this.v += diff * Math.min(1, dt * 7);
    return true;
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

/** Points the camera at the middle of the bounds from a three-quarter view, far enough to see all of it. */
function frameCamera(camera: THREE.PerspectiveCamera, controls: Controls, { min, max }: { min: number[]; max: number[] }) {
  const c = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const r = Math.max(30, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
  const dist = (r / Math.sin(((camera.fov || 40) * Math.PI) / 360)) * 1.05;
  const dir = new THREE.Vector3(0.62, 0.48, 0.92).normalize();
  camera.position.copy(c.clone().add(dir.multiplyScalar(dist)));
  camera.near = Math.max(0.5, dist / 200);
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controls.target.copy(c);
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

function CameraRig({ resetToken, boundsOf }: { resetToken: number; boundsOf: () => { min: number[]; max: number[] } }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  const boundsRef = useRef(boundsOf);
  useEffect(() => {
    boundsRef.current = boundsOf;
  }, [boundsOf]);
  useEffect(() => {
    if (!controls) return;
    frameCamera(camera as THREE.PerspectiveCamera, controls, boundsRef.current());
    invalidate();
  }, [resetToken, controls, camera, invalidate]);
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
    const p = progress.value;
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
            className={`whitespace-nowrap rounded-md border bg-surface px-1.5 py-0.5 text-left text-[11px] text-primary shadow-sm transition-colors duration-150 ${
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

function BodyPart({ part, progress, selected, onSelect, colors, index }: {
  part: CanvasPart;
  progress: Progress;
  selected: boolean;
  onSelect: (id: number) => void;
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
  useFrame(() => {
    const p = progress.value;
    group.current?.position.set(g.pos[0] + g.explode[0] * p, g.pos[1] + g.explode[1] * p, g.pos[2] + g.explode[2] * p);
  });
  const color = selected ? ORANGE : colors.body[index % 2];
  // One material per part, shared by its identical bodies; the meshes opt out of R3F disposal (dispose={null})
  // because they share this material and geometry, so both are disposed here.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, emissive: selected ? ORANGE : "#000000", emissiveIntensity: selected ? 0.18 : 0 }),
    [color, selected]
  );
  useDispose(material);
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

function ShellPart({ part, progress, selected, onSelect, colors, view, params, lift }: {
  part: CanvasPart;
  progress: Progress;
  selected: boolean;
  onSelect: (id: number) => void;
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
  const trayRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const H = g.size[1];
  useFrame(() => {
    const p = progress.value;
    const x = g.pos[0] + g.explode[0] * p;
    const z = g.pos[2] + g.explode[2] * p;
    trayRef.current?.position.set(x, g.pos[1] - H / 2 + g.explode[1] * p, z);
    lidRef.current?.position.set(x, g.pos[1] + H / 2 + (g.explode[1] + lift) * p, z);
  });
  const clear = view === "clear";
  const color = selected ? ORANGE : colors.shell;
  const edge = selected ? ORANGE : colors.edge;
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={0.5}
      metalness={0}
      transparent={clear}
      opacity={clear ? 0.16 : 1}
      depthWrite={!clear}
      side={clear ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
  const handlers = {
    onClick: clickSelect(part.id, onSelect, clear),
    onPointerOver: () => setCursor("pointer"),
    onPointerOut: () => setCursor("auto"),
  };
  return (
    <>
      <group ref={trayRef} position={[g.pos[0], g.pos[1] - H / 2, g.pos[2]]}>
        <mesh geometry={tray} userData={{ partId: part.id }} renderOrder={clear ? 2 : 0} {...handlers}>
          {material}
          <Edges threshold={20} color={edge} />
        </mesh>
      </group>
      <group ref={lidRef} position={[g.pos[0], g.pos[1] + H / 2, g.pos[2]]}>
        <mesh geometry={lid} userData={{ partId: part.id }} renderOrder={clear ? 2 : 0} {...handlers}>
          {material}
          <Edges threshold={20} color={edge} />
        </mesh>
      </group>
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
  const { parts, selectedId, onSelect, explode, labels, shellView, shellParams, resetToken, dark, uploaded, progress } = props;
  const colors = palette(dark);
  const [labelsOn, setLabelsOn] = useState(false);

  const geoms = useMemo(() => parts.map((p) => p.geometry), [parts]);
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

  const span = useMemo(() => {
    const b = sceneBounds(geoms, true);
    const u = uploadedBounds ? Math.max(uploadedBounds.max[0] - uploadedBounds.min[0], uploadedBounds.max[2] - uploadedBounds.min[2]) : 0;
    return Math.ceil((Math.max(200, u, geoms.length ? Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) : 0) * 4) / 100) * 100;
  }, [geoms, uploadedBounds]);

  return (
    <>
      <Animator progress={progress} explode={explode} onLabels={setLabelsOn} />
      <CameraRig resetToken={resetToken} boundsOf={boundsOf} />
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
            colors={colors}
            view={shellView}
            params={shellParams}
            lift={shellLift.get(p.id) ?? 20}
          />
        ) : (
          <BodyPart key={p.id} part={p} progress={progress} selected={p.id === selectedId} onSelect={onSelect} colors={colors} index={i} />
        )
      )}
      {labels &&
        labelsOn &&
        parts.map((p) => {
          const info = labelInfo.get(p.id);
          if (!info) return null;
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
