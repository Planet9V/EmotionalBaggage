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
//  - "add": a new row. Nothing is added when the section already has a row of that title, or (a part) when the
//    parts list already has a part of that reference: a part a person kept from a retired design keeps its ref.
//  - "enrich": an existing row keeps its text and gains what the batch lists. It is applied only while the row
//    still reads as the seed (and the batches before this one) left it: a row a person has changed is left alone.
//  - a ruling: a question or a decision is recorded as decided only where the owner's own words decide it.
//    Such a row carries `ruling` (his words, quoted) or, on an existing row, `decide`; nothing else in a
//    batch raises a status.
//  - "retire" (since the engineering batch of 22 Nov 2026): a row of the seeded design that an owner's ruling
//    supersedes (the 3 x AA design's series resistor, its microSD card, its UART wires) is taken out, with the
//    reason kept in the history. Only while the row still reads as seeded: a row a person has changed stays.
//  - "link": a requirement is linked to the tests that check it and the parts it needs, as SEED_LINKS does for
//    the first seed. Links live in the database only (the pure half leaves them out, as it does SEED_LINKS).
// No row a person wrote or changed is ever deleted or overwritten, and no row is given a status above the lowest
// one that is true (an enrichment may set a status only to one of the lowest: see LOWEST in seedContentDb.ts).
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT, type SeedItem } from "@/lib/seed";
import { evaluate } from "@/lib/content/claims";
import { CONTENT_STORES, claimFields } from "@/lib/content/schemas";
import type { Item } from "@/lib/types";
import { SEED_STORY } from "@/lib/story/seed";
import { STORY_STORE, storyPart } from "@/lib/story/parts";
import batch20261122 from "../../seed/concepts/baggage-claims/content/2026-11-22.json";
import batch20261122Rulings from "../../seed/concepts/baggage-claims/content/2026-11-22-rulings.json";
import batchEngineering from "../../seed/concepts/baggage-claims/content/2026-11-22-engineering.json";
import batchRevD from "../../seed/concepts/baggage-claims/content/2026-11-22-revD.json";
import batchRevD2 from "../../seed/concepts/baggage-claims/content/2026-11-22-revD-2.json";

type Provenance = { proposal: string; sourceFile: string; sourceLocation: string };

type ContentAdd = Provenance & {
  op: "add";
  section: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  /** the owner's words that decide the row; only with it may a question or a decision start as "decided" */
  ruling?: string;
  /** the day of the ruling, as 2026-11-22 */
  ruledOn?: string;
};

/** The sections whose rows a ruling can decide. */
export const RULED_SECTIONS = new Set(["concept/decisions", "concept/questions"]);
/** What a ruling leaves on the row it decides: the owner's words, and the day he said them. */
const ruled = (ruling: string, on?: string) => ({ ruling, ...(on ? { ruledOn: on } : {}) });

type ContentEnrich = Provenance & {
  op: "enrich";
  section: string;
  /** the row it changes: by title, or for a part by its reference */
  match: { title?: string; ref?: string };
  /** text put after the row's own text */
  appendBody?: string;
  /** the row's text, where the document's fuller wording replaces a shortened one */
  setBody?: string;
  /** data fields given the document's (or the design note's) value: text, a number, or a structure such as a part's geometry */
  setData?: Record<string, unknown>;
  /** the row's status, only to one of the lowest statuses (a requirement that is no longer blocked becomes open) */
  setStatus?: string;
  /** text put after a data field's own text */
  appendData?: Record<string, string>;
  /** entries put after a data field's own list (a decision's options, the story's example lines) */
  appendList?: Record<string, unknown[]>;
  /** the owner's words that decide the row, and for a decision the option they choose: the row becomes "decided" */
  decide?: { ruling: string; on?: string; chosen?: string };
};

/** Takes a seeded row out because a ruling supersedes it. `why` goes into the history. */
type ContentRetire = Provenance & { op: "retire"; section: string; match: { title?: string; ref?: string }; why: string };

/** Links a requirement (by title) to tests (by title) and parts (by reference), with the reason. */
type ContentLink = Provenance & { op: "link"; section: "design/requirements"; requirement: string; tests: string[]; parts: string[]; because: string };

export type ContentRow = ContentAdd | ContentEnrich | ContentRetire | ContentLink;
/** `from`: where the batch's rows come from, as the history lines say it (default: the owner's documents). */
export type ContentBatch = { batch: string; about: string; from?: string; rows: ContentRow[] };

/** Every batch, oldest first. A new batch is a new file and a new line here. */
export const CONTENT_BATCHES: ContentBatch[] = [batch20261122 as ContentBatch, batch20261122Rulings as ContentBatch, batchEngineering as ContentBatch, batchRevD as ContentBatch, batchRevD2 as ContentBatch];

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
  const row: PlainRow = { section: r.section, title: r.title, body: r.body, data: { ...r.data, ...(r.ruling ? ruled(r.ruling, r.ruledOn) : {}), proposal: r.proposal, sourceFile: r.sourceFile, sourceLocation: r.sourceLocation }, status: r.status };
  return { ...row, data: withFlags(row) };
}

/** The data fields an enrichment reads or writes; the row must still hold the seeded value of each. */
const touchedFields = (r: ContentEnrich) => [...Object.keys(r.setData ?? {}), ...Object.keys(r.appendData ?? {}), ...Object.keys(r.appendList ?? {}), ...(r.decide?.chosen !== undefined ? ["chosen"] : [])];

/** A row after an enrichment: its own text and fields, plus what the batch lists and a note of where that came from. */
export function enrichedRow(was: PlainRow, r: ContentEnrich): PlainRow {
  const data: Record<string, unknown> = { ...was.data, ...(r.setData ?? {}) };
  for (const [k, more] of Object.entries(r.appendData ?? {})) data[k] = joined(typeof was.data[k] === "string" ? (was.data[k] as string) : "", more);
  for (const [k, more] of Object.entries(r.appendList ?? {})) data[k] = [...(Array.isArray(was.data[k]) ? (was.data[k] as unknown[]) : []), ...more];
  if (r.decide) Object.assign(data, ruled(r.decide.ruling, r.decide.on), r.decide.chosen !== undefined ? { chosen: r.decide.chosen } : {});
  const before = Array.isArray(was.data.additions) ? (was.data.additions as unknown[]) : [];
  data.additions = [...before, { proposal: r.proposal, sourceFile: r.sourceFile, sourceLocation: r.sourceLocation }];
  const row: PlainRow = { ...was, body: r.setBody ?? (r.appendBody ? joined(was.body, r.appendBody) : was.body), data, status: r.decide ? "decided" : (r.setStatus ?? was.status) };
  return { ...row, data: withFlags(row) };
}

/** Whether `rows` already hold the row an "add" would make: one of that title in its section, or a part of its reference. */
const PARTS = "design/bom";
export const alreadyThere = (rows: Pick<PlainRow, "section" | "title" | "data">[], r: Pick<ContentAdd, "section" | "title" | "data">) =>
  rows.some((x) => x.section === r.section && (x.title === r.title || (r.section === PARTS && typeof r.data.ref === "string" && x.data?.ref === r.data.ref)));

/** Whether a row is the one an enrichment names. */
export const matches = (row: Pick<PlainRow, "section" | "title" | "data">, r: Pick<ContentEnrich, "section" | "match">) =>
  row.section === r.section && (r.match.ref !== undefined ? row.data?.ref === r.match.ref : row.title === r.match.title);

/** Whether a stored row still reads as `expected` in everything an enrichment touches: its text and the fields it sets. */
export function untouched(row: PlainRow, expected: PlainRow, r: ContentEnrich): boolean {
  if (row.body !== expected.body || row.title !== expected.title) return false;
  // a ruling decides a row only while nobody has decided, reopened or blocked it since
  if ((r.decide || r.setStatus !== undefined) && row.status !== expected.status) return false;
  return touchedFields(r).every((k) => same(row.data?.[k] ?? "", expected.data?.[k] ?? ""));
}

/** Two stored values are the same value (a geometry or a list is compared by content, key order aside). */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * Whether a stored row still reads as the seed and the earlier batches left it, in everything they wrote: its
 * title, text, status and each data field they set. Fields the app added since (a key, links, flags) do not count.
 * A row is retired only when this holds.
 */
export function asSeeded(row: PlainRow, expected: PlainRow): boolean {
  if (row.body !== expected.body || row.title !== expected.title || row.status !== expected.status) return false;
  return Object.keys(expected.data ?? {}).filter((k) => !APP_FIELDS.has(k)).every((k) => same(row.data?.[k], expected.data?.[k]));
}
const APP_FIELDS = new Set(["flags", "noProof", "additions", "key", "tests", "parts", "requirements"]);

const plain = (s: SeedItem): PlainRow => ({ section: s.section, title: s.title, body: s.body ?? "", data: s.data ?? {}, status: s.status ?? "open" });

/** A part of the story as a batch reads it: its heading, its text and its example lines (the links to its sources differ per database). */
export const storyRow = (p: (typeof SEED_STORY)[number]): PlainRow => ({
  section: STORY_STORE,
  title: storyPart(p.part)?.heading ?? p.part,
  body: p.body,
  data: { part: p.part, ...(p.examples ? { examples: p.examples } : {}) },
  status: p.status,
});

/** The example's rows that a batch may enrich, as the seed modules hold them: the story's parts, then every other row (the files are not among them). */
export const seededRows = (): PlainRow[] => [...SEED_STORY.map(storyRow), ...SEED_ITEMS.map(plain), ...Object.values(SEED_ADDITIONS).flatMap((list) => list.map(plain))];

/** `rows` after the given batches: enriched rows changed in place, added rows at the end. A row that is not found is an error in the batch. */
export function applyBatches(rows: PlainRow[], batches: ContentBatch[] = CONTENT_BATCHES): PlainRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (const b of batches) {
    for (const r of b.rows) {
      if (r.op === "add") {
        if (!alreadyThere(out, r)) out.push(addedRow(r));
        continue;
      }
      if (r.op === "link") continue;
      const i = out.findIndex((x) => matches(x, r));
      if (i < 0) throw new Error(`[seed] ${b.batch} ${r.proposal}: no row in ${r.section} matches ${JSON.stringify(r.match)}`);
      if (r.op === "retire") out.splice(i, 1);
      else out[i] = enrichedRow(out[i], r);
    }
  }
  return out;
}

/** The example's Item rows with every batch applied, for the views that read the seed modules and no database. */
export function applySeedContent(rows: Item[], batches: ContentBatch[] = CONTENT_BATCHES): Item[] {
  // rows carry their place in `rows`, so a retired row drops out without shifting the ids of the rows after it
  const tagged = rows.map((r, i) => ({ ...r, data: { ...r.data, __at: i } }));
  const after = applyBatches(tagged, batches);
  let next = rows.length;
  return after.map((r) => {
    const { __at, ...data } = r.data as Record<string, unknown> & { __at?: number };
    if (typeof __at === "number") return { ...rows[__at], ...r, data };
    const id = ++next;
    return { id, projectId: SEED_PROJECT.id, sort: id - 1, ...r, data };
  });
}
