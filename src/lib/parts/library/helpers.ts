import type { PinInput } from "../schema";

type Pin = Omit<PinInput, "position">;

/**
 * Pins in a straight row at a fixed pitch, centred on (cx, cy) along x (row "x") or y (row "y").
 * Used where a part's pins sit on a header; the positions are as typical as the outline they sit on.
 */
export function row(pins: Pin[], opts: { pitch: number; axis: "x" | "y"; at: number; centre?: number; reverse?: boolean }): PinInput[] {
  const n = pins.length;
  const c = opts.centre ?? 0;
  return pins.map((p, i) => {
    const k = opts.reverse ? n - 1 - i : i;
    const along = Math.round((c + (k - (n - 1) / 2) * opts.pitch) * 100) / 100;
    return { ...p, position: opts.axis === "x" ? { x: along, y: opts.at } : { x: opts.at, y: along } };
  });
}

export const p = (name: string, kind: PinInput["kind"], extra: Partial<Pin> = {}): Pin => ({ name, kind, ...extra });
