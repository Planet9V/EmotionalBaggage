// What the content sections store in Item.data. Registered in src/lib/domain/schemas.ts (BY_STORE).
// All loose, every field optional, so a row typed by hand, an older row and a generated row all pass.
// The stores are existing sections (marketing/ads, marketing/landing, marketing/social, sales/listing)
// plus marketing/launch; no new table.
import { z } from "zod";
import { proofRef } from "@/lib/market/schemas";
import type { CopyField } from "./claims";

const text = (max = 4000) => z.string().max(max);

export const CONTENT = {
  ads: "marketing/ads",
  landing: "marketing/landing",
  social: "marketing/social",
  listing: "sales/listing",
  launch: "marketing/launch",
  campaigns: "marketing/campaigns",
} as const;

/** The ONE approved message a piece is tied to: the positioning row and the message's place in it. */
export const messageRef = z.object({ positioningId: z.number().int(), index: z.number().int().min(0).max(20), text: text(600) });
export type MessageRef = z.infer<typeof messageRef>;

export const flag = z.object({ field: text(80), text: text(200), kind: z.enum(["number", "superlative"]), reason: text(400) });

const base = {
  message: messageRef.optional(),
  proof: z.array(proofRef).max(30).optional(),
  flags: z.array(flag).max(100).optional(),
  noProof: z.boolean().optional(),
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "must be a date like 2026-12-31 or 2026-12-31T09:00");

export const adData = z.looseObject({
  ...base,
  channel: text(60).optional(),
  fields: z.record(z.string().max(60), z.union([text(2000), z.array(text(500)).max(60)])).optional(),
  /** the stop and scale rule: the sentence, and the two numbers the campaign module reads (minor units, e.g. cents) */
  stopRule: text(1000).optional(),
  costPerOrderCeilingMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  minSpendBeforeJudgingMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  currency: text(3).optional(),
});

export const LANDING_KINDS = ["hero", "problem", "how", "proof", "comparison", "faq", "price", "footer"] as const;
export type LandingKind = (typeof LANDING_KINDS)[number];

export const landingData = z.looseObject({
  ...base,
  page: text(60).optional(),
  kind: z.enum(LANDING_KINDS).optional(),
  order: z.number().int().min(0).max(1000).optional(),
  content: z.record(z.string().max(60), z.unknown()).optional(),
});

export const listingData = z.looseObject({
  ...base,
  category: text(40).optional(),
  fields: z
    .object({ title: text(400), bullets: z.array(text(1000)).max(10), description: text(5000), searchTerms: text(1000) })
    .partial()
    .optional(),
  /** imagery shotKey -> checked by the user */
  imagesChecked: z.record(z.string().max(60), z.boolean()).optional(),
});

export const socialData = z.looseObject({
  ...base,
  channel: text(40).optional(),
  /** Pinterest and Reddit carry a title as well as text; the post's text is the row body */
  postTitle: text(300).optional(),
  mediaShotKeys: z.array(text(60)).max(10).optional(),
  scheduledAt: day.optional(),
  campaignId: z.number().int().optional(),
});

export const launchData = z.looseObject({
  ...base,
  kind: z.enum(["email", "press-note", "sequence"]).optional(),
  subjects: z.array(text(200)).max(10).optional(),
  previewText: text(300).optional(),
  plainText: text(20000).optional(),
  /** sequence only */
  step: z.number().int().min(1).max(10).optional(),
  sendOffsetDays: z.number().int().min(-60).max(365).optional(),
  goal: text(400).optional(),
  pressReleaseId: z.number().int().optional(),
});

export const campaignDates = z.looseObject({ start: day.optional(), end: day.optional() });

export const CONTENT_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  [CONTENT.ads]: adData,
  [CONTENT.landing]: landingData,
  [CONTENT.social]: socialData,
  [CONTENT.listing]: listingData,
  [CONTENT.launch]: launchData,
  [CONTENT.campaigns]: campaignDates,
};

export const CONTENT_STORES = new Set<string>([CONTENT.ads, CONTENT.landing, CONTENT.social, CONTENT.listing, CONTENT.launch]);

// ------------------------------------------------------------------------------------------------
// The copy of a row, for the no-proof check
// ------------------------------------------------------------------------------------------------

const NOT_COPY = new Set(["url", "finalUrl", "asin", "asins", "campaignName", "adGroupName", "brandName", "matchType", "cta", "displayName", "keywords", "negativeKeywords", "href", "ctaHref", "imageFileId", "imageAlt", "competitorIds", "priceItemId"]);

function leaves(v: unknown, path: string, out: CopyField[]) {
  const key = path.split(".").pop()!.replace(/\[\d+\]/g, "");
  if (NOT_COPY.has(key)) return;
  if (typeof v === "string") {
    if (v.trim()) out.push({ field: path, text: v });
  } else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, out);
}

export function claimFields(section: string, title: string, body: string, data: Record<string, unknown>): CopyField[] {
  const out: CopyField[] = [];
  switch (section) {
    case CONTENT.ads:
      leaves(data.fields, "fields", out);
      break;
    case CONTENT.landing:
      leaves(data.content, "content", out);
      break;
    case CONTENT.listing:
      leaves((data.fields as Record<string, unknown> | undefined) ? { ...(data.fields as object), searchTerms: undefined } : undefined, "fields", out);
      break;
    case CONTENT.social:
      if (body.trim()) out.push({ field: "text", text: body });
      if (typeof data.postTitle === "string" && data.postTitle.trim()) out.push({ field: "postTitle", text: data.postTitle });
      break;
    case CONTENT.launch:
      leaves(data.subjects, "subjects", out);
      if (typeof data.previewText === "string" && data.previewText.trim()) out.push({ field: "previewText", text: data.previewText });
      if (typeof data.goal === "string" && data.goal.trim()) out.push({ field: "goal", text: data.goal });
      if (body.trim()) out.push({ field: "body", text: body });
      break;
  }
  return out;
}
