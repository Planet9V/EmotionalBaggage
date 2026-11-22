// The loose parts of a costume (a scarf's end, a lanyard, a backpack, a bun, ear defenders, a coat's hem) as
// springs: each has a tip that is pulled back toward where it hangs at rest, so when the body moves it lags, swings
// past and settles. Stepped at a fixed rate in the world, so the result does not depend on the frame rate.
import * as THREE from "three";
import type { V3 } from "./kit";

/** One loose part: where its tip hangs at rest from the pivot (in the parent bone's frame), how stiff and how damped it is, and how far it may turn. */
export type SpringDef = { rest: V3; k: number; c: number; max: number };

export type SpringState = { tip: THREE.Vector3; vel: THREE.Vector3 };

const want = new THREE.Vector3();
const acc = new THREE.Vector3();
const off = new THREE.Vector3();

/** Where the tip would hang at rest, for a pivot and its parent's turn and scale. */
function restTip(def: SpringDef, pivot: THREE.Vector3, parent: THREE.Quaternion, scale: number, out: THREE.Vector3) {
  return out.set(def.rest[0], def.rest[1], def.rest[2]).multiplyScalar(scale).applyQuaternion(parent).add(pivot);
}

/** Puts a spring at rest. */
export function settle(s: SpringState, def: SpringDef, pivot: THREE.Vector3, parent: THREE.Quaternion, scale: number) {
  restTip(def, pivot, parent, scale, s.tip);
  s.vel.set(0, 0, 0);
}

/**
 * One step of `dt` seconds: the tip is pulled toward its rest place (stiffness `k`, damping `c`) and held at its
 * length from the pivot, so it swings on an arc rather than stretching.
 */
export function stepSpring(s: SpringState, def: SpringDef, pivot: THREE.Vector3, parent: THREE.Quaternion, scale: number, dt: number) {
  if (dt <= 0) return;
  restTip(def, pivot, parent, scale, want);
  acc.subVectors(want, s.tip).multiplyScalar(def.k).addScaledVector(s.vel, -def.c);
  s.vel.addScaledVector(acc, dt);
  s.tip.addScaledVector(s.vel, dt);
  const len = Math.hypot(def.rest[0], def.rest[1], def.rest[2]) * scale;
  off.subVectors(s.tip, pivot);
  const d = off.length();
  if (d > 1e-6) s.tip.copy(pivot).addScaledVector(off, len / d);
}

const from = new THREE.Vector3();
const to = new THREE.Vector3();
const inv = new THREE.Quaternion();
/** The turn the part's bone takes, in its parent's frame, to point from its pivot at the tip; no more than `max`. */
export function springTurn(s: SpringState, def: SpringDef, pivot: THREE.Vector3, parent: THREE.Quaternion, out: THREE.Quaternion) {
  from.set(def.rest[0], def.rest[1], def.rest[2]).normalize();
  to.subVectors(s.tip, pivot).applyQuaternion(inv.copy(parent).invert()).normalize();
  out.setFromUnitVectors(from, to);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(out.w)));
  if (angle > def.max) out.slerp(inv.identity(), 1 - def.max / angle);
  return out;
}
