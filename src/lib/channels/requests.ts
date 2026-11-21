// Request schemas for /api/channels/*. Every input is validated here before it reaches the channel code.
import { z } from "zod";
import { REVIEW_KINDS } from "./schemas";

export const projectId = z.string().trim().min(1, "is required").max(80);
export const recordId = z.coerce.number().int().positive();

export const amazonPut = z.object({ projectId, marketplaceId: z.string().trim().min(1).max(40) }).strict();
export const projectOnly = z.object({ projectId }).strict();
export const ackBody = z.object({ version: z.string().max(120), read: z.literal(true, { error: "tick that you have read the statement" }) }).strict();
export const inboxFetch = z.object({ projectId, channel: z.enum(["x", "instagram"]) }).strict();
export const previewQuery = z.object({ projectId, kind: z.enum(["post", "reply"]), itemId: recordId });
export const imageBody = z.object({ projectId, itemId: z.number().int().positive(), imageUrl: z.string().trim().max(2000), altText: z.string().max(1000).optional() }).strict();
export const reviewTicks = z.object({ ticks: z.record(z.string().max(60), z.boolean()) }).strict();
export const importBody = z
  .object({ projectId, text: z.string().min(1, "paste or choose something to import").max(2_000_000, "is too large: split it into files under 2 MB"), source: z.string().trim().max(80).optional(), kind: z.enum(REVIEW_KINDS).optional() })
  .strict();
export const groupsQuery = z.object({ projectId, mode: z.enum(["auto", "tags"]).default("auto") });
export const requirementBody = z
  .object({ projectId, title: z.string().trim().min(1, "is required").max(300), detail: z.string().max(20_000), reviewIds: z.array(z.number().int().positive()).min(1, "name at least one review or question").max(500) })
  .strict();

export const queryOf = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);
