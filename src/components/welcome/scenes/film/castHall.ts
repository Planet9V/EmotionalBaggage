// The people at the carousel, acted beat by beat: a stranger waiting for her own bag, the bag's owner filming it from
// across the hall, and someone further back. The bag's joy reaches them one after another: the owner first (he is
// filming it), the one at the back at "Wheee", the stranger only when it comes round again, right past her.
import { BAG_MID, type BagPose, type V3 } from "./kit";
import { bump, clamp01, kf, mix } from "./ease";
import { footAt, stepFoot } from "./gait";
import { blendHead, faceTo, fidget, shake, take } from "./acting";
import { onBody, type FigPose } from "./people";
import type { Scene } from "../scenes";
import { voiceOf } from "../speech";

const STRANGER: V3 = [-2.55, 0, 3.0];
const STRANGER_YAW = 2.35;
const HOST: V3 = [3.9, 0, -3.4];
const HOST_YAW = -0.35;
const WATCHER: V3 = [-3.2, 0, -3.3];
const WATCHER_YAW = 0.7;

type Cue = { bag: (t: number) => BagPose; scene: Scene; againAt: number; belt: (s: number) => V3 };

export function hallCast({ bag, scene, againAt, belt }: Cue) {
  const bagAt = (t: number): V3 => {
    const b = bag(t).p;
    return [b[0], b[1] + BAG_MID, b[2]];
  };
  /** How far the head turns from a body at `p` facing `yaw` to the bag, clamped. */
  const headTo = (p: V3, yaw: number, t: number) => faceTo(p, yaw, bagAt(t));

  /**
   * The stranger, waiting for her own bag: eyes scanning the belt, a look at her watch; as ours comes round again,
   * her eyes catch it, her head goes back to the belt and snaps round again (the double take), a step in, the point,
   * the question; then she looks across the hall for whoever owns it.
   */
  function stranger(t: number): FigPose {
    const b = bag(t).p;
    const watching = kf(t, [[againAt + 300, 0], [againAt + 600, 1], [7300, 1], [7400, 0.3], [7520, 1]]);
    const tk = take(t, 7500, 1);
    const ask = kf(t, [[8050, 0], [8400, 1, "back"], [9800, 1], [10300, 0.4]]);
    const watch = kf(t, [[2000, 0], [2300, 1], [2900, 1], [3200, 0]]);
    const toHost = kf(t, [[9250, 0], [9600, 1]]);
    const dir = Math.atan2(b[0] - STRANGER[0], b[2] - STRANGER[2]);
    const yaw = STRANGER_YAW + 0.5 * kf(t, [[7500, 0], [7900, 1]]) * Math.max(-1, Math.min(1, Math.atan2(Math.sin(dir - STRANGER_YAW), Math.cos(dir - STRANGER_YAW))));
    // a step in toward the belt
    const plant = footAt(STRANGER, STRANGER_YAW, 1);
    const inward = { at: [plant.at[0] + 0.25 * Math.sin(STRANGER_YAW), 0, plant.at[2] + 0.25 * Math.cos(STRANGER_YAW)] as V3, yaw: STRANGER_YAW + 0.2 };
    const stepIn = kf(t, [[7650, 0], [7950, 1]]);
    // scanning the belt for her own bag: a point that drifts along it
    const scan = belt(1.5 + 2.2 * Math.sin(t / 2300));
    const scanHead = faceTo(STRANGER, yaw, [scan[0], 0.6, scan[2]]);
    const head = blendHead(blendHead(scanHead, headTo(STRANGER, yaw, t - 150), watching), faceTo(STRANGER, yaw, [HOST[0], 1.6, HOST[2]]), toHost);
    const wrist = onBody(STRANGER, yaw, 0, [-0.08, 1.12, 0.3]);
    return {
      p: STRANGER,
      yaw,
      footR: stepFoot(t, 7650, 7950, plant, inward),
      hipZ: 0.1 * stepIn,
      hipX: fidget(t, 13) * (1 - stepIn),
      lean: 0.14 * ask + tk.lean + 0.06 * stepIn,
      squash: tk.squash,
      head: head.head,
      nod: head.nod - 0.15 * tk.back + 0.35 * watch,
      tilt: 0.12 * toHost,
      look: watch > 0.5 ? wrist : toHost > 0.5 ? [HOST[0], 1.6, HOST[2]] : watching > 0.5 || t > 5200 ? bagAt(t) : [scan[0], 0.6, scan[2]],
      brow: 0.9 * tk.brow + 0.3 * ask - 0.2 * kf(t, [[9900, 0], [10300, 1]]),
      blink: Math.max(tk.blink, bump(t, 7330, 7460)),
      mouth: tk.brow > 0.5 && t < 8300 ? "o" : "flat",
      talk: voiceOf(scene, "stranger", t),
      // a look at her watch, then the point after it as she asks
      handL: watch > 0 ? wrist : null,
      aimL: watch > 0.3 ? onBody([0, 0, 0], yaw, 0, [1, 0, 0.3]) : undefined,
      palmL: watch > 0.3 ? [0, -1, 0] : undefined,
      handR: ask > 0.01 ? [mix(STRANGER[0] + 0.25, b[0], 0.3 * ask), mix(0.8, 1.25, ask), mix(STRANGER[2] - 0.1, b[2], 0.3 * ask)] : null,
      shapeR: ask > 0.3 ? "point" : undefined,
      aimR: ask > 0.3 ? [b[0] - STRANGER[0], 0.1, b[2] - STRANGER[2]] : undefined,
    };
  }

  /**
   * The owner, filming it from across the hall and grinning; he bounces on his toes with each of its hops; when the
   * stranger asks, he lowers the phone, looks over to her, and owns it, a hand on his chest.
   */
  function host(t: number): FigPose {
    const turn = headTo(HOST, HOST_YAW, t - 100);
    const a = HOST_YAW + turn.head * 0.6;
    const bounce = bump(t, 4780, 5100) + bump(t, 5280, 5600);
    const lower = kf(t, [[8550, 0], [8950, 1]]);
    const toStranger = kf(t, [[8450, 0], [8800, 1]]);
    const mine = kf(t, [[9200, 0], [9500, 1, "back"], [10200, 1], [10600, 0]]);
    const filming: V3 = [HOST[0] + 0.48 * Math.sin(a), 1.38, HOST[2] + 0.48 * Math.cos(a)];
    const low = onBody(HOST, HOST_YAW, 0, [0.22, 1.02, 0.22]);
    const head = blendHead(turn, faceTo(HOST, HOST_YAW, [STRANGER[0], 1.6, STRANGER[2]]), toStranger);
    const heel = 0.35 * bounce;
    return {
      p: HOST,
      yaw: HOST_YAW,
      footL: { at: footAt(HOST, HOST_YAW, -1).at, heel },
      footR: { at: footAt(HOST, HOST_YAW, 1).at, heel },
      hipY: -0.012 + 0.045 * bounce,
      hipX: fidget(t, 17) * 0.6,
      shrug: 0.4 * mine,
      head: head.head * 0.8,
      nod: head.nod,
      tilt: 0.12 * mine,
      look: toStranger > 0.5 ? [STRANGER[0], 1.55, STRANGER[2]] : bagAt(t),
      mouth: t > 3900 ? "grin" : "smile",
      brow: 0.4 * kf(t, [[3800, 0], [4200, 1]]) + 0.4 * mine,
      squint: 0.4 * bounce,
      handR: [mix(filming[0], low[0], lower), mix(filming[1], low[1], lower), mix(filming[2], low[2], lower)],
      aimR: lower > 0.5 ? onBody([0, 0, 0], HOST_YAW, 0, [0, 0.3, 1]) : [0, 1, 0],
      palmR: lower > 0.5 ? [0, 1, 0] : [-Math.sin(a), 0, -Math.cos(a)],
      elbowR: [0.5, -1, 0],
      handL: mine > 0 ? onBody(HOST, HOST_YAW, 0, [mix(-0.3, -0.05, mine), mix(0.8, 1.2, mine), mix(0.03, 0.2, mine)]) : null,
      shapeL: mine > 0.4 ? "open" : undefined,
      palmL: mine > 0.4 ? onBody([0, 0, 0], HOST_YAW, 0, [0, 0, -1]) : undefined,
      aimL: mine > 0.4 ? onBody([0, 0, 0], HOST_YAW, 0, [1, 0.3, 0]) : undefined,
    };
  }

  /** Someone further back: idle, a double take at "Wheee", a grin at its hops, a glance at the owner, then bored again. */
  function watcher(t: number): FigPose {
    const tk = take(t, 3950, 0.6);
    const on = kf(t, [[3850, 0], [4050, 1], [6200, 1], [6500, 0.3], [7400, 0]]);
    const grin = kf(t, [[4900, 0], [5100, 1], [5900, 1], [6300, 0]]);
    const toHost = kf(t, [[6300, 0], [6600, 1], [7200, 1], [7500, 0]]);
    const head = blendHead(blendHead({ head: 0.2, nod: 0.05 }, headTo(WATCHER, WATCHER_YAW, t - 150), on), faceTo(WATCHER, WATCHER_YAW, [HOST[0], 1.6, HOST[2]]), toHost);
    return {
      p: WATCHER,
      yaw: WATCHER_YAW,
      hipX: fidget(t, 21),
      lean: tk.lean,
      squash: tk.squash + 0.02 * shake(t, grin),
      head: head.head,
      nod: head.nod - 0.12 * tk.back + 0.25 * clamp01((t - 7600) / 400),
      look: toHost > 0.5 ? [HOST[0], 1.6, HOST[2]] : on > 0.3 ? bagAt(t) : null,
      brow: 0.8 * tk.brow,
      blink: tk.blink,
      mouth: grin > 0.4 ? "grin" : tk.brow > 0.5 ? "o" : "flat",
      squint: 0.5 * grin,
    };
  }

  return { stranger, host, watcher };
}
