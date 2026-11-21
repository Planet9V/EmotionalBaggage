// Shapes and helpers for AI drafts that both the server and the browser use. Nothing here touches
// the database or a model.

export type DraftStatus = "draft" | "approved" | "rejected";

/** A row a draft was generated from. */
export type DraftSource = { kind: "item" | "research" | "message"; id: number; title: string; section?: string };

/**
 * What a draft asks of the target store. Kept in `data._draft`, never saved into the row.
 * "append": add `data.value` to the list at `field` (a dotted path such as "sourcing.offers") inside the
 * existing row `itemId`, read as it is at approval, so nothing else on the row is overwritten.
 */
export type DraftOp = { op: "add" | "replace" | "remove" | "append"; reason?: string; field?: string };

export type Draft = {
  id: number;
  projectId: string;
  generator: string;
  targetStore: string;
  title: string;
  body: string;
  /** the row's data as it would be saved (without `_draft`) */
  data: Record<string, unknown>;
  op: DraftOp;
  sources: DraftSource[];
  model: string;
  provider: string;
  status: DraftStatus;
  runId: string;
  reason: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  /** before approval: the row it would replace or remove; after: the row it created or replaced */
  itemId: number | null;
};

/** A row the model proposed that was not kept, and why. */
export type DroppedRow = { title: string; reason: string };

export type RunResult = {
  runId: string;
  generator: string;
  targetStore: string;
  drafts: Draft[];
  dropped: DroppedRow[];
  /** earlier undecided drafts of this generator marked rejected as superseded */
  superseded: number;
  model: string;
  provider: string;
  /** which path of the model layer produced the answer */
  path: "structured" | "prompted";
  notes: string[];
};

/** One generator as the screens see it. */
export type GeneratorInfo = {
  id: string;
  label: string;
  /** what the button says it does, e.g. "Draft requirements" */
  action: string;
  from: string[];
  to: string;
  kind: "section" | "optimise" | "links";
  /** source rows it would read, by store */
  counts: Record<string, number>;
  /** total source rows */
  reads: number;
  /** "from 9 requirements and 3 brief lines" */
  readsText: string;
  /** a sentence when it cannot run yet (nothing to read), else "" */
  blocked: string;
  /** undecided drafts of this generator, waiting for review */
  pending: number;
};

export type GeneratorsReply = {
  configured: boolean;
  /** the model layer's sentence when no reasoning model is ready */
  reason: string;
  model: string;
  generators: GeneratorInfo[];
};

/** Plain names of stores, singular and plural, for "from 9 requirements". */
const STORE_NOUN: Record<string, [string, string]> = {
  "concept/brief": ["brief line", "brief lines"],
  "concept/press": ["press release", "press releases"],
  "concept/faq": ["FAQ entry", "FAQ entries"],
  "concept/questions": ["open question", "open questions"],
  "concept/decisions": ["decision", "decisions"],
  "research/claims": ["claim", "claims"],
  "design/requirements": ["requirement", "requirements"],
  "design/bom": ["part", "parts"],
  "design/wiring": ["wire", "wires"],
  "prototype/assembly": ["assembly step", "assembly steps"],
  "prototype/tests": ["acceptance test", "acceptance tests"],
  "prototype/printing": ["print job", "print jobs"],
  "production/economics": ["economics line", "economics lines"],
  // channels (plan 8.18 to 8.20)
  "marketing/inbox": ["message", "messages"],
  "sales/reviews": ["review or question", "reviews and questions"],
  "marketing/replies": ["reply", "replies"],
  "marketing/brand": ["brand note", "brand notes"],
};

const noun = (store: string, n: number) => {
  const pair = STORE_NOUN[store] ?? ["row", "rows"];
  return `${n} ${n === 1 ? pair[0] : pair[1]}`;
};

/** "9 requirements, 3 brief lines and 1 claim", leaving out stores with nothing in them. */
export function readsText(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => noun(s, n));
  if (!parts.length) return "nothing yet";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The words the reviewer is asked with when an approved press release or FAQ entry is attacked (once, by the server). */
export const ATTACK_MESSAGE: Record<string, string> = {
  "concept/press": "Attack this press release. What would a sceptical buyer, journalist or investor say is wrong with it?",
  "concept/faq": "Attack this FAQ answer. Is it straight, and what question does it dodge?",
};

/** What the server keeps on an attacked row (data.attack). Written only by src/lib/ai/drafts/attack.ts. */
export type AttackRecord =
  | { state: "running"; at: string; by: string }
  | { state: "done"; at: string; by: string; model: string; messageId: number }
  | { state: "failed"; at: string; by: string; reason: string };
