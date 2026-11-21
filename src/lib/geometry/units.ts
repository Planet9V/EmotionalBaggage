/**
 * Unit check for an attached shape file. STL and STEP files carry no reliable unit, so a file
 * drawn in metres or inches reads as a tiny or huge part. This flags that; it never rescales
 * on its own. The user picks a factor, which is then stored with the file.
 */

export type Extent = readonly [number, number, number];

/** Sizes a product part can plausibly have, in mm: a 0.5 mm SMD pad up to a 600 mm enclosure. */
export const PLAUSIBLE_MIN_MM = 0.5;
export const PLAUSIBLE_MAX_MM = 600;

export type UnitFactor = { label: string; factor: number };

/** The usual mix-ups: the file's numbers are in these units, so multiply by the factor to get mm. */
export const UNIT_FACTORS: UnitFactor[] = [
  { label: "metres to millimetres (x 1000)", factor: 1000 },
  { label: "centimetres to millimetres (x 10)", factor: 10 },
  { label: "inches to millimetres (x 25.4)", factor: 25.4 },
  { label: "micrometres to millimetres (x 0.001)", factor: 0.001 },
];

export type UnitCheck =
  | { ok: true; longest: number }
  | {
      ok: false;
      longest: number;
      problem: "tiny" | "huge";
      /** what the file would be at each usual factor, only those that land in the plausible range */
      suggestions: (UnitFactor & { longestMm: number })[];
      message: string;
    };

const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n >= 0.01 ? n.toFixed(2) : n.toExponential(1));

/** Judges the longest side of the file's bounding box, taken as mm. */
export function checkUnits(extent: Extent, scale = 1): UnitCheck {
  const longest = Math.max(...extent) * scale;
  if (!(longest > 0)) {
    return { ok: false, longest, problem: "tiny", suggestions: [], message: "The file has no size: its points are all in one place." };
  }
  if (longest >= PLAUSIBLE_MIN_MM && longest <= PLAUSIBLE_MAX_MM) return { ok: true, longest };
  const problem = longest < PLAUSIBLE_MIN_MM ? "tiny" : "huge";
  const suggestions = UNIT_FACTORS.map((u) => ({ ...u, longestMm: longest * u.factor }))
    .filter((u) => u.longestMm >= PLAUSIBLE_MIN_MM && u.longestMm <= PLAUSIBLE_MAX_MM);
  return {
    ok: false,
    longest,
    problem,
    suggestions,
    message: `The longest side reads as ${fmt(longest)} mm, which is ${problem === "tiny" ? "too small" : "too large"} for a part. The file may be in other units. It has not been rescaled.`,
  };
}
