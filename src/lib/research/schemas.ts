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

/**
 * One source of a saved research answer (column research.sources, migrations/0006_research_sources.sql).
 * title is "" when Perplexity gave none; snippet and date only when Perplexity supplied them.
 */
export const researchSource = z.object({
  url: httpUrl,
  title: z.string().max(500),
  snippet: z.string().max(2000).optional(),
  date: z.string().max(40).optional(),
});
export type ResearchSource = z.infer<typeof researchSource>;

/** Stored sources, read leniently: entries that are not in the shape above are dropped, not fatal. */
export function readSources(stored: unknown, citations: unknown): ResearchSource[] {
  const list = Array.isArray(stored) ? stored : [];
  const out: ResearchSource[] = [];
  for (const x of list) {
    const r = researchSource.safeParse(x);
    if (r.success) out.push(r.data);
  }
  if (out.length || list.length) return out;
  // A row with no stored sources: build them from its citation URLs, as the migration does.
  const urls = Array.isArray(citations) ? citations : [];
  return urls.filter((u): u is string => typeof u === "string" && httpUrl.safeParse(u).success).map((url) => ({ url, title: "" }));
}

/** What is saved for one source Perplexity returned: trimmed and cut to the column's limits. */
export function toStoredSource(s: { url: string; title?: string; snippet?: string; date?: string }): ResearchSource {
  const cut = (v: string | undefined, n: number) => (v ? v.trim().slice(0, n) : "");
  const snippet = cut(s.snippet, 2000);
  const date = cut(s.date, 40);
  return { url: s.url, title: cut(s.title, 500), ...(snippet ? { snippet } : {}), ...(date ? { date } : {}) };
}

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
