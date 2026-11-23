"use client";

/**
 * A small three.js canvas for the enclosure preview: one or two assembled pairs (base and lid), concept frame, mm, Y up.
 * Loaded with next/dynamic (ssr: false) from EnclosureView. It does not touch the Physical layout or Model canvases.
 */
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { GeneratedMesh } from "@/lib/enclosure/types";

export type PreviewMesh = { id: string; mesh: GeneratedMesh; kind: "base" | "lid"; /** this piece's own colour (its filament's), in place of the kind's or the tint */ color?: string };
export type PreviewProps = {
  meshes: PreviewMesh[];
  /** Lift the lid straight up by this many mm. */
  lift: number;
  dark: boolean;
  label: string;
  /** y of the underside of the base, so the grid sits under it. */
  floorY: number;
  /** Drawn inside the canvas after the meshes; the public welcome page passes its turntable and print animation. */
  children?: React.ReactNode;
  /** False leaves the wheel to the page (the welcome page zooms on Ctrl or Cmd + wheel itself). Default true. */
  wheelZoom?: boolean;
  /**
   * Presentation extras for the welcome page, each off unless given:
   *  - `look`: see-through (with edges drawn) or wireframe (the pieces' feature edges, not every triangle) instead of solid;
   *  - `clipY`: everything above this height is cut away, as a print stands part way up; the cut face is filled
   *    in `cutColor` and, with `ghost`, what is still to print shows as a faint outline above it;
   *  - `tint`: one colour for every piece (the print material's) in place of base grey and lid orange.
   */
  look?: "solid" | "translucent" | "wireframe";
  clipY?: number | null;
  cutColor?: string;
  ghost?: boolean;
  tint?: string;
};

type Extras = Pick<PreviewProps, "look" | "clipY" | "cutColor" | "ghost" | "tint">;

function geometryOf(m: GeneratedMesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

function Part({ mesh, kind, lift, dark, look = "solid", clipY = null, cutColor = "#E05A10", ghost = false, tint }: { mesh: GeneratedMesh; kind: "base" | "lid"; lift: number; dark: boolean } & Extras) {
  const g = useMemo(() => geometryOf(mesh), [mesh]);
  useEffect(() => () => g.dispose(), [g]);
  const color = tint ?? (kind === "base" ? (dark ? "#9AA4B2" : "#6B7686") : "#E05A10");
  const plain = look === "solid" && clipY === null && !ghost && !tint;
  // the extras: one clipping plane shared by the piece's materials, its edges, and a faint copy for what is to come
  const [plane] = useState(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0));
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setConstant(plane, clipY ?? 1e6);
    invalidate();
  }, [plane, clipY, invalidate]);
  const edges = useMemo(() => (plain ? null : new THREE.EdgesGeometry(g, 28)), [g, plain]);
  useEffect(() => () => edges?.dispose(), [edges]);
  const y = kind === "lid" ? lift : 0;
  if (plain) {
    return (
      <mesh geometry={g} position={[0, y, 0]}>
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  const clear = look === "translucent";
  const wire = look === "wireframe";
  const planes = clipping(plane, clipY !== null);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={g} renderOrder={clear ? 2 : 0}>
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.62} side={THREE.FrontSide} transparent={clear || wire} opacity={clear ? 0.38 : wire ? 0.07 : 1} depthWrite={!clear && !wire} clippingPlanes={planes} />
      </mesh>
      {/* the inside faces, seen through the cut, read as the filled cross-section of the layer being laid */}
      {clipY !== null && look !== "wireframe" ? (
        <mesh geometry={g}>
          <meshBasicMaterial color={cutColor} side={THREE.BackSide} clippingPlanes={planes} />
        </mesh>
      ) : null}
      {edges ? (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={wire ? color : dark ? "#d5dae1" : "#3d3a35"} transparent opacity={wire ? 1 : clear ? 0.75 : 0.45} clippingPlanes={planes} />
        </lineSegments>
      ) : null}
      {ghost && clipY !== null && edges ? (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={dark ? "#8b919b" : "#77716a"} transparent opacity={0.28} />
        </lineSegments>
      ) : null}
    </group>
  );
}

// one array per plane, so the materials keep one clipping setup and their shaders are compiled once
const PLANES = new WeakMap<THREE.Plane, THREE.Plane[]>();
const NONE: THREE.Plane[] = [];
function clipping(plane: THREE.Plane, on: boolean) {
  if (!on) return NONE;
  let a = PLANES.get(plane);
  if (!a) PLANES.set(plane, (a = [plane]));
  return a;
}

// three.js objects changed in place, outside React's data flow
function setConstant(plane: THREE.Plane, y: number) {
  plane.constant = y;
}
function enableLocalClipping(gl: THREE.WebGLRenderer) {
  gl.localClippingEnabled = true;
}
function LocalClipping() {
  const gl = useThree((s) => s.gl);
  useEffect(() => enableLocalClipping(gl), [gl]);
  return null;
}

function Fit({ meshes }: { meshes: PreviewMesh[] }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const box = new THREE.Box3();
    for (const m of meshes) {
      const g = geometryOf(m.mesh);
      if (g.boundingBox) box.union(g.boundingBox);
      g.dispose();
    }
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z, 20);
    camera.position.set(c.x + r * 1.1, c.y + r * 1.0, c.z + r * 1.6);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
    invalidate();
  }, [meshes, camera, invalidate]);
  return null;
}

export default function EnclosureCanvas({ meshes, lift, dark, label, floorY, children, wheelZoom = true, ...extras }: PreviewProps) {
  return (
    <div role="img" aria-label={label} className="h-full w-full">
      <Canvas frameloop="demand" dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: 40, near: 1, far: 5000, position: [120, 100, 170] }} style={{ touchAction: "none" }}>
        <ambientLight intensity={dark ? 0.9 : 1.1} />
        <directionalLight position={[80, 160, 120]} intensity={dark ? 1.6 : 1.8} />
        <directionalLight position={[-100, 60, -80]} intensity={0.6} />
        <Fit meshes={meshes} />
        {meshes.map((m) => (
          <Part key={m.id} mesh={m.mesh} kind={m.kind} lift={m.kind === "lid" ? lift : 0} dark={dark} {...extras} tint={m.color ?? extras.tint} />
        ))}
        {extras.clipY !== undefined && extras.clipY !== null ? <LocalClipping /> : null}
        <Grid args={[400, 400]} cellSize={10} sectionSize={50} cellColor={dark ? "#2A2F37" : "#D8D3CC"} sectionColor={dark ? "#3A414B" : "#B9B2A8"} fadeDistance={500} infiniteGrid position={[0, floorY - 0.05, 0]} />
        <OrbitControls makeDefault enableDamping={false} enableZoom={wheelZoom} />
        {children}
      </Canvas>
    </div>
  );
}
