"use client";

// The film's kit of parts: the clock every moving thing reads, the builder that turns a whole set into one mesh,
// the lit stage (key, fill, rim, a generated environment, a graded backdrop), and the cast: the suitcase with the
// gadget hanging from its handle, and the deliberately abstract people. Everything is built from primitives; nothing
// is loaded from a file. Each moving piece is given a function of the scene's clock, so a scene is a set of poses
// in time and any moment can be drawn on its own.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";

export type V3 = [number, number, number];
export type Clock = { t: number };
const ClockCtx = createContext<Clock>({ t: 0 });
export const ClockProvider = ClockCtx.Provider;
export const useClock = () => useContext(ClockCtx);

/** The colours every set shares: the bag is cream and the gadget orange in every scene; nothing else may be either. */
export const C = {
  shell: "#ecdcb6",
  rib: "#d3c193",
  orange: "#f0641a",
  ink: "#23262d",
  tyre: "#2f333b",
  steel: "#9aa4b1",
  chrome: "#c9d0d8",
  white: "#f4f5f6",
  red: "#ff4d3d",
  yellow: "#f5c518",
  cone: "#ff8a1f",
  navy: "#1f2f4f",
};

// ---- the builder ------------------------------------------------------------------------------------------------

type Opt = { rot?: V3; r?: number; seg?: number; r2?: number; s?: V3; hs?: number };
/** Which bones a vertex follows, given where it is in the figure: two bones and the weight of the second. */
export type Skin = (x: number, y: number, z: number) => [a: number, b: number, w: number];
const ZERO: V3 = [0, 0, 0];

/**
 * Collects primitives, each with its own flat colour, and merges them into one geometry with vertex colours: a
 * whole set, or a whole figure's costume, is then one draw call. `at` nests a placement, as a group would.
 */
export class Kit {
  private parts: THREE.BufferGeometry[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private skins: Skin[] = [];
  private surfaces: number[] = [];
  private surfaced = false;
  private shading: ((x: number, y: number, z: number) => number) | null = null;

  private place(p: V3, rot: V3 = ZERO, s: V3 = [1, 1, 1]) {
    this.q.setFromEuler(this.e.set(rot[0], rot[1], rot[2]));
    return this.m.compose(new THREE.Vector3(...p), this.q, new THREE.Vector3(...s)).premultiply(this.stack[this.stack.length - 1]!);
  }
  /** Everything added inside `inner` sits at `p`, turned by `rot`. */
  at(p: V3, rot: V3, inner: () => void) {
    this.stack.push(this.place(p, rot).clone());
    inner();
    this.stack.pop();
    return this;
  }
  /** Everything added inside `inner` is bound to bones by `skin` (for a figure built as one skinned mesh). */
  bind(skin: Skin | number, inner: () => void) {
    this.skins.push(typeof skin === "number" ? () => [skin, skin, 0] : skin);
    inner();
    this.skins.pop();
    return this;
  }
  /**
   * Tags everything added inside `inner` as a kind of surface (0 cloth, 1 skin, 2 hard), written per vertex for a
   * shader to tell them apart. Once used, every part of the build carries the tag (cloth unless said otherwise).
   */
  surface(kind: number, inner: () => void) {
    this.surfaced = true;
    this.surfaces.push(kind);
    inner();
    this.surfaces.pop();
    return this;
  }
  /** Darkens every vertex added from now on by `f` of where it is (1 leaves it), for soft shading baked in creases. */
  shade(f: (x: number, y: number, z: number) => number) {
    this.shading = f;
    return this;
  }
  geo(g: THREE.BufferGeometry, c: string, p: V3 = ZERO, o: Opt = {}) {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    flat.deleteAttribute("uv");
    flat.applyMatrix4(this.place(p, o.rot, o.s));
    const pos = flat.getAttribute("position");
    const n = pos.count;
    const col = new THREE.Color(c);
    const a = new Float32Array(n * 3);
    const shade = this.shading;
    for (let i = 0; i < n; i++) {
      const f = shade ? shade(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1;
      a.set([col.r * f, col.g * f, col.b * f], i * 3);
    }
    flat.setAttribute("color", new THREE.BufferAttribute(a, 3));
    if (this.surfaced) flat.setAttribute("surface", new THREE.BufferAttribute(new Float32Array(n).fill(this.surfaces[this.surfaces.length - 1] ?? 0), 1));
    const skin = this.skins[this.skins.length - 1];
    if (skin) {
      const idx = new Uint16Array(n * 4);
      const wt = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const [b0, b1, w] = skin(pos.getX(i), pos.getY(i), pos.getZ(i));
        idx[i * 4] = b0;
        idx[i * 4 + 1] = b1;
        wt[i * 4] = 1 - w;
        wt[i * 4 + 1] = w;
      }
      flat.setAttribute("skinIndex", new THREE.BufferAttribute(idx, 4));
      flat.setAttribute("skinWeight", new THREE.BufferAttribute(wt, 4));
    }
    this.parts.push(flat);
    return this;
  }
  /** A box; with `r` its edges are rounded. */
  box(size: V3, c: string, p: V3 = ZERO, o: Opt = {}) {
    const r = Math.min(o.r ?? 0, Math.min(...size) / 2 - 0.0005);
    return this.geo(r > 0 ? new RoundedBoxGeometry(size[0], size[1], size[2], o.seg ?? 3, r) : new THREE.BoxGeometry(...size), c, p, o);
  }
  /** A cylinder standing on its axis (y): radius `r` at the foot, `r2` at the top. */
  cyl(r: number, h: number, c: string, p: V3 = ZERO, o: Opt = {}) {
    return this.geo(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg ?? 20, o.hs ?? 1), c, p, o);
  }
  ball(r: number, c: string, p: V3 = ZERO, o: Opt = {}) {
    return this.geo(new THREE.SphereGeometry(r, o.seg ?? 18, Math.round((o.seg ?? 18) * 0.7)), c, p, o);
  }
  capsule(r: number, len: number, c: string, p: V3 = ZERO, o: Opt = {}) {
    return this.geo(new THREE.CapsuleGeometry(r, len, 5, o.seg ?? 14, o.hs ?? 1), c, p, o);
  }
  build() {
    const g = this.parts.length ? mergeGeometries(this.parts) : new THREE.BufferGeometry();
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    return g;
  }
}

export function useBuilt(make: (k: Kit) => void) {
  const geo = useMemo(() => {
    const k = new Kit();
    make(k);
    return k.build();
  }, [make]);
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

type MeshProps = Omit<ThreeElements["mesh"], "args" | "ref" | "geometry">;
/** One mesh from a builder function (keep the function at module level, so it is built once). Matte by default. */
export function Built({ make, rough = 0.84, cast = true, receive = true, meshRef, ...p }: MeshProps & { make: (k: Kit) => void; rough?: number; cast?: boolean; receive?: boolean; meshRef?: React.Ref<THREE.Mesh> }) {
  const geo = useBuilt(make);
  return (
    <mesh ref={meshRef} geometry={geo} castShadow={cast} receiveShadow={receive} {...p}>
      <meshStandardMaterial vertexColors roughness={rough} metalness={0} />
    </mesh>
  );
}

/** A group moved by a function of the clock. */
export function A({ f, children, ...p }: Omit<ThreeElements["group"], "ref"> & { f: (g: THREE.Group, t: number) => void; children?: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const clock = useClock();
  useFrame(() => {
    if (ref.current) f(ref.current, clock.t);
  });
  return (
    <group ref={ref} {...p}>
      {children}
    </group>
  );
}

// ---- the stage ----------------------------------------------------------------------------------------------------

/** How a set is lit and graded. Colours are the set's own; the rig is the same everywhere. */
export type Look = {
  /** the backdrop, top to horizon */
  sky: [string, string];
  /** depth haze in the set's tint: colour, where it starts, where it is complete */
  fog: [string, number, number];
  floor: string;
  key: { c: string; i: number; p: V3 };
  fill: { sky: string; ground: string; i: number };
  rim: { c: string; i: number; p: V3 };
  env: number;
  /** half the width of the ground the one shadow covers */
  reach?: number;
};

/** What the stage is doing at a moment, for the one scene whose light changes: 1 is the look as written. */
type Level = { key: number; fill: number; env: number };
const FULL: Level = { key: 1, fill: 1, env: 1 };

function skyGeometry(top: string, horizon: string) {
  const g = new THREE.SphereGeometry(58, 24, 16);
  const pos = g.getAttribute("position");
  const a = new Float32Array(pos.count * 3);
  const up = new THREE.Color(top);
  const low = new THREE.Color(horizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = Math.max(0, Math.min(1, pos.getY(i) / 58 / 0.55));
    c.copy(low).lerp(up, h ** 0.7);
    a.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

/**
 * The lit stage. A large soft key from above and in front casts the one shadow; a hemisphere fills from the
 * backdrop's colours; a rim separates the cast from the set; an environment made of three soft panels (no file)
 * gives every curved thing a top light and a floor bounce. The backdrop is a graded dome, never a void.
 */
export function Stage({ look, level, floor = true }: { look: Look; level?: (t: number) => Level; floor?: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const clock = useClock();
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyGeometry(look.sky[0], look.sky[1]), [look]);
  useEffect(() => () => sky.dispose(), [sky]);
  useFrame(() => {
    const l = level?.(clock.t) ?? FULL;
    if (key.current) key.current.intensity = look.key.i * l.key;
    if (rim.current) rim.current.intensity = look.rim.i * l.key;
    if (fill.current) fill.current.intensity = look.fill.i * l.fill;
    setEnvironment(scene, look.env * l.env, { c: look.rim.c, i: look.rim.i * l.key });
  });
  const reach = look.reach ?? 6.5;
  return (
    <>
      <fog attach="fog" args={look.fog} />
      <mesh geometry={sky} frustumCulled={false} renderOrder={-10}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <hemisphereLight ref={fill} args={[look.fill.sky, look.fill.ground, look.fill.i]} />
      <directionalLight ref={key} color={look.key.c} position={look.key.p} intensity={look.key.i} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006} shadow-normalBias={0.035}>
        <orthographicCamera attach="shadow-camera" args={[-reach, reach, reach * 0.8, -reach * 0.6, 0.5, 30]} />
      </directionalLight>
      <directionalLight ref={rim} color={look.rim.c} position={look.rim.p} intensity={look.rim.i} />
      <Environment resolution={64} frames={1} environmentIntensity={look.env}>
        <color attach="background" args={[look.fill.ground]} />
        {/* a big soft top light, a cool side and a warm side */}
        <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 7, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 10, 1]} />
        <Lightformer form="rect" intensity={1.1} color={look.fill.sky} position={[-8, 3, 2]} rotation={[0, Math.PI / 2, 0]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={1.0} color={look.rim.c} position={[8, 3, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} color={look.sky[1]} position={[0, 3, 9]} rotation={[0, Math.PI, 0]} scale={[14, 6, 1]} />
      </Environment>
      {floor ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[56, 48]} />
          <meshStandardMaterial color={look.floor} roughness={0.92} metalness={0} />
        </mesh>
      ) : null}
    </>
  );
}
// the scene belongs to three, not to React: this changes it by name
function setEnvironment(scene: THREE.Scene, intensity: number, rim?: { c: string; i: number }) {
  scene.environmentIntensity = intensity;
  // the people's rim light takes the set's rim colour and strength from here
  if (rim) scene.userData.rim = rim;
}

let blob: THREE.CanvasTexture | null = null;
function blobTexture() {
  if (!blob) {
    const c = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
    const g = c.getContext("2d");
    if (g) {
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, "rgba(0,0,0,0.62)");
      grad.addColorStop(0.45, "rgba(0,0,0,0.3)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    blob = new THREE.CanvasTexture(c);
  }
  return blob;
}
/** The soft dark patch where something meets the ground: it tightens and darkens as the thing comes down. */
export function Contact({ at, tint = "#1a2233" }: { at: (t: number) => { p: V3; w: number; d: number; o: number }; tint?: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const clock = useClock();
  useFrame(() => {
    const a = at(clock.t);
    ref.current?.position.set(a.p[0], a.p[1] + 0.006, a.p[2]);
    ref.current?.scale.set(a.w, a.d, 1);
    if (mat.current) mat.current.opacity = a.o;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={blobTexture()} color={tint} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---- signs --------------------------------------------------------------------------------------------------------

type Picto = "bag" | "plane" | "claim";
const SIGN_FONT = "'Inter Variable', Inter, system-ui, sans-serif";
function drawPicto(g: CanvasRenderingContext2D, kind: Picto, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.fillStyle = "#16233d";
  g.strokeStyle = "#16233d";
  g.lineWidth = 8;
  g.lineJoin = "round";
  g.lineCap = "round";
  if (kind === "plane") {
    // a plane climbing, seen from above
    g.rotate(-Math.PI / 4);
    g.beginPath();
    g.moveTo(0, -44);
    g.quadraticCurveTo(9, -34, 9, -12);
    g.lineTo(44, 14);
    g.lineTo(44, 24);
    g.lineTo(9, 12);
    g.lineTo(7, 32);
    g.lineTo(18, 41);
    g.lineTo(18, 47);
    g.lineTo(0, 42);
    g.lineTo(-18, 47);
    g.lineTo(-18, 41);
    g.lineTo(-7, 32);
    g.lineTo(-9, 12);
    g.lineTo(-44, 24);
    g.lineTo(-44, 14);
    g.lineTo(-9, -12);
    g.quadraticCurveTo(-9, -34, 0, -44);
    g.fill();
  } else {
    const up = kind === "claim" ? -10 : 0;
    g.beginPath();
    g.roundRect(-30, -18 + up, 60, 46, 8);
    g.fill();
    g.beginPath();
    g.roundRect(-12, -32 + up, 24, 16, 5);
    g.stroke();
    if (kind === "claim") {
      // the belt it rides on
      g.beginPath();
      g.moveTo(-42, 34);
      g.lineTo(42, 34);
      g.stroke();
      [-30, 0, 30].forEach((cx) => {
        g.beginPath();
        g.arc(cx, 44, 4, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  g.restore();
}

/** A way-finding sign: a dark plate, a yellow pictogram block and one word. Generic on purpose: no airline, no brand. */
export function Sign({ text, picto, w = 2.4, h = 0.5, ...p }: Omit<ThreeElements["mesh"], "ref" | "args"> & { text: string; picto: Picto; w?: number; h?: number }) {
  const canvas = useMemo(() => Object.assign(document.createElement("canvas"), { width: Math.round((512 * w) / h), height: 512 }), [w, h]);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => {
    const draw = () => paintSign(canvas, texture, text, picto);
    draw();
    let live = true;
    void document.fonts?.ready.then(() => live && draw());
    return () => {
      live = false;
      texture.dispose();
    };
  }, [canvas, texture, text, picto]);
  return (
    <mesh {...p}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
    </mesh>
  );
}
function paintSign(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, text: string, picto: Picto) {
  const g = canvas.getContext("2d");
  if (!g) return;
  const W = canvas.width;
  g.fillStyle = "#16233d";
  g.fillRect(0, 0, W, 512);
  g.fillStyle = C.yellow;
  g.beginPath();
  g.roundRect(56, 56, 400, 400, 44);
  g.fill();
  drawPicto(g, picto, 256, 256, 330);
  g.fillStyle = "#ffffff";
  g.font = `700 250px ${SIGN_FONT}`;
  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillText(text, 540, 268, W - 600);
  texture.needsUpdate = true;
}

// ---- the suitcase -------------------------------------------------------------------------------------------------

const BW = 0.5;
const BH = 0.7;
const BD = 0.28;
const WHEEL = 0.045;
const BASE = WHEEL * 2 - 0.005;
/** The middle of the bag above its base (it tumbles about this), and where a hand holds it. */
export const BAG_MID = BASE + BH / 2;
export const BAG_HALF = BW / 2;
export const HANDLE_Y = BASE + BH + 0.155;
/** The top of the shell, above its base. */
export const BAG_TOP = BASE + BH;
const TAG_X = 0.075;
/**
 * The gadget: a luggage tag that hangs from the handle on a loop. One set of numbers describes it (width, height,
 * thickness, corner radius, loop length), so the real enclosure's dimensions can be dropped in. It is thick on
 * purpose: it holds a speaker, a board and batteries. The proportions are the owner's own enclosure (a hinged
 * clamshell about 90 by 68 mm, 42 mm thick when closed), shown larger than life so it reads on a stage.
 */
const TAG = { w: 0.17, h: 0.225, t: 0.105, r: 0.03, loop: 0.045 };
/** From the loop's pivot to the middle of the tag: the length of the pendulum. */
const TAG_ARM = TAG.loop + TAG.h / 2;

export type BagPose = {
  p: V3;
  /** turn about the vertical; 0 faces the camera side (+z) */
  yaw?: number;
  /** lean sideways and forward, about the base */
  roll?: number;
  pitch?: number;
  /** squash and stretch, from the base */
  sx?: number;
  sy?: number;
  /** swing from the handle, as when carried */
  hang?: number;
  hangX?: number;
  /** tumble about the middle, as when thrown */
  tumble?: number;
  /** the tag turning on its loop; where it swings is not posed: it is a weight on a loop, and follows the bag */
  tagTwist?: number;
  /** the gadget's own light, 0 to 1 */
  glow?: number;
};

function bagBody(k: Kit) {
  const mid = BAG_MID;
  k.box([BW, BH, BD], C.shell, [0, mid, 0], { r: 0.07, seg: 4 });
  // the moulded ribs of a hard shell
  [-0.17, -0.085, 0.085, 0.17].forEach((x) => k.box([0.02, BH - 0.17, BD + 0.014], C.rib, [x, mid, 0], { r: 0.007, seg: 1 }));
  // the trolley handle: two posts and a grip
  [-0.1, 0.1].forEach((x) => k.cyl(0.012, 0.15, C.steel, [x, BASE + BH + 0.07, -0.03], { seg: 8 }));
  k.box([0.27, 0.036, 0.042], C.ink, [0, HANDLE_Y - 0.012, -0.03], { r: 0.016, seg: 2 });
  k.box([0.16, 0.022, 0.05], C.rib, [-0.08, BASE + BH + 0.008, 0.02], { r: 0.01, seg: 1 });
  // the loop goes round the handle and over the top edge; the tag hangs from it against the front
  k.box([0.03, 0.012, BD / 2 + 0.07], C.ink, [TAG_X, BASE + BH + 0.012, (BD / 2 + 0.01) / 2 - 0.015]);
  k.box([0.034, 0.12, 0.012], C.ink, [TAG_X, HANDLE_Y - 0.07, -0.03]);
  [-0.19, 0.19].forEach((x) =>
    [-0.09, 0.09].forEach((z) => {
      k.box([0.075, 0.034, 0.075], C.steel, [x, BASE - 0.004, z], { r: 0.012, seg: 1 });
      k.cyl(WHEEL, 0.042, C.tyre, [x, WHEEL, z], { rot: [0, 0, Math.PI / 2], seg: 14 });
    }),
  );
}
function tagBody(k: Kit) {
  const { w, h, t, r, loop } = TAG;
  k.box([0.034, loop + 0.03, 0.012], C.ink, [0, -loop / 2, 0]);
  k.at([0, -loop - h / 2, t / 2], ZERO, () => {
    // a hinged clamshell in two colours: the dark base behind (the orange lid is its own mesh, so it can glow)
    k.box([w, h, t * 0.5], "#2b2f38", [0, 0, -t * 0.25], { r: r * 0.8 });
    [-0.3, 0.3].forEach((y) => k.cyl(0.011, h * 0.2, C.ink, [-w / 2 - 0.004, h * y, 0.002], { seg: 8 }));
    k.box([0.05, 0.016, t + 0.004], C.ink, [0, h / 2 - 0.022, 0]);
    // on the back: a round lidded pocket, the size of a coin-shaped tracker
    k.cyl(w * 0.33, 0.01, "#b8480b", [0, -h * 0.12, -t / 2 - 0.006], { rot: [Math.PI / 2, 0, 0], seg: 24 });
  });
}
function tagLid(k: Kit) {
  const { w, h, t, r, loop } = TAG;
  k.box([w, h, t * 0.46], "#ffffff", [0, -loop - h / 2, t / 2 + t * 0.27], { r: r * 0.8 });
}

let tagFace: THREE.CanvasTexture | null = null;
/** The lid's face, drawn once: the name card behind its window, the working name inlaid, the speaker holes. */
function tagFaceTexture() {
  if (!tagFace) {
    const W = 340;
    const H = 450;
    const c = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#f3ecdd";
      g.beginPath();
      g.roundRect(48, 76, W - 96, 108, 10);
      g.fill();
      g.fillStyle = "#8d93a0";
      [100, 128, 156].forEach((y, i) => g.fillRect(70, y, i ? 130 : 180, 9));
      g.fillStyle = "#fff3e2";
      g.font = `800 34px ${SIGN_FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("BAGGAGE CLAIMS", W / 2, 228, W - 44);
      g.fillStyle = "#23262d";
      [-1.5, -0.5, 0.5, 1.5].forEach((gx) =>
        [-1, 0, 1].forEach((gy) => {
          g.beginPath();
          g.arc(W / 2 + gx * 52, 346 + gy * 52, 17, 0, Math.PI * 2);
          g.fill();
        }),
      );
    }
    tagFace = new THREE.CanvasTexture(c);
    tagFace.colorSpace = THREE.SRGBColorSpace;
    tagFace.anisotropy = 4;
  }
  return tagFace;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const STEP_MS = 1000 / 110;
const PREROLL_MS = 2600;

/**
 * The suitcase. Its pose is a function of the clock. The gadget is not posed: it is a weight on a short loop, and
 * swings from wherever the bag takes its handle (a damped pendulum, stepped at a fixed rate and re-run from a few
 * seconds back whenever the film is cut to a new moment, so a held frame shows the same swing the film would).
 * `time` is the scene's own time, for a scene that stops it; `gravity` is how hard the tag is pulled down.
 */
export function Bag({ pose, voice, lamp = 0, time, gravity = 9.8, children }: { pose: (t: number) => BagPose; voice?: (t: number) => { level: number; on: number }; lamp?: number; time?: (t: number) => number; gravity?: number; children?: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const tumble = useRef<THREE.Group>(null);
  const hang = useRef<THREE.Group>(null);
  const lean = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const grilleMat = useRef<THREE.MeshBasicMaterial>(null);
  const lid = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const clock = useClock();
  const body = useBuilt(bagBody);
  const tagGeo = useBuilt(tagBody);
  const lidGeo = useBuilt(tagLid);
  const state = useRef<{ t: number; p: THREE.Vector3; was: THREE.Vector3; a: THREE.Vector3; d: THREE.Vector3; inv: THREE.Matrix4 } | null>(null);

  useFrame(() => {
    const g = root.current;
    const pivot = anchor.current;
    const frame = lean.current;
    if (!g || !pivot || !frame || !tag.current) return;
    const sim = (state.current ??= { t: NaN, p: new THREE.Vector3(), was: new THREE.Vector3(), a: new THREE.Vector3(), d: new THREE.Vector3(), inv: new THREE.Matrix4() });
    const place = (t: number) => {
      const q = pose(t);
      g.position.set(q.p[0], q.p[1], q.p[2]);
      g.rotation.set(0, q.yaw ?? 0, 0);
      tumble.current?.rotation.set(0, 0, q.tumble ?? 0);
      hang.current?.rotation.set(q.hangX ?? 0, 0, q.hang ?? 0);
      frame.rotation.set(q.pitch ?? 0, 0, q.roll ?? 0);
      frame.scale.set(q.sx ?? 1, q.sy ?? 1, q.sx ?? 1);
      g.updateWorldMatrix(true, true);
      pivot.getWorldPosition(sim.a);
      return q;
    };
    const now = clock.t;
    const own = time ?? ((t: number) => t);
    // a cut, a seek or the first frame: run the pendulum up to this moment from a few seconds before it
    let from = sim.t;
    if (!(now >= from) || now - from > 400) {
      from = Math.max(0, now - PREROLL_MS);
      place(from);
      sim.p.copy(sim.a).addScaledVector(DOWN, TAG_ARM);
      sim.was.copy(sim.p);
    }
    for (let t = from + STEP_MS; t < now; t += STEP_MS) swingTo(t);
    const q = swingTo(now);
    sim.t = now;
    // point the tag down the loop, in the bag's own frame
    sim.inv.copy(frame.matrixWorld).invert();
    sim.d.copy(sim.p).applyMatrix4(sim.inv).sub(pivot.position).normalize();
    tag.current.quaternion.setFromUnitVectors(DOWN, sim.d);
    tag.current.rotateY(q.tagTwist ?? 0);

    // the gadget performs its line: the grille pulses with each syllable, the lamp follows the voice, and it leans
    // toward us while it speaks (and swells a hair on each syllable)
    const v = voice?.(now) ?? { level: 0, on: 0 };
    ring.current?.scale.setScalar(1 + 0.1 * v.on + 0.38 * v.level);
    if (ringMat.current) ringMat.current.opacity = 0.2 * v.on + 0.6 * v.level;
    if (grilleMat.current) grilleMat.current.opacity = 0.32 * v.level;
    tag.current.rotateX(-0.16 * v.on);
    tag.current.scale.setScalar(1 + 0.035 * v.level);
    const glow = (q.glow ?? 0) + 0.12 * v.on + 0.45 * v.level;
    if (lid.current) lid.current.emissiveIntensity = 0.06 + glow * 0.75;
    if (light.current) light.current.intensity = glow * lamp;

    function swingTo(t: number) {
      const dt = (own(t) - own(t - STEP_MS)) / 1000;
      const q2 = place(t);
      if (dt <= 0) {
        // the scene's time is stopped: the tag hangs where it was, in the air
        return q2;
      }
      const keep = Math.exp(-2.1 * dt);
      sim.d.subVectors(sim.p, sim.was).multiplyScalar(keep);
      sim.was.copy(sim.p);
      sim.p.add(sim.d);
      sim.p.y -= gravity * dt * dt;
      // the loop holds it at arm's length; the shell stops it swinging through the bag
      sim.inv.copy(frame!.matrixWorld).invert();
      sim.d.copy(sim.p).applyMatrix4(sim.inv).sub(pivot!.position);
      if (sim.d.z < 0.004) sim.d.z = 0.004;
      sim.d.add(pivot!.position).applyMatrix4(frame!.matrixWorld);
      sim.d.sub(sim.a).setLength(TAG_ARM);
      sim.p.copy(sim.a).add(sim.d);
      return q2;
    }
  });

  const { w, h, t, loop } = TAG;
  const face = t / 2 + t * 0.5 + 0.0015;
  return (
    <group ref={root}>
      <group position={[0, BAG_MID, 0]}>
        <group ref={tumble}>
          <group position={[0, HANDLE_Y - BAG_MID, 0]}>
            <group ref={hang}>
              <group position={[0, -HANDLE_Y, 0]}>
                <group ref={lean}>
                  <mesh geometry={body} castShadow receiveShadow>
                    <meshStandardMaterial vertexColors roughness={0.62} metalness={0} />
                  </mesh>
                  {children}
                  <group ref={anchor} position={[TAG_X, BASE + BH + 0.01, BD / 2 + 0.012]}>
                    <group ref={tag}>
                      <mesh geometry={tagGeo} castShadow>
                        <meshStandardMaterial vertexColors roughness={0.7} metalness={0} />
                      </mesh>
                      <mesh geometry={lidGeo} castShadow>
                        <meshStandardMaterial ref={lid} color={C.orange} roughness={0.5} metalness={0} emissive={C.orange} emissiveIntensity={0.06} />
                      </mesh>
                      <mesh position={[0, -loop - h / 2, face]}>
                        <planeGeometry args={[w * 0.94, h * 0.94]} />
                        <meshBasicMaterial map={tagFaceTexture()} transparent toneMapped={false} depthWrite={false} />
                      </mesh>
                      <mesh ref={ring} position={[0, -loop - h / 2 - h * 0.27, face + 0.006]}>
                        <torusGeometry args={[w * 0.3, 0.007, 6, 28]} />
                        <meshBasicMaterial ref={ringMat} color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} />
                      </mesh>
                      <mesh position={[0, -loop - h / 2 - h * 0.27, face + 0.003]}>
                        <circleGeometry args={[w * 0.29, 28]} />
                        <meshBasicMaterial ref={grilleMat} color="#ffd9b0" transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
                      </mesh>
                      {lamp > 0 ? <pointLight ref={light} color="#ff8a3d" intensity={0} distance={1.5} decay={2} position={[0, -loop - h / 2, 0.32]} /> : null}
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** Other people's luggage, added to a builder: plainly shaped, in the set's colours, no gadget. Stands on (0, 0, 0). */
export type BagKind = "case" | "duffel" | "box" | "tall" | "round";
export function luggage(k: Kit, kind: BagKind, c: string, p: V3 = ZERO, yaw = 0) {
  const dark = "#2a2e36";
  k.at(p, [0, yaw, 0], () => {
    if (kind === "case") {
      k.box([0.62, 0.42, 0.24], c, [0, 0.21, 0], { r: 0.06 });
      k.box([0.2, 0.03, 0.04], dark, [0, 0.445, 0], { r: 0.012, seg: 1 });
      k.box([0.63, 0.03, 0.245], dark, [0, 0.21, 0]);
    } else if (kind === "duffel") {
      k.capsule(0.16, 0.42, c, [0, 0.16, 0], { rot: [0, 0, Math.PI / 2] });
      [-0.12, 0.12].forEach((x) => k.box([0.05, 0.335, 0.33], dark, [x, 0.16, 0], { r: 0.02, seg: 1 }));
    } else if (kind === "box") {
      k.box([0.48, 0.36, 0.36], c, [0, 0.18, 0], { r: 0.015, seg: 1 });
      k.box([0.07, 0.365, 0.365], "#e9e2d0", [0, 0.18, 0]);
    } else if (kind === "round") {
      k.box([0.46, 0.5, 0.26], c, [0, 0.25, 0], { r: 0.12 });
      k.box([0.16, 0.03, 0.04], dark, [0, 0.52, 0], { r: 0.012, seg: 1 });
    } else {
      k.box([0.4, 0.6, 0.24], c, [0, 0.34, 0], { r: 0.06 });
      k.box([0.18, 0.03, 0.04], dark, [0, 0.68, 0], { r: 0.012, seg: 1 });
      k.box([0.3, 0.2, 0.02], dark, [0, 0.25, 0.125], { r: 0.008, seg: 1 });
    }
  });
}

/** A luggage trolley, added to a builder. Stands on (0, 0, 0), pushed toward -x. */
export function trolley(k: Kit, p: V3, yaw = 0) {
  k.at(p, [0, yaw, 0], () => {
    k.box([0.95, 0.04, 0.58], C.chrome, [0, 0.2, 0], { r: 0.015, seg: 1 });
    k.box([0.04, 0.9, 0.04], C.chrome, [0.46, 0.63, -0.26]);
    k.box([0.04, 0.9, 0.04], C.chrome, [0.46, 0.63, 0.26]);
    k.box([0.05, 0.05, 0.6], C.ink, [0.5, 1.07, 0], { r: 0.02, seg: 1 });
    k.box([0.03, 0.36, 0.5], C.chrome, [0.44, 0.52, 0]);
    k.box([0.04, 0.16, 0.56], C.chrome, [-0.46, 0.3, 0], { r: 0.012, seg: 1 });
    [-0.36, 0.4].forEach((x) => [-0.24, 0.24].forEach((z) => k.cyl(0.075, 0.04, C.tyre, [x, 0.075, z], { rot: [Math.PI / 2, 0, 0], seg: 12 })));
  });
}

/** A puff of dust: a ring of pale blobs that swell and fade, drawn as one instanced mesh. `progress` runs 0 to 1. */
export function Dust({ at, progress, c = "#f1ede4", size = 1, strength = 0.7 }: { at: V3; progress: (t: number) => number; c?: string; size?: number; strength?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const m = useMemo(() => new THREE.Object3D(), []);
  const clock = useClock();
  const N = 11;
  useFrame(() => {
    const p = progress(clock.t);
    const g = ref.current;
    if (!g) return;
    g.visible = p > 0 && p < 1;
    if (!g.visible) return;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.4;
      const out = 0.2 + 0.95 * (1 - (1 - p) ** 2.4) * (0.8 + (i % 3) * 0.14);
      m.position.set(Math.cos(a) * out, 0.06 + 0.3 * p * (0.6 + (i % 2) * 0.6), Math.sin(a) * out * 0.55);
      const s = (0.5 + 1.0 * p) * (0.75 + (i % 4) * 0.14) * (1 - p * 0.35);
      m.scale.set(s, s * 0.7, s);
      m.updateMatrix();
      g.setMatrixAt(i, m.matrix);
    }
    g.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = strength * (1 - p) ** 1.3;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} position={at} scale={size} visible={false} frustumCulled={false}>
      <sphereGeometry args={[0.13, 10, 8]} />
      <meshBasicMaterial ref={mat} color={c} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * One shot: where the camera is and what it looks at, from `at` until the next shot. A pair is a slow move.
 * `rise` lifts the picture in the frame (a lens shift, as a fraction of the frame's height), so the subject sits
 * clear of the subtitle band. `ease` shapes the move (linear when left out).
 */
export type Shot = { at: number; to?: number; pos: V3 | [V3, V3]; look: V3 | [V3, V3]; fov?: number | [number, number]; rise?: number; ease?: "lin" | "io" | "out" | "soft"; follow?: (t: number) => { pos: V3; look: V3 } };
/** A scene as the film plays it: its set, its shots, and (for the thud) how hard the camera is shaken at a moment. */
export type Staged = { Set: () => React.JSX.Element; shots: Shot[]; shake?: (t: number) => number };
