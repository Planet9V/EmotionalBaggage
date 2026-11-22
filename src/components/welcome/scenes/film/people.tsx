"use client";

// The people: deliberately abstract, told apart at a glance by silhouette and costume, and now given a face that
// acts (eyes that blink and look, brows, a mouth). Each figure's pose is a function of the scene's clock.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { C, useBuilt, useClock, type Kit, type V3 } from "./kit";
import { blinkAt, mouthFor, pupilFor, type FaceState, type Mouth } from "./face";
import { FACE_ACROSS, FACE_H, FACE_UPDOWN, FACE_W, drawFace, faceKey } from "./faceDraw";

export type FigPose = {
  p: V3;
  /** turn about the vertical; 0 faces the camera side (+z) */
  yaw?: number;
  /** lean forward (positive) or back, about the feet */
  lean?: number;
  /** head turn and nod, relative to the body */
  head?: number;
  nod?: number;
  /** where each hand is, in the world; left out, the arm hangs */
  handR?: V3 | null;
  handL?: V3 | null;
  /** what the eyes look at, in the world; left out, straight ahead */
  look?: V3 | null;
  /** brows up (positive) or down, and knitted at the middle (positive) or lifted there, worried (negative) */
  brow?: number;
  browIn?: number;
  /** the resting mouth; left out, the deadpan line */
  mouth?: Mouth;
  /** speech, 0 to 1: the jaw follows it */
  talk?: number;
  /** lids held down (0 to 1), on top of the figure's own blinking; and a squint from below */
  lids?: number;
  squint?: number;
  /** a blink called for by the acting (0 to 1), as on a take */
  blink?: number;
};

/**
 * A point given on a figure's own body (x toward its right hand, y up, z in front of it), turned into the world:
 * for hands that go to a mouth, a chest or a hip, whichever way the figure faces and leans.
 */
export function onBody(p: V3, yaw: number, lean: number, l: V3): V3 {
  const y = l[1] * Math.cos(lean) - l[2] * Math.sin(lean);
  const z = l[1] * Math.sin(lean) + l[2] * Math.cos(lean);
  return [p[0] + l[0] * Math.cos(yaw) + z * Math.sin(yaw), p[1] + y, p[2] - l[0] * Math.sin(yaw) + z * Math.cos(yaw)];
}

/** Who is who, by silhouette and costume: no logos. */
export type Role = "agent" | "handler" | "owner" | "bystander" | "traveller";
type Costume = { coat: string; legs: string; skin: string; hair: string; sleeve: string };
const WEAR: Record<Role, Costume> = {
  agent: { coat: "#2b4a8a", legs: "#1f2f4f", skin: "#c99a78", hair: "#2a2320", sleeve: "#2b4a8a" },
  handler: { coat: "#d9e021", legs: "#2c3a52", skin: "#e2bd98", hair: "#39414f", sleeve: "#39414f" },
  owner: { coat: "#2f6b62", legs: "#39414f", skin: "#e6c3a0", hair: "#5a3d2b", sleeve: "#2f6b62" },
  bystander: { coat: "#8a4a6c", legs: "#3b4660", skin: "#8f6247", hair: "#1e1b1c", sleeve: "#8a4a6c" },
  traveller: { coat: "#c9b6d6", legs: "#56617a", skin: "#d9ad88", hair: "#7a5a3a", sleeve: "#c9b6d6" },
};
const ROLES = Object.keys(WEAR) as Role[];
const ZERO: V3 = [0, 0, 0];
const HIP = 0.8;
const SHOULDER = 1.3;
const HEAD = 1.6;
const HEAD_R = 0.185;

function figureBody(role: Role) {
  const w = WEAR[role];
  return (k: Kit) => {
    // legs and shoes
    [-0.105, 0.105].forEach((x) => {
      k.box([0.16, HIP, 0.19], w.legs, [x, HIP / 2 + 0.03, 0], { r: 0.06, seg: 2 });
      k.box([0.17, 0.08, 0.27], "#2a2e36", [x, 0.04, 0.035], { r: 0.035, seg: 2 });
    });
    const long = role === "owner" ? 0.32 : 0;
    // the torso: a coat for the owner, a jacket or vest for the rest
    k.box([0.46, 0.64 + long, 0.28], w.coat, [0, 1.07 - long / 2, 0], { r: 0.12, seg: 4 });
    k.cyl(0.07, 0.1, w.skin, [0, 1.42, 0], { seg: 12 });
    if (role === "agent") {
      // a neck scarf, knotted to one side, and a lanyard with its card
      k.box([0.24, 0.07, 0.24], C.yellow, [0, 1.385, 0.005], { r: 0.035, seg: 2 });
      k.box([0.07, 0.15, 0.03], C.yellow, [0.07, 1.3, 0.145], { rot: [0, 0, -0.35], r: 0.012, seg: 1 });
      k.box([0.012, 0.3, 0.012], "#e9edf2", [-0.07, 1.2, 0.143], { rot: [0, 0, 0.12] });
      k.box([0.08, 0.1, 0.012], "#e9edf2", [-0.09, 1.02, 0.146], { r: 0.008, seg: 1 });
      k.box([0.47, 0.05, 0.285], "#1f2f4f", [0, 0.8, 0]);
    } else if (role === "handler") {
      // hi-vis: reflective bands round the middle and over the shoulders
      k.box([0.47, 0.06, 0.29], "#eef1f4", [0, 0.95, 0]);
      [-0.13, 0.13].forEach((x) => k.box([0.06, 0.5, 0.29], "#eef1f4", [x, 1.13, 0]));
    } else if (role === "owner") {
      // a backpack, and the coat's collar and front
      k.box([0.36, 0.46, 0.2], "#d9a441", [0, 1.12, -0.21], { r: 0.07 });
      k.box([0.22, 0.14, 0.04], "#b98428", [0, 1.02, -0.315], { r: 0.02, seg: 1 });
      [-0.15, 0.15].forEach((x) => k.box([0.05, 0.4, 0.3], "#b98428", [x, 1.18, -0.03], { r: 0.02, seg: 1 }));
      k.box([0.02, 0.86, 0.01], "#234f48", [0, 0.92, 0.142]);
      k.box([0.3, 0.07, 0.3], "#234f48", [0, 1.385, 0], { r: 0.03, seg: 2 });
    } else if (role === "bystander") {
      k.box([0.3, 0.06, 0.29], "#f1e6d2", [0, 1.375, 0], { r: 0.03, seg: 2 });
    } else {
      k.box([0.36, 0.1, 0.33], "#7fa3c7", [0, 1.36, 0], { r: 0.05, seg: 2 });
    }
  };
}
function figureHead(role: Role) {
  const w = WEAR[role];
  return (k: Kit) => {
    k.ball(HEAD_R, w.skin, ZERO, { seg: 22 });
    // the nose: a small bump, so a turned head reads as turned
    k.ball(0.03, w.skin, [0, -0.035, 0.178], { seg: 8, s: [1, 1.1, 0.9] });
    if (role === "handler") {
      // a cap, and ear defenders on a band
      k.geo(new THREE.SphereGeometry(0.195, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), w.hair, [0, 0.07, 0]);
      k.box([0.22, 0.022, 0.14], w.hair, [0, 0.085, 0.2], { r: 0.01, seg: 1 });
      [-0.19, 0.19].forEach((x) => k.cyl(0.075, 0.07, C.cone, [x, -0.01, 0], { rot: [0, 0, Math.PI / 2], seg: 14 }));
      k.geo(new THREE.TorusGeometry(0.2, 0.016, 6, 20, Math.PI), "#2a2e36", [0, 0, 0]);
    } else if (role === "agent") {
      // hair pulled back into a bun
      k.geo(new THREE.SphereGeometry(0.195, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), w.hair, [0, 0.012, -0.022], { rot: [-0.5, 0, 0] });
      k.ball(0.085, w.hair, [0, 0.11, -0.18], { seg: 12 });
    } else if (role === "bystander") {
      k.ball(0.2, w.hair, [0, 0.045, -0.035], { seg: 18, s: [1, 0.92, 1] });
    } else if (role === "traveller") {
      k.geo(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), w.hair, [0, 0.01, -0.03], { rot: [-0.45, 0, 0] });
      k.box([0.3, 0.3, 0.1], w.hair, [0, -0.1, -0.15], { r: 0.05, seg: 2 });
    } else {
      k.geo(new THREE.SphereGeometry(0.196, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), w.hair, [0, 0.015, -0.02], { rot: [-0.4, 0, 0] });
    }
  };
}
function armGeometry(k: Kit) {
  // a unit arm along +y: stretched to reach, so the sleeve is one tapered piece
  k.cyl(0.062, 1, "#ffffff", [0, 0.5, 0], { r2: 0.052, seg: 10 });
}
function mitten(phone: boolean) {
  return (k: Kit) => {
    k.ball(0.07, "#ffffff", ZERO, { seg: 12, s: [1, 1.15, 0.9] });
    // a phone, held up to film it
    if (phone) k.box([0.085, 0.165, 0.014], "#1d1f24", [0, 0.1, 0.04], { r: 0.006, seg: 1 });
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const BODIES = Object.fromEntries(ROLES.map((r) => [r, { body: figureBody(r), head: figureHead(r) }])) as Record<Role, { body: (k: Kit) => void; head: (k: Kit) => void }>;
const HAND = { plain: mitten(false), phone: mitten(true) };

// the canvas and its texture are changed in place, outside React's data flow; this does it by name
function repaint(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, f: FaceState, skin: string) {
  const g = canvas.getContext("2d");
  if (!g) return;
  drawFace(g, f, skin);
  texture.needsUpdate = true;
}

/** The face's canvas and texture, one per figure, redrawn only when the face changes. */
function useFace(skin: string) {
  const canvas = useMemo(() => Object.assign(document.createElement("canvas"), { width: FACE_W, height: FACE_H }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const geo = useMemo(() => new THREE.SphereGeometry(HEAD_R + 0.004, 24, 16, Math.PI / 2 - FACE_ACROSS, 2 * FACE_ACROSS, Math.PI / 2 - FACE_UPDOWN, 2 * FACE_UPDOWN), []);
  useEffect(
    () => () => {
      texture.dispose();
      geo.dispose();
    },
    [texture, geo],
  );
  const shown = useRef("");
  const paint = (f: FaceState) => {
    const key = faceKey(f);
    if (key === shown.current) return;
    shown.current = key;
    repaint(canvas, texture, f, skin);
  };
  return { texture, geo, paint };
}

/** The face at one moment, from the pose and the figure's own blinking. `local` is the look target in the head's frame. */
function faceOf(q: FigPose, t: number, seed: number, local: THREE.Vector3 | null): FaceState {
  const [lookX, lookY] = local ? pupilFor(local.x, local.y, local.z) : [0, 0];
  const m = mouthFor(q.mouth, q.talk ?? 0);
  const lid = Math.max(q.lids ?? 0, blinkAt(t, seed), q.blink ?? 0);
  return { lookX, lookY, lid: Math.min(1, lid), squint: q.squint ?? 0, brow: q.brow ?? 0, browIn: q.browIn ?? 0, mouth: m.mouth, open: m.open };
}

/**
 * A person, kept abstract on purpose but told apart at a glance: a rounded body on two legs, a face that blinks,
 * looks and reacts, mitten hands that reach where they are told, and a costume (the agent's scarf and lanyard, the
 * handler's hi-vis and ear defenders, the owner's coat and backpack, a phone in a bystander's hand).
 */
export function Figure({ pose, role, tall = 1, phone = false, seed, time }: { pose: (t: number) => FigPose; role: Role; tall?: number; phone?: boolean; seed?: number; time?: (t: number) => number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Mesh | null)[]>([null, null]);
  const hands = useRef<(THREE.Mesh | null)[]>([null, null]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), l: new THREE.Vector3() }), []);
  const clock = useClock();
  const bodyGeo = useBuilt(BODIES[role].body);
  const headGeo = useBuilt(BODIES[role].head);
  const armGeo = useBuilt(armGeometry);
  const handGeo = useBuilt(HAND.plain);
  const phoneGeo = useBuilt(HAND.phone);
  const w = WEAR[role];
  const face = useFace(w.skin);
  const own = seed ?? ROLES.indexOf(role) * 7.3 + tall * 3.1;
  useFrame(() => {
    const q = pose(clock.t);
    const g = root.current;
    if (!g) return;
    g.position.set(q.p[0], q.p[1], q.p[2]);
    g.rotation.set(0, q.yaw ?? 0, 0);
    body.current?.rotation.set(q.lean ?? 0, 0, 0);
    head.current?.rotation.set(q.nod ?? 0, q.head ?? 0, 0);
    g.updateMatrixWorld();
    let local: THREE.Vector3 | null = null;
    if (q.look && head.current) local = head.current.worldToLocal(tmp.l.set(q.look[0], q.look[1], q.look[2]));
    face.paint(faceOf(q, time ? time(clock.t) : clock.t, own, local));
    [q.handL, q.handR].forEach((target, i) => {
      const side = i === 0 ? -1 : 1;
      const lean = q.lean ?? 0;
      tmp.a.set(side * 0.27, SHOULDER * Math.cos(lean), SHOULDER * Math.sin(lean));
      if (target) g.worldToLocal(tmp.b.set(target[0], target[1], target[2]));
      else tmp.b.set(side * 0.31, 0.78, 0.03 + 0.78 * Math.sin(lean));
      const arm = arms.current[i];
      const hand = hands.current[i];
      if (!arm || !hand) return;
      tmp.d.subVectors(tmp.b, tmp.a);
      const len = tmp.d.length();
      arm.position.copy(tmp.a);
      arm.quaternion.setFromUnitVectors(UP, tmp.d.normalize());
      arm.scale.set(1, len, 1);
      hand.position.copy(tmp.b);
      hand.quaternion.copy(arm.quaternion);
      if (!target) hand.rotation.set(0, 0, 0);
    });
  });
  return (
    <group ref={root} scale={tall}>
      <group ref={body}>
        <mesh geometry={bodyGeo} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.86} metalness={0} />
        </mesh>
        <group ref={head} position={[0, HEAD, 0]}>
          <mesh geometry={headGeo} castShadow>
            <meshStandardMaterial vertexColors roughness={0.8} metalness={0} />
          </mesh>
          <mesh geometry={face.geo} renderOrder={1}>
            <meshStandardMaterial map={face.texture} transparent alphaTest={0.04} depthWrite={false} roughness={0.8} metalness={0} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      </group>
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh
            ref={(m) => {
              arms.current[i] = m;
            }}
            geometry={armGeo}
            castShadow
          >
            <meshStandardMaterial color={w.sleeve} roughness={0.86} metalness={0} />
          </mesh>
          <mesh
            ref={(m) => {
              hands.current[i] = m;
            }}
            geometry={phone && i === 1 ? phoneGeo : handGeo}
            castShadow
          >
            <meshStandardMaterial vertexColors color={w.skin} roughness={0.8} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
