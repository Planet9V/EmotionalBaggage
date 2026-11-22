"use client";

// Two indoor scenes. The dark hold (script 1:10): the one low-key scene. The bag on a black cart among nets and
// stacked luggage; the door shuts, one cool shaft is left, and the gadget's own glow is the brightest thing there.
// Nothing moves for longer than is comfortable. The carousel (script 1:20): a warm white hall, a dark oval belt of
// overlapping slats, the bag coming out through the flaps and round the bend leaning into the turn, and a stranger
// who wants to know where it came from.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { bagSpeaking, sceneOf } from "../scenes";
import { bump, clamp01, kf } from "./ease";
import { A, Bag, Built, C, Contact, Figure, Sign, Stage, luggage, trolley, useClock, type BagKind, type BagPose, type FigPose, type Kit, type Look, type Shot, type Staged, type V3 } from "./kit";

// ---- the dark hold --------------------------------------------------------------------------------------------

const HOLD = sceneOf("hold");
const DARK_FROM = 900;
const DARK = 1500;
const DECK = 0.5;
const dark = (t: number) => kf(t, [[DARK_FROM, 0], [DARK, 1, "in"]]);

const HOLD_LOOK: Look = {
  sky: ["#05080f", "#0a1120"],
  fog: ["#070b15", 7, 22],
  floor: "#1b2438",
  key: { c: "#a9c6ff", i: 1.3, p: [2.2, 5.5, 4.6] },
  fill: { sky: "#2c3d63", ground: "#080b12", i: 0.5 },
  rim: { c: "#6d8fd0", i: 0.35, p: [-4, 3, -5] },
  env: 0.07,
  reach: 5,
};

function holdBag(t: number): BagPose {
  const droop = kf(t, [[8300, 0], [9100, 0.6], [9400, 0.6], [10300, 1]]);
  return {
    p: [0, DECK, 0],
    // it looks one way, then the other, then gives up and slumps
    yaw: kf(t, [[4650, 0], [5000, 0.4], [5750, 0.4], [6150, -0.45], [6950, -0.45], [7400, 0]]),
    sy: 1 + 0.035 * bump(t, 4650, 5600) - 0.07 * droop,
    sx: 1 + 0.03 * droop,
    pitch: 0.12 * droop,
    roll: 0.06 * droop,
    glow: dark(t) * (0.75 + 0.2 * Math.sin(t / 700)),
  };
}

let zed: THREE.CanvasTexture | null = null;
function zedTexture() {
  if (!zed) {
    const c = Object.assign(document.createElement("canvas"), { width: 96, height: 96 });
    const g = c.getContext("2d");
    if (g) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 13;
      g.lineJoin = "round";
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(22, 22);
      g.lineTo(74, 22);
      g.lineTo(22, 74);
      g.lineTo(74, 74);
      g.stroke();
    }
    zed = new THREE.CanvasTexture(c);
  }
  return zed;
}
let shaft: THREE.CanvasTexture | null = null;
/** The shaft of light, as a soft-edged wash: brightest down its middle and near the top. */
function shaftTexture() {
  if (!shaft) {
    const c = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
    const g = c.getContext("2d");
    if (g) {
      const across = g.createLinearGradient(0, 0, 128, 0);
      across.addColorStop(0, "rgba(255,255,255,0)");
      across.addColorStop(0.5, "rgba(255,255,255,1)");
      across.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = across;
      g.fillRect(0, 0, 128, 128);
      g.globalCompositeOperation = "destination-in";
      const down = g.createLinearGradient(0, 0, 0, 128);
      down.addColorStop(0, "rgba(0,0,0,0.9)");
      down.addColorStop(0.75, "rgba(0,0,0,0.35)");
      down.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = down;
      g.fillRect(0, 0, 128, 128);
    }
    shaft = new THREE.CanvasTexture(c);
  }
  return shaft;
}
function Z({ i }: { i: number }) {
  const start = 9900 + i * 520;
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  return (
    <A
      f={(g, t) => {
        const p = (t - start) / 1900;
        g.visible = p > 0 && p < 1;
        g.position.set(0.42 + 0.26 * p + 0.05 * i, DECK + 0.62 + 0.36 * p, 0.25);
        g.scale.setScalar(0.16 + 0.14 * p + 0.035 * i);
        g.rotation.z = 0.2 * Math.sin(p * 4 + i);
        if (mat.current) mat.current.opacity = Math.min(1, p * 5) * (1 - p) ** 0.8;
      }}
      visible={false}
    >
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={mat} map={zedTexture()} color="#cfdcf7" transparent opacity={0} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </A>
  );
}

const DIM = ["#2c3854", "#35304a", "#2a3d44", "#3a3340", "#27324a", "#3a3a30"];
function hold(k: Kit) {
  // floor tracks, with their rollers
  [-1.9, -0.62, 0.62, 1.9].forEach((x) => {
    k.box([0.09, 0.03, 16], "#2d3a58", [x, 0.015, -2]);
    for (let z = -8; z <= 4; z += 0.5) k.cyl(0.035, 0.12, "#40507a", [x, 0.04, z], { rot: [0, 0, Math.PI / 2], seg: 8 });
  });
  // the hull: ribs overhead, lining panels along the sides, a bulkhead at the back
  for (let z = -7; z <= 3; z += 1.5) k.geo(new THREE.TorusGeometry(3.5, 0.09, 6, 28, Math.PI), "#27324c", [0, -0.2, z]);
  [-1, 1].forEach((s) => {
    k.box([0.12, 1.7, 14], "#161e30", [s * 3.25, 0.85, -2], { rot: [0, 0, s * -0.16] });
    k.box([0.1, 0.16, 14], "#33415f", [s * 3.12, 1.72, -2]);
  });
  k.box([9, 5, 0.2], "#121929", [0, 2.2, -7.2]);
  // the cargo net across the hold, behind the cart: diamonds of webbing between two posts
  const NET_Z = -2.6;
  for (let i = -8; i <= 8; i++) {
    k.box([0.03, 4.4, 0.02], "#44557c", [i * 0.42, 1.45, NET_Z], { rot: [0, 0, 0.62] });
    k.box([0.03, 4.4, 0.02], "#44557c", [i * 0.42, 1.45, NET_Z + 0.02], { rot: [0, 0, -0.62] });
  }
  k.box([7, 0.06, 0.05], "#55678f", [0, 2.95, NET_Z]);
  k.box([7, 0.06, 0.05], "#55678f", [0, 0.05, NET_Z]);
  // other people's bags: stacked behind the net, and strapped down each side
  const stack: [BagKind, number, number, number, number][] = [
    ["case", -2.2, 0, -3.5, 0.2], ["case", -2.15, 0.44, -3.5, -0.1], ["box", -2.2, 0.88, -3.5, 0.1], ["tall", -1.3, 0, -3.6, 0.1], ["duffel", -1.3, 0.72, -3.6, 0.1],
    ["box", -0.5, 0, -3.5, 0], ["case", -0.45, 0.38, -3.5, 0.15], ["round", 0.3, 0, -3.6, -0.1], ["case", 1.0, 0, -3.5, 0.1], ["duffel", 1.0, 0.44, -3.5, 0],
    ["tall", 1.8, 0, -3.6, -0.15], ["box", 2.4, 0, -3.4, 0.2], ["case", 2.35, 0.38, -3.4, 0], ["tall", -2.55, 0, -0.9, 0.5], ["case", -2.45, 0, 0.3, 1.2],
    ["duffel", -2.4, 0.44, 0.3, 1.3], ["round", 2.5, 0, -0.9, -0.4], ["case", 2.45, 0, 0.4, -1.3], ["box", 2.5, 0.44, 0.4, -1.2],
  ];
  stack.forEach(([kind, x, y, z, yaw], i) => luggage(k, kind, DIM[i % DIM.length]!, [x, y, z], yaw));
  // the black luggage cart
  k.box([1.9, 0.09, 1.05], "#161b28", [0, DECK - 0.045, 0], { r: 0.02, seg: 1 });
  k.box([1.94, 0.03, 1.09], "#4a5c86", [0, DECK - 0.1, 0]);
  k.box([0.05, 0.62, 1.05], "#161b28", [-0.93, DECK + 0.3, 0]);
  k.box([0.06, 0.06, 1.09], "#33415f", [-0.93, DECK + 0.63, 0]);
  k.box([0.8, 0.04, 0.04], "#33415f", [1.3, 0.34, 0]);
  [-0.62, 0.62].forEach((x) => [-0.5, 0.5].forEach((z) => k.cyl(0.19, 0.09, "#0d1018", [x, 0.19, z], { rot: [Math.PI / 2, 0, 0], seg: 14 })));
}

function HoldSet() {
  return (
    <>
      {/* before the door shuts there is still daylight in here; after, the look as written */}
      <Stage look={HOLD_LOOK} level={(t) => ({ key: 1 + 1.3 * (1 - dark(t)), fill: 1 + 4.5 * (1 - dark(t)), env: 1 + 6 * (1 - dark(t)) })} />
      <Built make={hold} cast={false} />
      {/* the one cool shaft that is left: a seam of light from above */}
      <mesh position={[1.05, 2.9, -0.4]} rotation={[0, 0, 0.34]}>
        <planeGeometry args={[3.4, 6.6]} />
        <meshBasicMaterial map={shaftTexture()} color="#8fb2ff" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </mesh>
      {/* the door's light, closing */}
      <A f={(g, t) => void g.scale.set(1, 1, Math.max(0.001, 1 - kf(t, [[400, 0], [DARK_FROM + 300, 1]])))} position={[-3.3, 1.25, 2.2]}>
        <mesh position={[0, 0, -0.7]}>
          <boxGeometry args={[0.05, 2.2, 1.4]} />
          <meshBasicMaterial color="#ffe9c4" toneMapped={false} fog={false} />
        </mesh>
      </A>
      <Contact at={() => ({ p: [0, DECK, 0], w: 0.85, d: 0.55, o: 0.55 })} tint="#000000" />
      <Bag pose={holdBag} speaking={(t) => bagSpeaking(HOLD, t)} lamp />
      {[0, 1, 2].map((i) => (
        <Z key={i} i={i} />
      ))}
    </>
  );
}

export const HoldScene: Staged = { Set: HoldSet, shots: [
  { at: 0, to: 1500, pos: [[1.0, 1.55, 7.4], [0.8, 1.5, 6.8]], look: [0, 1.0, 0], rise: 0.1 },
  // one very slow push-in, for as long as the scene lasts
  { at: 1500, pos: [[0.2, 1.3, 6.6], [0, 1.18, 4.1]], look: [[0, 1.0, 0], [0.04, 1.02, 0]], rise: 0.17 },
] satisfies Shot[] };

// ---- the carousel ---------------------------------------------------------------------------------------------

const CAROUSEL = sceneOf("carousel");
/** The belt is a stadium: two straights of 2 x HS joined by half circles of radius R (to the belt's middle). */
const HS = 1.6;
const R = 1.45;
const WIDTH = 0.92;
const ARC = Math.PI * R;
const LOOP = 4 * HS + 2 * ARC;
const TOP = 0.42;
const LAP = 8400;
const SPEED = LOOP / LAP;
/** Where our bag is along the belt (metres from the start of the back straight): mid-bend as the gadget wakes. */
const along = (t: number) => 5.0 + (t - 3600) * SPEED;

type Spot = { x: number; z: number; nx: number; nz: number; bend: number };
/** A point on the belt's middle line, the way out from the island there, and how far into a bend it is (0 to 1). */
function spot(s: number): Spot {
  let d = ((s % LOOP) + LOOP) % LOOP;
  const edge = (a: number) => clamp01(Math.min(a, ARC - a) / 0.7);
  if (d < 2 * HS) return { x: -HS + d, z: -R, nx: 0, nz: -1, bend: 0 };
  d -= 2 * HS;
  if (d < ARC) {
    const th = -Math.PI / 2 + d / R;
    return { x: HS + R * Math.cos(th), z: R * Math.sin(th), nx: Math.cos(th), nz: Math.sin(th), bend: edge(d) };
  }
  d -= ARC;
  if (d < 2 * HS) return { x: HS - d, z: R, nx: 0, nz: 1, bend: 0 };
  d -= 2 * HS;
  const th = Math.PI / 2 + d / R;
  return { x: -HS + R * Math.cos(th), z: R * Math.sin(th), nx: Math.cos(th), nz: Math.sin(th), bend: edge(d) };
}

const HALL: Look = {
  sky: ["#efe4d2", "#fbf6ee"],
  fog: ["#f8f1e6", 13, 42],
  floor: "#ddd0bb",
  key: { c: "#fff1da", i: 2.6, p: [3.5, 9, 6] },
  fill: { sky: "#fff5e4", ground: "#c4b59c", i: 0.55 },
  rim: { c: "#cfe2ff", i: 0.8, p: [-5, 4, -6] },
  env: 0.36,
  reach: 7,
};

function rideBag(t: number): BagPose {
  const at = spot(along(t));
  const joy = kf(t, [[CAROUSEL.litAt - 500, 0], [CAROUSEL.litAt + 300, 1]]);
  const hops = bump(t, 4800, 5120) + bump(t, 5300, 5620);
  const squat = bump(t, 4700, 4800) + bump(t, 5200, 5300) + bump(t, 5120, 5200) + bump(t, 5620, 5720);
  return {
    p: [at.x, TOP + 0.02 + 0.18 * hops, at.z],
    yaw: Math.atan2(at.nx, at.nz),
    // leaning into the turn, like a kid on a ride
    pitch: -joy * (0.07 + 0.2 * at.bend + 0.04 * Math.sin(t / 210)),
    roll: joy * (0.1 * Math.sin(t / 290) - 0.1 * at.bend),
    sy: 1 - 0.1 * squat + 0.06 * hops,
    sx: 1 + 0.07 * squat,
  };
}

const STRANGER: V3 = [-4.15, 0, 1.0];
const STRANGER_YAW = 1.75;
const HOST: V3 = [3.9, 0, -3.4];
const HOST_YAW = -0.35;
/** How far a head has to turn, from a body facing `yaw`, to look at the bag. */
function toward(from: V3, yaw: number, t: number) {
  const b = rideBag(t).p;
  const turn = Math.atan2(b[0] - from[0], b[2] - from[2]) - yaw;
  return Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(turn), Math.cos(turn))));
}
function stranger(t: number): FigPose {
  const watching = kf(t, [[6300, 0], [6900, 1]]);
  const ask = kf(t, [[8100, 0], [8500, 1]]);
  return {
    p: STRANGER,
    yaw: STRANGER_YAW,
    head: watching * toward(STRANGER, STRANGER_YAW, t),
    lean: 0.1 * ask,
    // one hand comes up, pointing after it
    handR: ask > 0 ? [STRANGER[0] + 0.5 * ask, 0.8 + 0.42 * ask, STRANGER[2] + 0.3 - 0.45 * ask] : null,
  };
}
function host(t: number): FigPose {
  // filming it, and following it round with the phone
  const turn = toward(HOST, HOST_YAW, t);
  const a = HOST_YAW + turn * 0.6;
  return { p: HOST, yaw: HOST_YAW, head: turn * 0.8, handR: [HOST[0] + 0.42 * Math.sin(a), 1.52, HOST[2] + 0.42 * Math.cos(a)] };
}

/** A stadium-shaped slab: half the straight is `HS`, the ends have radius `r`. */
function stadium(k: Kit, r: number, h: number, c: string, y: number) {
  k.box([2 * HS, h, 2 * r], c, [0, y, 0]);
  [-HS, HS].forEach((x) => k.cyl(r, h, c, [x, y, 0], { seg: 40 }));
}
const TUNNEL = { x0: -1.5, x1: -0.1 };
function hall(k: Kit) {
  // the hall: a warm white wall with a timber band, columns, and the floor's inlay under the belt
  k.box([34, 6.5, 0.3], "#f7f2e9", [0, 3.25, -7]);
  k.box([34, 1.2, 0.34], "#e2cfae", [0, 0.6, -6.99]);
  k.box([34, 0.5, 0.34], "#cfe0ee", [0, 4.6, -6.99]);
  [-8.5, -4.5, 4.5, 8.5].forEach((x) => k.cyl(0.3, 6.5, "#fbf8f2", [x, 3.25, -5.2], { seg: 20 }));
  stadium(k, R + 1.5, 0.006, "#e3d8c5", 0.003);
  // the carousel: a steel skirt, a dark bumper rail, the bed the slats run on, the island in the middle
  stadium(k, R + WIDTH / 2 + 0.1, 0.34, "#cfd5dc", 0.17);
  stadium(k, R + WIDTH / 2 + 0.13, 0.06, "#2a2e36", 0.36);
  stadium(k, R + WIDTH / 2 + 0.02, 0.04, "#1d2026", TOP - 0.03);
  stadium(k, R - WIDTH / 2, 0.34, "#b9c1cb", TOP + 0.12);
  stadium(k, R - WIDTH / 2 + 0.03, 0.05, "#2a2e36", TOP + 0.3);
  stadium(k, R - WIDTH / 2 - 0.08, 0.03, "#d5dbe2", TOP + 0.33);
  // where bags come out: a housing over the back straight, fed from the wall
  const mid = (TUNNEL.x0 + TUNNEL.x1) / 2;
  const len = TUNNEL.x1 - TUNNEL.x0;
  k.box([len, 0.16, WIDTH + 0.5], "#f1ebe1", [mid, TOP + 1.12, -R], { r: 0.05, seg: 2 });
  [-1, 1].forEach((s) => k.box([len, 1.1, 0.12], "#f1ebe1", [mid, TOP + 0.55, -R + s * (WIDTH / 2 + 0.19)], { r: 0.04, seg: 1 }));
  k.box([len - 0.2, 1.0, 4.6], "#e9e1d4", [mid, TOP + 0.62, -R - 2.9], { r: 0.05, seg: 1 });
  [TUNNEL.x0, TUNNEL.x1].forEach((x) => k.box([0.05, 0.1, WIDTH + 0.3], C.yellow, [x, TOP + 0.99, -R]));
  // the way in keeps its flaps closed (the way out is hinged, and moves)
  for (let i = 0; i < 6; i++) k.box([0.03, 0.9, 0.14], "#23262d", [TUNNEL.x0 - 0.01, TOP + 0.5, -R - 0.39 + i * 0.156]);
  // the sign's hangers and plate
  [-1.3, 1.3].forEach((x) => k.cyl(0.015, 2.6, "#aab4c0", [x + 0.2, 4.3, -0.3], { seg: 6 }));
  k.box([4.0, 0.68, 0.08], "#16233d", [0.2, 2.75, -0.3], { r: 0.03, seg: 1 });
  // floor joints, and a long window high in the wall
  for (let x = -16; x <= 16; x += 2) k.box([0.03, 0.003, 14], "#cbbda6", [x, 0.0015, 0]);
  for (let z = -6; z <= 7; z += 2) k.box([34, 0.003, 0.03], "#cbbda6", [0, 0.0015, z]);
  // a trolley waiting
  trolley(k, [5.3, 0, -0.4], 2.6);
  luggage(k, "case", "#3d6fb6", [5.3, 0.22, -0.4], 2.6 + Math.PI / 2);
}

const SLATS = 66;
const TONES = ["#2e333c", "#4b5260"].map((c) => new THREE.Color(c));
/** The belt: overlapping slats that travel round the stadium, as one instanced mesh. Two tones, so it reads as moving. */
function Slats() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Object3D(), []);
  const clock = useClock();
  const painted = useRef(false);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (!painted.current) {
      for (let i = 0; i < SLATS; i++) g.setColorAt(i, TONES[i % 2]!);
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
      painted.current = true;
    }
    const s0 = along(clock.t);
    for (let i = 0; i < SLATS; i++) {
      const at = spot(s0 + (i / SLATS) * LOOP);
      m.position.set(at.x, TOP, at.z);
      m.rotation.set(0, Math.atan2(at.nx, at.nz) - Math.PI / 2, 0.07);
      m.updateMatrix();
      g.setMatrixAt(i, m.matrix);
    }
    g.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, SLATS]} receiveShadow frustumCulled={false}>
      <boxGeometry args={[0.31, 0.022, WIDTH]} />
      <meshStandardMaterial roughness={0.7} metalness={0} />
    </instancedMesh>
  );
}

const OTHERS: { lead: number; kind: BagKind; c: string; turn: number }[] = [
  { lead: 2.3, kind: "case", c: "#2f8f83", turn: 0.3 },
  { lead: 4.7, kind: "duffel", c: "#d1495b", turn: 1.4 },
  { lead: 7.5, kind: "tall", c: "#3d6fb6", turn: -0.2 },
  { lead: 9.6, kind: "round", c: "#e2b33c", turn: 0.4 },
  { lead: 11.2, kind: "box", c: "#7b5ea7", turn: 0.6 },
];
const OTHER_MAKE = OTHERS.map((o) => (k: Kit) => luggage(k, o.kind, o.c));

function flap(k: Kit) {
  for (let i = 0; i < 6; i++) k.box([0.03, 0.9, 0.14], "#23262d", [0, -0.45, -0.39 + i * 0.156]);
}
/** How far the way-out flaps are pushed open: by whatever is passing under them. */
function pushed(t: number) {
  const s0 = along(t);
  let open = 0;
  [0, ...OTHERS.map((o) => o.lead)].forEach((lead) => {
    const d = ((((s0 + lead) % LOOP) + LOOP) % LOOP) - (TUNNEL.x1 + HS);
    if (d > -0.45 && d < 0.75) open = Math.max(open, Math.sin(((d + 0.45) / 1.2) * Math.PI));
  });
  return open;
}

function CarouselSet() {
  return (
    <>
      <Stage look={HALL} />
      <Built make={hall} />
      <Sign text="BAGGAGE CLAIM" picto="claim" w={3.85} h={0.54} position={[0.2, 2.75, -0.255]} />
      <Slats />
      <A f={(g, t) => void (g.rotation.z = -1.15 * pushed(t) + 0.06 * Math.sin(t / 240))} position={[TUNNEL.x1 + 0.01, TOP + 0.95, -R]}>
        <Built make={flap} />
      </A>
      {OTHERS.map((o, i) => (
        <A
          key={o.lead}
          f={(g, t) => {
            const at = spot(along(t) + o.lead);
            g.position.set(at.x, TOP + 0.02, at.z);
            g.rotation.y = Math.atan2(at.nx, at.nz) + o.turn;
          }}
        >
          <Built make={OTHER_MAKE[i]!} rough={0.7} />
        </A>
      ))}
      <Contact
        at={(t) => {
          const b = rideBag(t);
          return { p: [b.p[0], TOP + 0.012, b.p[2]], w: 0.8, d: 0.8, o: 0.42 - 1.2 * (b.p[1] - TOP - 0.02) };
        }}
      />
      <Bag pose={rideBag} speaking={(t) => bagSpeaking(CAROUSEL, t)} gravity={4.2} />
      <Figure pose={stranger} role="traveller" />
      <Figure pose={host} role="owner" tall={1.03} phone />
      <Figure pose={() => ({ p: [-3.2, 0, -3.3], yaw: 0.7, head: 0.2 })} role="bystander" tall={0.97} />
    </>
  );
}

export const CarouselScene: Staged = { Set: CarouselSet, shots: [
  // wide and high: the hall, the sign, the belt turning, the bag coming out through the flaps
  { at: 0, to: 3000, pos: [[0.9, 3.3, 11.2], [0.6, 3.0, 10.4]], look: [0.3, 1.55, -0.4], rise: 0.07 },
  // travelling with it round the near bend and along the front
  {
    at: 3000,
    to: 6700,
    pos: [0, 0, 0],
    look: [0, 0, 0],
    rise: 0.18,
    follow: (t) => {
      const b = rideBag(t).p;
      // it comes round the bend toward us, then we back away along the front as it passes
      const ease = kf(t, [[3000, 0], [5600, 1], [6700, 1.25]]);
      return { pos: [4.9 - 3.9 * ease, 1.3, 2.8 + 2.9 * Math.min(1, ease)], look: [b[0], 0.98, b[2]] };
    },
  },
  // past the stranger's shoulder: round it goes again
  { at: 6700, pos: [[0.5, 1.6, 5.8], [0.2, 1.55, 5.3]], look: [-3.0, 1.12, 0.2], rise: 0.17 },
] satisfies Shot[] };
