// What a part's `data.sourcing` holds. It lives on the part (design/bom) because every figure belongs to one part, the parts list is
// already loaded by every screen that needs it, and a new table or section would add nothing a nested object does not.
// Browser-safe.
import { z } from "zod";

const text = (n: number) => z.string().max(n);
const num = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v), z.number().finite());
export const day = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2026-12-31")]);
const link = z.union([z.literal(""), z.string().max(600).regex(/^https?:\/\/[^\s]+$/i, "must be an http or https address")]);

export const ORDER_STATUSES = ["to order", "ordered", "shipped", "received", "short"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const offerSchema = z
  .object({
    id: text(40).min(1),
    supplier: text(120).min(1, "name the supplier"),
    partNumber: text(120).optional(),
    url: link.optional(),
    /** the price of one pack, in the concept's currency */
    price: num.refine((n) => n >= 0, "cannot be negative"),
    /** pieces in the pack that price buys */
    packSize: num.refine((n) => Number.isInteger(n) && n >= 1, "must be a whole number, 1 or more").default(1),
    stock: text(200).optional(),
    leadTimeDays: num.refine((n) => n >= 0, "cannot be negative").optional(),
    /** the day the price was looked at */
    checkedAt: day,
    /** entered: typed by the user. research: accepted from a research draft, and then a citation is required. */
    source: z.enum(["entered", "research"]).default("entered"),
    citation: link.optional(),
    researchId: num.optional(),
  })
  .refine((o) => o.source !== "research" || !!o.citation, { path: ["citation"], message: "a price from research needs the page it came from" });
export type Offer = z.infer<typeof offerSchema>;

export const alternateSchema = z.object({
  id: text(40).min(1),
  name: text(200).min(1, "name the part"),
  partNumber: text(120).optional(),
  url: link.optional(),
  /** what would have to change in the design if this part is used */
  whatChanges: text(1500).default(""),
  source: z.enum(["entered", "research"]).default("entered"),
  citation: link.optional(),
  researchId: num.optional(),
});
export type Alternate = z.infer<typeof alternateSchema>;

/** A suggestion from research that waits for the user. It never counts as a fact until accepted. */
export const draftSchema = z.object({
  id: text(40).min(1),
  kind: z.enum(["offer", "alternate"]),
  createdAt: text(40),
  model: text(80).optional(),
  researchId: num,
  /** the page the claim came from; a draft with no citation is never saved */
  citation: z.string().max(600).regex(/^https?:\/\/[^\s]+$/i),
  offer: offerSchema.optional(),
  alternate: alternateSchema.optional(),
});
export type Draft = z.infer<typeof draftSchema>;

export const orderSchema = z.object({
  status: z.enum(ORDER_STATUSES).default("to order"),
  qtyOrdered: num.refine((n) => n >= 0, "cannot be negative").optional(),
  qtyReceived: num.refine((n) => n >= 0, "cannot be negative").optional(),
  orderedOn: day.optional(),
  shippedOn: day.optional(),
  receivedOn: day.optional(),
  note: text(500).optional(),
});
export type Order = z.infer<typeof orderSchema>;

export const sourcingData = z.object({
  offers: z.array(offerSchema).max(30).default([]),
  chosen: text(40).optional(),
  alternates: z.array(alternateSchema).max(30).default([]),
  drafts: z.array(draftSchema).max(40).default([]),
  order: orderSchema.optional(),
});
export type Sourcing = z.infer<typeof sourcingData>;

export const EMPTY_SOURCING: Sourcing = { offers: [], alternates: [], drafts: [] };

/** A part's sourcing, tolerant of rows written before it existed. */
export function readSourcing(data: Record<string, unknown>): Sourcing {
  const r = sourcingData.safeParse(data.sourcing);
  return r.success ? r.data : EMPTY_SOURCING;
}

export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
