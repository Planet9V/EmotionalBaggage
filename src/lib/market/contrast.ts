// WCAG 2.x contrast, worked out in code. Relative luminance and ratio as defined in
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance and #dfn-contrast-ratio.

export type Rgb = [number, number, number];

/** "#E05A10" (or "E05A10") as 0-255 channels, or null when it is not a six-digit hex colour. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** Ratio from 1 to 21, or null when either colour is not a six-digit hex. */
export function contrastRatio(a: string, b: string): number | null {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return null;
  const la = luminance(x);
  const lb = luminance(y);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastLevel = "AAA" | "AA" | "AA large" | "fails";

/** WCAG levels for text: 7 for AAA, 4.5 for AA, 3 for large text and graphics only. */
export function levelFor(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "fails";
}

export type ColourCheck = {
  hex: string;
  onWhite: { ratio: number; level: ContrastLevel };
  onBlack: { ratio: number; level: ContrastLevel };
  /** set when the colour is under 3 to 1 against white or against black: it will not read there at all */
  warning: string | null;
  /** set when it reaches 3 to 1 but not 4.5 to 1 against white: fine for large text, not for body text */
  note: string | null;
};

/**
 * The check shown beside each brand colour: its ratio against white and against black, as the
 * colour would be used as text, a line or a button on a white page, or on a black one.
 * Against white and black the better of the two is never below 4.58 to 1, so no colour is
 * unreadable on both: a warning means the colour is too light to show on white. Weaker cases are notes.
 */
export function checkColour(hex: string): ColourCheck | null {
  const w = contrastRatio(hex, "#FFFFFF");
  const b = contrastRatio(hex, "#000000");
  if (w === null || b === null) return null;
  let warning: string | null = null;
  let note: string | null = null;
  if (w < 3) {
    warning = `Low contrast on white (${w.toFixed(2)}:1, under 3:1). As text or a line on a white page it will be hard to see. Use it as a fill with black text (${b.toFixed(2)}:1).`;
  } else if (b < 3) {
    note = `Too dark for a black page (${b.toFixed(2)}:1). On white it is ${w.toFixed(2)}:1.`;
  } else if (w < 4.5 && b < 4.5) {
    note = `Reads at 3:1 to 4.5:1 on both white (${w.toFixed(2)}:1) and black (${b.toFixed(2)}:1): fine for large text and buttons, not for body text.`;
  } else if (w < 4.5) {
    note = `On white this is ${w.toFixed(2)}:1: fine for large text and buttons, not for body text. With black text it is ${b.toFixed(2)}:1.`;
  }
  return { hex, onWhite: { ratio: w, level: levelFor(w) }, onBlack: { ratio: b, level: levelFor(b) }, warning, note };
}
