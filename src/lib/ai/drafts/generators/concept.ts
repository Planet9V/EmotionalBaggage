// Brief to press release, and to FAQ (plan 4.2). Both are attacked by the reviewer once approved.
import { z } from "zod";
import type { Generator } from "../types";
import { RULES, basedOn, block, clip, conceptHeader, critiqueBlock, replaces, reviseBlock, revisionTarget } from "../prompt";

const always = () => true;

const pressRow = z.object({
  headline: z.string().min(1).max(300),
  text: z.string().min(1).max(20_000).describe("the full release, several short paragraphs"),
  basedOn,
  replaces,
});

export const pressRelease: Generator<z.infer<typeof pressRow>> = {
  id: "press-release",
  label: "Press release",
  action: "Draft a press release",
  from: ["concept/brief", "concept/questions", "research/claims", "concept/press"],
  to: "concept/press",
  kind: "section",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["concept/brief"]?.length || ctx.concept.oneLiner ? "" : "Write at least one brief line or a one-liner for the concept first."),
  buildPrompt: (ctx) => ({
    system: [
      "You write the press release a company would publish on the day this product launches, written before anything is built (the working-backwards method).",
      "It states who the customer is, the problem, what the product does about it, one quote from the company and one from a customer that are clearly marked as illustrative, and how to get it.",
      "A claim marked unverified must not be stated as fact. Prices and dates not on record are written as to be confirmed.",
      "Return exactly one row.",
      RULES,
    ].join("\n"),
    user: [
      conceptHeader(ctx),
      block("Brief", ctx.rows["concept/brief"]),
      block("Open questions", ctx.rows["concept/questions"]),
      block("Claims (with whether they are verified)", ctx.rows["research/claims"]),
      reviseBlock(ctx),
      critiqueBlock(ctx),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
  schema: pressRow,
  toDraft(row, ctx, run) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    if (!ctx.revise && run.index > 0) return { ok: false, reason: "only one press release is drafted per run" };
    return {
      ok: true,
      drafts: [
        {
          title: clip(row.headline),
          body: row.text.trim(),
          data: t.item ? { ...t.item.data } : {},
          op: t.item ? { op: "replace", reason: ctx.critique ? "Revised against the reviewer's critique." : undefined } : { op: "add" },
          itemId: t.item?.id,
          basedOn: row.basedOn,
        },
      ],
    };
  },
};

const faqRow = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(4000),
  basedOn,
  replaces,
});

export const faq: Generator<z.infer<typeof faqRow>> = {
  id: "faq",
  label: "FAQ",
  action: "Draft the FAQ",
  from: ["concept/brief", "concept/press", "concept/questions", "research/claims", "concept/faq"],
  to: "concept/faq",
  kind: "section",
  applies: always,
  revises: true,
  blocked: (ctx) => (ctx.rows["concept/brief"]?.length || ctx.rows["concept/press"]?.length ? "" : "Write the brief or a press release first."),
  buildPrompt: (ctx) => ({
    system: [
      "You write the frequently asked questions that buyers, retailers and sceptics will ask about this product, with straight answers.",
      "Include the hard questions: price, why not an existing product, what happens when it fails, safety and rules that may apply.",
      "Where the answer is not on record, the answer says what is not yet known and how it will be found out.",
      "Between 6 and 12 rows. Do not repeat a question that is already in the existing FAQ.",
      RULES,
    ].join("\n"),
    user: [
      conceptHeader(ctx),
      block("Brief", ctx.rows["concept/brief"]),
      block("Press release", ctx.rows["concept/press"], { bodyMax: 4000 }),
      block("Open questions", ctx.rows["concept/questions"]),
      block("Claims", ctx.rows["research/claims"]),
      ctx.revise ? "" : block("Existing FAQ", ctx.rows["concept/faq"]),
      reviseBlock(ctx),
      critiqueBlock(ctx),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
  schema: faqRow,
  toDraft(row, ctx) {
    const t = revisionTarget(ctx, row.replaces);
    if (!t.ok) return { ok: false, reason: t.reason };
    const q = clip(row.question);
    if (!t.item && (ctx.existing.some((i) => i.title.trim().toLowerCase() === q.toLowerCase()))) {
      return { ok: false, reason: "the FAQ already has this question" };
    }
    return {
      ok: true,
      drafts: [
        {
          title: q,
          body: row.answer.trim(),
          data: t.item ? { ...t.item.data } : {},
          op: t.item ? { op: "replace", reason: ctx.critique ? "Revised against the reviewer's critique." : undefined } : { op: "add" },
          itemId: t.item?.id,
          basedOn: row.basedOn,
        },
      ],
    };
  },
};
