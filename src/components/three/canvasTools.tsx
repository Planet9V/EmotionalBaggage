"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useDispose } from "./canvasShared";
import { CutPlane } from "./canvasTypes";

const AXIS_NORMAL: Record<"x" | "y" | "z", [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function setClipping(gl: THREE.WebGLRenderer, planes: THREE.Plane[]) {
  gl.clippingPlanes = planes;
}

/** Up to three clipping planes on the renderer, one per axis, from the section sliders. */
export function SectionClip({ cut }: { cut: CutPlane[] }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const planes = cut
      .filter((c) => c.on)
      .map((c) => {
        const n = AXIS_NORMAL[c.axis];
        // A plane keeps points where normal . p + constant >= 0. Normal -x with constant pos keeps x <= pos.
        const sign = c.flip ? 1 : -1;
        return new THREE.Plane(new THREE.Vector3(n[0] * sign, n[1] * sign, n[2] * sign), c.flip ? -c.pos : c.pos);
      });
    setClipping(gl, planes);
    invalidate();
    return () => setClipping(gl, []);
  }, [cut, gl, invalidate]);
  return null;
}

/** Two clicked points, a line between them and the distance in mm. Points are in assembled scene coordinates. */
export function MeasureLayer({ points, dark }: { points: THREE.Vector3[]; dark: boolean }) {
  const dot = useMemo(() => new THREE.SphereGeometry(1.1, 14, 10), []);
  useDispose(dot);
  const color = dark ? "#ffd2b8" : "#E05A10";
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }), [color]);
  useDispose(mat);
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points.length === 2 ? points : [new THREE.Vector3(), new THREE.Vector3()]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
    l.renderOrder = 20;
    l.frustumCulled = false;
    return l;
  }, [points, color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [points, invalidate]);
  if (!points.length) return null;
  const mid = points.length === 2 ? points[0].clone().add(points[1]).multiplyScalar(0.5) : null;
  const d = points.length === 2 ? points[0].distanceTo(points[1]) : 0;
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} geometry={dot} material={mat} position={p} renderOrder={21} />
      ))}
      {points.length === 2 && <primitive object={line} />}
      {mid && (
        <Html position={mid} zIndexRange={[40, 0]} style={{ pointerEvents: "none", transform: "translate(8px, -120%)" }}>
          <span className="whitespace-nowrap rounded-md border border-dutchOrange bg-surface px-2 py-0.5 font-mono text-[11px] text-primary shadow-xs">{d.toFixed(2)} mm</span>
        </Html>
      )}
    </>
  );
}
