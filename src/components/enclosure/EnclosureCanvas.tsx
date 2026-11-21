"use client";

/**
 * A small three.js canvas for the enclosure preview: one or two assembled pairs (base and lid), concept frame, mm, Y up.
 * Loaded with next/dynamic (ssr: false) from EnclosureView. It does not touch the Physical layout or Model canvases.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { GeneratedMesh } from "@/lib/enclosure/types";

export type PreviewMesh = { id: string; mesh: GeneratedMesh; kind: "base" | "lid" };
export type PreviewProps = {
  meshes: PreviewMesh[];
  /** Lift the lid straight up by this many mm. */
  lift: number;
  dark: boolean;
  label: string;
  /** y of the underside of the base, so the grid sits under it. */
  floorY: number;
};

function geometryOf(m: GeneratedMesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

function Part({ mesh, kind, lift, dark }: { mesh: GeneratedMesh; kind: "base" | "lid"; lift: number; dark: boolean }) {
  const g = useMemo(() => geometryOf(mesh), [mesh]);
  useEffect(() => () => g.dispose(), [g]);
  const color = kind === "base" ? (dark ? "#9AA4B2" : "#6B7686") : "#E05A10";
  return (
    <mesh geometry={g} position={[0, kind === "lid" ? lift : 0, 0]}>
      <meshStandardMaterial color={color} metalness={0.05} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );
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

export default function EnclosureCanvas({ meshes, lift, dark, label, floorY }: PreviewProps) {
  return (
    <div role="img" aria-label={label} className="h-full w-full">
      <Canvas frameloop="demand" dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: 40, near: 1, far: 5000, position: [120, 100, 170] }} style={{ touchAction: "none" }}>
        <ambientLight intensity={dark ? 0.9 : 1.1} />
        <directionalLight position={[80, 160, 120]} intensity={dark ? 1.6 : 1.8} />
        <directionalLight position={[-100, 60, -80]} intensity={0.6} />
        <Fit meshes={meshes} />
        {meshes.map((m) => (
          <Part key={m.id} mesh={m.mesh} kind={m.kind} lift={m.kind === "lid" ? lift : 0} dark={dark} />
        ))}
        <Grid args={[400, 400]} cellSize={10} sectionSize={50} cellColor={dark ? "#2A2F37" : "#D8D3CC"} sectionColor={dark ? "#3A414B" : "#B9B2A8"} fadeDistance={500} infiniteGrid position={[0, floorY - 0.05, 0]} />
        <OrbitControls makeDefault enableDamping={false} />
      </Canvas>
    </div>
  );
}
