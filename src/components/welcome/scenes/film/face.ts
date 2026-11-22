// The people's faces, as numbers: when an eye blinks, where a pupil points, which mouth is drawn. Pure functions of
// the scene's clock and the pose, so any moment can be drawn on its own and the logic can be tested without a canvas.

/** The mouths a face can make. `flat` is the deadpan the script asks for; the rest are beats. */
export type Mouth = "flat" | "closed" | "smile" | "grin" | "open" | "o" | "wince" | "laugh" | "frown";

/** Everything the face drawing needs at one moment. */
export type FaceState = {
  /** where the pupils point, -1 to 1 across and up */
  lookX: number;
  lookY: number;
  /** how far the upper lids are down, 0 open to 1 shut */
  lid: number;
  /** a squint from below, as a laugh or a wince pushes the cheeks up, 0 to 1 */
  squint: number;
  /** brows up (positive) or down; and drawn together at the middle (positive) or lifted there, worried (negative) */
  brow: number;
  browIn: number;
  mouth: Mouth;
  /** how far the jaw is open, 0 to 1 (talking, a gasp) */
  open: number;
};

/** A small deterministic hash, 0 to 1, so every figure blinks on its own rhythm and every run blinks alike. */
function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const BLINK_MS = 150;
const CLOSE_MS = 55;
const SHUT_MS = 30;

/**
 * How far the lids are closed by the figure's own blinking at `t` (0 open, 1 shut). Blinks come every 1.8 to 4.6
 * seconds, at times fixed by the seed; each takes 150 ms: down fast, a moment shut, up slower.
 */
export function blinkAt(t: number, seed: number): number {
  if (t < 0) return 0;
  let at = 300 + hash01(seed, 0) * 1600;
  for (let k = 1; at <= t && k < 400; k++) {
    if (t < at + BLINK_MS) return lidCurve(t - at);
    at += 1800 + hash01(seed, k) * 2800;
  }
  return 0;
}
/** The shape of one blink in time: 0 at 0 ms, 1 from 55 to 85 ms, 0 again at 150 ms. */
export function lidCurve(ms: number): number {
  if (ms <= 0 || ms >= BLINK_MS) return 0;
  if (ms < CLOSE_MS) return ms / CLOSE_MS;
  if (ms < CLOSE_MS + SHUT_MS) return 1;
  return 1 - (ms - CLOSE_MS - SHUT_MS) / (BLINK_MS - CLOSE_MS - SHUT_MS);
}

const HAPPY: Mouth[] = ["smile", "grin", "laugh"];
/**
 * The mouth to draw for a resting shape and a speech level (0 to 1): silent, the resting shape; speaking, the jaw
 * follows the level, rounded on the quieter part of a syllable and open on its peak, and a smiling mouth stays a
 * smile as it talks.
 */
export function mouthFor(rest: Mouth | undefined, talk: number): { mouth: Mouth; open: number } {
  const base = rest ?? "flat";
  if (talk < 0.08) return { mouth: base, open: base === "open" || base === "o" || base === "laugh" ? 1 : 0 };
  if (HAPPY.includes(base)) return { mouth: talk > 0.5 ? "laugh" : "grin", open: talk };
  if (base === "wince" || base === "frown") return { mouth: talk > 0.45 ? "open" : base, open: talk };
  if (talk > 0.55) return { mouth: "open", open: talk };
  if (talk > 0.25) return { mouth: "o", open: talk };
  return { mouth: "closed", open: talk };
}

/**
 * Where the pupils point for a target given in the head's own frame (x to its right hand, y up, z out of the face),
 * -1 to 1. A target behind the head pins the eyes to that side, as far as they go.
 */
export function pupilFor(x: number, y: number, z: number): [number, number] {
  const across = Math.atan2(x, Math.max(z, 1e-4));
  const up = Math.atan2(y, Math.hypot(x, z));
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return [clamp(across / 0.75), clamp(up / 0.6)];
}
