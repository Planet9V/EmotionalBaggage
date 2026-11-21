// The one definition of what each section stores in Item.data.
// The API validates writes with these; the readers in this folder parse with them;
// the TypeScript types are inferred from them. Nothing else describes these shapes.
import { z } from "zod";
import { economicsSchemas, partPricingFields } from "@/lib/economics/schemas";
import { MARKET_SCHEMAS } from "@/lib/market/schemas";
import { PART_KIND_IDS } from "@/lib/parts/kinds";
import { libraryEntryById } from "@/lib/parts/library";
import { printJobData } from "@/lib/slicing/jobState";
import { sourcingData } from "@/lib/sourcing/schemas";
import { CONTENT_SCHEMAS } from "@/lib/content/schemas";
import { CAMPAIGN_SCHEMAS } from "@/lib/campaigns/schemas";
import { CHANNEL_SCHEMAS } from "@/lib/channels/schemas";
import { keys } from "./step";

export const STORE = {
  parts: "design/bom",
  wiring: "design/wiring",
  decisions: "concept/decisions",
  requirements: "design/requirements",
  tests: "prototype/tests",
  builds: "prototype/builds",
  printing: "prototype/printing",
} as const;

const text = (max = 400) => z.string().max(max);

/** A number, or a string that is plainly a number ("12", " 3.5 "). Never "12abc", never "". */
const numeric = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v),
  z.number().finite()
);

/**
 * A list of keys. Stored as an array. Older rows held "a, b, c" in one string,
 * so a string is still read, and is turned into an array on the way in.
 */
export const keyList = z.preprocess(
  (v) => (typeof v === "string" ? keys(v) : v),
  z.array(text(120)).max(500)
);

const vec3 = z.tuple([numeric, numeric, numeric]);

const angle = numeric.refine((n) => Math.abs(n) <= 3600, "must be within 3600 degrees");

/** A file attached as a part's shape. `scale` is a unit choice the user confirmed; 1 means the file is already in millimetres. */
const shapeFile = z.object({
  id: z.number().int().positive(),
  name: text(200),
  format: z.enum(["stl", "step"]),
  scale: numeric.refine((n) => n > 0 && n <= 1e6, "must be above zero").default(1),
});
type ShapeFile = z.infer<typeof shapeFile>;

/** Y up, millimetres, origin at the centre of the enclosure floor. */
export const geometry = z
  .object({
    shape: z.enum(["box", "cylinder", "shell"]),
    /** box and shell: [x, y, z]. cylinder: [diameter, length]. */
    size: z.array(numeric.refine((n) => n > 0, "must be greater than zero")).min(2).max(3),
    pos: vec3.default([0, 0, 0]),
    explode: vec3.default([0, 0, 0]),
    basis: z.enum(["doc", "typical", "library"]).default("typical"),
    /** doc: the document the size is stated in; library: the library entry it was taken from */
    basisSource: z.string().trim().max(300).optional(),
    count: numeric.optional(),
    print: z.boolean().optional(),
    /** cylinder only: which axis its length runs along */
    axis: z.enum(["x", "y", "z"]).optional(),
    /** degrees about the scene x, y, then z axes, turning the part about its own centre */
    rotation: z.tuple([angle, angle, angle]).optional(),
    /** the part's real shape: an STL or STEP file stored with the concept. `size` is then its bounding box. */
    file: shapeFile.optional(),
  })
  .superRefine((g, ctx) => {
    if (g.shape === "shell" && g.rotation && g.rotation.some((a) => a !== 0)) {
      ctx.addIssue({ code: "custom", path: ["rotation"], message: "an enclosure shell cannot be rotated; rotate the parts inside it" });
    }
    if (g.file && g.shape !== "box") {
      ctx.addIssue({ code: "custom", path: ["file"], message: "an attached file replaces a box; the shape must be box" });
    }
    const need = g.shape === "cylinder" ? 2 : 3;
    if (g.size.length < need) {
      ctx.addIssue({ code: "custom", path: ["size"], message: `a ${g.shape} needs ${need} sizes` });
    }
  })
  .transform((g) => {
    const size = g.size.slice(0, g.shape === "cylinder" ? 2 : 3);
    const count = g.count === undefined ? undefined : Math.round(g.count);
    const out: {
      shape: typeof g.shape; size: number[]; pos: number[]; explode: number[]; basis: typeof g.basis;
      basisSource?: string; count?: number; print?: boolean; axis?: "x" | "y" | "z";
      rotation?: [number, number, number]; file?: ShapeFile;
    } = { shape: g.shape, size, pos: [...g.pos], explode: [...g.explode], basis: g.basis };
    if (g.basisSource) out.basisSource = g.basisSource;
    if (count !== undefined && count > 1) out.count = count;
    if (g.print === true) out.print = true;
    if (g.axis) out.axis = g.axis;
    if (g.rotation && g.rotation.some((a) => a !== 0)) out.rotation = [...g.rotation];
    if (g.file) out.file = { ...g.file };
    return out;
  });

export type Geometry = z.infer<typeof geometry>;

export const xy = z.object({ x: numeric, y: numeric });
export type XY = z.infer<typeof xy>;

/** Any row can be a step in the order of operations: a key, what it waits on, how long it takes. */
const step = {
  key: text(120).optional(),
  after: keyList.optional(),
  minutes: numeric.refine((n) => n >= 0, "cannot be negative").optional(),
};

/** Sections without a schema of their own: free columns, plus the step fields. */
const genericData = z.looseObject(step);

export const partData = z.looseObject({
  ...step,
  ref: text(40).optional(),
  qty: numeric.refine((n) => n >= 0, "cannot be negative").optional(),
  source: text(120).optional(),
  search: text().optional(),
  /** line cost, in the concept's currency */
  line: numeric.refine((n) => n >= 0, "cannot be negative").optional(),
  asin: text(20).optional(),
  geometry: geometry.nullable().optional(),
  /** where the part sits on the schematic */
  schematic: xy.nullable().optional(),
  /** pins the part has, wired or not. Legacy: pins are rows of `pins` since migrations/0014_pins.sql, which moved these. */
  pins: z.array(text(60)).max(400).optional(),
  /** what kind of part it is (src/lib/parts/kinds.ts); "" clears it */
  kind: z.union([z.literal(""), z.enum(PART_KIND_IDS, { error: "not a part kind this app knows" })]).optional(),
  /** the part-library entry it is (src/lib/parts/library); "" clears it */
  library: z.union([z.literal(""), z.string().refine((id) => !!libraryEntryById(id), "not an entry of the part library")]).optional(),
  /** where the part sits in the symbol view of the schematic (the pins-and-wires view uses `schematic`) */
  symbolPos: xy.nullable().optional(),
  /** unit price, supplier key and quantity price breaks (plan 3.6, 7.2) */
  ...partPricingFields(),
  /** suppliers, alternates, research drafts and order status (plan 6.1) */
  sourcing: sourcingData.optional(),
});

export const NET_CLASSES = ["power", "ground", "signal", "audio"] as const;
export type NetClass = (typeof NET_CLASSES)[number];

export const wireData = z.looseObject({
  ...step,
  order: numeric.optional(),
  net: text(120).optional(),
  netClass: z.enum(NET_CLASSES).optional(),
  from: text(40).optional(),
  fromPin: text(60).optional(),
  to: text(40).optional(),
  toPin: text(60).optional(),
  /** gone since migrations/0014_pins.sql: a part in series is an ordinary part with a wire to each pin */
  via: z.literal("", { error: "a part in series is its own part now: wire to each of its pins" }).optional(),
  /** where a series part on this wire sat on the schematic (legacy) */
  schematic: xy.nullable().optional(),
  /** routed length of the path through the enclosure, mm, from the planner (plan 5.12) */
  routedLengthMm: numeric.refine((n) => n >= 0, "cannot be negative").optional(),
  /** grid cell the router used, mm, and when it ran */
  routedCellMm: numeric.optional(),
  routedAt: text(40).optional(),
  /** fingerprint of the positions the route was computed from; a different one means out of date */
  routedFingerprint: text(80).optional(),
  /** the path as [x, y, z] points in scene millimetres, for drawing */
  routedPath: z.array(z.tuple([numeric, numeric, numeric])).max(2000).optional(),
});

const decisionOption = z.object({ id: text(80).min(1), label: text(200).min(1), outcome: text(2000).default("") });

const decisionData = z.looseObject({
  ...step,
  parent: text(120).optional(),
  viaOption: text(80).optional(),
  options: z.array(decisionOption).max(40).optional(),
  chosen: text(80).optional(),
  dependsOn: keyList.optional(),
  unlocks: keyList.optional(),
  source: text().optional(),
});

/** A requirement links to the acceptance tests that check it and the parts it needs, by key (checked in src/lib/trace/links.ts). */
const requirementData = z.looseObject({
  ...step,
  tests: keyList.optional(),
  parts: keyList.optional(),
});

const day = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2026-12-31")]);

/** A named build: its exit criteria, the tests it must pass, and its dates. The name is the title and the goal is the body. */
const buildData = z.looseObject({
  ...step,
  criteria: z.array(z.object({ text: text(300).trim().min(1, "a criterion needs text"), met: z.boolean().default(false) })).max(50).optional(),
  tests: keyList.optional(),
  start: day.optional(),
  end: day.optional(),
});

/** The chosen enclosure generator and its parameters (plan 5.9). One row per concept; the numbers are range-checked again by the generator route. */
const enclosureData = z.looseObject({
  enclosureGenerator: z.enum(["casemaker", "yapp"]).optional(),
  params: z.looseObject({
    wallThickness: numeric.optional(),
    floorThickness: numeric.optional(),
    lidThickness: numeric.optional(),
    cornerRadius: numeric.optional(),
    clearance: numeric.optional(),
    openingMargin: numeric.optional(),
    lidType: z.enum(["slip", "snap", "screw"]).optional(),
    screwSize: z.enum(["M2", "M2.5", "M3"]).optional(),
  }).optional(),
});

const BY_STORE: Record<string, z.ZodType<Record<string, unknown>>> = {
  [STORE.requirements]: requirementData,
  [STORE.builds]: buildData,
  [STORE.printing]: printJobData,
  [STORE.parts]: partData,
  [STORE.wiring]: wireData,
  [STORE.decisions]: decisionData,
  "design/enclosure": enclosureData,
  // production, sales channels and compliance rows (plan 3.6, 3.8, 7.1, 7.2)
  ...economicsSchemas(step),
  ...MARKET_SCHEMAS,
  ...CONTENT_SCHEMAS,
  // campaigns and the launch plan (plan 8.13, 8.14)
  ...CAMPAIGN_SCHEMAS,
  ...CHANNEL_SCHEMAS,
};

/** The schema a section's `data` must satisfy. */
export const dataSchemaFor = (section: string): z.ZodType<Record<string, unknown>> => BY_STORE[section] ?? genericData;
