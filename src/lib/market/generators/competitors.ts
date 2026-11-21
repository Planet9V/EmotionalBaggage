// 8.2 Competitors and alternatives, read out of ONE saved research answer (Perplexity, with its
// citations). The model only extracts what the answer says. Every row keeps the citation address it
// came from; a row with none is saved as "unsourced" and shown as "unsourced: check this".
import { z } from "zod";
import { squash, stampOf, GROUNDING, type Entry, type Generator, type ToRows } from "./types";

const schema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        kind: z.enum(["product", "alternative"]),
        what: z.string().max(500),
        /** a price exactly as the answer words it ("$29.99"), or "" when the answer gives none */
        priceText: z.string().max(100).default(""),
        /** what the competitor says it does, as the answer reports it */
        claim: z.string().max(500).default(""),
        /** a weakness the answer reports, or "" */
        weakness: z.string().max(500).default(""),
        /** the one citation address the row is taken from; "" when the answer does not support it */
        sourceUrl: z.string().max(2000).default(""),
      })
    )
    .max(15),
});

const SYMBOL: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };

/** One plain price in text ("$29.99", "€1,200"), as minor units. A range or several prices give null. */
export function readPrice(text: string): { minor: number; currency: string } | null {
  const found = [...text.matchAll(/([$€£])\s?(\d{1,3}(?:,\d{3})*|\d+)(\.\d{1,2})?/g)];
  if (found.length !== 1) return null;
  const m = found[0];
  const major = Number(`${m[2].replace(/,/g, "")}${m[3] ?? ""}`);
  if (!Number.isFinite(major)) return null;
  return { minor: Math.round(major * 100), currency: SYMBOL[m[1]] };
}

const norm = (u: string) => u.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();

export const generator: Generator<typeof schema> = {
  id: "competitors",
  label: "Extract competitors from a research answer",
  from: ["research"],
  to: "marketing/competitors",
  applies: (c) => {
    const id = c.params.researchId;
    if (typeof id !== "number") return { ok: false, reason: "Choose the saved research answer to read." };
    return c.research.some((r) => r.id === id) ? { ok: true } : { ok: false, reason: "That research answer is not saved for this concept." };
  },
  buildPrompt: (c) => {
    const r = c.research.find((x) => x.id === c.params.researchId)!;
    const sources = r.sources.map((s, i) => `[${i + 1}] ${s.url}${s.title ? ` (${s.title})` : ""}`).join("\n");
    return {
      system: `You read one research answer and list the competitors and alternatives it names, as a comparison table. You extract; you do not research.\n${GROUNDING}\nA price is only what the answer states, written exactly as it states it. "sourceUrl" must be one of the numbered source addresses below, the one the answer relied on for that row; if the answer does not support the row, leave it empty. Include up to three non-product alternatives the buyer has today (doing nothing, a workaround, a substitute) only if the answer or the brief points to them, and leave their price empty.`,
      prompt: `Concept: ${c.project.name}. ${c.project.oneLiner}\n\nQuestion asked: ${r.query}\n\nAnswer:\n${r.answer.slice(0, 9000)}\n\nSource addresses:\n${sources || "(none)"}\n\nList each competitor or alternative: name, kind (product or alternative), what it is, price, its main claim, its weakness.`,
      maxOutputTokens: 3500,
    };
  },
  schema,
};

export const toRows: ToRows<typeof schema> = (out, c, stamp) => {
  const notes: string[] = [];
  const r = c.research.find((x) => x.id === c.params.researchId)!;
  const answer = squash(r.answer);
  const allowed = new Map(r.sources.map((s) => [norm(s.url), s]));
  const have = new Set(c.competitors.map((i) => i.title.trim().toLowerCase()));
  const seen = new Set<string>();
  const rows = out.rows.flatMap((x) => {
    const key = x.name.trim().toLowerCase();
    if (have.has(key) || seen.has(key)) {
      notes.push(`"${x.name}" is already in the table and was skipped.`);
      return [];
    }
    seen.add(key);
    const src = allowed.get(norm(x.sourceUrl));
    if (x.sourceUrl && !src) notes.push(`"${x.name}": the address the model gave is not one of the answer's sources, so the row is unsourced.`);
    let priceText = x.priceText.trim();
    if (priceText && !answer.includes(squash(priceText))) {
      notes.push(`"${x.name}": the price "${priceText}" is not in the answer and was removed.`);
      priceText = "";
    }
    const price = priceText ? readPrice(priceText) : null;
    return [
      {
        section: "marketing/competitors",
        title: x.name.trim(),
        body: "",
        data: {
          kind: x.kind,
          what: x.what,
          priceText,
          ...(price ? { priceMinor: price.minor, currency: price.currency } : {}),
          claim: x.claim,
          weakness: x.weakness,
          sourceUrl: src ? src.url : "",
          basis: src ? "research" : "unsourced",
          researchId: r.id,
          generatedFrom: stampOf([{ kind: "research", id: r.id, title: r.query }], stamp),
        },
        status: "draft" as const,
      },
    ];
  });
  return { rows, notes };
};

export const entry: Entry<typeof schema> = { generator, toRows };
