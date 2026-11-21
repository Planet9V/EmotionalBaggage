// What a generator is. A generator is data plus two functions: it says which stores it reads and
// which one it writes, whether it applies to a product type, how to build the prompt from the rows it
// read, and the zod schema of one output row. `toDraft` turns one validated output row into the row
// that would be saved, or says why it is dropped. Everything else (reading rows, calling the model,
// checking each row against the target section's schema, saving drafts) is the engine's, in run.ts.
import type { z } from "zod";
import type { Item } from "@/lib/types";
import type { DraftOp } from "./shared";

export type ConceptInfo = { id: string; name: string; oneLiner: string; productType: string; /** the concept's currency, for generators that work with money */ currency?: string };

export type GenContext = {
  concept: ConceptInfo;
  /** source rows by store, read through the domain readers' Item shape */
  rows: Record<string, Item[]>;
  /** rows already in the target store */
  existing: Item[];
  /** every key used by any row of the concept, and every part reference: new ones must not repeat them */
  usedKeys: Set<string>;
  usedRefs: Set<string>;
  /** realignment and optimisation: only these existing rows may be changed */
  revise?: { items: Item[]; why: string };
  /** a critique from the reviewer to answer in the revision */
  critique?: string;
};

/** What one output row becomes: a new row, a replacement of an existing one, or a removal. */
export type Proposed = {
  title: string;
  body: string;
  data: Record<string, unknown>;
  op: DraftOp;
  /** the existing row it replaces or removes */
  itemId?: number;
  /** ids of source rows the model said it used; checked against what it was given */
  basedOn?: number[];
};

export type ToDraft = { ok: true; drafts: Proposed[]; notes?: string[] } | { ok: false; reason: string };

export type Generator<Row = Record<string, unknown>> = {
  id: string;
  label: string;
  /** the verb phrase on the button */
  action: string;
  /** stores it reads */
  from: string[];
  /** the store it writes */
  to: string;
  /** "section": a Draft with AI button on the target section; "optimise": run from /optimise */
  kind: "section" | "optimise";
  applies(productType: string): boolean;
  /** a sentence when there is nothing to work from; "" when it can run */
  blocked(ctx: GenContext): string;
  buildPrompt(ctx: GenContext): { system: string; user: string };
  /** one output row */
  schema: z.ZodType<Row>;
  /** state carried across the rows of one run (keys handed out, refs seen) is the generator's own */
  toDraft(row: Row, ctx: GenContext, run: RunState): ToDraft;
  /** whether it can be asked to revise existing rows of its target store */
  revises: boolean;
};

/** Scratch space for one run. */
export type RunState = {
  index: number;
  keys: Set<string>;
  refs: Set<string>;
  /** generator-specific memory (e.g. step numbers to keys) */
  memo: Map<string, unknown>;
};
