"use client";

/**
 * Presentation-only extras for the 3D scene, used by the public welcome page's showcase (ModelCanvas takes them as
 * the optional `showcase` prop; the app's own model view does not pass it, so nothing changes there).
 *  - a slow turntable that stops the moment the visitor takes hold of the view;
 *  - a wireframe look, set on every mesh material in the scene;
 *  - zoom with Ctrl or Cmd + wheel only, so an ordinary wheel over the canvas still scrolls the page
 *    (ModelCanvas turns the controls' own wheel zoom off when `showcase` is given);
 *  - nudges from buttons, for people who do not drag: turn, tilt, zoom;
 *  - a two-finger pinch zooms on a touch screen.
 * The enclosure preview on the welcome page uses the same component (EnclosureCanvas takes it as a child).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export type ShowcaseNudge = { kind: "left" | "right" | "up" | "down" | "in" | "out"; n: number };
export type ShowcaseOptions = {
  turntable: boolean;
  wireframe: boolean;
  /** called once when the visitor starts to drag the view */
  onGrab?: () => void;
  /** one step of turning, tilting or zooming; `n` changes each time a button is pressed */
  nudge?: ShowcaseNudge;
  /** distance factor for the framing: below 1 brings the camera in, so the model fills more of the view */
  closer?: number;
  /** drawn inside the canvas: the welcome page's own label layer */
  children?: React.ReactNode;
};

type Controls = { target: THREE.Vector3; update: () => void; addEventListener: (t: "start", f: () => void) => void; removeEventListener: (t: "start", f: () => void) => void };

const TURN_PER_SECOND = 0.22; // radians: one turn in about half a minute

function orbit(cam: THREE.Camera, controls: Controls, turn: number, tilt: number, zoom: number) {
  const offset = cam.position.clone().sub(controls.target);
  const s = new THREE.Spherical().setFromVector3(offset);
  s.theta += turn;
  s.phi = Math.min(Math.PI / 2 - 0.05, Math.max(0.25, s.phi + tilt));
  s.radius = Math.min(1600, Math.max(60, s.radius * zoom));
  cam.position.copy(controls.target).add(offset.setFromSpherical(s));
  controls.update();
}

export function Showcase({ turntable, wireframe = false, onGrab, nudge }: Omit<ShowcaseOptions, "wireframe"> & { wireframe?: boolean }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  const grab = useRef(onGrab);
  useEffect(() => {
    grab.current = onGrab;
  }, [onGrab]);

  useEffect(() => {
    if (!controls) return;
    const start = () => grab.current?.();
    controls.addEventListener("start", start);
    return () => controls.removeEventListener("start", start);
  }, [controls]);

  // Ctrl or Cmd + wheel zooms; a plain wheel is left alone and scrolls the page.
  useEffect(() => {
    const el = gl.domElement;
    const wheel = (e: WheelEvent) => {
      if (!controls || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      grab.current?.();
      orbit(camera, controls, 0, 0, e.deltaY > 0 ? 1.08 : 0.92);
      invalidate();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [gl, camera, controls, invalidate]);

  // Two fingers: pinch to zoom. The controls' own zoom is off (it would take the wheel), so the pinch is read here.
  useEffect(() => {
    const el = gl.domElement;
    const touches = new Map<number, [number, number]>();
    let last = 0;
    const span = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      last = span();
    };
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      const now = span();
      if (!controls || touches.size !== 2 || !last || !now) return;
      orbit(camera, controls, 0, 0, last / now);
      last = now;
      invalidate();
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      last = span();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, camera, controls, invalidate]);

  const lastNudge = useRef(nudge?.n ?? 0);
  useEffect(() => {
    if (!controls || !nudge || nudge.n === lastNudge.current) return;
    lastNudge.current = nudge.n;
    const step = Math.PI / 10;
    orbit(camera, controls, nudge.kind === "left" ? -step : nudge.kind === "right" ? step : 0, nudge.kind === "up" ? -step / 2 : nudge.kind === "down" ? step / 2 : 0, nudge.kind === "in" ? 0.82 : nudge.kind === "out" ? 1.22 : 1);
    invalidate();
  }, [nudge, camera, controls, invalidate]);

  useFrame((_, dt) => {
    // parts mount and change over time, so the look is set each frame that is drawn; it is a handful of meshes
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as (THREE.Material & { wireframe?: boolean }) | THREE.Material[] | undefined;
      if (!m || Array.isArray(m) || !("wireframe" in m) || o.userData.isWire) return;
      if (m.wireframe !== wireframe) {
        m.wireframe = wireframe;
        m.needsUpdate = true;
      }
    });
    if (!turntable || !controls) return;
    orbit(camera, controls, Math.min(dt, 0.05) * TURN_PER_SECOND, 0, 1);
    invalidate();
  });

  // a change of look needs one frame drawn even when nothing is turning
  useEffect(() => invalidate(), [wireframe, turntable, invalidate]);
  return null;
}
