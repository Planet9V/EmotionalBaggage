// The one definition of a pin and of a part-library entry. The pins API validates writes with
// `pinInput`; the library is checked against `libraryEntry` by tests/parts/library.test.ts.
import { z } from "zod";
import { BUS_TYPES, BUSES, CATEGORIES, PART_KIND_IDS, PIN_KINDS, SIDES, SYMBOL_IDS } from "./kinds";

const finite = z.number().finite();

/** Volts. A pin that takes power states the range it accepts (min, max); a pin that gives power states what it gives (nominal, or a range). */
const voltage = z
  .object({ min: finite.optional(), max: finite.optional(), nominal: finite.optional() })
  .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, { message: "the lowest voltage must not be above the highest" })
  .refine((v) => v.min !== undefined || v.max !== undefined || v.nominal !== undefined, { message: "give at least one voltage, or leave it out" });
export type Voltage = z.infer<typeof voltage>;

/** Milliamps. On a power-out pin: the most it can supply. On a power-in pin: the most it draws. */
const current = z.object({ max: finite.nonnegative() });

/** Millimetres, in the part's own coordinates: origin at the part's centre, x right, y away from the viewer when the part lies flat. */
const position = z.object({ x: finite, y: finite });
export type PinPosition = z.infer<typeof position>;

const bus = z
  .object({ type: z.enum(BUS_TYPES), line: z.string().min(1).max(20) })
  .refine((b) => (BUSES[b.type].lines as readonly string[]).includes(b.line), { message: "that line is not one of the bus's lines" });
export type BusRef = z.infer<typeof bus>;

const pinName = z.string().trim().min(1, "a pin needs a name").max(60);

/** A pin as stored (a row of `pins`) and as a library entry lists it. */
export const pinInput = z.object({
  name: pinName,
  /** null: not stated yet. The checks that need a kind skip such a pin. */
  kind: z.enum(PIN_KINDS).nullable().default(null),
  /** pin number on the part (a header position, a package pin) where it differs from the name */
  number: z.string().max(20).optional(),
  side: z.enum(SIDES).nullable().optional(),
  position: position.nullable().optional(),
  voltage: voltage.nullable().optional(),
  current: current.nullable().optional(),
  bus: bus.nullable().optional(),
  analog: z.boolean().optional(),
  /** the part itself pulls this line up (stated in its documentation) */
  pullUp: z.boolean().optional(),
  /** may be left unconnected without a finding (a second ground, an alternative supply input) */
  optional: z.boolean().optional(),
});
export type PinInput = z.input<typeof pinInput>;
export type PinDef = z.output<typeof pinInput>;

export const pinList = z
  .array(pinInput)
  .max(400)
  .superRefine((pins, ctx) => {
    const seen = new Set<string>();
    pins.forEach((p, i) => {
      const k = p.name.trim();
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: [i, "name"], message: `the pin name ${k} is used twice` });
      seen.add(k);
    });
  });

const source = z.object({ label: z.string().min(1).max(200), url: z.url() });

/**
 * A part in the library. Every electrical figure (voltage, current) on its pins comes from one of
 * `sources`, named in `figures`; a figure nobody could source is left out.
 */
export const libraryEntry = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lower case letters, digits and dashes"),
    kind: z.enum(PART_KIND_IDS),
    name: z.string().min(1).max(120),
    description: z.string().max(400),
    pins: pinList,
    /** outline in millimetres: width (x) by depth (y), and height where known */
    size: z.object({ w: finite.positive(), d: finite.positive(), h: finite.positive().optional() }),
    /** where the size and pin positions come from: a drawing ("doc") or a typical part ("typical") */
    basis: z.enum(["doc", "typical"]),
    symbol: z.enum(SYMBOL_IDS),
    sources: z.array(source).max(8),
    /** which source each electrical figure comes from, in a sentence */
    figures: z.string().max(600).default(""),
  })
  .superRefine((e, ctx) => {
    const hasFigure = e.pins.some((p) => p.voltage || p.current);
    if (hasFigure && (!e.sources.length || !e.figures.trim())) {
      ctx.addIssue({ code: "custom", path: ["figures"], message: "an entry with electrical figures must name the source of each one" });
    }
    e.pins.forEach((p, i) => {
      if (!p.position) return;
      if (Math.abs(p.position.x) > e.size.w / 2 + 0.01 || Math.abs(p.position.y) > e.size.d / 2 + 0.01) {
        ctx.addIssue({ code: "custom", path: ["pins", i, "position"], message: `pin ${p.name} lies outside the part's outline` });
      }
    });
  });
export type LibraryEntry = z.output<typeof libraryEntry>;
export type LibraryEntryInput = z.input<typeof libraryEntry>;
