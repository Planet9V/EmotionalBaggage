// Reviews and questions (plan 8.20): CSV or pasted import, "what customers keep asking", and turning a
// group into a draft requirement that cites the rows it came from.
//
// Amazon reviews are not imported: SP-API has no operation that returns individual customer reviews.
// The Customer Feedback API (https://developer-docs.amazon.com/sp-api/docs/customer-feedback-api, read
// 21 Nov 2026) gives weekly, English-only review *topics* per ASIN or browse node in seven stores, not the
// reviews themselves. Reviews are typed, pasted or imported here from a CSV the user exported.
import { createHash } from "node:crypto";
import Papa from "papaparse";
import { HttpError } from "@/lib/api/route";
import { currentActor } from "@/lib/actor";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { embed, getEmbedding } from "@/lib/ai/models";
import type { Item } from "@/lib/types";
import { CHANNEL, reviewData, SENTIMENTS } from "./schemas";
import { assertRoomFor } from "@/lib/api/limits";

// ---------------------------------------------------------------------------------------------
// Import

/** Column names recognised in a CSV header, lower case, spaces and punctuation removed. */
const COLUMNS: Record<string, string[]> = {
  text: ["text", "review", "reviewtext", "body", "content", "comment", "question", "message", "reviewbody"],
  title: ["title", "reviewtitle", "headline", "subject", "summary"],
  rating: ["rating", "stars", "starrating", "score", "overallrating"],
  date: ["date", "reviewdate", "created", "createdat", "submitted", "posted"],
  source: ["source", "channel", "site", "platform", "marketplace"],
  productVersion: ["productversion", "version", "model", "variant", "sku", "asin"],
  kind: ["kind", "type"],
  sentiment: ["sentiment"],
  topic: ["topic", "tag", "category", "theme"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type ImportRow = { kind: "review" | "question"; title: string; text: string; rating: number | null; date: string; source: string; productVersion: string; sentiment: string; topic: string };

function toDay(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Parses CSV with a header row (papaparse), or plain pasted text with one review or question per blank-line-separated block. */
export function parseReviews(input: string, defaults: { source?: string; kind?: "review" | "question" } = {}): { rows: ImportRow[]; problems: string[]; columns: Record<string, string> } {
  const problems: string[] = [];
  const looksCsv = /^[^\n]*[,;\t][^\n]*\n/.test(input.trimStart());
  const columns: Record<string, string> = {};
  const rows: ImportRow[] = [];
  const base = (text: string): ImportRow => ({ kind: defaults.kind ?? (/\?\s*$/.test(text.trim()) ? "question" : "review"), title: "", text, rating: null, date: "", source: defaults.source ?? "", productVersion: "", sentiment: "", topic: "" });
  if (looksCsv) {
    const parsed = Papa.parse<Record<string, string>>(input.trim(), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    for (const e of parsed.errors.slice(0, 5)) problems.push(`Line ${(e.row ?? 0) + 2}: ${e.message}`);
    const headers = parsed.meta.fields ?? [];
    for (const [field, names] of Object.entries(COLUMNS)) {
      const h = headers.find((x) => names.includes(norm(x)));
      if (h) columns[field] = h;
    }
    if (!columns.text) {
      problems.push(`No column holds the review text. Name one of the columns "text", "review", "body" or "question". Columns found: ${headers.join(", ") || "none"}.`);
      return { rows: [], problems, columns };
    }
    parsed.data.forEach((r, i) => {
      const text = String(r[columns.text] ?? "").trim();
      if (!text) return;
      const row = base(text);
      row.title = columns.title ? String(r[columns.title] ?? "").trim() : "";
      if (columns.rating) {
        const raw = String(r[columns.rating] ?? "").trim();
        const n = Number.parseFloat(raw);
        if (raw && (!Number.isFinite(n) || n < 1 || n > 5)) problems.push(`Row ${i + 2}: the rating "${raw}" is not 1 to 5; left empty.`);
        else if (raw) row.rating = Math.round(n);
      }
      if (columns.date) row.date = toDay(String(r[columns.date] ?? ""));
      if (columns.source) row.source = String(r[columns.source] ?? "").trim() || row.source;
      if (columns.productVersion) row.productVersion = String(r[columns.productVersion] ?? "").trim();
      if (columns.kind) {
        const k = norm(String(r[columns.kind] ?? ""));
        if (k === "question" || k === "review") row.kind = k;
      }
      if (columns.sentiment) {
        const s = norm(String(r[columns.sentiment] ?? ""));
        if ((SENTIMENTS as readonly string[]).includes(s)) row.sentiment = s;
      }
      if (columns.topic) row.topic = String(r[columns.topic] ?? "").trim().slice(0, 80);
      rows.push(row);
    });
  } else {
    for (const block of input.split(/\n\s*\n/)) {
      const text = block.trim();
      if (text) rows.push(base(text));
    }
  }
  return { rows, problems, columns };
}

const externalIdOf = (r: ImportRow) => `review:${createHash("sha256").update(`${r.source.toLowerCase()}\n${r.date}\n${r.text.trim()}`).digest("hex").slice(0, 32)}`;

export async function importReviews(projectId: string, input: string, defaults: { source?: string; kind?: "review" | "question" } = {}) {
  const { rows, problems, columns } = parseReviews(input, defaults);
  if (!rows.length) return { added: 0, skipped: 0, problems: problems.length ? problems : ["Nothing to import: no rows with text were found."], columns };
  let added = 0;
  await tx(async (c) => {
    await assertRoomFor(c, projectId, rows.length);
    for (const r of rows) {
      const data = reviewData.parse({
        kind: r.kind,
        rating: r.rating,
        source: r.source.slice(0, 80),
        date: r.date,
        productVersion: r.productVersion.slice(0, 80),
        sentiment: r.sentiment,
        topic: r.topic,
        externalId: externalIdOf(r),
      });
      const title = (r.title || r.text.split("\n")[0]).replace(/\s+/g, " ").slice(0, 120);
      const res = await c.query(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1, $2, $3, $4, $5, 'new', (SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
         ON CONFLICT (project_id, section, (data->>'externalId')) WHERE data ? 'externalId' DO NOTHING RETURNING id`,
        [projectId, CHANNEL.reviews, title, r.text.slice(0, 20_000), JSON.stringify(data)]
      );
      added += res.rowCount ?? 0;
    }
    await logEventIn(c, projectId, "channel.reviews.import", `Imported ${added} reviews and questions (${rows.length - added} already in the log)`, { added, skipped: rows.length - added, columns, problems: problems.slice(0, 5) });
  });
  return { added, skipped: rows.length - added, problems, columns };
}

// ---------------------------------------------------------------------------------------------
// What customers keep asking

export type Group = { label: string; count: number; reviewIds: number[]; questions: number; reviews: number; averageRating: number | null; examples: string[] };
export type Grouping = { method: "meaning" | "tags"; note: string; groups: Group[]; untagged: number; total: number };

/** Groups by the user's own topic tags. Rows without a tag are counted, not guessed. */
export function groupByTag(items: Item[]): Grouping {
  const map = new Map<string, Item[]>();
  let untagged = 0;
  for (const i of items) {
    const t = typeof i.data.topic === "string" ? i.data.topic.trim() : "";
    if (!t) {
      untagged++;
      continue;
    }
    const k = t.toLowerCase();
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  const groups = [...map.values()].map((rows) => summarise(String(rows[0].data.topic).trim(), rows));
  groups.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { method: "tags", note: "Grouped by the topic you set on each row.", groups, untagged, total: items.length };
}

function summarise(label: string, rows: Item[]): Group {
  const ratings = rows.map((r) => r.data.rating).filter((n): n is number => typeof n === "number");
  return {
    label,
    count: rows.length,
    reviewIds: rows.map((r) => r.id),
    questions: rows.filter((r) => r.data.kind === "question").length,
    reviews: rows.filter((r) => r.data.kind !== "question").length,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    examples: rows.slice(0, 3).map((r) => r.body.replace(/\s+/g, " ").slice(0, 160)),
  };
}

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

export const SIMILARITY = 0.8;

/**
 * Greedy grouping by meaning: each row joins the first group whose first row is at least SIMILARITY
 * alike (cosine of the embedding vectors), else starts a group. Exported for tests with given vectors.
 */
export function groupVectors(items: Item[], vectors: number[][], threshold = SIMILARITY): Group[] {
  const seeds: { vector: number[]; rows: Item[] }[] = [];
  items.forEach((it, k) => {
    const v = vectors[k];
    const home = seeds.find((s) => cosine(s.vector, v) >= threshold);
    if (home) home.rows.push(it);
    else seeds.push({ vector: v, rows: [it] });
  });
  const groups = seeds.map((s) => {
    const tags = new Map<string, number>();
    for (const r of s.rows) {
      const t = typeof r.data.topic === "string" ? r.data.topic.trim() : "";
      if (t) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    const tag = [...tags.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return summarise(tag ?? s.rows[0].title.slice(0, 80), s.rows);
  });
  return groups.sort((a, b) => b.count - a.count);
}

export async function reviewRows(projectId: string): Promise<Item[]> {
  return (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [projectId, CHANNEL.reviews])).map(toItem);
}

/** By meaning when an embedding model is chosen, else by the user's tags. Counts are counts of rows. */
export async function whatTheyAsk(projectId: string, mode: "auto" | "tags" = "auto"): Promise<Grouping> {
  const items = await reviewRows(projectId);
  if (mode === "tags" || items.length === 0) return groupByTag(items);
  const ready = await getEmbedding();
  if (!ready.ok) return { ...groupByTag(items), note: `Grouped by the topic you set on each row. Grouping by meaning needs an embedding model: ${ready.reason}` };
  const { vectors, info } = await embed(items.map((i) => `${i.title}\n${i.body}`.slice(0, 4000)), { use: ready });
  return {
    method: "meaning",
    note: `Grouped by meaning with ${info.model}: rows whose embeddings are at least ${SIMILARITY} alike (cosine) share a group. A group is named by its most used topic tag, else by its first row.`,
    groups: groupVectors(items, vectors),
    untagged: items.filter((i) => !(typeof i.data.topic === "string" && i.data.topic.trim())).length,
    total: items.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Turn into a requirement: a draft (drafts table), approved through the drafting engine like any other.

export async function draftRequirement(projectId: string, o: { title: string; detail: string; reviewIds: number[] }) {
  const ids = [...new Set(o.reviewIds)];
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND id = ANY($3)`, [projectId, CHANNEL.reviews, ids])).map(toItem);
  const missing = ids.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) throw new HttpError(400, `Rows ${missing.map((m) => `#${m}`).join(", ")} are not reviews or questions of this concept.`);
  const used = await q<{ key: string }>("SELECT data->>'key' AS key FROM items WHERE project_id=$1 AND data ? 'key'", [projectId]);
  const pendingKeys = await q<{ key: string }>("SELECT data->>'key' AS key FROM drafts WHERE project_id=$1 AND status='draft' AND data ? 'key'", [projectId]);
  const taken = new Set([...used, ...pendingKeys].map((u) => u.key));
  let n = 1;
  while (taken.has(`req-${n}`)) n++;
  const key = `req-${n}`;
  const data = { key, source: "customer reviews and questions", fromReviews: ids, _draft: { op: "add", reason: `${ids.length} customer ${ids.length === 1 ? "row" : "rows"} asked for this` } };
  const sources = rows.map((r) => ({ kind: "item", id: r.id, title: r.title, section: r.section }));
  return tx(async (c) => {
    const r = await c.query<{ id: string; run_id: string }>(
      `INSERT INTO drafts (project_id, generator, target_store, title, body, data, sources, model, provider, run_id)
       VALUES ($1, 'reviews-requirement', $2, $3, $4, $5, $6, '', 'user', gen_random_uuid()) RETURNING id, run_id`,
      [projectId, CHANNEL.requirements, o.title.trim().slice(0, 300), o.detail.slice(0, 20_000), JSON.stringify(data), JSON.stringify(sources)]
    );
    await logEventIn(c, projectId, "draft.created", `${currentActor() || "Someone"} turned ${ids.length} customer ${ids.length === 1 ? "row" : "rows"} into a draft requirement "${o.title.trim()}" for review`, {
      draftId: Number(r.rows[0].id),
      generator: "reviews-requirement",
      targetStore: CHANNEL.requirements,
      key,
      sources,
    });
    return { draftId: Number(r.rows[0].id), key };
  });
}
