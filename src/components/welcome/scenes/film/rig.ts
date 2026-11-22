// The people's joints, as geometry: a two-bone limb solved in closed form (shoulder, elbow, hand; hip, knee, foot),
// with a hint for which way the middle joint points. Pure functions of their inputs, so they can be tested and any
// frame can be drawn on its own.
import * as THREE from "three";

export type Limb = {
  /** where the middle joint (elbow, knee) is */
  mid: THREE.Vector3;
  /** where the end of the limb is: the target, or as close as the limb reaches toward it */
  end: THREE.Vector3;
  /** how much both bones are lengthened to reach (1 is their own length), for a cartoon stretch */
  stretch: number;
  /** the axis the middle joint bends about (unit, at right angles to both bones) */
  hinge: THREE.Vector3;
};

const d = new THREE.Vector3();
const side = new THREE.Vector3();

/**
 * Solves a limb from `root` toward `target` with bones of length `a` and `b`. The middle joint bends toward `pole`
 * (a direction, not a point). Past full reach the bones lengthen together up to `stretch` times, the way a drawn
 * arm does; beyond that the end stops short, on the line to the target. Too close, the limb folds no further than
 * its own lengths allow.
 */
export function twoBone(root: THREE.Vector3, target: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, stretch = 1.3, out?: Limb): Limb {
  const o = out ?? { mid: new THREE.Vector3(), end: new THREE.Vector3(), stretch: 1, hinge: new THREE.Vector3() };
  d.subVectors(target, root);
  let dist = d.length();
  if (dist < 1e-6) {
    d.set(0, -1, 0);
    dist = 1e-6;
  } else d.divideScalar(dist);
  // how far it can reach, lengthened if it has to
  let k = 1;
  const full = (a + b) * 0.999;
  if (dist > full) k = Math.min(stretch, dist / full);
  const A = a * k;
  const B = b * k;
  const reach = Math.max(Math.abs(A - B) + 1e-4, Math.min(dist, (A + B) * 0.999));
  // the bend's direction: the pole with its part along the limb taken out
  side.copy(pole).addScaledVector(d, -pole.dot(d));
  if (side.lengthSq() < 1e-8) side.set(0, 0, -1).addScaledVector(d, -d.z);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
  side.normalize();
  const cosA = (A * A + reach * reach - B * B) / (2 * A * reach);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  o.mid.copy(root).addScaledVector(d, A * cosA).addScaledVector(side, A * sinA);
  o.end.copy(root).addScaledVector(d, reach);
  o.stretch = k;
  o.hinge.crossVectors(d, side).normalize();
  return o;
}

const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();
const bm = new THREE.Matrix4();
/**
 * The rotation that turns a bone whose rest pose points down its -y axis so that it points along `along`, with its
 * x axis as near to `x` as it can be. Written into `q`.
 */
export function aimDown(along: THREE.Vector3, x: THREE.Vector3, q: THREE.Quaternion): THREE.Quaternion {
  by.copy(along).normalize().negate();
  bx.copy(x).addScaledVector(by, -x.dot(by));
  if (bx.lengthSq() < 1e-8) bx.set(1, 0, 0).addScaledVector(by, -by.x);
  bx.normalize();
  bz.crossVectors(bx, by);
  bm.makeBasis(bx, by, bz);
  return q.setFromRotationMatrix(bm);
}
