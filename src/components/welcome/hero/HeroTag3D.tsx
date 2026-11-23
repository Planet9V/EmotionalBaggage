"use client";

// The hero's tag in real time: the film's own tag (scenes/film/tag.ts: one mesh, one material, its leather, holes,
// stitches and stamp worked out in the shader), hanging by its strap from the rail that runs from "Idea" to "On
// sale". It idles as a weight on a strap does: a slow twist that shows its thickness and lets the light cross the
// grain, a small swing, and it turns a little toward the pointer. One mesh; no shadows, no post. The
// renderer maps tones linearly here: the film's neutral curve deepens a dark tan toward orange, and this is the
// owner's saddle tan, close up.
//
// It is laid over the drawn tag (TagArt) with the same frame (frame.ts): at rest and square on, the two coincide,
// so the drawing gives way to it without a jump. Loaded only after the hero has painted (HeroStage).
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Kit } from "../scenes/film/kit";
import { STRAP_INK, STRAP_T, TAG_ARM, band, tagBuild, tagMaterial, tagPerform } from "../scenes/film/tag";
import { STRAP, TAG_MM } from "../scenes/film/tagShape";
import { measure, newMeter } from "../scenes/pace";
import { BLEED, BOX_MM, STRAP_UP } from "./frame";

/** One millimetre in the film's units (tag.ts builds the tag at the bag's scale). */
const MM = (TAG_ARM - 0.012) / (TAG_MM.h / 2);
/** From the rail down to the film tag's own pivot (its strap's two strands start there). */
const DROP = STRAP_UP * MM - 0.012;
const FOV = 17;

/** The film's tag, with the rest of its strap: above where its two strands meet, they rise together to the rail. */
function build(k: Kit) {
  k.surface(0, () => band(k, [DROP + 2 * MM, 0], [0, 0], STRAP_INK, STRAP.w * MM, STRAP_T * 2));
  tagBuild(k);
}

type Pointer = { x: number; y: number };

function Tag({ pointer, onFrame }: { pointer: React.RefObject<Pointer>; onFrame: (seconds: number, calls: number) => void }) {
  const swing = useRef<THREE.Group>(null);
  const twist = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const k = new Kit();
    build(k);
    return k.build();
  }, []);
  const look = useMemo(() => tagMaterial(), []);
  useEffect(
    () => () => {
      geo.dispose();
      look.mat.dispose();
    },
    [geo, look],
  );
  const gl = useThree((s) => s.gl);
  const state = useRef({ t: 0, yaw: 0, tilt: 0 });
  useFrame((_, dt) => {
    const s = state.current;
    const step = Math.min(dt, 0.1);
    s.t += step;
    // the motion eases in from rest, where the drawn tag stood
    const amp = Math.min(1, s.t / 2.4) ** 2;
    const p = pointer.current ?? { x: 0, y: 0 };
    s.yaw += (p.x * 0.5 - s.yaw) * Math.min(1, step * 2.2);
    s.tilt += (p.y * 0.12 - s.tilt) * Math.min(1, step * 2.2);
    if (swing.current) swing.current.rotation.set(s.tilt * amp, 0, amp * 0.045 * Math.sin(s.t * 1.15));
    if (twist.current) twist.current.rotation.y = amp * (0.42 * Math.sin(s.t * 0.52) + s.yaw);
    // the gadget is on: a low light breathes behind the holes over the speaker, and the holes stay dark
    tagPerform(look.u, 0, 0, amp * (0.035 + 0.025 * Math.sin(s.t * 1.7)));
    onFrame(dt, gl.info.render.calls);
  });
  return (
    <group ref={swing}>
      <group ref={twist} position={[0, -DROP, 0]}>
        <mesh geometry={geo} material={look.mat} />
      </group>
    </group>
  );
}

// the camera belongs to three, not to React: this places it by name
function place(camera: THREE.PerspectiveCamera, mid: number, dist: number) {
  camera.fov = FOV;
  camera.near = dist * 0.2;
  camera.far = dist * 4;
  camera.position.set(0, mid, dist);
  camera.lookAt(0, mid, 0);
  camera.updateProjectionMatrix();
}

/** Frames the tag so that a millimetre of it is as many pixels as a millimetre of the drawing under it. */
function Frame({ boxPx }: { boxPx: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const pxPerUnit = boxPx / BOX_MM.h / MM;
    // the canvas reaches BLEED.top of the box above the rail and BLEED.bottom below the drawing
    const mid = -(size.height / 2 - BLEED.top * boxPx) / pxPerUnit;
    place(camera, mid, size.height / pxPerUnit / 2 / Math.tan((FOV * Math.PI) / 360));
    invalidate();
  }, [camera, size.height, boxPx, invalidate]);
  return null;
}

export type HeroTagProps = {
  /** the drawn tag's box, in CSS pixels high: the 3D tag is drawn at the same scale */
  boxPx: number;
  playing: boolean;
  sharp: boolean;
  pointer: React.RefObject<Pointer>;
  onReady: () => void;
  /** a two-second average of the frame time, and the draw calls of the last frame */
  onPace: (ms: number, calls: number) => void;
};

export default function HeroTag3D({ boxPx, playing, sharp, pointer, onReady, onPace }: HeroTagProps) {
  const meter = useRef({ pace: newMeter(), drawn: 0 });
  const onFrame = (seconds: number, calls: number) => {
    const m = meter.current;
    // by the third frame two have been drawn, the first of them with the shader's compile: the drawing may give way
    if (++m.drawn === 3) onReady();
    const ms = measure(m.pace, seconds);
    if (ms !== null) onPace(ms, calls);
  };
  return (
    <Canvas
      frameloop={playing ? "always" : "never"}
      dpr={sharp ? [1, 2] : [1, 1.25]}
      camera={{ fov: FOV, position: [0, 0, 2] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.LinearToneMapping, toneMappingExposure: 1 }}
      aria-hidden="true"
      tabIndex={-1}
    >
      <Frame boxPx={boxPx} />
      {/* a warm key from the upper left, as the drawn tag is lit; a cool rim from behind; soft panels for the sheen */}
      <hemisphereLight args={["#f4f1ee", "#17120e", 0.9]} />
      <directionalLight color="#fff8f0" position={[-0.5, 0.7, 1]} intensity={2.7} />
      <directionalLight color="#a9c4ff" position={[0.8, 0.4, -1]} intensity={1.1} />
      <Environment resolution={64} frames={1} environmentIntensity={0.5}>
        <color attach="background" args={["#0d0d0e"]} />
        <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-4, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffeedd" position={[-8, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[8, 6, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#9fb9ff" position={[8, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 6, 1]} />
      </Environment>
      <Tag pointer={pointer} onFrame={onFrame} />
    </Canvas>
  );
}
