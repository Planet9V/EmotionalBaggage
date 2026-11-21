// Draft generators for the channel sections (plan 8.18 to 8.20), registered in
// src/lib/ai/drafts/registry.ts. Every reply and every suggested tag is a draft until a person approves
// it; an approved reply is still sent only by its own "Send" button (src/lib/channels/send.ts).
// The brand voice comes from the brand kit (the same text brandContext gives other generators).
import { z } from "zod";
import { brandText, findKit } from "@/lib/market/brandKit";
import type { Item } from "@/lib/types";
import type { GenContext, Generator } from "@/lib/ai/drafts/types";
import { RULES, basedOn, block, clip, conceptHeader } from "@/lib/ai/drafts/prompt";
import { CHANNEL, SENTIMENTS } from "./schemas";

const always = () => true;
/** X counts most characters as one; this is a plain code-point count, so a reply X would count longer is refused by X, not sent short. */
export const X_REPLY_MAX = 280;
export const IG_REPLY_MAX = 2200;

const voice = (ctx: GenContext) => {
  const t = brandText(findKit(ctx.rows[CHANNEL.brand] ?? []));
  return t ? `Brand voice (follow it):\n${t}` : "Brand voice: none on record. Write plainly and politely.";
};

/** Rows of `store` that nothing in Replies answers yet (approved or sent), and that are still new. */
const unanswered = (ctx: GenContext, store: string) => {
  const answered = new Set(ctx.existing.map((r) => r.data.answers).filter((n): n is number => typeof n === "number"));
  return (ctx.rows[store] ?? []).filter((i) => i.status === "new" && !answered.has(i.id));
};

const REPLY_RULES = [
  "Answer the person's actual point in one to three short sentences. Thank them only when they praised or helped.",
  "Never promise a refund, a replacement, a date, a feature or a fix that the rows do not support. When something is not known, say it will be checked.",
  "Never ask for personal details in public. Never argue. No hashtags. No links unless the rows give one.",
];

const replyRow = z.object({
  answers: z.number().int().describe("the id (the number after #) of the mention, comment or review this answers"),
  text: z.string().min(1).max(IG_REPLY_MAX).describe("the reply, ready to post"),
  reasoning: z.string().max(600).optional().describe("one sentence on why this reply, for the person approving it"),
  basedOn,
});

export const channelReplies: Generator<z.infer<typeof replyRow>> = {
  id: "channel-replies",
  label: "Replies to mentions and comments",
  action: "Draft replies to mentions and comments",
  from: [CHANNEL.inbox, CHANNEL.brand, "concept/faq", "research/claims"],
  to: CHANNEL.replies,
  kind: "section",
  applies: always,
  revises: false,
  blocked: (ctx) => (unanswered(ctx, CHANNEL.inbox).length ? "" : "Nothing new to answer: read mentions or comments in Replies and comments first."),
  buildPrompt: (ctx) => ({
    system: ["You draft public replies, for a small product company, to mentions on X and comments on Instagram.", ...REPLY_RULES, `A reply on X must be at most ${X_REPLY_MAX} characters.`, "One row per message you answer; skip messages that need no reply (spam, a plain like).", RULES].join("\n"),
    user: [conceptHeader(ctx), voice(ctx), block("Messages to answer", unanswered(ctx, CHANNEL.inbox)), block("FAQ", ctx.rows["concept/faq"]), block("Checked claims", (ctx.rows["research/claims"] ?? []).filter((c) => c.status === "verified"))].join("\n\n"),
  }),
  schema: replyRow,
  toDraft(row, ctx) {
    const src = unanswered(ctx, CHANNEL.inbox).find((i) => i.id === row.answers);
    if (!src) return { ok: false, reason: `#${row.answers} is not a new mention or comment without a reply` };
    const channel = src.data.channel === "Instagram" ? "Instagram" : "X";
    const text = row.text.trim();
    const len = Array.from(text).length;
    if (channel === "X" && len > X_REPLY_MAX) return { ok: false, reason: `the reply is ${len} characters; X allows ${X_REPLY_MAX}` };
    const who = typeof src.data.author === "string" && src.data.author ? ` @${src.data.author}` : "";
    return {
      ok: true,
      drafts: [
        {
          title: clip(`Reply to${who} on ${channel}: ${text}`, 120),
          body: text,
          data: { channel, answers: src.id, replyTo: String(src.data.replyTo ?? ""), ...(row.reasoning ? { reasoning: row.reasoning.trim() } : {}) },
          op: { op: "add" },
          basedOn: [src.id, ...(row.basedOn ?? [])],
        },
      ],
    };
  },
};

export const reviewReplies: Generator<z.infer<typeof replyRow>> = {
  id: "review-replies",
  label: "Replies to reviews and questions",
  action: "Draft replies to reviews and questions",
  from: [CHANNEL.reviews, CHANNEL.brand, "concept/faq", "research/claims"],
  to: CHANNEL.replies,
  kind: "section",
  applies: always,
  revises: false,
  blocked: (ctx) => (unanswered(ctx, CHANNEL.reviews).length ? "" : "Nothing new to answer: add or import reviews and questions in Sales, Reviews and questions first."),
  buildPrompt: (ctx) => ({
    system: [
      "You draft replies, for a small product company, to customer reviews and questions. The person approving them posts them by hand where the review was left.",
      ...REPLY_RULES,
      "On Amazon, a reply must not ask for a review, offer anything in return or direct the customer off Amazon.",
      "One row per review or question you answer.",
      RULES,
    ].join("\n"),
    user: [conceptHeader(ctx), voice(ctx), block("Reviews and questions to answer", unanswered(ctx, CHANNEL.reviews)), block("FAQ", ctx.rows["concept/faq"]), block("Checked claims", (ctx.rows["research/claims"] ?? []).filter((c) => c.status === "verified"))].join("\n\n"),
  }),
  schema: replyRow,
  toDraft(row, ctx) {
    const src = unanswered(ctx, CHANNEL.reviews).find((i) => i.id === row.answers);
    if (!src) return { ok: false, reason: `#${row.answers} is not a new review or question without a reply` };
    const source = typeof src.data.source === "string" ? src.data.source : "";
    const channel = /amazon/i.test(source) ? "Amazon" : "Other";
    const text = row.text.trim();
    return {
      ok: true,
      drafts: [
        {
          title: clip(`Reply to ${src.data.kind === "question" ? "question" : "review"}${source ? ` on ${source}` : ""}: ${text}`, 120),
          body: text,
          data: { channel, answers: src.id, ...(row.reasoning ? { reasoning: row.reasoning.trim() } : {}) },
          op: { op: "add" },
          basedOn: [src.id, ...(row.basedOn ?? [])],
        },
      ],
    };
  },
};

const tagRow = z.object({
  id: z.number().int().describe("the id (the number after #) of the review or question"),
  topic: z.string().min(1).max(60).describe("two to four words naming what it is about, reusing an existing topic where one fits"),
  sentiment: z.enum(SENTIMENTS),
});

const untagged = (ctx: GenContext): Item[] => ctx.existing.filter((i) => !(typeof i.data.topic === "string" && i.data.topic.trim()) || !i.data.sentiment);

export const reviewTags: Generator<z.infer<typeof tagRow>> = {
  id: "review-tags",
  label: "Topic and sentiment for reviews",
  action: "Suggest topics and sentiment",
  from: [CHANNEL.reviews],
  to: CHANNEL.reviews,
  kind: "section",
  applies: always,
  revises: false,
  blocked: (ctx) => (untagged(ctx).length ? "" : "Every review and question already has a topic and a sentiment."),
  buildPrompt: (ctx) => {
    const topics = [...new Set(ctx.existing.map((i) => (typeof i.data.topic === "string" ? i.data.topic.trim() : "")).filter(Boolean))];
    return {
      system: [
        "You tag customer reviews and questions with a short topic and a sentiment, so the most common requests can be counted.",
        "Reuse one of the existing topics when it fits; otherwise make a new one of two to four words.",
        "Sentiment is positive, neutral or negative, from what the customer wrote, not from the rating alone.",
        "One row per review or question listed.",
      ].join("\n"),
      user: [conceptHeader(ctx), `Existing topics: ${topics.length ? topics.join(", ") : "none yet"}.`, block("Reviews and questions without a topic or sentiment", untagged(ctx))].join("\n\n"),
    };
  },
  schema: tagRow,
  toDraft(row, ctx) {
    const item = untagged(ctx).find((i) => i.id === row.id);
    if (!item) return { ok: false, reason: `#${row.id} is not a review or question that lacks a topic or sentiment` };
    const hasTopic = typeof item.data.topic === "string" && item.data.topic.trim();
    const data = { ...item.data, topic: hasTopic ? item.data.topic : row.topic.trim(), sentiment: item.data.sentiment || row.sentiment };
    return {
      ok: true,
      drafts: [{ title: item.title, body: item.body, data, op: { op: "replace", reason: `Suggested topic "${data.topic}" and sentiment "${data.sentiment}".` }, itemId: item.id, basedOn: [item.id] }],
    };
  },
};

export const CHANNEL_GENERATORS = [channelReplies, reviewReplies, reviewTags];
