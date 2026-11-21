// Small helpers the generators share for writing prompts and reading rows.
import { z } from "zod";
import type { Item } from "@/lib/types";
import type { GenContext } from "./types";

export const RULES = `Rules that always apply:
- Work only from the rows you are given. Do not invent market figures, prices, regulations, certifications, test results or suppliers.
- When something needed is not on record, say so in the text (for example "to be confirmed") instead of making it up.
- Plain, short sentences. No marketing superlatives. No em dashes.
- For each row, list in "basedOn" the ids (the numbers after #) of the rows you used.`;

const fieldText = (data: Record<string, unknown>, skip: string[] = []) =>
  Object.entries(data ?? {})
    .filter(([k, v]) => !skip.includes(k) && v !== null && v !== "" && (typeof v !== "object" || Array.isArray(v)))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join("|") : String(v)}`)
    .join("; ");

/** One row as a prompt line: "#12 [open] Title: body (field=value; ...)". */
function line(i: Item, opts: { skip?: string[]; bodyMax?: number } = {}) {
  const body = i.body ? `: ${i.body.length > (opts.bodyMax ?? 1200) ? `${i.body.slice(0, opts.bodyMax ?? 1200)}...` : i.body}` : "";
  const f = fieldText(i.data, opts.skip ?? ["geometry", "schematic"]);
  return `#${i.id} [${i.status}] ${i.title}${body}${f ? ` (${f})` : ""}`;
}

export function block(title: string, items: Item[] | undefined, opts?: { skip?: string[]; bodyMax?: number }) {
  const list = items ?? [];
  if (!list.length) return `${title}: none on record.`;
  return `${title}:\n${list.map((i) => line(i, opts)).join("\n")}`;
}

export function conceptHeader(ctx: GenContext) {
  return `Concept: ${ctx.concept.name}. ${ctx.concept.oneLiner || "(no one-liner)"}\nProduct type: ${ctx.concept.productType}.`;
}

/** The part of a prompt that turns a generator into a reviser of named rows. */
export function reviseBlock(ctx: GenContext) {
  if (!ctx.revise) return "";
  return [
    `This is a revision, not a fresh draft. ${ctx.revise.why}`,
    "Change only the rows below, and only where they need it. Return one row for each row you change, with \"replaces\" set to that row's id. Leave out rows that need no change.",
    block("Rows you may change", ctx.revise.items),
  ].join("\n");
}

export function critiqueBlock(ctx: GenContext) {
  if (!ctx.critique) return "";
  return `The reviewer attacked the current version. Answer the critique in the revision where it is right, and keep what it gets wrong:\n${ctx.critique}`;
}

/** Ids the model may cite, and the ids it did cite that exist: rows given, rows to revise, and the sources of the passages given. */
export const knownIds = (ctx: GenContext) =>
  new Set(Object.values(ctx.rows).flat().map((i) => i.id).concat(ctx.revise?.items.map((i) => i.id) ?? [], ctx.passages?.map((p) => p.sourceId) ?? []));

/** The passages of the concept's sources given to this run, each headed by its source's id and title, for citing in basedOn. */
export function passagesBlock(ctx: GenContext) {
  const list = ctx.passages ?? [];
  if (!list.length) return "";
  return [
    "Passages from the concept's own source documents (the original material it was written from). Use them as evidence, quote their lines exactly where you quote, and cite the source's id (the number after #) in basedOn:",
    ...list.map((p) => `#${p.sourceId} ${p.title}, passage ${p.n}:\n${p.text}`),
  ].join("\n\n");
}

export const basedOn = z.array(z.number().int()).max(200).optional().describe("ids of the rows you used, the numbers after #");
export const replaces = z.number().int().optional().describe("revision only: the id of the row this replaces");

/** A short title from text that may be long. */
export function clip(s: string, n = 300) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}.` : t;
}

/** The next free key of the form `${prefix}${n}`, skipping every key already used. */
export function nextKey(prefix: string, used: Set<string>) {
  for (let n = 1; ; n++) {
    const k = `${prefix}${n}`;
    if (!used.has(k)) {
      used.add(k);
      return k;
    }
  }
}

/** The existing row a revision row names, if it is one of the rows that may be changed. */
export function revisionTarget(ctx: GenContext, id: number | undefined) {
  if (!ctx.revise) return { ok: true as const, item: null };
  if (id === undefined) return { ok: false as const, reason: "it is a revision but does not say which row it replaces" };
  const item = ctx.revise.items.find((i) => i.id === id);
  if (!item) return { ok: false as const, reason: `it replaces row #${id}, which is not one of the rows that may be changed` };
  return { ok: true as const, item };
}
