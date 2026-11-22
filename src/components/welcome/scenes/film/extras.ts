// Background life: two passers-by in each public scene (the curb, the check-in hall, the carousel). They idle, walk
// through on footfalls, glance at the bag on its loudest beat and get on with their day. Muted clothes, kept to the
// back of the set and mostly to the wide shots, so they never steal the shot.
import { BAG_MID, type BagPose, type V3 } from "./kit";
import { bump, kf, mix } from "./ease";
import { swingOf, walks, type Walk } from "./gait";
import { blendHead, faceTo, fidget } from "./acting";
import { onBody, type FigPose, type Role } from "./people";

export type Extra = { role: Role; tall: number; pose: (t: number) => FigPose };

const line = (a: V3, b: V3) => (u: number): V3 => [mix(a[0], b[0], u), 0, mix(a[2], b[2], u)];

/** Someone walking a straight line, arms swinging, who glances at `look` while `glance` is up. */
function walker(w: Walk[], look: (t: number) => V3, glance: (t: number) => number, seed: number) {
  return (t: number): FigPose => {
    const g = walks(t, w);
    const k = glance(t);
    const head = blendHead({ head: 0, nod: 0.05 }, faceTo(g.p, g.yaw, look(t - 150)), k * 0.8);
    return {
      p: g.p,
      yaw: g.yaw,
      footL: g.footL,
      footR: g.footR,
      hipY: g.walking ? g.bob : -0.012,
      hipX: g.walking ? g.sway : fidget(t, seed),
      head: head.head,
      nod: head.nod,
      look: k > 0.3 ? look(t) : null,
      brow: 0.4 * k,
      handL: g.walking ? onBody(g.p, g.yaw, 0, [-0.3, 0.8, swingOf(g, -1)]) : null,
      handR: g.walking ? onBody(g.p, g.yaw, 0, [0.3, 0.8, swingOf(g, 1)]) : null,
    };
  };
}

/** Someone standing about, weight shifting, who turns their head to `look` while `glance` is up. */
function stander(at: V3, yaw: number, look: (t: number) => V3, glance: (t: number) => number, seed: number, extra: (t: number) => Partial<FigPose> = () => ({})) {
  return (t: number): FigPose => {
    const k = glance(t);
    const head = blendHead({ head: 0.1 * Math.sin(t / 2600 + seed), nod: 0.08 }, faceTo(at, yaw, look(t - 150)), k);
    return { p: at, yaw, hipX: fidget(t, seed), head: head.head, nod: head.nod, look: k > 0.3 ? look(t) : null, brow: 0.5 * k, ...extra(t) };
  };
}

const bagMid = (bag: (t: number) => BagPose) => (t: number): V3 => {
  const p = bag(t).p;
  return [p[0], p[1] + BAG_MID, p[2]];
};

/** The curb: someone out of the doors and away to the right, gone before the close shots; someone by the trolley who turns at "whoa" and later leaves. */
export function curbExtras(bag: (t: number) => BagPose): Extra[] {
  const look = bagMid(bag);
  return [
    { role: "pax", tall: 1.02, pose: walker([{ t0: 0, t1: 6400, path: line([-0.1, 0, -3.3], [7, 0, -2.7]), stride: 0.62 }], look, (t) => kf(t, [[5150, 0], [5450, 1], [6100, 1], [6400, 0]]), 3) },
    {
      role: "pax2",
      tall: 0.96,
      pose: (t) => {
        const leave: Walk[] = [{ t0: 7400, t1: 10400, path: line([3.25, 0, -2.05], [6.8, 0, -2.6]), yaw0: -2.4, stride: 0.58 }];
        return t < 7400
          ? stander([3.25, 0, -2.05], -2.4, look, (s) => kf(s, [[5350, 0], [5650, 1], [6700, 1], [7100, 0]]), 5)(t)
          : walker(leave, look, () => 0, 5)(t);
      },
    },
  ];
}

/** The check-in hall: someone walking the length of the hall behind the desks; someone at the next desk who looks round at "FAT?". */
export function hallExtras(bag: (t: number) => BagPose): Extra[] {
  const look = bagMid(bag);
  return [
    { role: "pax2", tall: 1.0, pose: walker([{ t0: 0, t1: 11800, path: line([6.5, 0, -3.25], [-7.5, 0, -3.3]), stride: 0.64 }], look, (t) => kf(t, [[7550, 0], [7800, 1], [8600, 1], [8900, 0]]), 7) },
    {
      role: "pax",
      tall: 0.98,
      pose: stander([-5.75, 0, 0.32], Math.PI - 0.1, look, (t) => kf(t, [[7750, 0], [8050, 1], [9200, 1], [9600, 0]]), 9, (t) => ({
        // leaning on the desk, both hands on it
        lean: 0.12,
        handL: onBody([-5.75, 0, 0.32], Math.PI - 0.1, 0.12, [-0.2, 1.08, 0.38]),
        handR: onBody([-5.75, 0, 0.32], Math.PI - 0.1, 0.12, [0.22, 1.08, 0.36 + 0.01 * Math.sin(t / 900)]),
        shapeL: "open",
        shapeR: "open",
        palmL: [0, -1, 0],
        palmR: [0, -1, 0],
      })),
    },
  ];
}

/** The carousel: someone across the belt waiting for their own bag, eyes following the bags; someone crossing the back of the hall. */
export function carouselExtras(bag: (t: number) => BagPose, belt: (s: number) => V3): Extra[] {
  const look = bagMid(bag);
  const waiting: V3 = [2.4, 0, -2.95];
  return [
    {
      role: "pax",
      tall: 1.0,
      pose: stander(waiting, -0.25, (t) => {
        // watching the belt for their own bag, until ours shouts
        const k = kf(t, [[3800, 0], [4100, 1], [5900, 1], [6300, 0]]);
        const scan = belt(2 + 1.6 * Math.sin(t / 1900));
        const b = look(t);
        return [mix(scan[0], b[0], k), mix(0.5, b[1], k), mix(scan[2], b[2], k)];
      }, () => 0.85, 11, (t) => ({ brow: 0.6 * bump(t, 3800, 5000), squash: 0.03 * bump(t, 3900, 4100) })),
    },
    { role: "pax2", tall: 1.03, pose: walker([{ t0: 300, t1: 10800, path: line([-7, 0, -5.4], [6.5, 0, -5.2]), stride: 0.62 }], look, (t) => kf(t, [[3900, 0], [4200, 1], [5000, 1], [5300, 0]]), 13) },
  ];
}

