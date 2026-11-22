// How the film answers a device that cannot keep pace. The page measures the average frame time over each two
// seconds of playing; past SLOW_MS the film first gives up sharpness, and if the next measure is still slow it gives
// up the film for the drawn stills. `?film=force` keeps the film whatever the pace (for the screenshot script on a
// software renderer); `?film=slow` reports every measure as slow, to see the fallback fire on a fast machine.

/** The slowest the film may run, as the average time of a frame over two seconds: past this it is not a film. */
export const SLOW_MS = 40;

export type FilmMode = "normal" | "force" | "slow";
export type Verdict = "keep" | "soften" | "stills";

export function filmMode(query: string): FilmMode {
  const v = new URLSearchParams(query).get("film");
  return v === "force" || v === "slow" ? v : "normal";
}

/** What to do with one two-second measure, given whether the film is still drawn at full sharpness. */
export function paceVerdict(ms: number, sharp: boolean, mode: FilmMode): Verdict {
  if (mode === "force") return "keep";
  const slow = mode === "slow" || ms > SLOW_MS;
  if (!slow) return "keep";
  return sharp ? "soften" : "stills";
}

/** Frames not counted after the film starts or cuts to a scene: the hitch while that scene's shaders compile. */
export const WARM_FRAMES = 4;
/** A gap longer than this (seconds) is the tab hidden or the machine asleep, not the film's pace. */
const GAP_S = 1.5;
/** The two-second window the pace is averaged over. */
const WINDOW_S = 2;

export type PaceMeter = { frames: number; time: number; warm: number };
export const newMeter = (): PaceMeter => ({ frames: 0, time: 0, warm: WARM_FRAMES });

/**
 * Adds one frame's time (seconds) to the meter; returns the average frame time in milliseconds when a window is
 * complete, otherwise null. A slow frame counts in full: a device that takes half a second a frame is the very one
 * the measure is for. Only the frames just after a cut and a long gap are left out.
 */
export function measure(m: PaceMeter, delta: number): number | null {
  if (m.warm > 0) {
    m.warm -= 1;
    return null;
  }
  if (delta > GAP_S) return null;
  m.frames += 1;
  m.time += delta;
  if (m.time < WINDOW_S) return null;
  const ms = (m.time / m.frames) * 1000;
  m.frames = 0;
  m.time = 0;
  return ms;
}
