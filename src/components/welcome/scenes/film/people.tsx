"use client";

// The people: deliberately abstract, told apart at a glance by silhouette and costume, with a face that acts, arms
// that bend at the elbow and hands that grip and point. Each figure is one skinned mesh (one draw call, and one for
// its shadow) and a face drawn on a canvas; every joint is a bone moved by transforms, never by rebuilding geometry.
// The pose is a function of the scene's clock; the arms are solved to the hand targets the pose names.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBuilt, useClock, type V3 } from "./kit";
import { blinkAt, mouthFor, pupilFor, type FaceState, type Mouth } from "./face";
import { FACE_ACROSS, FACE_H, FACE_UPDOWN, FACE_W, drawFace, faceKey } from "./faceDraw";
import { ANKLE, BONE, BONES, FORE, HAND_C, HEAD_C, HEAD_R, HIP_J, KNEE, LEG_X, NECK, UPPER, WEAR, figureMaker, lr, skeletonOf, type Role } from "./body";
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
  /** lean forward (positive) or back, about the feet */
  lean?: number;
  /** head turn and nod, relative to the body */
  head?: number;
  nod?: number;
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
  const y = l[1] * Math.cos(lean) - l[2] * Math.sin(lean);
  const z = l[1] * Math.sin(lean) + l[2] * Math.cos(lean);
  return [p[0] + l[0] * Math.cos(yaw) + z * Math.sin(yaw), p[1] + y, p[2] - l[0] * Math.sin(yaw) + z * Math.cos(yaw)];
}

const ROLES = Object.keys(WEAR) as Role[];
const MAKERS = Object.fromEntries(ROLES.map((r) => [r, [figureMaker(r, false), figureMaker(r, true)]])) as Record<Role, [ReturnType<typeof figureMaker>, ReturnType<typeof figureMaker>]>;

// the canvas and its texture are changed in place, outside React's data flow; this does it by name
function repaint(canvas: HTMLCanvasElement, texture: THREE.CanvasTexture, f: FaceState, skin: string) {
  const g = canvas.getContext("2d");
  if (!g) return;
  drawFace(g, f, skin);
  texture.needsUpdate = true;
}

/** The face's canvas, texture and mesh, one per figure; the canvas is redrawn only when the face changes. */
function useFace(skin: string) {
  const canvas = useMemo(() => Object.assign(document.createElement("canvas"), { width: FACE_W, height: FACE_H }), []);
  const parts = useMemo(() => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const geo = new THREE.SphereGeometry(HEAD_R + 0.004, 24, 16, Math.PI / 2 - FACE_ACROSS, 2 * FACE_ACROSS, Math.PI / 2 - FACE_UPDOWN, 2 * FACE_UPDOWN);
    const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.04, depthWrite: false, roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, HEAD_C - NECK, 0);
    mesh.renderOrder = 1;
    return { texture, geo, mat, mesh };
  }, [canvas]);
  useEffect(
    () => () => {
      parts.texture.dispose();
      parts.geo.dispose();
      parts.mat.dispose();
    },
    [parts],
  );
  const shown = useRef("");
  const paint = (f: FaceState) => {
    const key = faceKey(f);
    if (key === shown.current) return;
    shown.current = key;
    repaint(canvas, parts.texture, f, skin);
  };
  return { mesh: parts.mesh, paint };
}

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
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(bones[BONE.root]!);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return { mesh, bones, rest, mat };
  }, [geo, role]);
  useEffect(() => () => rig.mat.dispose(), [rig]);
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
  const lift = Math.max(0, Math.min(1, (sc.t.y - sc.s.y) / (0.45 * tall))) * 0.22 + (q.shrug ?? 0) * 0.32;
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
  sc.pole.set(Math.sin(yaw) + s * 0.12 * Math.cos(yaw), 0, Math.cos(yaw) - s * 0.12 * Math.sin(yaw));
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

/** The face at one moment, from the pose and the figure's own blinking. `aim` is the look target in the head's frame. */
function faceOf(q: FigPose, t: number, seed: number, aim: THREE.Vector3 | null): FaceState {
  const [lookX, lookY] = aim ? pupilFor(aim.x, aim.y, aim.z) : [0, 0];
  const m = mouthFor(q.mouth, q.talk ?? 0);
  const lid = Math.max(q.lids ?? 0, blinkAt(t, seed), q.blink ?? 0);
  return { lookX, lookY, lid: Math.min(1, lid), squint: q.squint ?? 0, brow: q.brow ?? 0, browIn: q.browIn ?? 0, mouth: m.mouth, open: m.open };
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
    const now = time ? time(clock.t) : clock.t;
    const dt = now - sc.last;
    sc.last = now;
    const q = pose(clock.t);
    const { bones, rest } = rig;
    g.position.set(q.p[0], q.p[1], q.p[2]);
    g.rotation.set(0, q.yaw ?? 0, 0);
    toRest(bones, rest);
    bones[BONE.root]!.rotation.set(q.lean ?? 0, 0, 0);
    // soft knees by default: the hips sit a centimetre below a straight leg
    bones[BONE.hips]!.position.add(sc.v.set(q.hipX ?? 0, q.hipY ?? -0.012, q.hipZ ?? 0));
    bones[BONE.head]!.rotation.set(q.nod ?? 0, q.head ?? 0, 0);
    g.updateMatrixWorld(true);
    poseLeg(bones, rest, g, q, -1, tall, sc);
    poseLeg(bones, rest, g, q, 1, tall, sc);
    poseArm(bones, rest, q, -1, tall, phone, sc, dt);
    poseArm(bones, rest, q, 1, tall, phone, sc, dt);
    // the phone shows only in a phone hand
    bones[BONE.prop]!.scale.setScalar(phone ? 1 : 0.0001);
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
