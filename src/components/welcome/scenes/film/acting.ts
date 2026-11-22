// The animator's small tools, as functions of the scene's clock: a take (anticipation, a squash, the stretch up, an
// overshoot and a settle), a head that turns to face something (the eyes get there first, because the head is
// given the target late), a laugh's shake, and a slow weight shift for anyone standing about.
import type { V3 } from "./kit";
import { bump, clamp01, kf, swing } from "./ease";

/**
 * A take at `t0`, `size` 0 to 1: a quick crouch (90 ms), the spring up and back (to 260 ms), a small overshoot that
 * settles over half a second. `squash` is for the body, `back` for the head (it pulls back and up), `brow` and
 * `blink` for the face.
 */
export function take(t: number, t0: number, size = 1) {
  if (t < t0 - 10) return { squash: 0, back: 0, brow: 0, blink: 0, lean: 0 };
  const squash = size * (0.07 * bump(t, t0, t0 + 90) - 0.08 * bump(t, t0 + 90, t0 + 260) + swing(t, t0 + 260, 0.025, 320, 220));
  const back = size * kf(t, [[t0 + 40, 0], [t0 + 160, 1, "out"], [t0 + 700, 0.55], [t0 + 1400, 0.25]]);
  return {
    squash,
    back,
    lean: -0.08 * back,
    brow: size * kf(t, [[t0 + 30, 0], [t0 + 140, 1, "out"], [t0 + 1100, 0.55]]),
    blink: bump(t, t0, t0 + 140),
  };
}

/** The head's turn and nod, from a body at `p` facing `yaw`, to face `target` (its eye height about 1.6), clamped to a neck's reach. */
export function faceTo(p: V3, yaw: number, target: V3, eye = 1.6): { head: number; nod: number } {
  const dx = target[0] - p[0];
  const dz = target[2] - p[2];
  let turn = Math.atan2(dx, dz) - yaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const nod = Math.atan2(eye - target[1], Math.hypot(dx, dz));
  return { head: Math.max(-1.15, Math.min(1.15, turn)), nod: Math.max(-0.5, Math.min(0.6, nod)) };
}

/** Mixes two head poses: `p` of the way from `a` to `b`. */
export function blendHead(a: { head: number; nod: number }, b: { head: number; nod: number }, p: number) {
  const k = clamp01(p);
  return { head: a.head + (b.head - a.head) * k, nod: a.nod + (b.nod - a.nod) * k };
}

/** A laugh's shake: quick, uneven, fading in and out with `amount`. */
export const shake = (t: number, amount: number) => amount * (0.6 * Math.sin(t / 38) + 0.4 * Math.sin(t / 23 + 1));

/** A slow, uneven shift of the weight from foot to foot, for someone standing about: across, in metres. */
export const fidget = (t: number, seed: number) => 0.02 * Math.sin(t / 1900 + seed) + 0.01 * Math.sin(t / 830 + seed * 2);

/** A point between two points. */
export const between = (a: V3, b: V3, p: number): V3 => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];
