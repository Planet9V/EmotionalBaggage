// Walking, as footfalls: a walk is a list of steps, each foot either planted at one point or swinging from one plant
// to the next, and the body rides between the feet. A planted foot cannot slide, because its position is the plant
// itself; the body's speed comes from the steps, not the other way round. Pure functions of time.
import type { V3 } from "./kit";

export type Foot = { at: V3; yaw: number; lift: number; heel: number };
export type Gait = {
  /** the body's ground point and heading */
  p: V3;
  yaw: number;
  footL: Foot;
  footR: Foot;
  /** the hips' rise and fall, and their sway toward the standing foot (on the body's x) */
  bob: number;
  sway: number;
  /** whether this moment is inside the walk */
  walking: boolean;
};

/** One walk: along `path` (u from 0 to 1, on the ground) between t0 and t1, ending facing `yaw1` if given. */
export type Walk = { t0: number; t1: number; path: (u: number) => V3; yaw0?: number; yaw1?: number; lead?: -1 | 1; stride?: number };

const WIDTH = 0.105;
const SWING = 0.78;
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** The nearest equal of angle `a` to `ref` (so a turn takes the short way round from where it is). */
const near = (a: number, ref: number) => a + Math.round((ref - a) / (2 * Math.PI)) * 2 * Math.PI;

export type Plant = { at: V3; yaw: number };
type Plan = { steps: { side: number; from: Plant; to: Plant; t0: number; t1: number }[]; start: [Plant, Plant]; end: [Plant, Plant] };

const plans = new WeakMap<Walk, Plan>();

/** Where a foot is planted for a body standing at `at` facing `yaw`. */
export function footAt(at: V3, yaw: number, side: number): Plant {
  return { at: [at[0] + side * WIDTH * Math.cos(yaw), 0, at[2] - side * WIDTH * Math.sin(yaw)], yaw };
}

/** The walk's footfalls, worked out once per walk. */
function planOf(w: Walk): Plan {
  const cached = plans.get(w);
  if (cached) return cached;
  // the path, measured
  const N = 48;
  const pts: V3[] = [];
  const len: number[] = [0];
  for (let i = 0; i <= N; i++) pts.push(w.path(i / N));
  for (let i = 1; i <= N; i++) len.push(len[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![2] - pts[i - 1]![2]));
  const total = len[N]!;
  const at = (d: number): { p: V3; yaw: number } => {
    let i = 1;
    while (i < N && len[i]! < d) i++;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const f = clamp01((d - len[i - 1]!) / (len[i]! - len[i - 1]! || 1));
    return { p: [a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) };
  };
  const stride = w.stride ?? 0.62;
  const n = Math.max(2, Math.ceil(total / stride) + 1);
  let yaw = w.yaw0 ?? at(0).yaw;
  const start: [Plant, Plant] = [footAt(pts[0]!, yaw, -1), footAt(pts[0]!, yaw, 1)];
  const feet: [Plant, Plant] = [start[0], start[1]];
  const steps: Plan["steps"] = [];
  const T = (w.t1 - w.t0) / n;
  let side = w.lead ?? 1;
  for (let i = 0; i < n; i++) {
    // each step lands a little further along; the last two bring the feet together at the end, turned to its heading
    const d = i >= n - 2 ? total : (total * (i + 1)) / (n - 1);
    const here = at(d);
    const last = i >= n - 2;
    yaw = near(last && w.yaw1 !== undefined ? w.yaw1 : here.yaw, yaw);
    const k = side > 0 ? 1 : 0;
    const to = footAt(here.p, yaw, side);
    steps.push({ side, from: feet[k]!, to, t0: w.t0 + i * T, t1: w.t0 + i * T + T * SWING });
    feet[k] = to;
    side = -side as -1 | 1;
  }
  const plan: Plan = { steps, start, end: [feet[0], feet[1]] };
  plans.set(w, plan);
  return plan;
}

/** A foot moving from one plant to the next between t0 and t1: eased along the ground, lifted, heel first up. */
export function stepFoot(t: number, t0: number, t1: number, from: Plant, to: Plant, lift = 0.07): Foot {
  const p = clamp01((t - t0) / (t1 - t0));
  if (p <= 0) return { at: from.at, yaw: from.yaw, lift: 0, heel: 0 };
  if (p >= 1) return { at: to.at, yaw: to.yaw, lift: 0, heel: 0 };
  const e = ease(p);
  const mix = (a: number, b: number) => a + (b - a) * e;
  return {
    at: [mix(from.at[0], to.at[0]), lift * Math.sin(Math.PI * p), mix(from.at[2], to.at[2])],
    yaw: mix(from.yaw, near(to.yaw, from.yaw)),
    lift: Math.sin(Math.PI * p),
    // the heel comes up as the foot leaves, and the toe drops a touch before it lands
    heel: 0.5 * Math.sin(Math.PI * Math.min(1, p * 1.6)) * (1 - p) - 0.15 * Math.sin(Math.PI * clamp01((p - 0.6) / 0.4)),
  };
}

const still = (pl: Plant): Foot => ({ at: pl.at, yaw: pl.yaw, lift: 0, heel: 0 });

/** Where the feet and the body are at `t` on one walk. Before it the figure stands at its start, after it at its end. */
export function walk(t: number, w: Walk): Gait {
  const plan = planOf(w);
  let feet: [Foot, Foot] = [still(plan.start[0]), still(plan.start[1])];
  let bob = 0;
  let sway = 0;
  for (const s of plan.steps) {
    const k = s.side > 0 ? 1 : 0;
    if (t >= s.t1) feet[k] = still(s.to);
    else if (t > s.t0) {
      feet[k] = stepFoot(t, s.t0, s.t1, s.from, s.to);
      const p = (t - s.t0) / (s.t1 - s.t0);
      bob = 0.022 * Math.sin(Math.PI * p);
      // the weight goes over the standing foot
      sway = -s.side * 0.03 * Math.sin(Math.PI * p);
    }
  }
  if (t >= w.t1) feet = [still(plan.end[0]), still(plan.end[1])];
  const [L, R] = feet;
  const yaw = (L.yaw + near(R.yaw, L.yaw)) / 2;
  // the body is between the feet (their middle, with the side offsets taken back out)
  const p: V3 = [(L.at[0] + R.at[0]) / 2, 0, (L.at[2] + R.at[2]) / 2];
  const walking = t > w.t0 && t < w.t1;
  return { p, yaw, footL: L, footR: R, bob: walking ? bob - 0.012 : 0, sway: walking ? sway : 0, walking };
}

/** A chain of walks, one after another: between them the figure stands where the last one left it. */
export function walks(t: number, ws: Walk[]): Gait {
  let g = walk(t, ws[0]!);
  for (let i = 1; i < ws.length; i++) if (t >= ws[i]!.t0) g = walk(t, ws[i]!);
  return g;
}

/** How far forward a hand swings while walking: against the foot on the other side, as arms do. */
export function swingOf(g: Gait, side: number): number {
  const foot = side > 0 ? g.footL : g.footR;
  const fwd = (foot.at[0] - g.p[0]) * Math.sin(g.yaw) + (foot.at[2] - g.p[2]) * Math.cos(g.yaw);
  return 0.06 + 0.5 * fwd;
}
