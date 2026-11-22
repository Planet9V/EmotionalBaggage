// The face, drawn: two eyes with lids and pupils, two brows and a mouth, in ink on a transparent canvas that is laid
// over the front of the head. Bold on purpose: a head is about twenty pixels tall on a phone, so every feature is a
// thick shape, never a hairline. The canvas is redrawn only when the quantised face changes (a blink, a glance, a
// new mouth), so most frames upload nothing.
import type { FaceState } from "./face";

export const FACE_W = 256;
export const FACE_H = 192;
/** The patch of the head the canvas covers, as angles from the front: across (each way) and up and down. */
export const FACE_ACROSS = 1.0;
export const FACE_UPDOWN = 0.75;

const INK = "#1d1f24";
const WHITE = "#fbfaf7";
const MOUTH = "#5b2228";
const TONGUE = "#e0707a";

const px = (a: number) => FACE_W / 2 + (a / FACE_ACROSS) * (FACE_W / 2);
const py = (b: number) => FACE_H / 2 - (b / FACE_UPDOWN) * (FACE_H / 2);
const sx = (a: number) => (a / FACE_ACROSS) * (FACE_W / 2);
const sy = (b: number) => (b / FACE_UPDOWN) * (FACE_H / 2);

/** The face reduced to the steps it is drawn at: two states with one key look the same. */
export function faceKey(f: FaceState): string {
  const q = (v: number, n: number) => Math.round(v * n);
  return [q(f.lookX, 6), q(f.lookY, 5), q(f.lid, 4), q(f.squint, 3), q(f.brow, 5), q(f.browIn, 4), f.mouth, q(f.open, 4)].join(",");
}

const EYE_X = 0.36;
const EYE_Y = 0.05;
const EYE_RX = 0.135;
const EYE_RY = 0.165;
const PUPIL = 0.085;

function eye(g: CanvasRenderingContext2D, side: number, f: FaceState, skin: string) {
  const cx = px(side * EYE_X);
  const cy = py(EYE_Y);
  const rx = sx(EYE_RX);
  const ry = sy(EYE_RY);
  const happy = f.mouth === "laugh" || f.mouth === "grin";
  // shut, or squeezed shut by a laugh or a wince: a thick arc instead of an eye
  if (f.lid > 0.82 || f.squint > 0.82) {
    g.strokeStyle = INK;
    g.lineWidth = 9;
    g.lineCap = "round";
    g.beginPath();
    if (f.squint > 0.82 && happy) g.arc(cx, cy + ry * 0.45, rx * 0.95, Math.PI * 1.15, Math.PI * 1.85);
    else if (f.squint > 0.82) {
      // a wince: two strokes pinched toward the nose
      g.moveTo(cx + side * rx, cy - ry * 0.5);
      g.lineTo(cx - side * rx * 0.6, cy);
      g.lineTo(cx + side * rx, cy + ry * 0.5);
    } else g.arc(cx, cy - ry * 0.25, rx * 0.95, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    return;
  }
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = WHITE;
  g.fill();
  g.clip();
  // the pupil, inside the white
  const pr = sx(PUPIL);
  g.fillStyle = INK;
  g.beginPath();
  g.arc(cx + f.lookX * (rx - pr * 0.75), cy - f.lookY * (ry - pr * 0.8), pr, 0, Math.PI * 2);
  g.fill();
  // the lids: the upper comes down, the lower comes up, both in the skin's colour
  g.fillStyle = skin;
  const top = cy - ry + 2 * ry * f.lid;
  g.fillRect(cx - rx - 2, cy - ry - 2, 2 * rx + 4, top - (cy - ry) + 2);
  const low = cy + ry - 2 * ry * 0.55 * f.squint;
  g.fillRect(cx - rx - 2, low, 2 * rx + 4, cy + ry - low + 2);
  g.restore();
  // the lid's edge, and the eye's outline, so it reads against pale skin
  g.strokeStyle = INK;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  if (f.lid > 0.08) {
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx - rx, top);
    g.lineTo(cx + rx, top);
    g.stroke();
  }
}

function brow(g: CanvasRenderingContext2D, side: number, f: FaceState) {
  const y = EYE_Y + 0.25 + 0.08 * f.brow;
  const inner = side * (EYE_X - 0.11);
  const outer = side * (EYE_X + 0.1);
  g.strokeStyle = INK;
  g.lineWidth = 12;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(px(outer), py(y + 0.02 * f.brow));
  g.lineTo(px(inner), py(y - 0.07 * f.browIn));
  g.stroke();
}

function mouth(g: CanvasRenderingContext2D, f: FaceState) {
  const cx = px(0);
  const cy = py(-0.43);
  const w = sx(0.2);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = INK;
  g.fillStyle = MOUTH;
  g.lineWidth = 10;
  const open = Math.max(0, Math.min(1, f.open));
  g.beginPath();
  switch (f.mouth) {
    case "flat":
      g.moveTo(cx - w * 0.6, cy);
      g.lineTo(cx + w * 0.6, cy);
      g.stroke();
      return;
    case "closed":
      g.moveTo(cx - w * 0.5, cy);
      g.quadraticCurveTo(cx, cy + 3, cx + w * 0.5, cy);
      g.stroke();
      return;
    case "smile":
      g.moveTo(cx - w, cy - 6);
      g.quadraticCurveTo(cx, cy + 16, cx + w, cy - 6);
      g.stroke();
      return;
    case "frown":
      g.moveTo(cx - w * 0.75, cy + 7);
      g.quadraticCurveTo(cx, cy - 10, cx + w * 0.75, cy + 7);
      g.stroke();
      return;
    case "o": {
      const r = 7 + 7 * open;
      g.ellipse(cx, cy + 2, r * 0.8, r, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      return;
    }
    case "open": {
      const h = 7 + 16 * open;
      g.ellipse(cx, cy + h * 0.3, w * 0.62, h * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      return;
    }
    case "grin":
    case "laugh": {
      // a D on its back: a straight top lip, a deep curve, open as far as the laugh goes
      const h = (f.mouth === "laugh" ? 18 : 8) + 10 * open;
      g.moveTo(cx - w, cy - 6);
      g.lineTo(cx + w, cy - 6);
      g.quadraticCurveTo(cx + w * 0.85, cy + h * 1.6, cx, cy + h * 1.5);
      g.quadraticCurveTo(cx - w * 0.85, cy + h * 1.6, cx - w, cy - 6);
      g.closePath();
      g.fill();
      // a tongue, light enough to read against dark skin
      g.save();
      g.clip();
      g.fillStyle = TONGUE;
      g.beginPath();
      g.ellipse(cx, cy + h * 1.45, w * 0.6, h * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      // teeth
      g.fillStyle = WHITE;
      g.fillRect(cx - w, cy - 6, w * 2, Math.min(10, 3 + h * 0.35));
      g.restore();
      g.beginPath();
      g.moveTo(cx - w, cy - 6);
      g.lineTo(cx + w, cy - 6);
      g.quadraticCurveTo(cx + w * 0.85, cy + h * 1.6, cx, cy + h * 1.5);
      g.quadraticCurveTo(cx - w * 0.85, cy + h * 1.6, cx - w, cy - 6);
      g.closePath();
      g.stroke();
      return;
    }
    case "wince": {
      // teeth clenched: a flat white bar, ink round it, a line between the rows
      const ww = w * 0.95;
      g.fillStyle = WHITE;
      g.rect(cx - ww, cy - 7, ww * 2, 14);
      g.fill();
      g.stroke();
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx - ww, cy);
      g.lineTo(cx + ww, cy);
      g.stroke();
      return;
    }
  }
}

/** Draws the whole face on its canvas, from scratch. `skin` colours the lids. */
export function drawFace(g: CanvasRenderingContext2D, f: FaceState, skin: string) {
  g.clearRect(0, 0, FACE_W, FACE_H);
  [-1, 1].forEach((s) => eye(g, s, f, skin));
  [-1, 1].forEach((s) => brow(g, s, f));
  mouth(g, f);
}
