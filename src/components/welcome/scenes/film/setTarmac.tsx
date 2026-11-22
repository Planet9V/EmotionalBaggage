"use client";

// Two outdoor scenes. The handler's toss (script 0:58): on the apron, in open daylight, the bag arcs from the cart
// train to the belt loader under the aircraft's belly; the film holds it in mid-air, then the thud; the handler
// turns toward the sound and looks around. The handle (script 0:36): at the curb, in warm light, a hand closes on
// the handle and lifts, the bag dangles at arm's length, and has something to say about it.
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { bagSpeaking, sceneOf } from "../scenes";
import { E, bump, clamp01, kf, mix, swing } from "./ease";
import { BAG_HALF, BAG_MID, Bag, Built, C, Contact, Dust, HANDLE_Y, Sign, Stage, luggage, trolley, useClock, type BagPose, type Kit, type Look, type Shot, type Staged, type V3 } from "./kit";
import { Figure, onBody, type FigPose } from "./people";

// ---- the toss -------------------------------------------------------------------------------------------------

const FREEZE_AT = 1600;
const FREEZE_MS = 1300;
/** The scene's own time: it stops while the bag hangs in the air. The camera keeps the real clock. */
const held = (t: number) => (t < FREEZE_AT ? t : t < FREEZE_AT + FREEZE_MS ? FREEZE_AT : t - FREEZE_MS);
const RELEASE = 1150;
const LAND = 2050;
const THUD = LAND + FREEZE_MS;
const BELT = 0.8;
const FROM: V3 = [-0.7, 1.3, 0.45];
const TO: V3 = [1.95, BELT, 0.15];
const HANDLER: V3 = [-1.25, 0, 0];
const TOSS = sceneOf("toss");
const ARC = 4.3;

const APRON: Look = {
  sky: ["#4f9fee", "#d9ebfa"],
  fog: ["#dcebf8", 16, 60],
  floor: "#bfc5cb",
  key: { c: "#fff2d9", i: 2.9, p: [5, 9, 6.5] },
  fill: { sky: "#cfe4ff", ground: "#c9c6bd", i: 0.6 },
  rim: { c: "#ffe7c4", i: 0.8, p: [-6, 5, -5] },
  env: 0.36,
  reach: 8,
};

const flight = (p: number): V3 => [mix(FROM[0], TO[0], p), mix(FROM[1], TO[1], p) + ARC * p * (1 - p), mix(FROM[2], TO[2], p)];

function tossBag(t: number): BagPose {
  const s = held(t);
  if (s < RELEASE) {
    return {
      // the wind-up: back, a held breath, then through
      p: [kf(s, [[350, -0.95], [900, -1.76], [RELEASE, FROM[0], "in"]]), kf(s, [[350, 0.5], [900, 0.74], [RELEASE, FROM[1], "in"]]), FROM[2]],
      tumble: kf(s, [[350, 0], [900, 0.68], [RELEASE, -0.2, "in"]]),
    };
  }
  if (s < LAND) {
    const p = (s - RELEASE) / (LAND - RELEASE);
    return { p: flight(p), tumble: mix(-0.2, -Math.PI * 2, p), sy: 1.07, sx: 0.96 };
  }
  // the thud, one bounce, and then it keels over onto its side
  const flop = kf(s, [[2650, 0], [2780, -0.05], [3130, 1, "in"]]);
  const roll = -(Math.PI / 2) * (flop - 0.07 * bump(s, 3130, 3380));
  return {
    p: [TO[0], BELT + 0.26 * bump(s, 2120, 2440) + BAG_HALF * Math.sin(Math.abs(roll)) * 0.92, TO[2]],
    sy: 1 - 0.36 * bump(s, LAND, LAND + 160) - 0.1 * bump(s, 2440, 2580) + 0.1 * bump(s, LAND + 160, LAND + 330),
    sx: 1 + 0.24 * bump(s, LAND, LAND + 160) + 0.06 * bump(s, 2440, 2580) - 0.05 * bump(s, LAND + 160, LAND + 330),
    roll,
  };
}

function handler(t: number): FigPose {
  const s = held(t);
  const b = tossBag(t);
  const reach = kf(s, [[2750, 0], [3150, 1], [4350, 1], [4600, 0]]);
  const turned = kf(s, [[2250, 0], [2800, 1], [4450, 1], [5050, 0]]);
  let hand: (side: number) => V3 | null = () => null;
  if (s < RELEASE + 60) {
    const a = b.tumble ?? 0;
    const h = HANDLE_Y - BAG_MID;
    hand = (side) => [b.p[0] - Math.sin(a) * h, b.p[1] + BAG_MID + Math.cos(a) * h, b.p[2] + side * 0.09];
  } else if (s < 1500) {
    // the follow-through
    hand = (side) => [-0.45, 1.62 - 0.35 * clamp01((s - RELEASE) / 350), 0.45 + side * 0.12];
  } else if (reach > 0 && reach < 1.01 && turned > 0.9) {
    hand = (side) => [-2.05, mix(0.8, 1.05, reach), 0.2 + side * 0.16];
  }
  // eyes on the bag through the wind-up and the throw; the thud makes him start, then he looks round, puzzled
  const bagAt: V3 = [b.p[0], b.p[1] + BAG_MID, b.p[2]];
  const startle = kf(s, [[LAND, 0], [LAND + 120, 1, "out"], [LAND + 900, 0.6], [4450, 0.3]]);
  const puzzled = kf(s, [[4300, 0], [4700, 1]]);
  return {
    look: s < LAND + 200 ? bagAt : null,
    browIn: 0.7 * kf(s, [[300, 0], [700, 1], [RELEASE, 1], [RELEASE + 250, 0]]) - 0.6 * puzzled,
    brow: 0.9 * startle + 0.3 * puzzled - 0.4 * kf(s, [[300, 0], [700, 1], [RELEASE, 1], [RELEASE + 250, 0]]),
    mouth: s > 650 && s < RELEASE ? "wince" : s >= RELEASE && s < RELEASE + 380 ? "open" : startle > 0.7 && s < LAND + 700 ? "o" : puzzled > 0.5 ? "closed" : "flat",
    blink: bump(s, LAND, LAND + 140),
    p: HANDLER,
    yaw: mix(1.2, -1.75, turned) + (s > 4450 ? 0.25 * E.io(clamp01((s - 4450) / 600)) : 0),
    lean: kf(s, [[350, 0.05], [900, -0.22], [RELEASE, 0.32, "in"], [1500, 0]]) + 0.14 * kf(s, [[5100, 0], [5500, 1]]),
    // looking around for whatever made that noise
    head: s > 5150 ? 0.85 * Math.sin((s - 5150) / 430) * clamp01((s - 5150) / 300) : 0,
    handL: hand(1),
    handR: hand(-1),
    // gripping the handle until it goes, then open hands following through
    shapeL: s < RELEASE + 60 ? "grip" : "open",
    shapeR: s < RELEASE + 60 ? "grip" : "open",
    aimL: s < RELEASE + 60 ? [Math.sin(b.tumble ?? 0), -Math.cos(b.tumble ?? 0), 0] : undefined,
    aimR: s < RELEASE + 60 ? [Math.sin(b.tumble ?? 0), -Math.cos(b.tumble ?? 0), 0] : undefined,
  };
}

/** A baggage cart: a bed on small wheels under a roof, with curtains drawn back at the ends. Length along x. */
function cart(k: Kit, x: number, curtain: string) {
  k.at([x, 0, 0.1], [0, 0, 0], () => {
    k.box([2.0, 0.1, 1.15], "#8f99a6", [0, 0.46, 0], { r: 0.02, seg: 1 });
    k.box([2.1, 0.07, 1.25], "#f4f5f6", [0, 1.75, 0], { r: 0.03, seg: 1 });
    [-0.96, 0.96].forEach((px) => [-0.53, 0.53].forEach((pz) => k.box([0.05, 1.26, 0.05], "#8f99a6", [px, 1.1, pz])));
    // the curtains: gathered at each end, hanging in folds
    [-0.99, 0.99].forEach((px) => {
      k.box([0.03, 1.2, 1.06], curtain, [px, 1.12, 0]);
      for (let i = 0; i < 3; i++) k.cyl(0.05, 1.2, curtain, [px * (0.94 - i * 0.07), 1.12, 0.56], { seg: 8 });
    });
    k.box([0.7, 0.05, 0.05], "#59616f", [1.34, 0.4, 0]);
    [-0.65, 0.65].forEach((px) => [-0.5, 0.5].forEach((pz) => k.cyl(0.17, 0.1, C.tyre, [px, 0.17, pz], { rot: [Math.PI / 2, 0, 0], seg: 14 })));
  });
}

const LOADER_YAW = 0.85;
const HULL: V3 = [-7, 2.75, -5.6];
const HULL_R = 1.6;
function apron(k: Kit) {
  // ground paint: the stand's yellow lead-in line, its edge, and a red keep-clear line by the aircraft
  k.box([40, 0.004, 0.14], C.yellow, [0, 0.002, 2.5]);
  k.box([0.14, 0.004, 9], C.yellow, [-0.2, 0.002, -2]);
  k.box([40, 0.004, 0.1], "#f4f5f6", [0, 0.002, 3.6]);
  for (let x = -12; x <= 12; x += 1.2) k.box([0.7, 0.004, 0.1], "#e5484d", [x, 0.002, -1.5]);
  // the aircraft: a white hull along the stand, a cheat line, windows, the open cargo door, a wing and an engine
  k.geo(new THREE.CapsuleGeometry(HULL_R, 26, 10, 28), "#f7f8f9", HULL, { rot: [0, 0, Math.PI / 2] });
  k.geo(new THREE.CylinderGeometry(HULL_R + 0.012, HULL_R + 0.012, 26, 28, 1, true, 0.62, 0.2), "#2f6fed", HULL, { rot: [0, 0, Math.PI / 2] });
  const face = (y: number) => HULL[2] + Math.sqrt(HULL_R * HULL_R - (y - HULL[1]) ** 2);
  for (let x = -12; x <= 5.0; x += 0.62) k.box([0.24, 0.34, 0.08], "#33415c", [x, 3.3, face(3.3) - 0.02], { rot: [-0.35, 0, 0], r: 0.1, seg: 2 });
  // the flight deck's glazing, near the nose
  k.box([0.95, 0.32, 0.1], "#33415c", [6.55, 3.25, face(3.25) - 0.28], { rot: [-0.35, -0.42, 0], r: 0.08, seg: 2 });
  k.box([1.6, 1.0, 0.5], "#1c2740", [5.2, 2.0, face(2.0) - 0.2], { rot: [0.5, 0, 0], r: 0.1, seg: 2 });
  k.box([1.7, 0.08, 1.1], "#eef0f2", [5.2, 2.66, face(2.5) + 0.55], { rot: [-0.3, 0, 0], r: 0.03, seg: 1 });
  k.box([4.0, 0.22, 8.5], "#eceef0", [-6.4, 2.2, -2.2], { rot: [0.05, 0.3, 0], r: 0.1, seg: 2 });
  k.geo(new THREE.CylinderGeometry(0.66, 0.55, 2.1, 24), "#f7f8f9", [-5.6, 1.3, -2.0], { rot: [0, 0, Math.PI / 2 - 0.02] });
  k.geo(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 24), "#33415c", [-4.52, 1.3, -2.0], { rot: [0, 0, Math.PI / 2] });
  k.box([0.3, 0.6, 1.1], "#eceef0", [-5.7, 1.9, -2.0]);
  // its nose wheel
  k.box([0.14, 1.3, 0.14], "#aab4c0", [4.0, 0.75, -5.6]);
  k.cyl(0.34, 0.3, C.tyre, [4.0, 0.34, -5.6], { rot: [Math.PI / 2, 0, 0], seg: 16 });
  // far off: the terminal and its tower, a step lighter and bluer
  k.box([30, 2.2, 2], "#c9d9ea", [6, 1.1, -34]);
  k.box([1.2, 7, 1.2], "#c9d9ea", [-16, 3.5, -34]);
  k.box([2.6, 1.1, 2.6], "#b9cde2", [-16, 7.5, -34], { r: 0.2, seg: 2 });
  // the cart train
  cart(k, -2.85, "#2f6fed");
  cart(k, -5.35, "#2f6fed");
  luggage(k, "case", "#5d7fb8", [-3.2, 0.51, 0.1]);
  luggage(k, "duffel", "#c05a4d", [-3.15, 0.93, 0.12], 0.2);
  luggage(k, "tall", "#4f9a8a", [-2.4, 0.51, 0.2], -0.25);
  luggage(k, "box", "#c7a26b", [-2.55, 0.51, -0.28]);
  luggage(k, "round", "#8a6fb0", [-5.7, 0.51, 0.15], 0.2);
  luggage(k, "case", "#d9a441", [-5.1, 0.51, 0.0], -0.1);
  luggage(k, "case", "#5a8a5c", [-5.15, 0.93, 0.05], 0.3);
  // the belt loader: a low truck, a feed table at the handler's end, and the belt climbing to the cargo door
  k.at([TO[0], 0, TO[2]], [0, LOADER_YAW, 0], () => {
    k.box([3.0, 0.42, 1.2], "#f4f5f6", [1.0, 0.42, 0], { r: 0.08 });
    k.box([3.0, 0.08, 1.22], C.cone, [1.0, 0.25, 0]);
    k.box([0.9, 0.5, 0.5], "#f4f5f6", [2.0, 0.85, -0.42], { r: 0.1 });
    k.box([0.5, 0.26, 0.02], "#33415c", [2.0, 0.92, -0.16]);
    [0.0, 2.0].forEach((x) => [-0.56, 0.56].forEach((z) => k.cyl(0.24, 0.16, C.tyre, [x, 0.24, z], { rot: [Math.PI / 2, 0, 0], seg: 16 })));
    // the feed table
    k.box([1.9, 0.14, 0.96], "#aab4c0", [0.05, BELT - 0.09, 0], { r: 0.04, seg: 1 });
    k.box([1.86, 0.03, 0.78], "#3b414b", [0.05, BELT - 0.012, 0]);
    for (let i = 0; i < 9; i++) k.box([0.03, 0.012, 0.78], "#59616f", [-0.75 + i * 0.2, BELT + 0.006, 0]);
    // the climb
    const rise = Math.atan2(1.12, 3.75);
    k.at([1.0, BELT - 0.02, 0], [0, 0, rise], () => {
      k.box([3.95, 0.14, 0.96], "#aab4c0", [1.95, -0.07, 0], { r: 0.04, seg: 1 });
      k.box([3.9, 0.03, 0.78], "#3b414b", [1.95, 0.008, 0]);
      for (let i = 0; i < 19; i++) k.box([0.03, 0.012, 0.78], "#59616f", [0.1 + i * 0.2, 0.026, 0]);
      [-0.47, 0.47].forEach((z) => k.box([3.9, 0.1, 0.03], C.yellow, [1.95, 0.07, z]));
    });
    k.box([0.1, 1.1, 0.1], "#8f99a6", [3.5, 0.95, 0.3], { rot: [0, 0, -0.3] });
    k.box([0.1, 1.1, 0.1], "#8f99a6", [3.5, 0.95, -0.3], { rot: [0, 0, -0.3] });
  });
  // cones, with their white bands
  ([[-0.5, 2.0], [0.9, 2.15], [3.4, 1.7], [-6.9, 1.6]] as const).forEach(([x, z]) => {
    k.box([0.36, 0.035, 0.36], C.cone, [x, 0.018, z], { r: 0.012, seg: 1 });
    k.cyl(0.13, 0.44, C.cone, [x, 0.255, z], { r2: 0.03, seg: 14 });
    k.cyl(0.098, 0.09, "#ffffff", [x, 0.25, z], { r2: 0.079, seg: 14 });
  });
}

/** The path of the throw, as a dotted line that follows the bag and fades after the thud. */
function Trail() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const m = useMemo(() => new THREE.Object3D(), []);
  const clock = useClock();
  const N = 15;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = held(clock.t);
    const p = (s - RELEASE) / (LAND - RELEASE);
    g.visible = p > 0 && s < LAND + 900;
    for (let i = 0; i < N; i++) {
      const at = (i + 0.5) / (N + 1);
      const [x, y, z] = flight(at);
      m.position.set(x, y + BAG_MID, z);
      m.scale.setScalar(at < p - 0.07 ? 1 : 0.0001);
      m.updateMatrix();
      g.setMatrixAt(i, m.matrix);
    }
    g.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.9 * (1 - clamp01((s - LAND) / 900));
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false} visible={false}>
      <sphereGeometry args={[0.042, 10, 8]} />
      <meshBasicMaterial ref={mat} color="#ffffff" transparent depthWrite={false} toneMapped={false} fog={false} />
    </instancedMesh>
  );
}

function streakGeometry() {
  const k: number[] = [];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (i % 3) * 0.05;
    const r1 = 0.95 + (i % 4) * 0.12;
    const r2 = r1 + 0.5 + ((i * 7) % 5) * 0.28;
    const w = 0.012 + (i % 2) * 0.008;
    const c = Math.cos(a);
    const s = Math.sin(a);
    k.push(r1 * c - w * s, r1 * s + w * c, 0, r1 * c + w * s, r1 * s - w * c, 0, r2 * c, r2 * s, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(k, 3));
  return g;
}
/** The freeze: a ring of thin streaks round the bag while the frame is held, as a comic panel draws a stopped moment. */
function Streaks() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(() => streakGeometry(), []);
  const clock = useClock();
  useFrame(() => {
    const t = clock.t;
    const on = t >= FREEZE_AT - 60 && t < FREEZE_AT + FREEZE_MS;
    const g = ref.current;
    if (!g) return;
    g.visible = on;
    if (!on) return;
    const p = (t - FREEZE_AT) / FREEZE_MS;
    const b = tossBag(t).p;
    g.position.set(b[0], b[1] + BAG_MID, b[2] - 0.3);
    g.scale.setScalar(0.94 + 0.1 * E.out(clamp01(p * 3)) + 0.03 * p);
    g.rotation.z = 0.05 * p;
    if (mat.current) mat.current.opacity = 0.85 * Math.min(1, p * 8, (1 - p) * 9);
  });
  return (
    <mesh ref={ref} geometry={geo} visible={false} frustumCulled={false}>
      <meshBasicMaterial ref={mat} color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} fog={false} />
    </mesh>
  );
}

function TossSet() {
  return (
    <>
      <Stage look={APRON} />
      <Built make={apron} />
      <Contact
        at={(t) => {
          const b = tossBag(t);
          const up = b.p[1] - BELT;
          const near = clamp01(1 - Math.abs(b.p[0] - TO[0]) / 0.9);
          return { p: [b.p[0], BELT, TO[2]], w: 0.9, d: 0.55, o: 0.5 * near * clamp01(1 - up * 1.2) };
        }}
      />
      <Trail />
      <Streaks />
      <Bag pose={tossBag} speaking={(t) => bagSpeaking(TOSS, t)} time={held} />
      <Dust at={[TO[0], BELT + 0.02, TO[2] + 0.25]} progress={(t) => (held(t) - LAND) / 950} />
      <Figure pose={handler} role="handler" time={held} />
    </>
  );
}

export const TossScene: Staged = {
  Set: TossSet,
  shots: [
    // wide, at a distance: the cart train, the wind-up, the throw
    { at: 0, to: FREEZE_AT, pos: [[0.5, 1.5, 10.6], [0.55, 1.45, 10.1]], look: [0.6, 1.9, 0], rise: 0.07 },
    // the freeze: the frame holds, with the smallest of zooms toward the bag
    { at: FREEZE_AT, to: FREEZE_AT + FREEZE_MS, pos: [0.55, 1.45, 10.1], look: [[0.6, 1.9, 0], [0.62, 2.2, 0]], fov: [30, 23], rise: 0.07 },
    // released: down it comes, and the frame takes the thud
    { at: FREEZE_AT + FREEZE_MS, to: 4000, pos: [0.55, 1.45, 10.1], look: [[0.62, 2.2, 0], [0.9, 1.8, 0]], fov: [23, 26.5], rise: 0.07 },
    // the belt: the bag on its side, with something to say
    { at: 4000, to: 6300, pos: [[2.5, 1.5, 5.0], [2.35, 1.45, 4.6]], look: [1.85, 1.12, 0.15], rise: 0.19 },
    // wide again: the handler turns toward the sound
    { at: 6300, pos: [[0.3, 1.5, 9.4], [0.3, 1.45, 8.8]], look: [0.3, 1.6, 0], rise: 0.12 },
  ] satisfies Shot[],
  shake: (t) => (t < THUD || t > THUD + 520 ? 0 : (1 - (t - THUD) / 520) ** 2),
};

// ---- the handle -----------------------------------------------------------------------------------------------

const HANDLE = sceneOf("handle");
const LIFT = 3200;
const REST_X = 0.12;
const UP = 0.3;
const OWNER_X = -0.8;

const CURB: Look = {
  sky: ["#6fb0ee", "#fbe8cf"],
  fog: ["#f7ead8", 14, 48],
  floor: "#d9c9b0",
  key: { c: "#ffe6bd", i: 2.9, p: [-4.5, 8, 7] },
  fill: { sky: "#d3e5ff", ground: "#cdb999", i: 0.6 },
  rim: { c: "#ffd49a", i: 1.0, p: [6, 4, -5] },
  env: 0.36,
};

function curbBag(t: number): BagPose {
  const up = kf(t, [[LIFT, 0], [LIFT + 120, -0.04], [LIFT + 600, 1, "out"]]);
  const whoa = [5100, 5400, 5700].reduce((a, at, i) => a + swing(t, at, i % 2 ? -0.11 : 0.11, 520, 260), 0);
  // after the line it gives up and just hangs
  const limp = kf(t, [[6300, 0], [7200, 1]]);
  return {
    p: [mix(REST_X, 0.02, Math.max(0, up)), UP * up, 0],
    hang: swing(t, LIFT + 80, 0.3, 860, 1300) + whoa + 0.06 * limp,
    hangX: swing(t, LIFT + 80, 0.07, 1100, 1500),
    // turning a shoulder to the hand
    yaw: 0.45 * kf(t, [[7750, 0], [8250, 1, "back"]]) - 0.12 * limp,
    // yanked up, it stretches; at each "whoa" it clenches
    sx: 1 + 0.05 * kf(t, [[7700, 0], [8050, 1, "back"]]) - 0.05 * bump(t, LIFT + 60, LIFT + 520) + 0.04 * (bump(t, 5100, 5300) + bump(t, 5400, 5600) + bump(t, 5700, 5900)),
    sy: 1 + 0.03 * limp + 0.09 * bump(t, LIFT + 60, LIFT + 520) - 0.05 * (bump(t, 5100, 5300) + bump(t, 5400, 5600) + bump(t, 5700, 5900)),
    // the tag twists on its loop as the hand takes the handle
    tagTwist: swing(t, 2900, 0.9, 900, 1600),
  };
}

function owner(t: number): FigPose {
  const b = curbBag(t);
  const x = kf(t, [[0, -3.6], [1900, OWNER_X, "out"]]);
  const reach = kf(t, [[2350, 0], [2900, 1]]);
  // the hand closes round the bar from above: knuckles to us, fingers wrapped under it
  const grip: V3 = [b.p[0], b.p[1] + HANDLE_Y + 0.03, b.p[2] + 0.012];
  const glance = kf(t, [[7950, 0], [8400, 1]]);
  // the first "whoa" makes him start; at the punchline, the slow deadpan look down at it
  const start = kf(t, [[5120, 0], [5230, 1, "out"], [6000, 0.6], [7000, 0.2], [7900, 0]]);
  return {
    look: t < 1300 ? null : [b.p[0], b.p[1] + (reach > 0.5 && t < LIFT + 900 ? HANDLE_Y : BAG_MID), b.p[2]],
    brow: 0.9 * start - 0.15 * glance,
    blink: bump(t, 5120, 5260),
    lids: 0.42 * glance,
    mouth: start > 0.7 ? "o" : "flat",
    p: [x, t < 1900 ? 0.05 * Math.abs(Math.sin((t / 1900) * Math.PI * 5)) : 0, -0.05],
    // walks in side on, then turns to face us with the bag held out at one side
    yaw: kf(t, [[1500, Math.PI / 2], [2300, 0.3]]),
    lean: 0.1 * reach - 0.1 * kf(t, [[LIFT, 0], [LIFT + 600, 1]]),
    // the pause, and the glance down
    head: 0.3 * reach + 0.5 * glance,
    nod: 0.2 * reach * (1 - kf(t, [[LIFT + 600, 0], [LIFT + 1100, 1]])) + 0.36 * glance,
    handR: reach > 0 ? [mix(x + 0.3, grip[0], reach), mix(0.8, grip[1], reach), mix(0.0, grip[2], reach)] : null,
    shapeR: reach > 0.85 ? "grip" : reach > 0 ? "open" : undefined,
    aimR: reach > 0.3 ? [0.15, -1, 0.1] : undefined,
    palmR: reach > 0.3 ? [0, -0.2, -1] : undefined,
  };
}

const WATCHER: V3 = [1.75, 0, -0.45];
const WATCHER_YAW = -0.8;
/**
 * The bystander, told in silhouette: head down in a phone; the double take at the first "whoa"; the phone up at
 * arm's length to film it; and at the punchline the other hand flies to the mouth and they fold over, shaking.
 */
function bystander(t: number): FigPose {
  const take = kf(t, [[5080, 0], [5180, 1, "out"]]);
  const film = kf(t, [[5450, 0], [5900, 1, "back"]]);
  const laugh = kf(t, [[7850, 0], [8100, 1, "out"]]);
  const shake = laugh * Math.sin((t - 7850) / 38) * 0.5 + laugh * 0.5;
  const lean = -0.1 * bump(t, 5080, 5500) + 0.3 * laugh + 0.04 * shake * laugh;
  const at = (l: V3) => onBody([WATCHER[0], WATCHER[1], WATCHER[2]], WATCHER_YAW, lean, l);
  // the phone: held low and read, then raised to eye level at arm's length (it dips a little as they laugh)
  const phone: V3 = [mix(0.06, 0.16, film), mix(1.12, 1.62, film) - 0.12 * laugh + 0.025 * shake * laugh, mix(0.3, 0.62, film)];
  const phoneAt = at(phone);
  const gasp = kf(t, [[5080, 0], [5180, 1, "out"], [5700, 1], [6100, 0]]);
  return {
    // reading the phone; the take snaps the eyes to the bag, and they stay there
    look: take < 0.5 ? phoneAt : [curbBag(t).p[0], curbBag(t).p[1] + BAG_MID, 0],
    lids: 0.3 * (1 - take),
    brow: 1.0 * gasp + 0.5 * laugh + 0.25 * film * (1 - laugh),
    blink: bump(t, 5070, 5200),
    squint: laugh,
    mouth: laugh > 0.3 ? "laugh" : gasp > 0.4 ? "o" : film > 0.6 ? "grin" : "flat",
    p: [WATCHER[0], 0.035 * shake * laugh, WATCHER[2]],
    yaw: WATCHER_YAW + 0.12 * take,
    lean,
    // reading, then the snap up toward the noise
    nod: mix(0.5, -0.12, take) + 0.18 * laugh,
    head: -0.1 * take,
    handR: phoneAt,
    // the phone: tipped up to read, then upright to film, its screen (and the palm behind it) toward the face
    aimR: onBody([0, 0, 0], WATCHER_YAW, 0, [0, mix(0.55, 1, film), mix(0.85, -0.1, film)]),
    palmR: onBody([0, 0, 0], WATCHER_YAW, 0, [0, mix(0.85, 0.05, film), mix(-0.55, -1, film)]),
    elbowR: [0.4, -1, -0.2],
    shapeL: laugh > 0.5 ? "fist" : undefined,
    handL: laugh > 0 ? at([mix(-0.31, -0.02, laugh), mix(0.8, 1.5, laugh), mix(0.03, 0.22, laugh)]) : null,
  };
}

function curb(k: Kit) {
  // the kerb, the road in front of it and its lane marks
  k.box([44, 0.13, 0.3], "#f7f4ee", [0, 0.065, 2.75], { r: 0.03, seg: 1 });
  k.box([44, 0.01, 12], "#878f99", [0, 0.005, 8.9]);
  for (let x = -14; x <= 14; x += 2.4) k.box([1.2, 0.004, 0.12], "#f4f5f6", [x, 0.012, 5.4]);
  k.box([44, 0.004, 0.1], C.yellow, [0, 0.012, 3.15]);
  // the terminal front: a warm wall, a band of glass, two sliding doors in a frame, a canopy on columns
  k.box([30, 4.1, 0.3], "#f1e6d4", [0, 2.05, -3.9]);
  k.box([30.2, 0.16, 0.5], "#ffffff", [0, 4.15, -3.85], { r: 0.04, seg: 1 });
  for (let x = -13.5; x <= 13.5; x += 3) k.box([0.05, 4.1, 0.32], "#e2d5c0", [x, 2.05, -3.89]);
  // paving joints
  for (let x = -15; x <= 15; x += 1.5) k.box([0.03, 0.003, 6.3], "#c9b89d", [x, 0.0015, -0.6]);
  [-2.2, -0.6, 1.0].forEach((z) => k.box([32, 0.003, 0.03], "#c9b89d", [0, 0.0015, z]));
  k.box([5.0, 2.75, 0.34], "#59616f", [-0.3, 1.375, -3.88], { r: 0.04, seg: 1 });
  [-1.78, -0.6, 0.6, 1.78].forEach((x, i) => {
    k.box([1.1, 2.5, 0.36], "#a9d0ee", [x - 0.3, 1.3, -3.88]);
    k.box([0.16, 2.5, 0.37], "#cfe6f7", [x - 0.3 + (i % 2 ? -0.25 : 0.25), 1.3, -3.88], { rot: [0, 0, 0.0] });
  });
  // the doors stand a little open
  k.box([0.5, 2.5, 0.37], "#3b4656", [-0.3, 1.3, -3.9]);
  k.box([7.4, 0.14, 1.5], "#ffffff", [-0.3, 3.62, -3.1], { r: 0.05, seg: 1 });
  k.box([7.4, 0.07, 0.06], C.yellow, [-0.3, 3.56, -2.36]);
  // the sign's plate
  k.box([3.2, 0.66, 0.08], "#16233d", [-0.3, 3.15, -3.66], { r: 0.03, seg: 1 });
  // bollards along the kerb, a trolley with someone's bags, planters by the doors
  [-4.6, -2.3, 2.3, 4.6].forEach((x) => {
    k.cyl(0.095, 0.8, "#59616f", [x, 0.4, 2.2], { seg: 14 });
    k.ball(0.095, "#59616f", [x, 0.8, 2.2], { seg: 14 });
    k.cyl(0.099, 0.08, "#f4f5f6", [x, 0.62, 2.2], { seg: 14 });
  });
  trolley(k, [3.7, 0, -1.6], -0.5);
  luggage(k, "case", "#5d7fb8", [3.7, 0.22, -1.6], -0.5 + Math.PI / 2);
  luggage(k, "duffel", "#c05a4d", [3.68, 0.64, -1.58], -0.4 + Math.PI / 2);
  [-4.2, 3.6].forEach((x) => {
    k.box([1.1, 0.6, 0.6], "#d9cfbf", [x, 0.3, -3.2], { r: 0.06, seg: 2 });
    k.ball(0.42, "#6fa66a", [x - 0.2, 0.86, -3.2], { seg: 12 });
    k.ball(0.34, "#84b77c", [x + 0.28, 0.8, -3.15], { seg: 12 });
  });
}

function HandleSet() {
  return (
    <>
      <Stage look={CURB} />
      <Built make={curb} />
      <Sign text="DEPARTURES" picto="plane" w={3.05} h={0.52} position={[-0.3, 3.15, -3.615]} />
      <Contact
        at={(t) => {
          const b = curbBag(t);
          return { p: [b.p[0], 0, 0], w: 0.85 + b.p[1], d: 0.55 + b.p[1] * 0.6, o: 0.5 - 0.9 * b.p[1] };
        }}
      />
      <Bag pose={curbBag} speaking={(t) => bagSpeaking(HANDLE, t)} />
      <Figure pose={owner} role="owner" tall={1.03} />
      <Figure pose={bystander} role="bystander" phone />
    </>
  );
}

export const HandleScene: Staged = { Set: HandleSet, shots: [
  // wide: the terminal front, the bag at rest, its owner walking up
  { at: 0, to: 2300, pos: [[0.9, 1.5, 10.2], [0.6, 1.45, 9.2]], look: [-0.25, 1.9, 0], rise: 0.07 },
  // closer: the hand closes on the handle, and lifts
  { at: 2300, to: 4900, pos: [[0.25, 1.25, 4.5], [0.15, 1.3, 4.15]], look: [[-0.3, 1.0, 0], [-0.3, 1.12, 0]], rise: 0.14 },
  // the line: owner on the left, the bag dangling free at arm's length, the bystander filming on the right
  { at: 4900, to: 7800, pos: [[0.85, 1.2, 5.7], [0.7, 1.2, 5.35]], look: [0.35, 1.12, 0], rise: 0.17, ease: "soft" },
  // the laugh: the same two-shot, eased a touch toward the bystander as they fold over
  { at: 7800, pos: [[0.7, 1.2, 5.35], [0.95, 1.18, 5.0]], look: [[0.35, 1.12, 0], [0.55, 1.1, 0]], rise: 0.17, ease: "soft" },
] satisfies Shot[] };
