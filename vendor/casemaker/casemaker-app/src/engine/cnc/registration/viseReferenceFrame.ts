/**
 * #1123-68 — THE Z1 VISE'S SHIPPED FRAME, "measured once on the reference unit".
 *
 * The Z1's vise locates on two pins, and the maintainer ruled (2026-10-13) that it is a PRODUCT CONSTANT: its
 * fixed jaw's machine position repeats across units. Without a frame no vise job can register (the guard has no
 * stock footprint to descend into, `registrationAttempt.ts`), and the app had no way to get a first one, so a
 * fresh bed was a dead end. This is the frame such a bed starts from. A frame measured on THIS machine (the bed
 * placement's own frame, or a completed registration's) always wins over it; the first one replaces it.
 *
 * WHERE THE NUMBERS COME FROM (cited as text; the bench records and traces are not part of this repository):
 * six completed registrations on 2026-10-24 and 2026-10-25 of the reference unit (the 38.1 × 76.2 × 3.81 mm badge
 * blank, ledge seat, Makera Wired Probe V2), whose vise placement frames were written to the bed profile:
 *   run 1  fixedJawFaceX −180.375   jawStartY −202.75    (typed seat)
 *   run 3  fixedJawFaceX −180.375   jawStartY −202.75    (a repeat of run 1)
 *   run 4  fixedJawFaceX −180.125   jawStartY −202.75    (the datum path)
 *   run 5  fixedJawFaceX −180.05    jawStartY −202.925
 *   run 6  fixedJawFaceX −179.975   jawStartY −202.85
 *   run 9  fixedJawFaceX −180.15    jawStartY −202.775
 * (the 2026-10-24 datum-path bench note and the `G10 L2 P1` lines of the run traces). The default is their MEAN:
 * X −180.175 (largest deviation 0.20 mm), Y −202.80 (largest deviation 0.13 mm).
 *
 * WHAT EACH NUMBER MEANS, AND DOES NOT:
 *  - X is the fixed jaw's FACE, measured: the blank's left edge rests on it. The six runs were a bare blank on
 *    the ledge — the bench note records the ledge seat (0.71 mm proud) and mentions no strip, so no strip is
 *    assumed; a job with a strip uses this face plus its own shift (the registration SUBTRACTS the strip when it
 *    writes a frame, every reader adds it).
 *  - Y is NOT a vise measurement. `jawStartY` is the blank's measured front edge plus the TYPED −10 (the bar's
 *    front end 10 mm in front of the blank's front edge, `fixture.ts`'s `DEFAULT_VISE.jawStartY`): the six values
 *    show the blank sat the same way six times, and the jaw's own Y was never measured.
 *  - ANGLE: not measured. The frame is taken square to the machine.
 *  - One unit only: unit-to-unit repeatability is unmeasured (the vise stayed on the bed between the six runs).
 */

/** Which of the three sources a frame came from; the card and Manage name it. */
export type ViseFrameSource = 'measured' | 'default';

export interface ViseReferenceFrame {
  fixedJawFaceX: number;
  jawStartY: number;
}

export const Z1_VISE_REFERENCE_FRAME: ViseReferenceFrame = { fixedJawFaceX: -180.175, jawStartY: -202.8 };

/** The words for the frame's provenance, one per field, as the card and Manage show them. */
export const VISE_FRAME_PROVENANCE = {
  measured: {
    x: 'measured on this machine',
    y: 'the blank’s measured front edge plus the typed seating — the jaw’s own Y is not measured',
    angle: 'square to the machine — angle not measured',
  },
  default: {
    x: 'measured on the reference unit — six registrations, 2026-10-24/25, a bare blank on the ledge, no strip',
    y: 'assumed from where the blank sat on those six runs (each typed 10 mm in from the jaw’s end); the jaw’s own Y is not measured',
    angle: 'taken square to the machine — angle not measured',
  },
} as const;

/** Where along the jaw the blank goes, from the job's own seating (`jobVise(job).jawStartY`, negative: the bar starts that far in FRONT of the blank). */
export function viseSeatingSentence(jawStartYMm: number): string {
  const n = Number(Math.abs(jawStartYMm).toFixed(1));
  return `Seat the blank with its front edge ${n} mm from the jaw’s front end.`;
}

/** The three provenance lines for a frame's source, one per field. */
export function viseFrameWords(source: ViseFrameSource): { x: string; y: string; angle: string } {
  return VISE_FRAME_PROVENANCE[source];
}

/**
 * What a measurement outside the margin SAYS, by where the frame came from. A frame measured on this machine means the blank was
 * not where the job's own seating put it: re-seat. The SHIPPED frame is not this machine's: its X was measured on one unit and its
 * Y was never measured, so nothing need have been mis-seated — the sentence says where the blank was found against the shipped
 * frame, per axis, what an X beyond the margin means, and that accepting writes this machine's own frame.
 */
export function marginRefusalWords(
  source: ViseFrameSource | undefined,
  outcome: { offset: { x: number; y: number }; margin: number },
): string {
  const n = (v: number): string => String(Number(v.toFixed(2)));
  const signed = (v: number): string => `${v >= 0 ? '+' : '−'}${n(Math.abs(v))}`;
  if (source !== 'default') {
    // The outcome line (how far off, which margin) sits directly above this on the card, so it is not said twice (#1123-124).
    return `No origin is written: the stock is outside the ${n(outcome.margin)} mm margin. Re-seat it and run the registration again.`;
  }
  const { x, y } = outcome.offset;
  const xBeyond = Math.abs(x) > outcome.margin + 1e-9;
  const yBeyond = Math.abs(y) > outcome.margin + 1e-9;
  const parts = [
    `No origin is written yet: the vise frame is the SHIPPED one, not measured on this machine, and the blank was found X ${signed(x)} mm, Y ${signed(y)} mm from where it puts it — the margin is ${n(outcome.margin)} mm.`,
  ];
  if (xBeyond) parts.push('X beyond the margin: check the blank is pressed against the fixed jaw.');
  if (yBeyond) parts.push('The shipped frame’s Y was never measured (it assumes the blank 10 mm in from the jaw’s front end), so a Y this far off is not a seating fault.');
  parts.push('Use the found position below to write this machine’s own frame from this measurement.');
  return parts.join(' ');
}

/**
 * #1435 — THE SHIPPED-FRAME ACCEPTANCE IS SETTING A DATUM, said as that (9b's wording). The vise's position on this machine has not been measured; accepting a blank found outside the margin
 * records the fixed jaw's face FROM THIS BLANK and writes this job's origin from the same measurement. Y is stated plainly and as unchecked: the position along the jaws is taken from this blank
 * and nothing on file checks it (by design: nothing fixes it).
 */
export function shippedDatumOfferWords(offset: { x: number; y: number }): string {
  const n = (v: number): string => String(Number(Math.abs(v).toFixed(2)));
  return (
    `The vise’s position on this machine has not been measured (the figure in use is the shipped one). This blank’s left edge was found ${n(offset.x)} mm from it. ` +
    `Press to record the fixed jaw’s face from this blank: make sure the blank is pressed against the fixed jaw with nothing between them. ` +
    `The origin for this job is written from the same measurement. The position along the jaws was found ${n(offset.y)} mm from where the shipped frame puts it; it is taken from this blank, and nothing on file checks it.`
  );
}

/**
 * #1435 (3) — THE BOUND on that offer: the found position is inside the scan's stated reach (a found edge is, by construction: an edge beyond it is not found and the run is not usable) AND the
 * left edge's two points agree (the turn inside the margin): a skewed blank is not a jaw face. UNKNOWN IS NEVER THE LENIENT ANSWER: a turn that was not read (one left line only) refuses by name.
 * Null = the offer may be made.
 */
export function shippedDatumOfferRefusal(outcome: { rotationDeg: number | null; rotationShiftMm: number | null; margin: number }): string | null {
  if (outcome.rotationShiftMm === null || outcome.rotationDeg === null) {
    return 'The blank’s turn has not been read, so a blank turned in the jaws cannot be told from the jaw’s face: the jaw’s face is not recorded from this blank.';
  }
  if (outcome.rotationShiftMm > outcome.margin + 1e-9) {
    return `The blank is turned ${String(Number(outcome.rotationDeg.toFixed(2)))}° (${String(Number(outcome.rotationShiftMm.toFixed(2)))} mm over its length), more than the ${String(Number(outcome.margin.toFixed(2)))} mm margin: a turned blank is not a jaw face, so the jaw’s face is not recorded from it. Seat it square against the fixed jaw and register again.`;
  }
  return null;
}

/**
 * #1435 — WHAT THE ORIGIN PRESS WRITES, named on the press: the origin always; on a vise's first side the press ALSO records the fixed jaw's face from this blank (with the bed it belongs to, if the machine
 * has none yet) and the top of the blank (used for this blank’s later registrations). Nothing the app will later treat as a fact about this shop is written without a press that names it.
 */
export function originPressWritesWords(input: { recordsFrame: boolean; createsBed: boolean }): string {
  if (!input.recordsFrame) return 'This press writes the origin for this job.';
  return (
    'This press writes the origin for this job, records the fixed jaw’s face from this blank’s left edge as the vise’s position on this machine (stamped measured, with today’s date and this registration as its source)' +
    (input.createsBed ? ', records this as the bed now on the machine' : '') +
    ', and records the top of this blank (used for this blank’s later registrations).'
  );
}

/**
 * #1435 (9b) — THE BLANK WAS NOT FOUND ALONG THE JAWS (front to back). Nothing sets the blank along the jaws, so a blank anywhere along the vise is ordinary use: what is true is that this build searches only within a stated reach of where the job
 * expects it. The sentence names the direction and the reach and says where the job expects the blank in landmark words (the job's own seating sentence) and to move the blank there; it never says to press the blank against the fixed jaw (that is the across-jaw fix), and never to measure the vise (measuring fixes the jaw face across the jaws, never the position along them: 9b, 2026-11-20).
 * ONE sentence for a blank too far either way.
 */
export const ALONG_JAWS_LEAD = 'The blank was not found where this job expects it along the jaws (front to back)';
export function alongJawsNotFoundWords(input: { reachMm: number; seating: string }): string {
  const n = String(Number(input.reachMm.toFixed(1)));
  return (
    `${ALONG_JAWS_LEAD}: the app looked ${n} mm either side of that place. ${input.seating} ` +
    'Move the blank there and register again.'
  );
}
