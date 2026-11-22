// A person's body, built once as one skinned mesh: every primitive is bound to a bone, sleeves and legs blend
// across the elbow and the knee so a bend is smooth, and the costume's loose parts (a scarf end, a lanyard, a
// backpack, a bun, ear defenders, a coat's hem) hang from bones of their own, which a spring moves. The figure is
// drawn in its rest pose: standing at the origin facing +z, arms hanging, x toward its right hand.
import * as THREE from "three";
import { C, type Kit, type Skin, type V3 } from "./kit";
import type { SpringDef } from "./springs";

export type Role = "agent" | "handler" | "owner" | "bystander" | "traveller" | "pax" | "pax2";
type Costume = { coat: string; legs: string; skin: string; hair: string; sleeve: string };
export const WEAR: Record<Role, Costume> = {
  agent: { coat: "#2b4a8a", legs: "#1f2f4f", skin: "#c99a78", hair: "#2a2320", sleeve: "#2b4a8a" },
  handler: { coat: "#d9e021", legs: "#2c3a52", skin: "#e2bd98", hair: "#39414f", sleeve: "#39414f" },
  owner: { coat: "#2f6b62", legs: "#39414f", skin: "#e6c3a0", hair: "#5a3d2b", sleeve: "#2f6b62" },
  bystander: { coat: "#8a4a6c", legs: "#3b4660", skin: "#8f6247", hair: "#1e1b1c", sleeve: "#8a4a6c" },
  traveller: { coat: "#c9b6d6", legs: "#56617a", skin: "#d9ad88", hair: "#7a5a3a", sleeve: "#c9b6d6" },
  // passers-by in the background: muted, so they never pull the eye from the bag
  pax: { coat: "#7d8796", legs: "#4a5160", skin: "#c79a7a", hair: "#3a332e", sleeve: "#7d8796" },
  pax2: { coat: "#a89c86", legs: "#5b5f66", skin: "#e0b896", hair: "#6e6a66", sleeve: "#a89c86" },
};

/** The bones, by number. Left and right pairs are next to each other: left first. */
export const BONE = {
  root: 0, hips: 1, spine: 2, chest: 3, breath: 4, head: 5,
  clav: 6, uarm: 8, farm: 10, hand: 12, fing: 14, thumb: 16, index: 18, prop: 20,
  thigh: 21, shin: 23, foot: 25, sA: 27, sB: 28, sC: 29,
} as const;
export const BONES = 30;
/** One of a pair: `s` is -1 for the left, 1 for the right. */
export const lr = (bone: number, s: number) => bone + (s > 0 ? 1 : 0);

// the joints in the rest pose
export const HIP_J = 0.84;
export const KNEE = 0.465;
export const ANKLE = 0.09;
export const LEG_X = 0.105;
const SHOULDER_Y = 1.31;
const ARM_X = 0.27;
export const UPPER = 0.235;
export const FORE = 0.225;
const WRIST = SHOULDER_Y - UPPER - FORE;
/** From the wrist to the middle of the hand: the point a pose's hand target names. */
export const HAND_C = 0.088;
export const NECK = 1.46;
export const HEAD_C = 1.6;
export const HEAD_R = 0.185;
const CHEST = 1.2;

type BoneDef = { parent: number; at: V3 };
/** Where each loose part hangs from, per role: the parent bone and the pivot. Unused springs sit on the chest. */
const SPRINGS: Record<Role, [BoneDef, BoneDef, BoneDef]> = {
  agent: [{ parent: BONE.chest, at: [0.07, 1.37, 0.14] }, { parent: BONE.chest, at: [-0.06, 1.37, 0.14] }, { parent: BONE.head, at: [0, 1.7, -0.14] }],
  handler: [{ parent: BONE.head, at: [0, HEAD_C + 0.12, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }],
  owner: [{ parent: BONE.chest, at: [0, 1.34, -0.14] }, { parent: BONE.hips, at: [0, 0.9, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }],
  bystander: [{ parent: BONE.head, at: [0, HEAD_C + 0.05, -0.05] }, { parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }],
  traveller: [{ parent: BONE.head, at: [0, HEAD_C + 0.02, -0.15] }, { parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }],
  pax: [{ parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }],
  pax2: [{ parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }, { parent: BONE.chest, at: [0, 1.3, 0] }],
};

/** How each role's loose parts swing: a scarf end and lanyard that flick, a heavy backpack, a stiff bun, a hem. */
export const SPRING_DEFS: Record<Role, [SpringDef | null, SpringDef | null, SpringDef | null]> = {
  agent: [{ rest: [0.03, -0.15, 0.01], k: 70, c: 5, max: 0.7 }, { rest: [-0.02, -0.32, 0.005], k: 45, c: 3.5, max: 0.55 }, { rest: [0, 0.05, -0.1], k: 240, c: 12, max: 0.22 }],
  handler: [{ rest: [0, -0.14, 0], k: 260, c: 13, max: 0.14 }, null, null],
  owner: [{ rest: [0, -0.26, -0.08], k: 60, c: 5, max: 0.32 }, { rest: [0, -0.36, 0], k: 160, c: 12, max: 0.08 }, null],
  bystander: [{ rest: [0, -0.06, -0.05], k: 300, c: 16, max: 0.1 }, null, null],
  traveller: [{ rest: [0, -0.26, -0.04], k: 70, c: 5.5, max: 0.4 }, null, null],
  pax: [null, null, null],
  pax2: [null, null, null],
};

/** The rest pose of every bone, for one role: its parent and where it is in the figure. */
export function skeletonOf(role: Role): BoneDef[] {
  const out: BoneDef[] = [];
  const put = (i: number, parent: number, at: V3) => (out[i] = { parent, at });
  put(BONE.root, -1, [0, 0, 0]);
  put(BONE.hips, BONE.root, [0, HIP_J + 0.02, 0]);
  put(BONE.spine, BONE.hips, [0, 0.98, 0]);
  put(BONE.chest, BONE.spine, [0, CHEST, 0]);
  put(BONE.breath, BONE.chest, [0, CHEST, 0]);
  put(BONE.head, BONE.chest, [0, NECK, 0]);
  [-1, 1].forEach((s) => {
    put(lr(BONE.clav, s), BONE.chest, [s * 0.08, 1.34, 0]);
    put(lr(BONE.uarm, s), lr(BONE.clav, s), [s * ARM_X, SHOULDER_Y, 0]);
    put(lr(BONE.farm, s), lr(BONE.uarm, s), [s * ARM_X, SHOULDER_Y - UPPER, 0]);
    put(lr(BONE.hand, s), lr(BONE.farm, s), [s * ARM_X, WRIST, 0]);
    put(lr(BONE.fing, s), lr(BONE.hand, s), [s * ARM_X, WRIST - 0.098, -0.006]);
    put(lr(BONE.thumb, s), lr(BONE.hand, s), [s * (ARM_X - 0.01), WRIST - 0.03, 0.042]);
    put(lr(BONE.index, s), lr(BONE.hand, s), [s * ARM_X, WRIST - 0.098, 0.036]);
    put(lr(BONE.thigh, s), BONE.hips, [s * LEG_X, HIP_J, 0]);
    put(lr(BONE.shin, s), lr(BONE.thigh, s), [s * LEG_X, KNEE, 0]);
    put(lr(BONE.foot, s), lr(BONE.shin, s), [s * LEG_X, ANKLE, 0]);
  });
  put(BONE.prop, lr(BONE.hand, 1), [ARM_X, WRIST - 0.06, 0]);
  const sp = SPRINGS[role];
  put(BONE.sA, sp[0].parent, sp[0].at);
  put(BONE.sB, sp[1].parent, sp[1].at);
  put(BONE.sC, sp[2].parent, sp[2].at);
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** A blend from bone `a` to bone `b` as y falls from `hi` to `lo`. */
const fall = (a: number, b: number, hi: number, lo: number): Skin => (_x, y) => [a, b, clamp01((hi - y) / (hi - lo))];

function legSkin(s: number): Skin {
  const thigh = lr(BONE.thigh, s);
  const shin = lr(BONE.shin, s);
  const foot = lr(BONE.foot, s);
  return (x, y, z) => (y > KNEE - 0.07 ? fall(thigh, shin, KNEE + 0.07, KNEE - 0.07)(x, y, z) : fall(shin, foot, ANKLE + 0.04, ANKLE - 0.02)(x, y, z));
}
function armSkin(s: number): Skin {
  const up = lr(BONE.uarm, s);
  const fore = lr(BONE.farm, s);
  const hand = lr(BONE.hand, s);
  const elbow = SHOULDER_Y - UPPER;
  return (x, y, z) => (y > elbow - 0.06 ? fall(up, fore, elbow + 0.06, elbow - 0.06)(x, y, z) : fall(fore, hand, WRIST + 0.025, WRIST - 0.015)(x, y, z));
}
/** The torso: the hips below the waist, the breathing chest above it, blended between. */
const torsoSkin: Skin = fall(BONE.breath, BONE.hips, 1.12, 0.93);
/** The owner's coat: the same, and below the hips its hem swings on a spring of its own. */
const coatSkin: Skin = (x, y, z) => (y > 0.86 ? torsoSkin(x, y, z) : fall(BONE.hips, BONE.sB, 0.86, 0.5)(x, y, z));

/** A hand, in its rest pose at its side: palm toward the body, fingers down, thumb forward. */
function hand(k: Kit, s: number, skin: string) {
  k.surface(1, () => handParts(k, s, skin));
}
function handParts(k: Kit, s: number, skin: string) {
  const x = s * ARM_X;
  k.bind(lr(BONE.hand, s), () => {
    k.box([0.062, 0.11, 0.104], skin, [x, WRIST - 0.048, 0.005], { r: 0.027, seg: 2 });
  });
  k.bind(lr(BONE.fing, s), () => {
    k.box([0.056, 0.086, 0.07], skin, [x, WRIST - 0.098 - 0.034, -0.016], { r: 0.024, seg: 2 });
  });
  k.bind(lr(BONE.index, s), () => {
    k.box([0.05, 0.094, 0.032], skin, [x, WRIST - 0.098 - 0.038, 0.036], { r: 0.015, seg: 2 });
  });
  k.bind(lr(BONE.thumb, s), () => {
    k.capsule(0.021, 0.042, skin, [s * (ARM_X - 0.01), WRIST - 0.03 - 0.033, 0.042 + 0.02], { rot: [-0.55, 0, 0], seg: 8 });
  });
}

/** The parts every figure shares: legs, shoes, arms, hands, a neck. */
function frame(k: Kit, w: Costume) {
  [-1, 1].forEach((s) => {
    k.bind(legSkin(s), () => {
      const len = HIP_J + 0.02 - ANKLE - 0.02;
      k.capsule(0.079, len - 0.158, w.legs, [s * LEG_X, (HIP_J + 0.02 + ANKLE + 0.02) / 2, 0], { seg: 12, hs: 14, s: [1, 1, 1.15] });
    });
    k.surface(2, () => k.bind(lr(BONE.foot, s), () => k.box([0.17, 0.08, 0.27], "#2a2e36", [s * LEG_X, 0.04, 0.035], { r: 0.035, seg: 2 })));
    k.bind(armSkin(s), () => {
      const top = SHOULDER_Y + 0.05;
      const bot = WRIST - 0.005;
      k.capsule(0.056, top - bot - 0.112, w.sleeve, [s * ARM_X, (top + bot) / 2, 0], { seg: 10, hs: 14 });
    });
    hand(k, s, w.skin);
  });
  k.surface(1, () => k.bind(fall(BONE.chest, BONE.head, NECK - 0.04, NECK + 0.04), () => k.cyl(0.07, 0.12, w.skin, [0, 1.43, 0], { seg: 12 })));
}

function costume(role: Role, k: Kit) {
  const w = WEAR[role];
  const long = role === "owner" ? 0.32 : 0;
  // the torso: a coat for the owner, a jacket or vest for the rest
  k.bind(role === "owner" ? coatSkin : torsoSkin, () => k.box([0.46, 0.64 + long, 0.28], w.coat, [0, 1.07 - long / 2, 0], { r: 0.12, seg: 4 }));
  // the long coat's skirt: squarer at the hem than the torso's rounding, so the legs stay inside it as they move
  if (role === "owner")
    k.bind(coatSkin, () => {
      k.cyl(0.258, 0.47, w.coat, [0, 0.65, 0.005], { r2: 0.228, s: [1, 1, 0.78], seg: 28, hs: 4 });
      k.box([0.02, 0.47, 0.01], "#234f48", [0, 0.65, 0.19], { rot: [-0.06, 0, 0] });
    });
  if (role === "agent") {
    // a neck scarf, its knotted end loose, and a lanyard with its card
    k.bind(BONE.breath, () => k.box([0.24, 0.07, 0.24], C.yellow, [0, 1.385, 0.005], { r: 0.035, seg: 2 }));
    k.bind(BONE.sA, () => k.box([0.07, 0.15, 0.03], C.yellow, [0.07, 1.3, 0.145], { rot: [0, 0, -0.35], r: 0.012, seg: 1 }));
    k.bind(BONE.sB, () => {
      k.box([0.012, 0.3, 0.012], "#e9edf2", [-0.07, 1.2, 0.143], { rot: [0, 0, 0.12] });
      k.box([0.08, 0.1, 0.012], "#e9edf2", [-0.09, 1.02, 0.146], { r: 0.008, seg: 1 });
    });
    k.bind(BONE.hips, () => k.box([0.47, 0.05, 0.285], "#1f2f4f", [0, 0.8, 0]));
  } else if (role === "handler") {
    // hi-vis: reflective bands round the middle and over the shoulders
    k.bind(torsoSkin, () => k.box([0.47, 0.06, 0.29], "#eef1f4", [0, 0.95, 0]));
    k.bind(BONE.breath, () => [-0.13, 0.13].forEach((x) => k.box([0.06, 0.5, 0.29], "#eef1f4", [x, 1.13, 0])));
  } else if (role === "owner") {
    // a backpack that swings a little, its straps, and the coat's collar and front
    k.bind(BONE.sA, () => {
      k.box([0.36, 0.46, 0.2], "#d9a441", [0, 1.12, -0.21], { r: 0.07 });
      k.box([0.22, 0.14, 0.04], "#b98428", [0, 1.02, -0.315], { r: 0.02, seg: 1 });
    });
    k.bind(BONE.breath, () => [-0.15, 0.15].forEach((x) => k.box([0.05, 0.4, 0.3], "#b98428", [x, 1.18, -0.03], { r: 0.02, seg: 1 })));
    k.bind(coatSkin, () => k.box([0.02, 0.86, 0.01], "#234f48", [0, 0.92, 0.142], { s: [1, 1, 1] }));
    k.bind(BONE.breath, () => k.box([0.3, 0.07, 0.3], "#234f48", [0, 1.385, 0], { r: 0.03, seg: 2 }));
  } else if (role === "bystander") {
    k.bind(BONE.breath, () => k.box([0.3, 0.06, 0.29], "#f1e6d2", [0, 1.375, 0], { r: 0.03, seg: 2 }));
  } else {
    k.bind(BONE.breath, () => k.box([0.36, 0.1, 0.33], "#7fa3c7", [0, 1.36, 0], { r: 0.05, seg: 2 }));
  }
}

function head(role: Role, k: Kit) {
  const w = WEAR[role];
  const H: V3 = [0, HEAD_C, 0];
  const at = (x: number, y: number, z: number): V3 => [x, HEAD_C + y, z];
  k.bind(BONE.head, () => {
    k.surface(1, () => {
      k.ball(HEAD_R, w.skin, H, { seg: 22 });
      // the nose: a small bump, so a turned head reads as turned
      k.ball(0.03, w.skin, at(0, -0.035, 0.178), { seg: 8, s: [1, 1.1, 0.9] });
    });
    if (role === "handler") {
      // a cap; the ear defenders are on a spring below
      k.geo(new THREE.SphereGeometry(0.195, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), w.hair, at(0, 0.07, 0));
      k.box([0.22, 0.022, 0.14], w.hair, at(0, 0.085, 0.2), { r: 0.01, seg: 1 });
    } else if (role === "agent") {
      k.geo(new THREE.SphereGeometry(0.195, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), w.hair, at(0, 0.012, -0.022), { rot: [-0.5, 0, 0] });
    } else if (role === "bystander") {
      k.ball(0.2, w.hair, at(0, 0.045, -0.035), { seg: 18, s: [1, 0.92, 1] });
    } else if (role === "traveller") {
      k.geo(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), w.hair, at(0, 0.01, -0.03), { rot: [-0.45, 0, 0] });
    } else {
      k.geo(new THREE.SphereGeometry(0.196, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), w.hair, at(0, 0.015, -0.02), { rot: [-0.4, 0, 0] });
    }
  });
  if (role === "handler") {
    k.bind(BONE.sA, () => {
      [-0.19, 0.19].forEach((x) => k.cyl(0.075, 0.07, C.cone, at(x, -0.01, 0), { rot: [0, 0, Math.PI / 2], seg: 14 }));
      k.geo(new THREE.TorusGeometry(0.2, 0.016, 6, 20, Math.PI), "#2a2e36", H);
    });
  } else if (role === "agent") {
    // the bun
    k.bind(BONE.sC, () => k.ball(0.085, w.hair, at(0, 0.11, -0.18), { seg: 12 }));
  } else if (role === "traveller") {
    // hair to the shoulders, which swings
    k.bind(BONE.sA, () => k.box([0.3, 0.3, 0.1], w.hair, at(0, -0.1, -0.15), { r: 0.05, seg: 2 }));
  }
}

/** A phone, in the right hand's palm: its screen faces the way the palm does. */
function phone(k: Kit) {
  k.surface(2, () => phoneParts(k));
}
function phoneParts(k: Kit) {
  k.bind(BONE.prop, () => {
    // longer than the hand is wide and held up past the fingertips, so it shows round a hand seen from behind
    k.box([0.016, 0.2, 0.1], "#1d1f24", [ARM_X - 0.042, WRIST - 0.15, 0.004], { r: 0.008, seg: 1 });
    k.box([0.004, 0.17, 0.082], "#3d4a5e", [ARM_X - 0.051, WRIST - 0.15, 0.004]);
    k.cyl(0.011, 0.006, "#3d4a5e", [ARM_X - 0.032, WRIST - 0.215, 0.03], { rot: [0, 0, Math.PI / 2], seg: 10 });
  });
}

const bell = (v: number, at: number, w: number) => Math.exp(-(((v - at) / w) ** 2));
/**
 * Soft shading baked where parts of a body meet, in the rest pose: under the arms (the torso's sides and the arms'
 * inner faces), under the chin, between the legs, under the coat's hem. A darkening of a sixth at most.
 */
function crease(x: number, y: number, z: number): number {
  const side = Math.abs(x);
  let k = 1;
  k -= 0.17 * bell(side, 0.222, 0.03) * bell(y, 1.08, 0.2);
  k -= 0.2 * bell(y, 1.4, 0.04) * (side < 0.09 ? 1 : 0);
  k -= 0.12 * bell(y, HEAD_C - 0.17, 0.03) * (z > -0.05 ? 1 : 0);
  k -= 0.14 * bell(side, 0.03, 0.03) * (y < HIP_J + 0.04 ? 1 : 0) * bell(y, 0.7, 0.25);
  k -= 0.1 * bell(y, HIP_J + 0.02, 0.05) * (side < 0.2 ? 1 : 0) * (side > 0.06 ? 1 : 0) * (z > 0.06 ? 1 : 0);
  return k;
}

/** The whole figure, bound to its bones. */
export function figureMaker(role: Role, withPhone: boolean) {
  return (k: Kit) =>
    k.surface(0, () => {
      k.shade(crease);
      frame(k, WEAR[role]);
      costume(role, k);
      head(role, k);
      if (withPhone) phone(k);
    });
}
