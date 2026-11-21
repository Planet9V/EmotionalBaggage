// The shape every marketing generator has. The shared drafting engine
// (src/lib/ai/drafts/, another branch) uses, so a generator can move onto it unchanged:
//   { id, label, from, to, applies, buildPrompt(context), schema }
// A generator is a plain module: no UI, no storage, no model client. `runGenerator` in
// src/lib/market/drafting.ts puts each one on the shared drafting engine (src/lib/ai/drafts).
import type { z } from "zod";
import type { Item } from "@/lib/types";
import type { GeneratedFrom } from "../schemas";

export type SourceRef = { kind: string; id: number; title: string };

/** A saved research answer, as a generator reads it. */
export type ResearchAnswer = {
  id: number;
  query: string;
  answer: string;
  sources: { url: string; title: string }[];
};

/** Everything a generator may read. Loaded once by the runner; generators never touch the database. */
export type MarketContext = {
  project: { id: string; name: string; oneLiner: string };
  brief: Item[];
  /** every claim, with its status: only verified ones may be leaned on */
  claims: Item[];
  research: ResearchAnswer[];
  personas: Item[];
  competitors: Item[];
  requirements: Item[];
  tests: Item[];
  names: Item[];
  /** the brand kit as text, "" when none is set up */
  brand: string;
  /** the brand kit row, when there is one */
  brandItem: Item | null;
  /** what the user asked for in this call: a research answer id, a text to check, a batch note */
  params: Record<string, unknown>;
};

export type Prompt = { system: string; prompt: string; maxOutputTokens?: number };

export type Applies = { ok: true } | { ok: false; reason: string };

export type RowDraft = {
  section: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: "draft";
};

export type Generator<S extends z.ZodType = z.ZodType> = {
  id: string;
  label: string;
  /** the kinds of rows it reads, for the "generated from" line */
  from: string[];
  /** the section its rows are saved to */
  to: string;
  applies(context: MarketContext): Applies;
  buildPrompt(context: MarketContext): Prompt;
  schema: S;
};

/** The pure step after the model answers: output to rows. Checks every reference the model gave against the context. */
export type ToRows<S extends z.ZodType> = (output: z.infer<S>, context: MarketContext, stamp: { model: string; at: string }) => { rows: RowDraft[]; notes: string[] };

export type Entry<S extends z.ZodType = z.ZodType> = { generator: Generator<S>; toRows: ToRows<S> };

export const lines = (items: Item[], max = 40) =>
  items
    .slice(0, max)
    .map((i) => `- [id ${i.id}${i.status ? `, ${i.status}` : ""}] ${i.title}${i.body ? `: ${i.body.replace(/\s+/g, " ").slice(0, 600)}` : ""}`)
    .join("\n");

export const stampOf = (sources: SourceRef[], s: { model: string; at: string }): GeneratedFrom => ({
  sources: dedupe(sources),
  model: s.model,
  at: s.at,
});

function dedupe(list: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.kind}:${s.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Lower-case, collapsed spaces and plain quotes, so a quotation can be found in the text it came from. */
export function squash(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export const GROUNDING =
  "Rules: use only what is given below. Never add a fact, figure, price, quotation or source of your own. If the material does not say it, leave the field empty rather than guess. Write short plain sentences with no em dashes.";
