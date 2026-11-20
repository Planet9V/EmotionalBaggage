// Evidence on a claim (section research/claims): each entry names ONE source and says whether it
// supports the claim. Kept here, not in src/lib/domain/schemas.ts, and checked by the evidence route;
// the generic per-section schema for claims accepts these extra keys as they are.
import { z } from "zod";

export const VERDICTS = ["supports", "contradicts", "unclear"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CLAIMS_SECTION = "research/claims";

export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, { message: "must be an http or https address" });

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const evidenceEntry = z.object({
  url: httpUrl,
  title: z.string().max(500).optional(),
  quote: z.string().max(4000).optional(),
  researchId: id.optional(),
  verdict: z.enum(VERDICTS),
  addedAt: z.string().max(40),
});
export type EvidenceEntry = z.infer<typeof evidenceEntry>;

/** What a claim's data.evidence must look like; absent means no evidence yet. */
export const claimEvidence = z.array(evidenceEntry).max(200);

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

export const evidenceAdd = z.object({
  claimId: id,
  url: httpUrl,
  title: optText(500),
  quote: optText(4000),
  researchId: id.optional(),
  verdict: z.enum(VERDICTS),
});

export const evidenceRemove = z.object({
  claimId: id,
  url: httpUrl,
});
