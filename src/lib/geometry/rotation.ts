/**
 * Rotation maths for parts. Pure functions, no three.js, so the layout editor, the build sheet
 * and tests share them with the 3D view.
 *
 * A part's rotation is three angles in degrees about the scene x, y and z axes, applied in that
 * order about the part's own centre. This is the same order as three.js `Euler(x, y, z, "XYZ")`:
 * the rotation matrix is Rx * Ry * Rz, so a point is turned about z first, then y, then x.
 */

export type V3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];

const ZERO_ROTATION: V3 = [0, 0, 0];
const RAD = Math.PI / 180;

export const degToRad = (d: number) => d * RAD;
export const radToDeg = (r: number) => r / RAD;

/** True when a rotation changes anything. */
export const isRotated = (r?: readonly number[] | null) => !!r && r.some((a) => a !== 0);

/** Row-major 3x3 matrix for Euler angles in degrees, order XYZ (three.js convention). */
export function rotationMatrix(deg: readonly number[] = ZERO_ROTATION): Mat3 {
  const [a, b, c] = [deg[0] ?? 0, deg[1] ?? 0, deg[2] ?? 0].map((d) => d * RAD);
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  // Rx * Ry * Rz, as three.js builds it for "XYZ".
  return [
    cb * cc, -cb * sc, sb,
    ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb,
    sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb,
  ];
}

export function applyMatrix(m: Mat3, v: readonly number[]): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Turns a point about the origin. */
export const rotatePoint = (v: readonly number[], deg: readonly number[]): V3 => applyMatrix(rotationMatrix(deg), v);

/** Matrix transpose, which is the inverse of a rotation. */
export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Euler angles in degrees (order XYZ) back out of a rotation matrix. Gimbal lock sets the z angle to 0. */
export function eulerFromMatrix(m: Mat3): V3 {
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])));
  let x: number;
  let z: number;
  if (Math.abs(m[2]) < 0.9999999) {
    x = Math.atan2(-m[5], m[8]);
    z = Math.atan2(-m[1], m[0]);
  } else {
    x = Math.atan2(m[7], m[4]);
    z = 0;
  }
  return [x / RAD, y / RAD, z / RAD];
}

/** Rounds to a step (1 mm, 15 degrees), turning -0 into 0. */
export function snap(v: number, step: number) {
  const r = Math.round(v / step) * step;
  return r === 0 ? 0 : r;
}

/** An angle brought into the range -180 to 180. */
export function wrapDegrees(d: number) {
  const r = ((((d + 180) % 360) + 360) % 360) - 180;
  return r === -180 && d > 0 ? 180 : r;
}

/**
 * Axis-aligned extent of a box of the given size after rotation: the sum of each rotated axis'
 * absolute components. Rotating by 90 degrees about y swaps x and z.
 */
export function rotatedExtent(size: readonly number[], deg?: readonly number[] | null): V3 {
  if (!isRotated(deg)) return [size[0], size[1], size[2]];
  const m = rotationMatrix(deg as number[]);
  return [
    Math.abs(m[0]) * size[0] + Math.abs(m[1]) * size[1] + Math.abs(m[2]) * size[2],
    Math.abs(m[3]) * size[0] + Math.abs(m[4]) * size[1] + Math.abs(m[5]) * size[2],
    Math.abs(m[6]) * size[0] + Math.abs(m[7]) * size[1] + Math.abs(m[8]) * size[2],
  ];
}

/** The eight corners of a rotated box, relative to its centre. */
export function rotatedCorners(size: readonly number[], deg?: readonly number[] | null): V3[] {
  const m = rotationMatrix(deg ?? ZERO_ROTATION);
  const out: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.push(applyMatrix(m, [(sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2]));
  }
  return out;
}
