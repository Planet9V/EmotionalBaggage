// The hero's tag, drawn and in 3D, share one frame so the 3D tag appears exactly where the drawn one stands: the
// numbers here say how the drawing is laid out (in millimetres of the real tag) and where the strap hangs from.
import { TAG_MM } from "../scenes/film/tagShape";

/** Strap above the tag's top edge, up to the rail it hangs from, in mm. */
export const STRAP_UP = 22;
/** Clear space round the drawn tag, in mm. */
export const MARGIN = 5;
/** The drawing's box in mm: the tag, its strap above and its margin (TagArt's viewBox). */
export const BOX_MM = { w: TAG_MM.w + MARGIN * 2, h: TAG_MM.h + STRAP_UP + MARGIN + 3 };
/** How far the 3D view reaches past the drawing's box on each side, as a share of the box: room for the turn and the sway. */
export const BLEED = { x: 0.14, top: 0.02, bottom: 0.06 };
