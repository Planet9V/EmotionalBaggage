"use client";

// The people: deliberately abstract, told apart at a glance by silhouette and costume, with a face that acts, arms
// that bend at the elbow and hands that grip and point. Each figure is one skinned mesh (one draw call, and one for
// its shadow) and a face drawn on a canvas; every joint is a bone moved by transforms, never by rebuilding geometry.
// The pose is a function of the scene's clock; the arms are solved to the hand targets the pose names.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useBuilt, useClock, type V3 } from "./kit";
import type { Mouth } from "./face";
import { faceOf, useFace } from "./faceMesh";
import { ANKLE, BONE, BONES, FORE, HAND_C, HIP_J, KNEE, LEG_X, SPRING_DEFS, UPPER, WEAR, figureMaker, lr, skeletonOf, type Role } from "./body";
import { settle, springTurn, stepSpring, type SpringState } from "./springs";
import { figureMaterial, outlineMaterial, takeRim } from "./figureLook";

/** Whether the people are drawn with an ink outline (one more draw call each). */
const OUTLINE = false;
import { aimDown, twoBone, type Limb } from "./rig";

export type { Role } from "./body";

/** What a hand is doing: its fingers' curl and the thumb's. */
type HandShape = "relax" | "open" | "grip" | "fist" | "point" | "hold";
const CURL: Record<HandShape, [fingers: number, index: number, thumb: number]> = {
  relax: [0.5, 0.5, 0.2],
  open: [0.05, 0, -0.15],
  grip: [1.55, 1.55, 0.95],
  fist: [2.0, 2.0, 1.2],
  point: [1.95, 0.0, 1.05],
  hold: [1.25, 1.15, 0.75],
};

/** A foot: the ground point under its ankle (raised while it swings), which way it points, and its heel lifted. */
type FootPose = { at: V3; yaw?: number; heel?: number };

export type FigPose = {
  p: V3;
  /** where each foot is; left out, planted under the body where it stands */
  footL?: FootPose;
  footR?: FootPose;
  /** the hips moved on the body: across toward its right (a weight shift), up or down (a crouch), forward */
  hipX?: number;
  hipY?: number;
  hipZ?: number;
  /** turn about the vertical; 0 faces the camera side (+z) */
  yaw?: number;
  /** lean forward (positive) or back: a third of it from the ankles, the rest at the waist */
  lean?: number;
  /** at the waist only: a bend forward, a twist (toward the left hand is positive), a bend to the side */
  bend?: number;
  twist?: number;
  side?: number;
  /** squash (positive) or stretch (negative) of the body above the hips, as on a take */
  squash?: number;
  /** head turn, nod and tilt, relative to the body */
  head?: number;
  nod?: number;
  tilt?: number;
  /** where each hand is, in the world; left out, the arm hangs */
  handR?: V3 | null;
  handL?: V3 | null;
  /** the shape of each hand; left out, relaxed (holding, for a phone hand) */
  shapeR?: HandShape;
  shapeL?: HandShape;
  /** which way each hand's fingers point, and which way its palm faces, in the world; left out, they follow the arm */
  aimR?: V3;
  aimL?: V3;
  palmR?: V3;
  palmL?: V3;
  /** which way each elbow points, on the body (x to its right hand, y up, z in front); left out, down and back */
  elbowR?: V3;
  elbowL?: V3;
  /** both shoulders up, 0 to 1 */
  shrug?: number;
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
  let y = l[1];
  let z = l[2];
  // above the waist the body bends there too, as the figure does
  if (y > WAIST) {
    const a = lean * (1 - FROM_FEET);
    const h = y - WAIST;
    y = WAIST + h * Math.cos(a) - z * Math.sin(a);
    z = h * Math.sin(a) + z * Math.cos(a);
  }
  const a = lean * FROM_FEET;
  [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  return [p[0] + l[0] * Math.cos(yaw) + z * Math.sin(yaw), p[1] + y, p[2] - l[0] * Math.sin(yaw) + z * Math.cos(yaw)];
}

/** How much of a lean comes from the ankles; the rest is at the waist, which is this high. */
const FROM_FEET = 0.3;
const WAIST = 0.98;

const ROLES = Object.keys(WEAR) as Role[];
const MAKERS = Object.fromEntries(ROLES.map((r) => [r, [figureMaker(r, false), figureMaker(r, true)]])) as Record<Role, [ReturnType<typeof figureMaker>, ReturnType<typeof figureMaker>]>;

/** The skinned body: its bones in their rest pose, bound once. */
function useRig(role: Role, phone: boolean) {
  const geo = useBuilt(MAKERS[role][phone ? 1 : 0]);
  const rig = useMemo(() => {
    const defs = skeletonOf(role);
    const bones = defs.map(() => new THREE.Bone());
    const rest = defs.map((d) => {
      const p = d.parent < 0 ? [0, 0, 0] : defs[d.parent]!.at;
      return new THREE.Vector3(d.at[0] - p[0]!, d.at[1] - p[1]!, d.at[2] - p[2]!);
    });
    defs.forEach((d, i) => {
      bones[i]!.position.copy(rest[i]!);
      if (d.parent >= 0) bones[d.parent]!.add(bones[i]!);
    });
    const { mat, rim } = figureMaterial();
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(bones[BONE.root]!);
    const skeleton = new THREE.Skeleton(bones);
    mesh.bind(skeleton);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    // the outline, when used: the same body on the same bones, drawn inside out
    const ink = OUTLINE ? outlineMaterial() : null;
    if (ink) {
      const hull = new THREE.SkinnedMesh(geo, ink);
      hull.bind(skeleton, mesh.bindMatrix);
      hull.frustumCulled = false;
      mesh.add(hull);
    }
    return { mesh, bones, rest, mat, rim, ink };
  }, [geo, role]);
  useEffect(
    () => () => {
      rig.mat.dispose();
      rig.ink?.dispose();
    },
    [rig],
  );
  return rig;
}

type Scratch = {
  s: THREE.Vector3;
  t: THREE.Vector3;
  w: THREE.Vector3;
  f: THREE.Vector3;
  p: THREE.Vector3;
  pole: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  qp: THREE.Quaternion;
  qu: THREE.Quaternion;
  qf: THREE.Quaternion;
  qh: THREE.Quaternion;
  e: THREE.Euler;
  limb: Limb;
  curl: number[][];
  last: number;
  breath: number;
  springs: SpringState[];
  /** the springs' own clock: the moment they were last stepped to */
  st: number;
};
const scratch = (): Scratch => ({
  s: new THREE.Vector3(),
  t: new THREE.Vector3(),
  w: new THREE.Vector3(),
  f: new THREE.Vector3(),
  p: new THREE.Vector3(),
  pole: new THREE.Vector3(),
  v: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  qp: new THREE.Quaternion(),
  qu: new THREE.Quaternion(),
  qf: new THREE.Quaternion(),
  qh: new THREE.Quaternion(),
  e: new THREE.Euler(),
  limb: { mid: new THREE.Vector3(), end: new THREE.Vector3(), stretch: 1, hinge: new THREE.Vector3() },
  curl: [[...CURL.relax], [...CURL.relax]],
  last: NaN,
  breath: 0,
  springs: [0, 1, 2].map(() => ({ tip: new THREE.Vector3(), vel: new THREE.Vector3() })),
  st: NaN,
});

/** The bones back to their rest pose, before a pose is applied. */
function toRest(bones: THREE.Bone[], rest: THREE.Vector3[]) {
  for (let i = 0; i < BONES; i++) {
    bones[i]!.position.copy(rest[i]!);
    bones[i]!.quaternion.identity();
    bones[i]!.scale.set(1, 1, 1);
  }
}

/** Sets a bone's own rotation so that its rotation in the world is `world`. */
function setWorld(bone: THREE.Bone, world: THREE.Quaternion, sc: Scratch) {
  bone.parent!.getWorldQuaternion(sc.qp);
  bone.quaternion.copy(sc.qp.invert().multiply(world));
}

/** One arm, solved to its target: the shoulder lifts toward a high hand, the elbow bends, the wrist turns the hand. */
function poseArm(bones: THREE.Bone[], rest: THREE.Vector3[], q: FigPose, s: number, tall: number, phone: boolean, sc: Scratch, dt: number) {
  const right = s > 0;
  const target = right ? q.handR : q.handL;
  const root = bones[BONE.root]!;
  if (target) sc.t.set(target[0], target[1], target[2]);
  else root.localToWorld(sc.t.set(s * 0.31, 0.79, 0.04));
  // the shoulder: lifted for a hand above it, and by a shrug
  const clav = bones[lr(BONE.clav, s)]!;
  const upper = bones[lr(BONE.uarm, s)]!;
  upper.getWorldPosition(sc.s);
  const lift = Math.max(0, Math.min(1, (sc.t.y - sc.s.y) / (0.45 * tall))) * 0.22 + (q.shrug ?? 0) * 0.32 + 0.012 * sc.breath;
  clav.rotation.set(0, 0, s * lift);
  clav.updateMatrixWorld(true);
  upper.getWorldPosition(sc.s);
  // the fingers' direction: as posed, or along the reach
  const aim = right ? q.aimR : q.aimL;
  if (aim) sc.f.set(aim[0], aim[1], aim[2]).normalize();
  else sc.f.subVectors(sc.t, sc.s).normalize().lerp(sc.v.set(0, -1, 0), target ? 0.15 : 0.6).normalize();
  // the palm: as posed, or toward the body's middle
  const palm = right ? q.palmR : q.palmL;
  if (palm) sc.p.set(palm[0], palm[1], palm[2]);
  else sc.p.set(-s, 0, 0.15).applyQuaternion(root.getWorldQuaternion(sc.q));
  // the wrist sits behind the hand's middle, along the fingers
  sc.w.copy(sc.t).addScaledVector(sc.f, -HAND_C * tall);
  const hint = right ? q.elbowR : q.elbowL;
  sc.pole.set(hint ? hint[0] : s * 0.3, hint ? hint[1] : -1, hint ? hint[2] : -0.5).applyQuaternion(bones[BONE.chest]!.getWorldQuaternion(sc.q));
  const limb = twoBone(sc.s, sc.w, UPPER * tall, FORE * tall, sc.pole, 1.3, sc.limb);
  // the upper arm, the forearm (lengthened with the reach), the hand
  aimDown(sc.v.subVectors(limb.mid, sc.s), limb.hinge, sc.qu);
  setWorld(upper, sc.qu, sc);
  const fore = bones[lr(BONE.farm, s)]!;
  fore.position.copy(rest[lr(BONE.farm, s)]!).multiplyScalar(limb.stretch);
  aimDown(sc.v.subVectors(limb.end, limb.mid), limb.hinge, sc.qf);
  fore.quaternion.copy(sc.qp.copy(sc.qu).invert().multiply(sc.qf));
  const hand = bones[lr(BONE.hand, s)]!;
  hand.position.copy(rest[lr(BONE.hand, s)]!).multiplyScalar(limb.stretch);
  aimDown(sc.f, sc.v.copy(sc.p).multiplyScalar(-s), sc.qh);
  hand.quaternion.copy(sc.qf.invert().multiply(sc.qh));
  // the fingers ease into their shape
  const want = CURL[(right ? q.shapeR : q.shapeL) ?? (phone && right ? "hold" : "relax")];
  const c = sc.curl[right ? 1 : 0]!;
  const k = dt > 0 && dt < 200 ? 1 - Math.exp(-dt / 70) : 1;
  for (let j = 0; j < 3; j++) c[j] = c[j]! + (want[j]! - c[j]!) * k;
  bones[lr(BONE.fing, s)]!.rotation.set(0, 0, -s * c[0]!);
  bones[lr(BONE.index, s)]!.rotation.set(0, 0, -s * c[1]!);
  bones[lr(BONE.thumb, s)]!.rotation.set(0.5 * c[2]!, -s * 0.9 * c[2]!, -s * 0.35 * c[2]!);
}

const THIGH = HIP_J - KNEE;
const SHIN = KNEE - ANKLE;
/** One leg, solved from the hip to its foot: the knee bends forward, the foot lies flat at its plant. */
function poseLeg(bones: THREE.Bone[], rest: THREE.Vector3[], g: THREE.Group, q: FigPose, s: number, tall: number, sc: Scratch) {
  const foot = s > 0 ? q.footR : q.footL;
  if (foot) sc.t.set(foot.at[0], foot.at[1] + ANKLE * tall, foot.at[2]);
  else g.localToWorld(sc.t.set(s * LEG_X, ANKLE, 0));
  const thigh = bones[lr(BONE.thigh, s)]!;
  thigh.getWorldPosition(sc.s);
  const yaw = foot?.yaw ?? q.yaw ?? 0;
  // the knee points the way the foot does, a touch outward
  sc.pole.set(Math.sin(yaw) + s * 0.05 * Math.cos(yaw), 0, Math.cos(yaw) - s * 0.05 * Math.sin(yaw));
  const limb = twoBone(sc.s, sc.t, THIGH * tall, SHIN * tall, sc.pole, 1.04, sc.limb);
  sc.v.copy(limb.hinge).negate();
  aimDown(sc.w.subVectors(limb.mid, sc.s), sc.v, sc.qu);
  setWorld(thigh, sc.qu, sc);
  const shin = bones[lr(BONE.shin, s)]!;
  shin.position.copy(rest[lr(BONE.shin, s)]!).multiplyScalar(limb.stretch);
  aimDown(sc.w.subVectors(limb.end, limb.mid), sc.v, sc.qf);
  shin.quaternion.copy(sc.qp.copy(sc.qu).invert().multiply(sc.qf));
  const ft = bones[lr(BONE.foot, s)]!;
  ft.position.copy(rest[lr(BONE.foot, s)]!).multiplyScalar(limb.stretch);
  sc.qh.setFromEuler(sc.e.set(foot?.heel ?? 0, yaw, 0, "YXZ"));
  ft.quaternion.copy(sc.qf.invert().multiply(sc.qh));
}

/**
 * The body without its limbs: where it stands and faces, the lean shared between ankles and waist, the hips, the
 * waist's twist and bend, a squash, the head, and the life underneath every pose: breathing, and a slow sway of
 * the weight and the shoulders, so nobody is ever perfectly still.
 */
function placeBody(g: THREE.Group, bones: THREE.Bone[], rest: THREE.Vector3[], q: FigPose, now: number, seed: number, sc: Scratch) {
  g.position.set(q.p[0], q.p[1], q.p[2]);
  g.rotation.set(0, q.yaw ?? 0, 0);
  toRest(bones, rest);
  const lean = q.lean ?? 0;
  const b = Math.sin((now / 3400) * Math.PI * 2 + seed);
  sc.breath = b;
  const drift = Math.sin(now / 2700 + seed * 3);
  bones[BONE.root]!.rotation.set(lean * FROM_FEET, 0, 0);
  // soft knees by default: the hips sit a centimetre below a straight leg
  bones[BONE.hips]!.position.add(sc.v.set((q.hipX ?? 0) + 0.008 * drift, q.hipY ?? -0.012, q.hipZ ?? 0));
  const spine = bones[BONE.spine]!;
  spine.rotation.set(lean * (1 - FROM_FEET) + (q.bend ?? 0), (q.twist ?? 0) + 0.02 * Math.sin(now / 3900 + seed), (q.side ?? 0) - 0.012 * drift, "YXZ");
  const sq = q.squash ?? 0;
  spine.scale.set(1 + 0.5 * sq, 1 - sq, 1 + 0.5 * sq);
  // a breath fills the chest, lifts it a touch, and the head rides it
  bones[BONE.breath]!.scale.set(1 + 0.016 * b, 1 + 0.008 * b, 1 + 0.024 * b);
  bones[BONE.chest]!.rotation.set(-0.012 * b, 0, 0);
  bones[BONE.head]!.rotation.set((q.nod ?? 0) + 0.01 * b, q.head ?? 0, q.tilt ?? 0, "YXZ");
  g.updateMatrixWorld(true);
}

const SPRING_MS = 1000 / 90;
const SPRING_PREROLL = 1200;
const SPRING_BONES = [BONE.sA, BONE.sB, BONE.sC];
/** Each loose part's pivot, its parent's turn, and the figure's scale, read from the placed body. */
function springFrame(bones: THREE.Bone[], i: number, sc: Scratch) {
  const bone = bones[SPRING_BONES[i]!]!;
  bone.getWorldPosition(sc.s);
  bone.parent!.getWorldQuaternion(sc.q);
}

/**
 * Steps the springs up to the scene's time `t`: at a fixed rate, and from a little before `t` when the film has been
 * cut or held, so a held frame shows the swing the film would. `own` is the scene's own clock (stopped in a freeze).
 */
function runSprings(g: THREE.Group, bones: THREE.Bone[], rest: THREE.Vector3[], role: Role, pose: (t: number) => FigPose, t: number, own: (t: number) => number, seed: number, tall: number, sc: Scratch) {
  const defs = SPRING_DEFS[role];
  let from = sc.st;
  if (!(t >= from) || t - from > 300) {
    from = t - SPRING_PREROLL;
    placeBody(g, bones, rest, pose(from), own(from), seed, sc);
    defs.forEach((d, i) => {
      if (!d) return;
      springFrame(bones, i, sc);
      settle(sc.springs[i]!, d, sc.s, sc.q, tall);
    });
  }
  for (let at = from + SPRING_MS; at <= t; at += SPRING_MS) {
    const dt = (own(at) - own(at - SPRING_MS)) / 1000;
    placeBody(g, bones, rest, pose(at), own(at), seed, sc);
    defs.forEach((d, i) => {
      if (!d) return;
      springFrame(bones, i, sc);
      stepSpring(sc.springs[i]!, d, sc.s, sc.q, tall, dt);
    });
    sc.st = at;
  }
}

/**
 * A person, kept abstract on purpose but told apart at a glance: a rounded body on two legs, a face that blinks,
 * looks and reacts, arms that bend and hands that grip, point and hold a phone, and a costume (the agent's scarf
 * and lanyard, the handler's hi-vis and ear defenders, the owner's coat and backpack). `time` is the scene's own
 * time, for a scene that stops it.
 */
export function Figure({ pose, role, tall = 1, phone = false, seed, time }: { pose: (t: number) => FigPose; role: Role; tall?: number; phone?: boolean; seed?: number; time?: (t: number) => number }) {
  const root = useRef<THREE.Group>(null);
  const clock = useClock();
  const scene = useThree((s) => s.scene);
  const rig = useRig(role, phone);
  const face = useFace(WEAR[role].skin);
  const scr = useRef<Scratch | null>(null);
  const own = seed ?? ROLES.indexOf(role) * 7.3 + tall * 3.1;
  useEffect(() => {
    const head = rig.bones[BONE.head]!;
    head.add(face.mesh);
    return () => void head.remove(face.mesh);
  }, [rig, face.mesh]);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const sc = (scr.current ??= scratch());
    const clockOf = time ?? ((t: number) => t);
    const now = clockOf(clock.t);
    const dt = now - sc.last;
    sc.last = now;
    const { bones, rest } = rig;
    takeRim(rig.rim, scene);
    runSprings(g, bones, rest, role, pose, clock.t, clockOf, own, tall, sc);
    const q = pose(clock.t);
    placeBody(g, bones, rest, q, now, own, sc);
    poseLeg(bones, rest, g, q, -1, tall, sc);
    poseLeg(bones, rest, g, q, 1, tall, sc);
    poseArm(bones, rest, q, -1, tall, phone, sc, dt);
    poseArm(bones, rest, q, 1, tall, phone, sc, dt);
    // the phone shows only in a phone hand
    bones[BONE.prop]!.scale.setScalar(phone ? 1 : 0.0001);
    // the loose parts hang where their springs have swung them
    SPRING_DEFS[role].forEach((d, i) => {
      if (!d) return;
      springFrame(bones, i, sc);
      bones[SPRING_BONES[i]!]!.quaternion.copy(springTurn(sc.springs[i]!, d, sc.s, sc.q, sc.qh));
    });
    g.updateMatrixWorld(true);
    let aim: THREE.Vector3 | null = null;
    if (q.look) aim = face.mesh.worldToLocal(sc.v.set(q.look[0], q.look[1], q.look[2]));
    face.paint(faceOf(q, now, own, aim));
  });
  return (
    <group ref={root} scale={tall}>
      <primitive object={rig.mesh} />
    </group>
  );
}
