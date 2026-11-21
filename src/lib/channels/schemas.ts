// What the channel sections store in Item.data (plan 8.17 to 8.20). Registered in
// src/lib/domain/schemas.ts (BY_STORE), so the generic item routes validate writes with these shapes.
// Every schema is loose and every field optional, like the market schemas: a row typed by hand, an
// imported row and an approved draft all pass.
import { z } from "zod";
import { namesWith } from "./registry";

const text = (max = 2000) => z.string().max(max);
const day = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2026-12-31")]);
const num = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v),
  z.number().finite()
);

export const CHANNEL = {
  monitor: "sales/monitor",
  reviews: "sales/reviews",
  inbox: "marketing/inbox",
  replies: "marketing/replies",
  /** owned by the content module (plan 8.11); the posting view reads it and marks rows posted */
  social: "marketing/social",
  requirements: "design/requirements",
  brand: "marketing/brand",
  imagery: "marketing/imagery",
} as const;

/** What a send recorded on the row: the id the service gave back, when, and a link. Written only by src/lib/channels/send.ts. */
export const sentRecord = z.object({
  id: text(200),
  at: text(40),
  url: text(500).optional(),
  by: text(120).optional(),
});

/**
 * One sales monitor row. Rows typed by hand have date, channel, units and revenue. Rows imported from
 * Amazon add the order id (also in externalId, which a unique index keeps to one row per order), the
 * marketplace, the currency and the items (ASIN, SKU, quantity, amount). Nothing about the buyer.
 */
export const saleItem = z.object({ asin: text(20).optional(), sku: text(200).optional(), quantity: z.number().int().min(0), amount: z.number().finite() });
export const saleData = z.looseObject({
  date: day.optional(),
  channel: text(80).optional(),
  units: num.optional(),
  revenue: num.optional(),
  currency: text(3).optional(),
  externalId: text(120).optional(),
  orderId: text(60).optional(),
  marketplaceId: text(40).optional(),
  orderStatus: text(40).optional(),
  items: z.array(saleItem).max(200).optional(),
  source: z.enum(["hand", "sp-api"]).optional(),
});

export const REVIEW_KINDS = ["review", "question"] as const;
export const SENTIMENTS = ["positive", "neutral", "negative"] as const;

export const reviewData = z.looseObject({
  kind: z.enum(REVIEW_KINDS).optional(),
  rating: z.union([z.null(), num.refine((n) => Number.isInteger(n) && n >= 1 && n <= 5, "must be a whole number from 1 to 5")]).optional(),
  source: text(80).optional(),
  date: day.optional(),
  productVersion: text(80).optional(),
  sentiment: z.union([z.literal(""), z.enum(SENTIMENTS)]).optional(),
  topic: text(80).optional(),
  externalId: text(120).optional(),
  /** requirement keys this row was turned into */
  requirements: z.array(text(120)).max(50).optional(),
});

export const INBOX_CHANNELS = namesWith("inbox");

/** A mention, reply or comment read from X or Instagram. Only what a reply needs: no follower data. */
export const inboxData = z.looseObject({
  channel: z.enum(INBOX_CHANNELS).optional(),
  externalId: text(120).optional(),
  /** the id on the service to reply to (tweet id or Instagram comment id) */
  replyTo: text(60).optional(),
  author: text(120).optional(),
  at: text(40).optional(),
  url: text(500).optional(),
  /** the post or media it was left on */
  parent: text(60).optional(),
});

export const REPLY_CHANNELS = namesWith("replies");

/** A reply waiting to be sent, or sent. The text is the row body. */
export const replyData = z.looseObject({
  channel: z.enum(REPLY_CHANNELS).optional(),
  /** the inbox or review row it answers */
  answers: z.number().int().optional(),
  replyTo: text(60).optional(),
  sent: sentRecord.optional(),
  error: text(500).optional(),
});

export const CHANNEL_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  [CHANNEL.monitor]: saleData,
  [CHANNEL.reviews]: reviewData,
  [CHANNEL.inbox]: inboxData,
  [CHANNEL.replies]: replyData,
};

export type SaleData = z.infer<typeof saleData>;
export type ReviewData = z.infer<typeof reviewData>;
