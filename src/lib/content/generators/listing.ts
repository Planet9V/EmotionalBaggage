// 8.10 Amazon listing: title, five bullets, description and search terms, one generator per category so
// the writer picks the category by picking the generator (limits differ by category).
import { z } from "zod";
import type { Generator } from "@/lib/ai/drafts/types";
import { LISTING_CATEGORIES, checkListing, refusals, type ListingCategory } from "../channels";
import { CONTENT } from "../schemas";
import { BASE_FROM, CONTENT_RULES, blockedNoMessage, clean, cleanBlock, commonRow, header, messagesBlock, proofBlock, resolve, voiceBlock, withProof } from "./shared";

const row = z.object({ ...commonRow, title: z.string().min(1).max(400), bullets: z.array(z.string().max(1000)).min(1).max(10), description: z.string().max(5000), searchTerms: z.string().max(1000).default("") });
type Row = z.infer<typeof row>;

function listingGenerator(cat: ListingCategory): Generator<Row> {
  const L = cat.limits;
  return {
    id: `listing-${cat.id}`,
    label: cat.label,
    action: `Draft the Amazon listing (${cat.label})`,
    from: BASE_FROM,
    to: CONTENT.listing,
    kind: "section",
    applies: () => true,
    revises: false,
    blocked: blockedNoMessage,
    buildPrompt: (ctx) => ({
      system: [
        `You write an Amazon product listing for the category "${cat.label}".`,
        `Limits: title at most ${L.title.max} characters; exactly ${L.bullets.count} bullets of at most ${L.bullets.max} characters, each starting with a capital letter and no ending full stop; description at most ${L.description.max} characters; search terms at most ${L.searchTerms.maxBytes} bytes, words separated by spaces, none repeated from the title, no brand names of others.`,
        "Do not put prices, promotions, shipping or seller information in any field. No 'best seller' or 'Amazon's Choice'. No claims that the product disinfects, repels insects, kills germs, treats, cures or prevents a condition.",
        "Tie the listing to exactly one approved message. Return exactly one row.",
        CONTENT_RULES,
      ].join("\n\n"),
      user: [header(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx)].join("\n\n"),
    }),
    schema: row,
    toDraft(r, ctx, run) {
      if (run.index > 0) return { ok: false, reason: "only one listing is drafted per run" };
      const res = resolve(ctx, r.messageId, r.proofIds);
      if (!res.ok) return res;
      const fields = { title: clean(r.title), bullets: r.bullets.map(clean).filter(Boolean), description: cleanBlock(r.description), searchTerms: clean(r.searchTerms) };
      const problems = checkListing(cat, fields);
      const hard = refusals(problems);
      if (hard.length) return { ok: false, reason: `over a limit from Amazon's own page: ${hard.map((h) => h.message).join(" ")}` };
      const data = withProof(ctx, CONTENT.listing, fields.title, fields.description, { category: cat.id, fields }, res.r);
      const notes = problems.map((p) => `${p.message}${p.source ? ` (${p.source})` : ""}`);
      return { ok: true, drafts: [{ title: fields.title.slice(0, 300), body: fields.description, data, op: { op: "add" }, basedOn: r.basedOn }], notes };
    },
  };
}

export const listingGenerators = LISTING_CATEGORIES.map(listingGenerator);
