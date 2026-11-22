"use client";

// The film itself: one canvas for every scene. It draws whichever scene it is given at the moment the shared
// clock says, so the page decides what plays and this only renders. The camera does the comedy, as the script
// does: each scene is a few shots with cuts and slow moves. Loaded only when the section nears the window.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { SceneId } from "../scenes";
import { measure, newMeter, type PaceMeter } from "../pace";
import { E, mix, clamp01 } from "./ease";
import { ClockProvider, useClock, type Clock, type Shot, type Staged, type V3 } from "./kit";
import { ButtonScene, ScaleScene } from "./setScale";
import { HandleScene, TossScene } from "./setTarmac";
import { CarouselScene, HoldScene } from "./setHall";

const FILM: Record<SceneId, Staged> = {
  scale: ScaleScene,
  toss: TossScene,
  handle: HandleScene,
  hold: HoldScene,
  carousel: CarouselScene,
  button: ButtonScene,
};

const pair = <T,>(v: T | [T, T], isOne: (x: T | [T, T]) => x is T): [T, T] => (isOne(v) ? [v, v] : v);
const isPoint = (x: V3 | [V3, V3]): x is V3 => typeof x[0] === "number";
const isNumber = (x: number | [number, number]): x is number => typeof x === "number";
const WIDE = 16 / 9;

/** Puts the camera where the current shot says. On a narrow window the lens widens, so the action stays in frame. */
function Camera({ shots, duration, shake }: { shots: Shot[]; duration: number; shake?: (t: number) => number }) {
  const clock = useClock();
  const look = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    const t = clock.t;
    let i = 0;
    for (let k = 0; k < shots.length; k++) if (t >= shots[k]!.at) i = k;
    const s = shots[i]!;
    const end = s.to ?? shots[i + 1]?.at ?? duration;
    const p = E[s.ease ?? "lin"](clamp01((t - s.at) / (end - s.at || 1)));
    let fov = 30;
    if (s.follow) {
      const f = s.follow(t);
      camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
      look.current.set(f.look[0], f.look[1], f.look[2]);
    } else {
      const [a, b] = pair(s.pos, isPoint);
      const [la, lb] = pair(s.look, isPoint);
      camera.position.set(mix(a[0], b[0], p), mix(a[1], b[1], p), mix(a[2], b[2], p));
      look.current.set(mix(la[0], lb[0], p), mix(la[1], lb[1], p), mix(la[2], lb[2], p));
    }
    if (s.fov !== undefined) {
      const [fa, fb] = pair(s.fov, isNumber);
      fov = mix(fa, fb, p);
    }
    const aspect = size.width / size.height;
    const widen = aspect < WIDE ? (WIDE / aspect) ** 0.62 : 1;
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * widen));
    cam.lookAt(look.current);
    // a hand holding the camera: the smallest slow drift, never still, never noticed (a few millimetres, a tenth of a degree)
    const d = t / 1000;
    cam.position.x += 0.006 * Math.sin(d * 0.9) + 0.003 * Math.sin(d * 2.3 + 1);
    cam.position.y += 0.005 * Math.sin(d * 1.3 + 2) + 0.002 * Math.sin(d * 3.1);
    cam.rotateZ(0.0015 * Math.sin(d * 0.7 + 0.5));
    // the thud: a short, dying shake
    const k = shake?.(t) ?? 0;
    if (k > 0) {
      cam.position.x += 0.05 * k * Math.sin(t / 13);
      cam.position.y += 0.07 * k * Math.sin(t / 9 + 1);
      cam.rotateZ(0.012 * k * Math.sin(t / 11));
    }
    // a lens shift lifts the picture in the frame: the subtitle band and the lower third need the bottom of it
    const rise = (s.rise ?? 0.1) * (aspect < WIDE ? 0.7 : 1);
    cam.setViewOffset(size.width, size.height, 0, rise * size.height, size.width, size.height);
    cam.updateProjectionMatrix();
  });
  return null;
}

/**
 * Measures the film on the visitor's own device: the average frame time over each two seconds of playing, and what
 * the renderer drew (draw calls and triangles, shadow pass included) for the report.
 */
function Meter({ scene, playing, onPace, onInfo }: { scene: SceneId; playing: boolean; onPace: (ms: number) => void; onInfo: (calls: number, triangles: number) => void }) {
  const acc = useRef<PaceMeter>(newMeter());
  // a new scene, or the film starting again: start a fresh measure, and leave out the hitch while shaders compile
  useEffect(() => {
    acc.current = newMeter();
  }, [scene, playing]);
  useFrame(({ gl }, delta) => {
    // everything drawn since the last frame, shadow pass included (the count is reset here, not by the renderer)
    if (gl.info.render.calls) onInfo(gl.info.render.calls, gl.info.render.triangles);
    gl.info.reset();
    // a held frame is not a measure of pace
    if (!playing) return;
    const ms = measure(acc.current, delta);
    if (ms !== null) onPace(ms);
  });
  return null;
}

/** When the film is held on one frame, draw that frame again whenever the scene or the moment changes. */
function Redraw({ stamp }: { stamp: string }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const again = window.setTimeout(() => invalidate(), 120);
    return () => window.clearTimeout(again);
  }, [stamp, invalidate]);
  return null;
}

// the renderer belongs to three, not to React: this changes its setting by name
function countByFrame(gl: THREE.WebGLRenderer) {
  gl.info.autoReset = false;
}

export type FilmProps = { scene: SceneId; duration: number; clock: Clock; playing: boolean; sharp: boolean; stamp: string; onReady: () => void; onPace: (ms: number) => void; onInfo: (calls: number, triangles: number) => void };

export default function Film({ scene, duration, clock, playing, sharp, stamp, onReady, onPace, onInfo }: FilmProps) {
  const { Set, shots, shake } = FILM[scene];
  return (
    <Canvas
      shadows
      frameloop={playing ? "always" : "demand"}
      dpr={sharp ? [1, 2] : [1, 1.5]}
      camera={{ fov: 30, near: 0.2, far: 80, position: [0, 1.5, 7] }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.92 }}
      onCreated={({ gl }) => {
        countByFrame(gl);
        onReady();
      }}
      aria-hidden="true"
      tabIndex={-1}
    >
      <ClockProvider value={clock}>
        <Set key={scene} />
        <Camera shots={shots} duration={duration} shake={shake} />
        <Meter scene={scene} playing={playing} onPace={onPace} onInfo={onInfo} />
        <Redraw stamp={stamp} />
      </ClockProvider>
    </Canvas>
  );
}
