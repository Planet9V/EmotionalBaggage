// Timing for the film: easing curves and keyframes, as plain functions of the scene's clock, so any moment of a
// scene can be drawn on its own (the stills and the chapter cuts rely on that).
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export const E = {
  lin: (p: number) => p,
  in: (p: number) => p * p * p,
  out: (p: number) => 1 - (1 - p) ** 3,
  io: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  /** overshoots, then settles */
  back: (p: number) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
  /** a held value: jumps at the end of its segment */
  hold: (p: number) => (p < 1 ? 0 : 1),
};
type Ease = keyof typeof E;

/** A keyframe: time, value, and the easing of the move that arrives at it. */
export type Key = [t: number, v: number, e?: Ease];

export function kf(t: number, keys: Key[]): number {
  const first = keys[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!;
    if (t <= b[0]) {
      const a = keys[i - 1]!;
      return mix(a[1], b[1], E[b[2] ?? "io"](clamp01((t - a[0]) / (b[0] - a[0] || 1))));
    }
  }
  return keys[keys.length - 1]![1];
}

/** A swing that dies away: starts at `t0`, `amp` at its first peak. */
export function swing(t: number, t0: number, amp: number, period: number, decay: number): number {
  if (t < t0) return 0;
  const s = t - t0;
  return amp * Math.exp(-s / decay) * Math.sin((s / period) * Math.PI * 2);
}

/** A short bump (0, up to 1, back to 0) between t0 and t1. */
export const bump = (t: number, t0: number, t1: number) => (t <= t0 || t >= t1 ? 0 : Math.sin(((t - t0) / (t1 - t0)) * Math.PI));
