"use client";

// The tag in real time, for the hero and for the product viewer: one canvas, one ProductScene (scene.ts), lit by
// one rig (a soft key from the upper left, a cool rim from behind, panels for the sheen: the same in both places).
// It turns on its own, slowly, in whichever look it is drawn; a drag (mouse, pen or finger) or the arrow keys turn
// it by hand, and it goes on turning from where it was left. A part under the pointer can be chosen. The page
// around it decides the look, the pose and what is chosen; this draws it and reports what the pointer does.
//
// Hanging (the hero): the tag hangs by its strap from the rail above it, framed so a millimetre of it is as many
// pixels as a millimetre of the drawn tag under it (hero/frame.ts), and sways a little. Standing free (the viewer):
// it is framed whole, with room for the exploded view.
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { TAG_MM } from "../scenes/film/tagShape";
import { measure, newMeter } from "../scenes/pace";
import { BLEED, BOX_MM, STRAP_UP } from "../hero/frame";
import { MM } from "./build";
import type { Product } from "./model";
import { ProductScene, type Open, type ViewerMode } from "./scene";

const FOV = 17;
const TURN = 0.42; // radians a second: a turn in about fifteen seconds
/** How far the strap's loop rises above the tag standing free, in mm. */
const STRAP_FREE = 24;
const REST_AFTER = 1.4; // seconds after a hand lets go before it turns on its own again

export type Pose = { yaw: number; pitch: number; /** changes when the page asks for this pose again */ key: number };
export type ProductCanvasProps = {
  product: Product;
  mode: ViewerMode;
  /** 0 assembled, 1 pulled apart */
  explode: number;
  open: Open;
  turning: boolean;
  pose: Pose;
  chosen: string | null;
  onChoose?: (ref: string | null) => void;
  onHover?: (ref: string | null) => void;
  /** every net of the schematic drawn at once, part to part */
  wires?: boolean;
  /** a turn, tilt or zoom asked for by a button: `n` changes with each press */
  nudge?: { kind: "left" | "right" | "up" | "down" | "in" | "out"; n: number };
  /** names set on the parts in the picture, each a button that chooses its part */
  labels?: { ref: string; text: string }[];
  /** the hero: the drawn tag's box in CSS pixels high, and the strap rising to the rail; absent, the tag stands free */
  hang?: { boxPx: number };
  /** how far the strap's loop rises above the tag standing free, in mm */
  strapUp?: number;
  playing: boolean;
  sharp: boolean;
  label: string;
  onReady: () => void;
  /** a two-second average of the frame time, and the draw calls of the last frame */
  onPace: (ms: number, calls: number) => void;
  className?: string;
};

/**
 * How the tag stands at this moment and what the hand on it is doing: its turn and tilt, how far it is pulled apart,
 * whether a pointer is down on it. One for each canvas, kept for its life; the frame loop and the pointer both
 * change it by its own methods, so React holds only the handle.
 */
class Turner {
  yaw = 0;
  pitch = 0;
  toPose = true;
  rest = 0;
  down: { x: number; y: number; moved: boolean } | null = null;
  explode = 0;
  coin = 0;
  tracker = 0;
  t = 0;
  drawn = 0;
  /** how much nearer than the whole view the camera stands (1 is the whole tag) */
  zoom = 1;
  camera: THREE.Camera | null = null;
  hovered: string | null = null;
  readonly labels = new Map<string, HTMLElement>();
  readonly leads = new Map<string, SVGLineElement>();

  see(camera: THREE.Camera | null) {
    this.camera = camera;
  }
  label(ref: string, el: HTMLElement | null) {
    if (el) this.labels.set(ref, el);
    else this.labels.delete(ref);
  }
  /** Notes the part under the pointer; true when it is a different one. */
  hover(ref: string | null) {
    const changed = ref !== this.hovered;
    this.hovered = ref;
    return changed;
  }
  askPose() {
    this.toPose = true;
    this.zoom = 1;
  }
  zoomBy(f: number) {
    this.zoom = Math.max(0.6, Math.min(3, this.zoom * f));
    this.rest = 0;
  }
  press(x: number, y: number) {
    this.down = { x, y, moved: false };
  }
  /** A pointer that is down has moved: past a few pixels it is a drag, and turns the tag. */
  drag(x: number, y: number) {
    if (!this.down) return;
    const dx = x - this.down.x;
    const dy = y - this.down.y;
    if (!this.down.moved && Math.hypot(dx, dy) < 5) return;
    this.down = { x, y, moved: true };
    this.turnBy(dx * 0.011, dy * 0.008);
  }
  /** Lets go; true when the pointer never moved (a press, not a drag). */
  release() {
    const was = this.down;
    this.down = null;
    this.rest = 0;
    return !!was && !was.moved;
  }
  turnBy(yaw: number, pitch: number) {
    this.toPose = false;
    this.rest = 0;
    this.yaw += yaw;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + pitch));
  }
  /** One frame on: toward the pose asked for, or round on the turntable, and toward how far apart and open it should be. */
  advance(step: number, p: ProductCanvasProps) {
    this.t += step;
    this.rest += step;
    if (this.toPose) {
      const to = unwound(p.pose.yaw, this.yaw);
      this.yaw = nearer(this.yaw, to, step * 4.5);
      this.pitch = nearer(this.pitch, p.pose.pitch, step * 4.5);
      if (Math.abs(to - this.yaw) < 0.004 && Math.abs(p.pose.pitch - this.pitch) < 0.004) this.toPose = false;
    } else if (!this.down && p.turning && this.rest > REST_AFTER) {
      this.yaw += step * TURN * Math.min(1, (this.rest - REST_AFTER) / 0.8);
      this.pitch = nearer(this.pitch, p.pose.pitch, step * 0.8);
    }
    this.explode = nearer(this.explode, p.explode, step * 5);
    if (Math.abs(this.explode - p.explode) < 0.002) this.explode = p.explode;
    this.coin = nearer(this.coin, p.open === "coin" ? 1 : 0, step * 5);
    this.tracker = nearer(this.tracker, p.open === "tracker" ? 1 : 0, step * 5);
    return ++this.drawn;
  }
  /**
   * Sets the names round the picture, each joined to its part by a line: from left to right they are dealt onto
   * four rows, two above the picture and two below, and spread along each row, so neighbours do not sit on one
   * another.
   */
  place(at: { ref: string; x: number; y: number }[], width: number, height: number) {
    at.sort((a, b) => a.x - b.x);
    const perRow = Math.ceil(at.length / 4);
    at.forEach((p, i) => {
      const el = this.labels.get(p.ref);
      if (!el) return;
      const row = i % 4;
      const above = row % 2 === 0;
      const y = above ? 15 + (row >> 1) * 30 : height - 15 - (row >> 1) * 30;
      const x = ((Math.floor(i / 4) + 0.5 + (row >> 1) * 0.5 - 0.25) / perRow) * (width - 40) + 20;
      el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      const line = this.leads.get(p.ref);
      if (!line) return;
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", String(y + (above ? 11 : -11)));
      line.setAttribute("x2", String(p.x));
      line.setAttribute("y2", String(p.y));
    });
  }
  lead(ref: string, el: SVGLineElement | null) {
    if (el) this.leads.set(ref, el);
    else this.leads.delete(ref);
  }
}

// the camera and the turning group belong to three, not to React: these place them by name
function placeCamera(camera: THREE.PerspectiveCamera, y: number, dist: number) {
  camera.fov = FOV;
  camera.near = dist * 0.2;
  camera.far = dist * 5;
  camera.position.set(0, y, dist);
  camera.lookAt(0, y, 0);
  camera.updateProjectionMatrix();
}
function turnGroup(g: THREE.Group, pitch: number, yaw: number, sway: number) {
  g.rotation.set(pitch, yaw, sway);
}
function castShadow(m: THREE.Mesh, yaw: number, y: number, spread: number) {
  const wide = (Math.abs(Math.cos(yaw)) * TAG_MM.w + Math.abs(Math.sin(yaw)) * TAG_MM.t * 2 + 26) * (1 + spread * 0.5);
  m.scale.set(wide * MM, (TAG_MM.h + 30) * MM, 1);
  m.position.set(5 * MM, y - 7 * MM, -(46 + spread * 40) * MM);
}
const nearer = (from: number, to: number, by: number) => from + (to - from) * Math.min(1, by);
/** The same angle, written within half a turn of `near`, so easing to it goes the short way round. */
const unwound = (a: number, near: number) => a + Math.round((near - a) / (Math.PI * 2)) * Math.PI * 2;

let blob: THREE.CanvasTexture | null = null;
function blobTexture() {
  if (!blob) {
    const c = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
    const g = c.getContext("2d");
    if (g) {
      const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
      grad.addColorStop(0, "rgba(0,0,0,0.6)");
      grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    blob = new THREE.CanvasTexture(c);
  }
  return blob;
}

function Drive({ scene, hand, p }: { scene: ProductScene; hand: Turner; p: ProductCanvasProps }) {
  const turn = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const meter = useRef(newMeter());
  const at = useMemo(() => new THREE.Vector3(), []);
  const pivot = p.hang ? (TAG_MM.h / 2 + STRAP_UP) * MM : 0;

  useEffect(() => {
    hand.see(camera);
    return () => hand.see(null);
  }, [camera, hand]);
  useEffect(() => scene.resize(size.width, size.height), [scene, size.width, size.height]);

  useFrame((_, dt) => {
    const h = hand;
    const drawn = h.advance(Math.min(dt, 0.1), p);
    // hanging, it sways a little on its strap; the gadget's low light breathes behind the speaker's holes
    const sway = p.hang && p.turning ? 0.035 * Math.sin(h.t * 1.15) * Math.min(1, h.t / 2.4) : 0;
    if (turn.current) turnGroup(turn.current, h.pitch, h.yaw, sway);
    scene.pose(h.explode, h.coin, h.tracker, 0.035 + 0.025 * Math.sin(h.t * 1.7));

    if (p.hang) {
      const pxPerUnit = p.hang.boxPx / BOX_MM.h / MM;
      const top = pivot + BLEED.top * BOX_MM.h * MM;
      placeCamera(camera, top - size.height / pxPerUnit / 2, size.height / pxPerUnit / 2 / Math.tan((FOV * Math.PI) / 360));
    } else {
      // whole, with room to turn; pulled apart it is deeper than it is wide
      const loop = (p.strapUp ?? STRAP_FREE) * (1 - h.explode * 0.4);
      const tall = ((TAG_MM.h + loop) / 2 + 9 + 26 * h.explode) * MM;
      const wide = (TAG_MM.w / 2 + 12 + 30 * h.explode) * MM;
      const half = Math.max(tall, wide / Math.max(0.2, size.width / size.height));
      placeCamera(camera, (loop / 2) * MM, half / h.zoom / Math.tan((FOV * Math.PI) / 360));
    }
    if (shadow.current) castShadow(shadow.current, h.yaw, 0, h.explode);

    if (h.labels.size && turn.current) {
      const on: { ref: string; x: number; y: number }[] = [];
      for (const ref of h.labels.keys()) {
        const mid = scene.middle(ref, at);
        if (!mid) continue;
        mid.y -= pivot;
        turn.current.localToWorld(mid).project(camera);
        on.push({ ref, x: ((mid.x + 1) / 2) * size.width, y: ((1 - mid.y) / 2) * size.height });
      }
      h.place(on, size.width, size.height);
    }
    // by the third frame two have been drawn, the first of them with the shaders' compile: the drawing may give way
    if (drawn === 3) p.onReady();
    const ms = measure(meter.current, dt);
    if (ms !== null) p.onPace(ms, gl.info.render.calls);
  });

  return (
    <>
      <group ref={turn} position={[0, pivot, 0]}>
        <group position={[0, -pivot, 0]}>
          <primitive object={scene.root} />
        </group>
      </group>
      {/* the soft shadow it throws on what is behind it */}
      <mesh ref={shadow} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} toneMapped={false} opacity={0.85} />
      </mesh>
    </>
  );
}

export default function ProductCanvas(p: ProductCanvasProps) {
  const { product, mode, chosen, strapUp = STRAP_FREE } = p;
  const hanging = !!p.hang;
  const scene = useMemo(() => new ProductScene(product, hanging ? STRAP_UP + 3 : strapUp, !hanging), [product, hanging, strapUp]);
  useEffect(() => () => scene.dispose(), [scene]);
  useEffect(() => scene.setMode(mode), [scene, mode]);
  useEffect(() => scene.setChosen(chosen), [scene, chosen]);
  useEffect(() => scene.setWires(!!p.wires), [scene, p.wires]);
  const [hand] = useState(() => new Turner());
  // a pose asked for again (a view chosen) is eased to; the first is where it starts
  useEffect(() => hand.askPose(), [hand, p.pose.key]);
  const nudge = p.nudge;
  useEffect(() => {
    if (!nudge || nudge.n === 0) return;
    if (nudge.kind === "in" || nudge.kind === "out") hand.zoomBy(nudge.kind === "in" ? 1.25 : 0.8);
    else hand.turnBy(nudge.kind === "left" ? -0.3 : nudge.kind === "right" ? 0.3 : 0, nudge.kind === "up" ? -0.18 : nudge.kind === "down" ? 0.18 : 0);
  }, [hand, nudge]);

  const pickAt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hand.camera) return null;
    const r = e.currentTarget.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)), hand.camera);
    scene.root.updateWorldMatrix(true, false);
    return scene.pick(ray.ray.applyMatrix4(scene.root.matrixWorld.clone().invert()));
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    hand.press(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hand.down) hand.drag(e.clientX, e.clientY);
    else if (p.onChoose && e.pointerType === "mouse") {
      const ref = pickAt(e);
      if (!hand.hover(ref)) return;
      e.currentTarget.style.cursor = ref ? "pointer" : "grab";
      p.onHover?.(ref);
    }
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hand.release() && p.onChoose) p.onChoose(pickAt(e));
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const by = { ArrowLeft: [-0.26, 0], ArrowRight: [0.26, 0], ArrowUp: [0, -0.16], ArrowDown: [0, 0.16] }[e.key];
    if (e.key === "Home") hand.askPose();
    else if (by) hand.turnBy(by[0]!, by[1]!);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="application"
      aria-label={p.label}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => hand.release()}
      onPointerLeave={() => p.onHover?.(null)}
      onKeyDown={onKey}
      className={`relative h-full w-full cursor-grab touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing ${p.className ?? ""}`}
    >
      <Canvas
        // never less than one and a half device pixels to a pixel while it keeps pace: the grain is fine and shimmers at one
        frameloop={p.playing ? "always" : "never"}
        dpr={p.sharp ? [1.5, 2] : [1, 1.25]}
        camera={{ fov: FOV, position: [0, 0, 2] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.LinearToneMapping, toneMappingExposure: 1 }}
        aria-hidden="true"
        tabIndex={-1}
      >
        {/* a soft key from the upper left, a cool rim from behind, panels for the sheen */}
        <hemisphereLight args={["#f4f1ee", "#17120e", 0.9]} />
        <directionalLight color="#fff8f0" position={[-0.5, 0.7, 1]} intensity={2.7} />
        <directionalLight color="#a9c4ff" position={[0.8, 0.4, -1]} intensity={1.1} />
        <directionalLight color="#ffe9d6" position={[0.6, -0.3, -0.9]} intensity={0.7} />
        <Environment resolution={64} frames={1} environmentIntensity={0.5}>
          <color attach="background" args={["#0d0d0e"]} />
          <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-4, 6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} />
          <Lightformer form="rect" intensity={1.1} color="#ffeedd" position={[-8, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[8, 6, 1]} />
          <Lightformer form="rect" intensity={0.9} color="#9fb9ff" position={[8, 2, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 6, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#ffffff" position={[0, 2, -8]} rotation={[0, 0, 0]} scale={[10, 6, 1]} />
        </Environment>
        <Drive scene={scene} hand={hand} p={p} />
      </Canvas>
      {p.labels ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {p.labels.map((l) => (
            <line key={l.ref} ref={(el) => hand.lead(l.ref, el)} stroke={chosen === l.ref ? "#ff8a3d" : "#ffffff"} strokeOpacity={chosen === l.ref ? 0.95 : 0.45} strokeWidth={1} />
          ))}
        </svg>
      ) : null}
      {p.labels?.map((l) => (
        <button
          key={l.ref}
          type="button"
          ref={(el) => hand.label(l.ref, el)}
          onClick={() => p.onChoose?.(l.ref)}
          aria-pressed={chosen === l.ref}
          className={`absolute left-0 top-0 max-w-[150px] truncate rounded-full border px-2 py-0.5 text-[13px] leading-tight shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${chosen === l.ref ? "border-transparent bg-action text-white" : "border-white/25 bg-black/75 text-white hover:border-dutchOrange"}`}
        >
          {l.text}
        </button>
      ))}
    </div>
  );
}
