// The people in the two outdoor scenes, acted beat by beat. Each pose is a function of the scene's clock, built from
// the beats a director would give: an anticipation before each move, a held pose, a take, overlap (the eyes go first,
// the head follows, the body last), and a settle after. Reactions are staggered, never at the same instant.
import { BAG_MID, HANDLE_Y, type BagPose, type V3 } from "./kit";
import { E, bump, clamp01, kf, mix, swing } from "./ease";
import { footAt, stepFoot, swingOf, walk, walks, type Walk } from "./gait";
import { blendHead, faceTo, fidget, shake, take } from "./acting";
import { onBody, type FigPose } from "./people";

const mid = (b: BagPose, y = BAG_MID): V3 => [b.p[0], b.p[1] + y, b.p[2]];
/** Several takes at once, added together. */
function takes(t: number, at: [number, number][]) {
  const all = at.map(([t0, size]) => take(t, t0, size));
  const sum = (k: "squash" | "back" | "brow" | "blink" | "lean") => all.reduce((a, x) => a + x[k], 0);
  return { squash: sum("squash"), back: sum("back"), brow: sum("brow"), blink: Math.min(1, sum("blink")), lean: sum("lean") };
}

// ---- the toss -------------------------------------------------------------------------------------------------

/** What the toss tells its handler: the bag's pose, the scene's own clock (it stops in the freeze), and its beats. */
type TossCue = { bag: (t: number) => BagPose; held: (t: number) => number; release: number; land: number; at: V3 };

export function tossCast({ bag, held, release, land, at }: TossCue) {
  const AWAY = 1.2;
  const CART = -1.75;
  const BACK = 0.8;
  // he turns on his feet: to the cart for the next bag, and back again
  const turns: Walk[] = [
    { t0: 2350, t1: 2900, path: () => at, yaw0: AWAY, yaw1: CART },
    { t0: 4450, t1: 5050, path: () => at, yaw0: CART, yaw1: BACK },
  ];
  const planted = footAt(at, AWAY, -1);
  const stride = { at: [planted.at[0] + 0.28 * Math.sin(AWAY), 0, planted.at[2] + 0.28 * Math.cos(AWAY)] as V3, yaw: AWAY + 0.25 };

  return function handler(t: number): FigPose {
    const s = held(t);
    const b = bag(t);
    const bagAt = mid(b);
    // the beats, in the scene's own time
    const windup = kf(s, [[350, 0], [900, 1], [release - 60, 0.3], [release, 0]]);
    const effort = kf(s, [[300, 0], [700, 1], [release, 1], [release + 250, 0]]);
    const through = kf(s, [[820, 0], [1080, 1], [1500, 1], [1820, 0]]);
    const thud = take(s, land + 40, 0.75);
    const shrugOff = kf(s, [[land + 200, 0], [land + 320, 1, "out"], [land + 600, 0]]);
    const turned = kf(s, [[2350, 0], [2900, 1], [4450, 1], [5050, 0]]);
    const reach = kf(s, [[2900, 0], [3250, 1], [4300, 1], [4500, 0]]);
    // he heard something: a freeze at the end of the line, then the slow look round
    const hark = kf(s, [[4320, 0], [4420, 1, "out"], [4700, 0.6], [5400, 0]]);
    const puzzled = kf(s, [[4800, 0], [5200, 1]]);
    const scratch = kf(s, [[6100, 0], [6450, 1], [7050, 1], [7350, 0]]);
    const shrug = kf(s, [[7350, 0], [7600, 1, "back"], [7950, 1], [8300, 0]]);
    const feet = walks(s, turns);
    const into = s < 2350 ? (s < 1300 ? stepFoot(s, 820, 1080, planted, stride) : stepFoot(s, 1500, 1820, stride, planted)) : null;
    const yaw = mix(AWAY, CART, turned) + (s > 4450 ? (BACK - AWAY) * E.io(clamp01((s - 4450) / 600)) : 0);
    // looking round for whatever said that: the eyes sweep ahead of the head
    const sweep = s > 5150 ? 0.85 * Math.sin((s - 5150) / 430) * clamp01((s - 5150) / 300) * (1 - 0.7 * shrug) : 0;
    const eyeSweep = s > 5050 ? 0.95 * Math.sin((s - 5050) / 430) * clamp01((s - 5050) / 300) * (1 - 0.7 * shrug) : 0;
    const ahead = (a: number): V3 => [at[0] + 3 * Math.sin(yaw + a), 1.5, at[2] + 3 * Math.cos(yaw + a)];
    // watching it fly: the head follows the bag, a beat behind the eyes
    const follow = s < land + 300 ? faceTo(at, yaw, mid(bag(t - 120))) : { head: 0, nod: 0 };
    const watching = kf(s, [[release, 0], [release + 250, 0.8], [land + 300, 0.8], [land + 600, 0]]);
    let hand: (side: number) => V3 | null = () => null;
    if (s < release + 60) {
      const a = b.tumble ?? 0;
      const h = HANDLE_Y - BAG_MID;
      hand = (side) => [b.p[0] - Math.sin(a) * h, b.p[1] + BAG_MID + Math.cos(a) * h, b.p[2] + side * 0.09];
    } else if (s < 1500) {
      hand = (side) => [-0.45, 1.62 - 0.35 * clamp01((s - release) / 350), 0.45 + side * 0.12];
    } else if (reach > 0 && turned > 0.9) {
      hand = (side) => [-2.05, mix(0.8, 1.05, reach) + 0.02 * Math.sin(s / 140 + side), 0.2 + side * 0.16];
    } else if (scratch > 0) {
      hand = (side) => (side > 0 ? onBody(at, yaw, 0, [-0.17, mix(0.95, 1.74, scratch) + 0.02 * Math.sin(s / 70) * scratch, -0.04]) : null);
    } else if (shrug > 0) {
      hand = (side) => onBody(at, yaw, 0, [-side * mix(0.3, 0.42, shrug), mix(0.8, 0.98, shrug), mix(0.05, 0.25, shrug)]);
    }
    return {
      p: at,
      yaw,
      footL: into ?? feet.footL,
      footR: feet.footR,
      // back and round on the wind-up, through and down into the throw, a settle after
      twist: -0.45 * windup + 0.25 * bump(s, 900, 1500) + swing(s, 1500, 0.06, 500, 300),
      lean: -0.22 * windup + 0.32 * kf(s, [[900, 0], [release, 1, "in"], [1500, 0]]) + swing(s, 1500, 0.05, 520, 320) + thud.lean + 0.3 * reach + 0.12 * puzzled * (1 - shrug),
      hipZ: 0.12 * through - 0.05 * windup,
      hipY: -0.012 - 0.07 * through - 0.04 * windup - 0.05 * reach + fidget(s, 2) * 0.3,
      hipX: s > 5000 ? fidget(s, 4) : 0,
      squash: thud.squash + 0.03 * bump(s, 4320, 4500),
      shrug: 0.35 * shrugOff + 0.5 * thud.back + 0.8 * shrug,
      head: mix(0, follow.head, watching) + sweep,
      nod: mix(0, follow.nod, watching) - 0.15 * thud.back - 0.1 * hark + 0.18 * reach,
      tilt: 0.18 * puzzled * Math.sin((s - 5000) / 900) * (1 - shrug) - 0.12 * scratch,
      look: s < land + 600 ? bagAt : reach > 0.3 ? [-2.05, 0.9, 0.2] : s > 5050 ? ahead(eyeSweep) : null,
      browIn: 0.7 * effort - 0.6 * puzzled,
      brow: 0.9 * thud.brow + 0.7 * hark + 0.3 * puzzled + 0.5 * shrug - 0.4 * effort,
      mouth: s > 650 && s < release ? "wince" : s >= release && s < release + 380 ? "open" : thud.brow > 0.6 && s < land + 500 ? "o" : shrug > 0.4 ? "frown" : puzzled > 0.5 ? "closed" : "flat",
      blink: Math.max(thud.blink, bump(s, 4330, 4460), bump(s, 7300, 7430)),
      handL: hand(1),
      handR: hand(-1),
      // gripping the handle until it goes, open hands after; a grip in the cart; open palms to shrug
      shapeL: s < release + 60 || reach > 0.6 ? "grip" : scratch > 0.3 ? "relax" : "open",
      shapeR: s < release + 60 || reach > 0.6 ? "grip" : "open",
      aimL: s < release + 60 ? [Math.sin(b.tumble ?? 0), -Math.cos(b.tumble ?? 0), 0] : undefined,
      aimR: s < release + 60 ? [Math.sin(b.tumble ?? 0), -Math.cos(b.tumble ?? 0), 0] : undefined,
      palmL: shrug > 0.4 ? [0, 1, 0] : undefined,
      palmR: shrug > 0.4 ? [0, 1, 0] : undefined,
    };
  };
}

// ---- the handle -----------------------------------------------------------------------------------------------

/** What the handle scene tells its people: the bag's pose. */
type HandleCue = { bag: (t: number) => BagPose };

const OWNER_X = -0.76;
const WATCHER: V3 = [1.75, 0, -0.45];
const WATCHER_YAW = -0.8;
/** Where the camera is for the last shot: the owner's look down the lens. */
const LENS: V3 = [0.95, 1.18, 5.0];

export function handleCast({ bag }: HandleCue) {
  /** The owner walks in along the front, side on, and turns to face us as he stops by the bag. */
  const ownerWalk: Walk = { t0: 80, t1: 2150, path: (u) => [mix(-3.6, OWNER_X, u), 0, -0.05], yaw0: Math.PI / 2, yaw1: 0.3, stride: 0.66 };

  function owner(t: number): FigPose {
    const b = bag(t);
    const gait = walk(t, ownerWalk);
    const { p, yaw } = gait;
    const handle = mid(b, HANDLE_Y);
    // the stop settles; a look at the handle and a breath before the reach; the hand closes; a held beat; the lift
    const settle = swing(t, 2150, 0.02, 380, 220);
    const stoop = kf(t, [[2300, 0], [2800, 1], [3150, 0.85], [3500, 0]]);
    const reach = kf(t, [[2350, 0], [2850, 1]]);
    const heave = kf(t, [[3150, 0], [3300, 1, "out"], [3700, 0.3], [4300, 0]]);
    const holding = kf(t, [[3200, 0], [3700, 1]]);
    // each "whoa" jolts him less: he gets used to it
    const tk = takes(t, [[5130, 1], [5430, 0.45], [5730, 0.3]]);
    // through "dinner first?" he turns his head to it, slowly; then the deadpan look down, and down the lens
    const regard = kf(t, [[6300, 0], [7100, 1]]);
    const glance = kf(t, [[7950, 0], [8400, 1]]);
    const lens = kf(t, [[8650, 0], [8780, 1]]);
    const headToLens = kf(t, [[8850, 0], [9250, 0.55]]);
    const grip: V3 = [b.p[0], b.p[1] + HANDLE_Y + 0.03, b.p[2] + 0.012];
    const toBag = faceTo(p, yaw, mid(bag(t - 120)));
    const toLens = faceTo(p, yaw, LENS);
    const amount = t < 1100 ? 0 : t < 2150 ? 0.45 : t < 3200 ? 0.85 : 0.5 + 0.5 * regard;
    const headPose = blendHead(blendHead({ head: 0, nod: 0 }, toBag, amount), toLens, headToLens);
    const swingHand = (side: number): V3 => onBody(p, yaw, 0, [side * 0.3, 0.8, swingOf(gait, side)]);
    return {
      p,
      yaw,
      footL: gait.footL,
      footR: gait.footR,
      hipY: (gait.walking ? gait.bob : -0.012) + settle - 0.06 * stoop,
      hipX: gait.sway - 0.035 * holding + (t > 4300 ? fidget(t, 1) * 0.5 : 0),
      // the reach bends him over it; taking the weight, he leans away from it with the shoulder up
      bend: 0.32 * stoop,
      lean: tk.lean - 0.08 * heave,
      side: 0.12 * heave + 0.05 * holding,
      squash: tk.squash,
      shrug: 0.35 * heave + 0.2 * tk.back,
      head: headPose.head + 0.08 * glance,
      nod: headPose.nod + 0.12 * stoop - 0.2 * tk.back + 0.3 * glance,
      tilt: 0.1 * regard * (1 - lens),
      look: t < 1100 ? null : lens > 0.5 ? LENS : t < 3200 ? handle : mid(b),
      brow: 0.9 * tk.brow - 0.25 * glance + 0.35 * lens - 0.3 * heave,
      browIn: 0.5 * heave,
      blink: Math.max(tk.blink, bump(t, 8600, 8730), bump(t, 9350, 9480)),
      lids: 0.3 * regard * (1 - tk.brow) + 0.2 * glance,
      mouth: tk.brow > 0.6 ? "o" : heave > 0.5 ? "wince" : "flat",
      // the arms swing against the legs as he walks; then the reach, open hand closing round the bar
      handL: gait.walking ? swingHand(-1) : null,
      handR: reach > 0 ? [mix(p[0] + 0.3, grip[0], reach), mix(0.8, grip[1], reach), mix(0.0, grip[2], reach)] : gait.walking ? swingHand(1) : null,
      shapeR: reach > 0.92 ? "grip" : reach > 0 ? "open" : undefined,
      aimR: reach > 0.3 ? [0.15, -1, 0.1] : undefined,
      palmR: reach > 0.3 ? [0, -0.2, -1] : undefined,
      elbowR: [0.5, -1, -0.3],
    };
  }

  /**
   * The bystander: head down in a phone, thumbing it; the double take at the first "whoa", a beat after the owner
   * starts (eyes, then head, then body); the phone up at arm's length to film it, grinning; at the punchline the
   * other hand flies to the mouth, a step back, and they fold over, shaking.
   */
  function bystander(t: number): FigPose {
    const b = bag(t);
    const look = kf(t, [[5170, 0], [5260, 1, "out"]]);
    const tk = take(t, 5220, 1);
    const film = kf(t, [[5480, 0], [5950, 1, "back"]]);
    const giggle = kf(t, [[6750, 0], [6950, 1], [7300, 0.4], [7800, 0]]);
    const laugh = kf(t, [[7900, 0], [8150, 1, "out"]]);
    const jiggle = shake(t, laugh + 0.3 * giggle);
    const fold = 0.42 * laugh + 0.05 * jiggle * laugh;
    const back = stepFoot(t, 7950, 8200, footAt(WATCHER, WATCHER_YAW, 1), { at: [WATCHER[0] + 0.22 * Math.sin(WATCHER_YAW + Math.PI) + 0.05, 0, WATCHER[2] + 0.22 * Math.cos(WATCHER_YAW + Math.PI)], yaw: WATCHER_YAW - 0.2 });
    const lean = tk.lean + 0.05 * film * (1 - laugh);
    const at = (l: V3) => onBody(WATCHER, WATCHER_YAW, lean + fold, l);
    // the phone: held low and read (the thumb working it), then raised to eye level at arm's length
    const phone: V3 = [mix(0.06, 0.16, film), mix(1.12, 1.62, film) - 0.14 * laugh + 0.02 * jiggle, mix(0.3, 0.62, film) - 0.1 * laugh];
    const phoneAt = at(phone);
    const gasp = kf(t, [[5220, 0], [5320, 1, "out"], [5750, 1], [6150, 0]]);
    const thumb = film < 0.2 && laugh === 0;
    return {
      p: [WATCHER[0], 0, WATCHER[2]],
      yaw: WATCHER_YAW + 0.12 * look,
      footR: back,
      hipX: fidget(t, 5) * (1 - film),
      hipY: -0.012 - 0.05 * laugh - 0.02 * tk.back,
      hipZ: -0.06 * laugh,
      lean,
      bend: fold,
      squash: tk.squash + 0.025 * jiggle,
      // reading; the take: eyes first, then the head snaps up
      nod: mix(0.5, -0.12, kf(t, [[5230, 0], [5330, 1, "out"]])) - 0.15 * tk.back + 0.2 * laugh,
      head: -0.1 * look,
      tilt: 0.15 * giggle + 0.1 * laugh,
      look: look < 0.5 ? phoneAt : mid(b),
      lids: 0.3 * (1 - look),
      brow: 1.0 * gasp + 0.5 * laugh + 0.3 * film * (1 - laugh) + 0.3 * giggle,
      blink: tk.blink,
      squint: Math.max(laugh, 0.6 * giggle),
      mouth: laugh > 0.3 ? "laugh" : gasp > 0.4 ? "o" : giggle > 0.4 ? "grin" : film > 0.6 ? "grin" : "flat",
      handR: phoneAt,
      // the phone: tipped up to read, then upright to film, its screen (and the palm behind it) toward the face
      aimR: onBody([0, 0, 0], WATCHER_YAW, 0, [0, mix(0.55, 1, film), mix(0.85, -0.1, film)]),
      palmR: onBody([0, 0, 0], WATCHER_YAW, 0, [0, mix(0.85, 0.05, film), mix(-0.55, -1, film)]),
      elbowR: [0.4, -1, -0.2],
      // the other hand: thumbing the phone, then down, then to the mouth
      handL: laugh > 0 ? at([mix(-0.31, -0.02, laugh), mix(0.8, 1.5, laugh), mix(0.03, 0.22, laugh)]) : thumb ? at([phone[0] - 0.09, phone[1] - 0.05 + 0.012 * Math.sin(t / 160), phone[2] + 0.02]) : null,
      shapeL: laugh > 0.5 ? "fist" : thumb ? "hold" : undefined,
      aimL: thumb ? onBody([0, 0, 0], WATCHER_YAW, 0, [0.6, 0.4, 0.6]) : undefined,
    };
  }

  return { owner, bystander };
}
