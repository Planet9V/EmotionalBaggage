// The worked example's enclosure is the owner's tag (Rev D): where the welcome page draws the example's 3D model,
// the shell takes the tag's own outline (scenes/film/tagShape.ts) instead of the box of its size, so the model in
// the views is the same shape as the tag in the hero and the film. The outline is in the Physical layout frame of
// the example's rows (docs/design/baggage-claims-revD.md, "Layout frame"): x across the tag, z along it with the
// strap's end at -z, the back plate as the floor and the perforated front as the lid.
import type { ShellOutline } from "@/components/three/canvasTypes";
import { SLOT, TAG_MM, rounded, tagOutline, type P2 } from "../scenes/film/tagShape";

/** The printed tag's colour in the views: Bambu PETG HF Peanut Brown, as the film and the hero show it. */
export const TAG_TONE = "#b0703f";

const flat = (pts: P2[]): [number, number][] => pts.map(([x, y]) => [-x, -y]);
const slotY = TAG_MM.h / 2 - SLOT.down;
const SLOT_HOLE = rounded(
  [
    [-SLOT.w / 2, slotY - SLOT.h / 2],
    [SLOT.w / 2, slotY - SLOT.h / 2],
    [SLOT.w / 2, slotY + SLOT.h / 2],
    [-SLOT.w / 2, slotY + SLOT.h / 2],
  ],
  [1.5, 1.5, 1.5, 1.5],
  3,
);

/** The tag as a shell outline: its edge, the same edge one wall (2 mm) in, and the strap slot through the lid. */
const TAG_SHELL: ShellOutline = { outer: flat(tagOutline(0, 6)), inner: flat(tagOutline(2, 6)), lidHoles: [flat(SLOT_HOLE)] };
/** The same with square-cut corners, for a line drawing: a fillet drawn as facets reads as noise. */
const TAG_SHELL_PLAIN: ShellOutline = { outer: flat(tagOutline(0, 1)), inner: flat(tagOutline(2, 1)), lidHoles: [flat(SLOT_HOLE)] };

/**
 * The outline for an enclosure of this size ([x across, y up, z along] in mm): the tag's, when the enclosure is
 * the tag (the example's rows give it the tag's own size); otherwise none, and the shell is drawn as its box.
 */
export function shellOutlineFor(size: readonly number[] | undefined, plain = false): ShellOutline | undefined {
  if (!size) return undefined;
  const is = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 0.05;
  return is(size[0], TAG_MM.w) && is(size[1], TAG_MM.t) && is(size[2], TAG_MM.h) ? (plain ? TAG_SHELL_PLAIN : TAG_SHELL) : undefined;
}
