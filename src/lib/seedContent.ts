// Content added to the example concept (Baggage Claims MK1) after its first seed, in dated batches.
//
// Each batch is a file under seed/concepts/baggage-claims/content/. Its rows come from the review sheet
// docs/research/baggage-claims-content-proposal.csv: only rows that state one of the owner's documents plainly
// and need no decision from him (his ruling of 22 Nov 2026). Every row names the sheet row it comes from
// (`proposal`) and the document and place it was checked against (`sourceFile`, `sourceLocation`).
//
// This file is the pure half: what a batch does to a list of rows. The welcome page and the status tests use
// it on the seed modules' rows, and src/lib/seedContentDb.ts uses the same functions to bring a database up to
// date, so a fresh install, an upgraded install and the public welcome page hold the same content.
//
//  - "add": a new row. Nothing is added when the section already has a row of that title.
//  - "enrich": an existing row keeps its text and gains what the batch lists. It is applied only while the row
//    still reads as the seed (and the batches before this one) left it: a row a person has changed is left alone.
// Nothing is ever deleted, and no row is given a status above the lowest one that is true.
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT, type SeedItem } from "@/lib/seed";
import { evaluate } from "@/lib/content/claims";
import { CONTENT_STORES, claimFields } from "@/lib/content/schemas";
import type { Item } from "@/lib/types";
import batch20261122 from "../../seed/concepts/baggage-claims/content/2026-11-22.json";

type Provenance = { proposal: string; sourceFile: string; sourceLocation: string };

type ContentAdd = Provenance & { op: "add"; section: string; title: string; body: string; data: Record<string, unknown>; status: string };

type ContentEnrich = Provenance & {
  op: "enrich";
  section: string;
  /** the row it changes: by title, or for a part by its reference */
  match: { title?: string; ref?: string };
  /** text put after the row's own text */
  appendBody?: string;
  /** the row's text, where the document's fuller wording replaces a shortened one */
  setBody?: string;
  /** data fields given the document's value */
  setData?: Record<string, string>;
  /** text put after a data field's own text */
  appendData?: Record<string, string>;
};

export type ContentRow = ContentAdd | ContentEnrich;
export type ContentBatch = { batch: string; about: string; rows: ContentRow[] };

/** Every batch, oldest first. A new batch is a new file and a new line here. */
export const CONTENT_BATCHES: ContentBatch[] = [batch20261122 as ContentBatch];

/** A row as far as a batch reads or writes it. */
export type PlainRow = { section: string; title: string; body: string; data: Record<string, unknown>; status: string };

/** `more` after a row's own text, as a new sentence. */
const joined = (was: string, more: string) => {
  const t = was.trimEnd();
  return t ? `${t}${/[.!?:;)"'\u201d]$/.test(t) ? "" : "."} ${more}` : more;
};

/** The flags a content row carries (numbers and superlatives with no proof), as the app sets them on every save. */
function withFlags(row: PlainRow): Record<string, unknown> {
  if (!CONTENT_STORES.has(row.section)) return row.data;
  const flags = evaluate(claimFields(row.section, row.title, row.body, row.data), [], [SEED_PROJECT.name]);
  return { ...row.data, flags, noProof: flags.length > 0 };
}

/** The row a batch adds, with where it came from kept on it. */
export function addedRow(r: ContentAdd): PlainRow {
  const row: PlainRow = { section: r.section, title: r.title, body: r.body, data: { ...r.data, proposal: r.proposal, sourceFile: r.sourceFile, sourceLocation: r.sourceLocation }, status: r.status };
  return { ...row, data: withFlags(row) };
}

/** The data fields an enrichment reads or writes; the row must still hold the seeded value of each. */
const touchedFields = (r: ContentEnrich) => [...Object.keys(r.setData ?? {}), ...Object.keys(r.appendData ?? {})];

/** A row after an enrichment: its own text and fields, plus what the batch lists and a note of where that came from. */
export function enrichedRow(was: PlainRow, r: ContentEnrich): PlainRow {
  const data: Record<string, unknown> = { ...was.data, ...(r.setData ?? {}) };
  for (const [k, more] of Object.entries(r.appendData ?? {})) data[k] = joined(typeof was.data[k] === "string" ? (was.data[k] as string) : "", more);
  const before = Array.isArray(was.data.additions) ? (was.data.additions as unknown[]) : [];
  data.additions = [...before, { proposal: r.proposal, sourceFile: r.sourceFile, sourceLocation: r.sourceLocation }];
  const row: PlainRow = { ...was, body: r.setBody ?? (r.appendBody ? joined(was.body, r.appendBody) : was.body), data };
  return { ...row, data: withFlags(row) };
}

/** Whether a row is the one an enrichment names. */
export const matches = (row: Pick<PlainRow, "section" | "title" | "data">, r: ContentEnrich) =>
  row.section === r.section && (r.match.ref !== undefined ? row.data?.ref === r.match.ref : row.title === r.match.title);

/** Whether a stored row still reads as `expected` in everything an enrichment touches: its text and the fields it sets. */
export function untouched(row: PlainRow, expected: PlainRow, r: ContentEnrich): boolean {
  if (row.body !== expected.body || row.title !== expected.title) return false;
  return touchedFields(r).every((k) => (row.data?.[k] ?? "") === (expected.data?.[k] ?? ""));
}

const plain = (s: SeedItem): PlainRow => ({ section: s.section, title: s.title, body: s.body ?? "", data: s.data ?? {}, status: s.status ?? "open" });

/** The example's rows that a batch may enrich, as the seed modules hold them (the story and the files are not among them). */
export const seededRows = (): PlainRow[] => [...SEED_ITEMS.map(plain), ...Object.values(SEED_ADDITIONS).flatMap((list) => list.map(plain))];

/** `rows` after the given batches: enriched rows changed in place, added rows at the end. A row that is not found is an error in the batch. */
export function applyBatches(rows: PlainRow[], batches: ContentBatch[] = CONTENT_BATCHES): PlainRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (const b of batches) {
    for (const r of b.rows) {
      if (r.op === "add") {
        if (!out.some((x) => x.section === r.section && x.title === r.title)) out.push(addedRow(r));
        continue;
      }
      const i = out.findIndex((x) => matches(x, r));
      if (i < 0) throw new Error(`[seed] ${b.batch} ${r.proposal}: no row in ${r.section} matches ${JSON.stringify(r.match)}`);
      out[i] = enrichedRow(out[i], r);
    }
  }
  return out;
}

/** The example's Item rows with every batch applied, for the views that read the seed modules and no database. */
export function applySeedContent(rows: Item[], batches: ContentBatch[] = CONTENT_BATCHES): Item[] {
  const after = applyBatches(rows, batches);
  return after.map((r, i) => (i < rows.length ? { ...rows[i], ...r } : { id: i + 1, projectId: SEED_PROJECT.id, sort: i, ...r }));
}
