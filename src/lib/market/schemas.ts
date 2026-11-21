// What each marketing section stores in Item.data. Kept in one file here and registered in
// src/lib/domain/schemas.ts (BY_STORE), so the API validates writes with these shapes.
// Every schema is loose: a column it does not name is kept, and every field is optional, so a
// row typed by hand, an older row and a generated row all pass.
import { z } from "zod";

const text = (max = 2000) => z.string().max(max);

/** Where a generated row came from. Written by the generator runner, never by the model. */
export const generatedFrom = z.object({
  sources: z.array(z.object({ kind: text(40), id: z.number().int().optional(), title: text(300) })).max(80),
  model: text(200),
  at: text(40),
});
export type GeneratedFrom = z.infer<typeof generatedFrom>;

export const MARKET = {
  personas: "marketing/personas",
  competitors: "marketing/competitors",
  positioning: "marketing/positioning",
  brand: "marketing/brand",
  imagery: "marketing/imagery",
  pricing: "marketing/pricing",
  names: "concept/names",
} as const;

// 8.1 -------------------------------------------------------------------------------------------

export const personaQuote = z.object({
  quote: text(600),
  /** the saved research answer the words were found in */
  researchId: z.number().int().optional(),
});

export const personaData = z.looseObject({
  who: text().optional(),
  job: text().optional(),
  trigger: text().optional(),
  objection: text().optional(),
  whereTheyLook: text().optional(),
  theirWords: z.array(personaQuote).max(12).optional(),
  generatedFrom: generatedFrom.optional(),
});

// 8.2 -------------------------------------------------------------------------------------------

export const COMPETITOR_KINDS = ["product", "alternative"] as const;
/** research: read from a cited answer. typed: entered by the user. unsourced: generated with no citation. */
export const COMPETITOR_BASIS = ["research", "typed", "unsourced"] as const;

export const competitorData = z.looseObject({
  kind: z.enum(COMPETITOR_KINDS).optional(),
  what: text().optional(),
  priceText: text(200).optional(),
  /** price in minor units (cents), when priceText is a single price */
  priceMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  currency: text(3).optional(),
  claim: text().optional(),
  weakness: text().optional(),
  sourceUrl: text(2000).optional(),
  basis: z.enum(COMPETITOR_BASIS).optional(),
  researchId: z.number().int().optional(),
  generatedFrom: generatedFrom.optional(),
});

// 8.3 -------------------------------------------------------------------------------------------

export const proofRef = z.object({
  itemId: z.number().int(),
  section: text(60),
  /** the row's key when it has one */
  key: text(120).optional(),
  title: text(300).optional(),
});
export type ProofRef = z.infer<typeof proofRef>;

export const positioningMessage = z.object({
  text: text(600),
  proof: z.array(proofRef).max(20).default([]),
});
export type PositioningMessage = z.infer<typeof positioningMessage>;

export const critique = z.object({ text: text(8000), at: text(40), model: text(200), /** what the reviewer was shown, see positioningFingerprint */ fingerprint: text(20_000).optional() });

export const positioningData = z.looseObject({
  kind: z.enum(["statement"]).optional(),
  forWhom: text().optional(),
  need: text().optional(),
  productIs: text().optional(),
  thatDoes: text().optional(),
  unlike: text().optional(),
  difference: text().optional(),
  messages: z.array(positioningMessage).max(8).optional(),
  critique: critique.optional(),
  generatedFrom: generatedFrom.optional(),
});

// 8.4 -------------------------------------------------------------------------------------------

export const pricingData = z.looseObject({
  kind: z.enum(["price", "channel", "assumptions"]).optional(),
  priceMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  currency: text(3).optional(),
  /** which of the three approaches suggested it, or "own" when typed */
  approach: z.enum(["cost-plus", "competitor", "value", "own"]).optional(),
  feePercent: z.number().min(0).max(100).optional(),
  fixedFeeMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  targetMarginPercent: z.number().min(0).max(99).optional(),
  valueMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  valueNote: text().optional(),
  note: text().optional(),
});

// 8.5 -------------------------------------------------------------------------------------------

export const namesData = z.looseObject({
  /** "Name" or "Tagline"; older rows may hold other text, so it is not an enum */
  kind: text(40).optional(),
  reason: text().optional(),
  /** which checks the user has done and ticked: check id -> true */
  screening: z.record(z.string().max(40), z.boolean()).optional(),
  generatedFrom: generatedFrom.optional(),
});

// 8.6 -------------------------------------------------------------------------------------------

export const HEX = /^#[0-9a-fA-F]{6}$/;

export const brandColour = z.object({
  role: z.enum(["primary", "secondary"]),
  name: text(60),
  hex: z.string().regex(HEX, "must be a six-digit colour such as #E05A10"),
});
export type BrandColour = z.infer<typeof brandColour>;

export const voiceRule = z.object({ rule: text(400), doExample: text(400).default(""), dontExample: text(400).default("") });
export type VoiceRule = z.infer<typeof voiceRule>;

export const voiceSuggestion = z.object({ before: text(1000), after: text(1000), why: text(500) });

export const brandData = z.looseObject({
  kind: z.enum(["kit", "voicecheck"]).optional(),
  voiceSummary: text().optional(),
  rules: z.array(voiceRule).max(20).optional(),
  colours: z.array(brandColour).max(12).optional(),
  headingFont: text(120).optional(),
  bodyFont: text(120).optional(),
  logoFileIds: z.array(z.number().int()).max(20).optional(),
  tagline: text(300).optional(),
  boilerplate: text(3000).optional(),
  /** voicecheck rows */
  checked: text(8000).optional(),
  suggestions: z.array(voiceSuggestion).max(20).optional(),
  generatedFrom: generatedFrom.optional(),
});

// 8.7 -------------------------------------------------------------------------------------------

export const imageryData = z.looseObject({
  shotKey: text(60).optional(),
  purpose: text().optional(),
  usedIn: z.array(text(80)).max(20).optional(),
  fileId: z.number().int().nullable().optional(),
  source: z.enum(["render", "upload"]).nullable().optional(),
  notes: text().optional(),
});

/** Schemas by store, for src/lib/domain/schemas.ts. */
export const MARKET_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  [MARKET.personas]: personaData,
  [MARKET.competitors]: competitorData,
  [MARKET.positioning]: positioningData,
  [MARKET.brand]: brandData,
  [MARKET.imagery]: imageryData,
  [MARKET.pricing]: pricingData,
  [MARKET.names]: namesData,
};
