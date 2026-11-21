import { z } from "zod";
import { DEFAULT_STATUSES, STAGES, storeKey } from "@/lib/menu";
import { dataSchemaFor } from "@/lib/domain/schemas";
import { whyField } from "@/lib/trace/why";

/** Every backend store the menu defines, with the statuses its sections allow. */
export const STORE_STATUSES: Record<string, string[]> = (() => {
  // Several sections can show the same store (the parts list is also the layout and sourcing).
  // The statuses a section declares win; the defaults apply only where no section declares any.
  const declared: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const stage of STAGES) {
    for (const section of stage.sections) {
      const key = storeKey(stage, section);
      seen.add(key);
      if (!section.statuses) continue;
      const list = (declared[key] ??= []);
      for (const s of section.statuses) if (!list.includes(s)) list.push(s);
    }
  }
  const out: Record<string, string[]> = {};
  for (const key of seen) out[key] = declared[key] ?? [...DEFAULT_STATUSES];
  return out;
})();

export const STORES = Object.keys(STORE_STATUSES);

const text = (max: number) => z.string().max(max);

/** Longest data.externalId: a service's id with its prefix ("amazon:", "x:", "review:"); a unique index reads it. */
export const EXTERNAL_ID_MAX = 120;

/** `data` is always a plain object: never an array, a string or null. data.externalId, when present, is a short text. */
export const dataObject = z.record(z.string(), z.unknown()).superRefine((d, ctx) => {
  const v = d.externalId;
  if (v === undefined) return;
  if (typeof v !== "string") ctx.addIssue({ code: "custom", path: ["externalId"], message: "must be text" });
  else if (v.length > EXTERNAL_ID_MAX) ctx.addIssue({ code: "custom", path: ["externalId"], message: `must be ${EXTERNAL_ID_MAX} characters or fewer` });
});

/**
 * Checks `data` against its section's schema and returns it normalised
 * (numbers as numbers, key lists as arrays). Problems are reported under "data.<field>".
 */
/**
 * The most a row's `data` may hold, serialised (robustness review S8). Measured on the seeded example
 * (largest: a decision, 718 bytes) and on what the app itself writes: a routed wire keeps up to 400 points
 * (about 9 KB) and a landing section up to 60 items of 500 characters, so those sections get more room.
 */
export const DATA_LIMIT_BYTES = 64 * 1024;
export const DATA_LIMIT_BY_SECTION: Record<string, number> = {
  "design/wiring": 128 * 1024,
  "marketing/landing": 256 * 1024,
};
export const dataLimitFor = (section: string) => DATA_LIMIT_BY_SECTION[section] ?? DATA_LIMIT_BYTES;

/** A sentence when the row's data is larger than its section allows, else null. */
export function dataSizeProblem(section: string, data: unknown): string | null {
  const bytes = new TextEncoder().encode(JSON.stringify(data ?? {})).length;
  const max = dataLimitFor(section);
  return bytes > max ? `is ${Math.ceil(bytes / 1024)} KB; a row of this section holds at most ${max / 1024} KB` : null;
}

function sectionData(section: string, data: Record<string, unknown>, ctx: z.RefinementCtx) {
  const size = dataSizeProblem(section, data);
  if (size) {
    ctx.addIssue({ code: "custom", path: ["data"], message: size });
    return z.NEVER;
  }
  const r = dataSchemaFor(section).safeParse(data);
  if (r.success) return r.data;
  for (const i of r.error.issues) ctx.addIssue({ code: "custom", path: ["data", ...i.path], message: i.message });
  return z.NEVER;
}

/** The same check for a change to an existing row, whose section comes from the database. */
export function parseData(section: string, data: Record<string, unknown> | undefined) {
  if (data === undefined) return undefined;
  const size = dataSizeProblem(section, data);
  if (size) throw new z.ZodError([{ code: "custom", path: ["data"], message: size, input: undefined }]);
  const r = dataSchemaFor(section).safeParse(data);
  if (r.success) return r.data;
  throw new z.ZodError(r.error.issues.map((i) => ({ ...i, path: ["data", ...i.path] })));
}

export const sectionKey = z
  .string()
  .refine((s) => s in STORE_STATUSES, { message: `must be one of: ${STORES.join(", ")}` });

function statusFor(section: string, status: string | undefined, ctx: z.RefinementCtx) {
  if (status === undefined) return;
  const allowed = STORE_STATUSES[section];
  if (allowed && !allowed.includes(status)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: `must be one of: ${allowed.join(", ")}` });
  }
}

export const newItem = z
  .object({
    section: sectionKey,
    title: text(300).trim().min(1, "is required"),
    body: text(20_000).optional(),
    data: dataObject.optional(),
    status: text(40).optional(),
  })
  .superRefine((v, ctx) => statusFor(v.section, v.status, ctx))
  .transform((v, ctx) => ({ ...v, data: v.data === undefined ? undefined : sectionData(v.section, v.data, ctx) }));

export type NewItem = z.infer<typeof newItem>;

/** The status is checked against the row's own section in the handler. */
export const itemPatch = z
  .object({
    title: text(300).trim().min(1, "cannot be empty").optional(),
    body: text(20_000).optional(),
    data: dataObject.optional(),
    status: text(40).optional(),
    sort: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    /** why the change was made; optional, kept on the event and never on the row */
    why: whyField,
  })
  .refine((v) => Object.keys(v).filter((k) => k !== "why").length > 0, { message: "nothing to change" });

export const newProject = z.object({
  name: text(120).trim().min(1, "A concept needs a name."),
  oneLiner: text(400).trim().optional(),
  items: z.array(newItem).max(2000).optional(),
});

export const challengeTurn = z.object({
  projectId: text(80).min(1),
  message: text(8000).trim().min(1, "is required"),
  /** "Challenge this": the row the reviewer argues against; the exchange keeps a link to it */
  itemId: z.number().int().positive().optional(),
});

export const researchAsk = z.object({
  projectId: text(80).min(1),
  query: text(2000).trim().min(1, "is required"),
});

export function assertStatus(section: string, status: string | undefined) {
  if (status === undefined) return;
  const allowed = STORE_STATUSES[section];
  if (allowed && !allowed.includes(status)) {
    throw new z.ZodError([
      { code: "custom", path: ["status"], message: `must be one of: ${allowed.join(", ")}`, input: status },
    ]);
  }
}

export const defaultStatus = (section: string) => STORE_STATUSES[section]?.[0] ?? "open";
