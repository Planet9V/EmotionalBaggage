"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Progress } from "./canvasShared";

export function Animator({ progress, explode, onLabels }: { progress: Progress; explode: number; onLabels: (v: boolean) => void }) {
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

export function CameraRig({ resetToken, boundsOf, focusKey, focusBoundsOf }: {
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
