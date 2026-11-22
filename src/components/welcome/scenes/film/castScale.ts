// The people at the check-in desk, acted beat by beat: the agent and the bag's owner in scene 2, and the same two at
// the end of the day in the closing button. Reactions are staggered (the agent first, the owner a beat later at the
// desk; the owner first, the agent later at closing), every move has its anticipation and its settle, and between
// beats they breathe, shift their weight, type, fiddle with a strap.
import { BAG_MID, HANDLE_Y, type BagPose, type V3 } from "./kit";
import { bump, kf, mix } from "./ease";
import { walks, type Walk } from "./gait";
import { blendHead, faceTo, fidget, take } from "./acting";
import { onBody, type FigPose } from "./people";
import type { Scene } from "../scenes";
import { voiceOf } from "../speech";

export const AGENT_BACK: V3 = [-1.6, 0, -1.3];
const AGENT_YAW = 0.42;
export const HOST: V3 = [3.2, 0, 0.8];
const HOST_YAW = -2.3;
/** In the button the owner stands close, beside the scale, facing the bag. */
const HOST_B: V3 = [1.75, 0, 1.2];
const HOST_B_YAW = -2.2;
/** Where the camera is for the button's last shot, which the owner looks down. */
const LENS_B: V3 = [-2.8, 1.35, 3.8];
const DIR = (yaw: number, l: V3) => onBody([0, 0, 0], yaw, 0, l);

/** The agent: two short steps with the bag to the scale, then round the end of the desk to her place, turning to it. */
const AGENT_WALKS: Walk[] = [
  { t0: 500, t1: 1300, path: (u) => [mix(-0.78, -0.52, u), 0, 0.1], yaw0: Math.PI / 2, yaw1: Math.PI / 2, stride: 0.3 },
  {
    t0: 1950,
    t1: 3650,
    path: (u) => {
      const pts: [number, number][] = [[-0.52, 0.1], [-0.72, -0.55], [-1.0, -1.2], [AGENT_BACK[0], AGENT_BACK[2]]];
      const f = u * 3;
      const i = Math.min(2, Math.floor(f));
      const a = pts[i]!;
      const b = pts[i + 1]!;
      return [mix(a[0], b[0], f - i), 0, mix(a[1], b[1], f - i)];
    },
    yaw0: Math.PI / 2,
    yaw1: AGENT_YAW,
    lead: -1,
  },
];

type Cue = { bag: (t: number) => BagPose; scene: Scene; setDown: number; display: V3; pop: number };

export function scaleCast({ bag, scene, setDown, display }: Cue) {
  const bagAt = (t: number): V3 => {
    const b = bag(t).p;
    return [b[0], b[1] + BAG_MID, b[2]];
  };

  function agent(t: number): FigPose {
    const gait = walks(t, AGENT_WALKS);
    const { p, yaw } = gait;
    const b = bag(t).p;
    const holding = t < setDown + 150;
    const letGo = kf(t, [[setDown + 150, 0], [setDown + 420, 1]]);
    // she brushes her hands off after setting it down: two quick pats
    const brush = kf(t, [[1650, 0], [1760, 1], [1900, 1], [1990, 0]]);
    // typing at her place until the bag speaks; then the hands stop dead
    const typing = t > 3750 && t < 5950 && !(t > 4600 && t < 5000);
    const atDesk = kf(t, [[3550, 0], [3750, 1], [7600, 1], [7700, 0], [9300, 0], [9600, 1]]);
    // the take at "FAT?", a beat after the word: a quick crouch, back an inch, hands off the desk, then a slow stare down
    const tk = take(t, 7620, 1);
    const aback = kf(t, [[7650, 0], [7850, 1, "out"], [8700, 1], [9200, 0]]);
    const down = kf(t, [[8150, 0], [8650, 1], [9500, 1], [9900, 0]]);
    const toHost = kf(t, [[9950, 0], [10300, 1], [10950, 1], [11300, 0.2]]);
    const annoyed = kf(t, [[11050, 0], [11400, 1]]);
    const lean = (holding ? 0.12 : 0.12 * (1 - letGo)) + tk.lean + 0.06 * atDesk * (1 - aback);
    const palms = (side: number): V3 => onBody(p, yaw, lean, [side * 0.24, 1.12 + 0.06 * aback, 0.3]);
    const tap = (side: number) => (typing ? 0.018 * Math.max(0, Math.sin(t / 55 + (side > 0 ? 0 : 1.7))) : 0);
    const keys = (side: number): V3 => onBody(p, yaw, lean, [side * 0.17, 1.075 + tap(side), 0.36]);
    const carry = (side: number): V3 => [mix(b[0], p[0] + 0.06, letGo), mix(b[1] + HANDLE_Y - 0.01, 0.8, letGo), mix(b[2] - 0.03 + side * 0.09, 0.1 + side * 0.3, letGo)];
    const pat = (side: number): V3 => onBody(p, yaw, 0, [side * (0.05 + 0.04 * Math.abs(Math.sin(t / 45))), 1.0, 0.3]);
    const hand = (side: number): V3 | null => {
      if (aback > 0.01) return palms(side);
      if (letGo < 1) return carry(side);
      if (brush > 0) return pat(side);
      if (atDesk > 0.5) return keys(side);
      return null;
    };
    // eyes: on the bag while she carries it, ahead as she walks, on the number as it passes the limit, on the bag
    // when it speaks, on the owner for his line, then back to the bag, annoyed
    const walking = t > 1950 && t < 3500;
    const eyes: V3 | null = walking ? null : t > 4550 && t < 5050 ? display : t > 3650 && t < 5980 ? onBody(p, yaw, 0, [0, 1.06, 0.6]) : toHost > 0.5 && t < 11050 ? [HOST[0], 1.65, HOST[2]] : bagAt(t);
    const head = blendHead(blendHead(faceTo(p, yaw, onBody(p, yaw, 0, [0, 1.0, 0.8])), faceTo(p, yaw, display), kf(t, [[4600, 0], [4800, 1], [4950, 1], [5150, 0]])), faceTo(p, yaw, bagAt(t)), kf(t, [[6100, 0], [6500, 0.8], [9900, 0.8], [10200, 0], [11200, 0], [11600, 0.7]]));
    return {
      p,
      yaw,
      footL: gait.footL,
      footR: gait.footR,
      // knees bent to set it down gently
      hipY: (gait.walking ? gait.bob : -0.012) - 0.13 * bump(t, 1050, 1800) - 0.02 * tk.back,
      hipX: gait.sway + (t > 3700 ? fidget(t, 3) * 0.5 : 0),
      lean,
      squash: tk.squash,
      head: (atDesk > 0 || t > 6000 ? head.head : 0) + 0.75 * toHost * (1 - annoyed),
      nod: (atDesk > 0 || t > 6000 ? head.nod : 0) + 0.3 * down - 0.15 * tk.back + 0.08 * bump(t, 4750, 5000),
      tilt: 0.1 * down * Math.sin(t / 700) + 0.1 * annoyed,
      look: eyes,
      brow: 0.9 * tk.brow - 0.3 * down * (1 - aback) + 0.4 * kf(t, [[6900, 0], [7400, 1], [7650, 1]]) + 0.4 * bump(t, 9900, 10500) - 0.2 * annoyed,
      browIn: 0.6 * annoyed,
      blink: Math.max(tk.blink, bump(t, 9900, 10040), bump(t, 6000, 6130)),
      lids: 0.3 * down + 0.25 * annoyed,
      mouth: aback > 0.6 ? "o" : annoyed > 0.5 ? "frown" : "flat",
      talk: t < 10250 ? voiceOf(scene, "agent", t) : 0,
      handL: hand(-1),
      handR: hand(1),
      shapeL: aback > 0.01 || brush > 0 ? "open" : letGo < 0.5 ? "grip" : atDesk > 0.5 ? "relax" : undefined,
      shapeR: aback > 0.01 || brush > 0 ? "open" : letGo < 0.5 ? "grip" : atDesk > 0.5 ? "relax" : undefined,
      aimL: aback > 0.01 ? DIR(yaw, [0, 0.3, 1]) : letGo < 0.5 ? [0, -1, 0] : atDesk > 0.5 ? DIR(yaw, [0.1, -0.3, 1]) : undefined,
      aimR: aback > 0.01 ? DIR(yaw, [0, 0.3, 1]) : letGo < 0.5 ? [0, -1, 0] : atDesk > 0.5 ? DIR(yaw, [-0.1, -0.3, 1]) : undefined,
      palmL: aback > 0.01 ? DIR(yaw, [0, -0.3, 1]) : atDesk > 0.5 ? [0, -1, 0] : brush > 0 ? DIR(yaw, [1, 0, 0]) : undefined,
      palmR: aback > 0.01 ? DIR(yaw, [0, -0.3, 1]) : atDesk > 0.5 ? [0, -1, 0] : brush > 0 ? DIR(yaw, [-1, 0, 0]) : undefined,
    };
  }

  function host(t: number): FigPose {
    // waiting: a tug at the backpack strap, a glance at the number, a wince as it passes the limit
    const strap = kf(t, [[1800, 0], [2050, 1], [2800, 1], [3050, 0]]);
    const glance = kf(t, [[4400, 0], [4650, 1], [5300, 1], [5600, 0]]);
    const wince = kf(t, [[4750, 0], [4950, 1], [5800, 0.4], [6300, 0]]);
    // "FAT?": a smaller take than hers, a beat after it
    const tk = take(t, 7900, 0.5);
    const toAgent = kf(t, [[8800, 0], [9050, 0.5], [9700, 0.5], [10150, 1]]);
    // the line, with an open palm to the bag on "her", and a little shrug
    const offer = kf(t, [[10350, 0], [10700, 1, "back"], [11300, 1], [11700, 0]]);
    const headPose = blendHead(blendHead(faceTo(HOST, HOST_YAW, bagAt(t - 120)), faceTo(HOST, HOST_YAW, display), glance * 0.8), faceTo(HOST, HOST_YAW, [AGENT_BACK[0], 1.6, AGENT_BACK[2]]), toAgent);
    const strapAt = onBody(HOST, HOST_YAW, 0, [0.15, 1.18 - 0.03 * Math.abs(Math.sin(t / 120)) * strap, 0.17]);
    const palmTo = bagAt(t);
    const reach = onBody(HOST, HOST_YAW, 0, [0.3, 1.02, 0.24]);
    return {
      p: HOST,
      yaw: HOST_YAW,
      hipX: fidget(t, 7),
      lean: tk.lean,
      squash: tk.squash,
      twist: -0.15 * offer,
      shrug: 0.35 * bump(t, 10600, 11300) + 0.3 * tk.back,
      head: headPose.head,
      nod: headPose.nod - 0.15 * tk.back + 0.15 * kf(t, [[8200, 0], [8600, 1], [9700, 1], [10150, 0]]),
      tilt: 0.15 * offer,
      look: toAgent > 0.4 && offer < 0.5 ? [AGENT_BACK[0], 1.6, AGENT_BACK[2]] : glance > 0.5 ? display : bagAt(t),
      brow: 0.6 * tk.brow + 0.3 * offer,
      browIn: -0.6 * wince,
      blink: Math.max(tk.blink, bump(t, 10200, 10330)),
      lids: 0.25 + 0.1 * offer,
      mouth: wince > 0.5 ? "closed" : "flat",
      talk: voiceOf(scene, "host", t),
      handR: strap > 0 ? strapAt : offer > 0 ? [mix(reach[0], palmTo[0], 0.05 * offer), mix(reach[1], 1.05, offer), mix(reach[2], palmTo[2], 0.05 * offer)] : null,
      shapeR: strap > 0.3 ? "grip" : offer > 0.3 ? "open" : undefined,
      aimR: strap > 0.3 ? [0, -1, 0] : offer > 0.3 ? [palmTo[0] - HOST[0], 0, palmTo[2] - HOST[2]] : undefined,
      palmR: offer > 0.3 ? [0, 1, 0] : undefined,
    };
  }

  return { agent, host };
}

export function buttonCast({ bag, scene, pop }: Cue) {
  const bagAt = (t: number): V3 => {
    const b = bag(t).p;
    return [b[0], b[1] + BAG_MID, b[2]];
  };

  function agent(t: number): FigPose {
    // end of shift: chin on her fist, elbow on the desk, lids heavy; her eyes slide to the bag at "Sixty-two pounds?"
    // and drift back; the souvenirs wake her, a beat after the owner reacts: chin off the hand, up straight, a smile
    const slide = kf(t, [[1150, 0], [1400, 1], [2300, 1], [2700, 0]]);
    const tk = take(t, pop + 280, 1);
    const woke = kf(t, [[pop + 260, 0], [pop + 420, 1, "out"]]);
    const settle = kf(t, [[pop + 1400, 0], [pop + 2200, 1]]);
    const toHost = kf(t, [[6050, 0], [6300, 1]]);
    const lean = mix(0.2, 0.06, woke) + tk.lean;
    const chin = onBody(AGENT_BACK, AGENT_YAW, lean, [0.02, 1.43, 0.22]);
    const desk = onBody(AGENT_BACK, AGENT_YAW, lean, [0.2, 1.08, 0.4]);
    const head = blendHead(faceTo(AGENT_BACK, AGENT_YAW, bagAt(t - 150)), faceTo(AGENT_BACK, AGENT_YAW, [HOST_B[0], 1.65, HOST_B[2]]), toHost);
    return {
      p: AGENT_BACK,
      yaw: AGENT_YAW,
      lean,
      squash: tk.squash,
      hipX: fidget(t, 9) * 0.4,
      head: woke * head.head * 0.9,
      nod: mix(0.15, head.nod, woke) - 0.15 * tk.back,
      tilt: 0.12 * (1 - woke) + 0.08 * settle,
      look: woke > 0.3 ? (toHost > 0.5 ? [HOST_B[0], 1.65, HOST_B[2]] : bagAt(t)) : slide > 0.3 ? bagAt(t) : null,
      lids: 0.55 * (1 - woke) - 0.2 * slide * (1 - woke) + 0.12 * settle,
      brow: 0.9 * tk.brow + 0.25 * slide * (1 - woke) - 0.2 * (1 - woke) + 0.3 * toHost,
      blink: Math.max(tk.blink, bump(t, 2900, 3150), bump(t, 500, 750)),
      mouth: woke > 0.6 && t < pop + 1300 ? "o" : woke > 0.3 ? "smile" : "flat",
      handR: woke > 0 ? [mix(chin[0], desk[0], woke), mix(chin[1], desk[1], woke), mix(chin[2], desk[2], woke)] : chin,
      handL: onBody(AGENT_BACK, AGENT_YAW, lean, [-0.26, 1.06, 0.42]),
      // chin on her knuckles, the other hand flat on the desk; then both flat on it
      shapeR: woke > 0.5 ? "open" : "fist",
      aimR: woke > 0.5 ? DIR(AGENT_YAW, [-0.1, -0.2, 1]) : DIR(AGENT_YAW, [0, 1, 0.3]),
      palmR: woke > 0.5 ? [0, -1, 0] : DIR(AGENT_YAW, [-1, 0, 0]),
      elbowR: [0.2, -1, 0.3],
      shapeL: "open",
      aimL: DIR(AGENT_YAW, [0.2, 0, 1]),
      palmL: [0, -1, 0],
    };
  }

  function host(t: number): FigPose {
    // arms folded, watching the bag; a small nod at the number; he reacts to the pop first, leaning back; for the
    // line, he turns to us, body and all, looks down the lens, unimpressed, and opens his arms in a shrug
    const turn = kf(t, [[5500, 0], [5850, 1]]);
    const shrug = kf(t, [[5950, 0], [6250, 1, "back"], [7100, 1], [7500, 0.3]]);
    const tk = take(t, pop + 120, 0.6);
    const yaw = mix(HOST_B_YAW, -1.15, turn * 0.85);
    const fold = (side: number): V3 => onBody(HOST_B, yaw, 0, [-side * 0.13, 1.08 + 0.02 * side, 0.22]);
    const open = (side: number): V3 => onBody(HOST_B, yaw, 0, [side * 0.46, 0.98, 0.26]);
    const hand = (side: number): V3 => {
      const a = fold(side);
      const b = open(side);
      return [mix(a[0], b[0], shrug), mix(a[1], b[1], shrug), mix(a[2], b[2], shrug)];
    };
    const head = blendHead(faceTo(HOST_B, yaw, bagAt(t - 120)), faceTo(HOST_B, yaw, LENS_B), turn);
    return {
      p: [HOST_B[0], 0.03 * shrug, HOST_B[2]],
      yaw,
      hipX: fidget(t, 11) * (1 - turn),
      lean: tk.lean,
      squash: tk.squash,
      head: head.head,
      nod: head.nod - 0.12 * tk.back + 0.1 * bump(t, 1500, 2100) + 0.12 * bump(t, 6300, 6800),
      tilt: 0.14 * shrug,
      look: turn > 0.5 ? LENS_B : bagAt(t),
      brow: 0.6 * shrug + 0.7 * tk.brow + 0.35 * bump(t, 6800, 7300),
      lids: 0.3 * turn * (1 - 0.6 * bump(t, 6000, 6400)) + 0.15,
      blink: Math.max(tk.blink, bump(t, 5480, 5610)),
      mouth: shrug > 0.6 && t > 7150 ? "closed" : "flat",
      talk: voiceOf(scene, "host", t),
      handL: hand(-1),
      handR: hand(1),
      // folded arms open into a shrug, palms up
      shapeL: shrug > 0.4 ? "open" : undefined,
      shapeR: shrug > 0.4 ? "open" : undefined,
      palmL: shrug > 0.4 ? [0, 1, 0] : undefined,
      palmR: shrug > 0.4 ? [0, 1, 0] : undefined,
      aimL: shrug > 0.4 ? DIR(yaw, [-0.6, 0, 1]) : undefined,
      aimR: shrug > 0.4 ? DIR(yaw, [0.6, 0, 1]) : undefined,
      shrug: 0.7 * bump(t, 5950, 7300) + 0.3 * tk.back,
    };
  }

  return { agent, host };
}
