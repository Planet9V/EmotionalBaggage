// Parameter validation, shared by the form (live) and the server (before it runs a generator).
import { z } from "zod";
import { DEFAULT_PARAMS, LID_TYPES, NUMERIC_RULES, SCREW_SIZES, type EnclosureParams, type Issue, type ScrewSize } from "./types";

const numeric = (min: number, max: number, label: string) =>
  z.number({ error: `${label} must be a number.` }).finite().min(min, `${label} must be at least ${min}.`).max(max, `${label} must be at most ${max}.`);

export const paramsSchema = z.object({
  wallThickness: numeric(1.2, 6, "Wall thickness"),
  floorThickness: numeric(1.2, 6, "Floor thickness"),
  lidThickness: numeric(1.2, 6, "Lid thickness"),
  cornerRadius: numeric(0, 10, "Corner radius"),
  clearance: numeric(0, 5, "Clearance"),
  openingMargin: numeric(0, 3, "Opening margin"),
  lidType: z.enum(LID_TYPES),
  screwSize: z.enum(SCREW_SIZES as [ScrewSize, ...ScrewSize[]]),
});

/** What is wrong with a set of parameters, one issue per field. Empty when all are in range. */
export function validateParams(p: EnclosureParams): Issue[] {
  const r = paramsSchema.safeParse(p);
  if (r.success) return [];
  return r.error.issues.map((i) => ({ severity: "error" as const, code: "param-range", about: String(i.path[0] ?? ""), message: i.message }));
}

/** Fills missing or non-numeric values with the defaults, so a half-typed form never reaches the spec builder. */
export function withDefaults(p: Partial<Record<keyof EnclosureParams, unknown>> | null | undefined): EnclosureParams {
  const out: EnclosureParams = { ...DEFAULT_PARAMS };
  if (!p) return out;
  for (const r of NUMERIC_RULES) {
    const v = p[r.key];
    if (typeof v === "number" && Number.isFinite(v)) (out as Record<string, unknown>)[r.key] = v;
  }
  if ((LID_TYPES as readonly string[]).includes(p.lidType as string)) out.lidType = p.lidType as EnclosureParams["lidType"];
  if ((SCREW_SIZES as readonly string[]).includes(p.screwSize as string)) out.screwSize = p.screwSize as EnclosureParams["screwSize"];
  return out;
}
