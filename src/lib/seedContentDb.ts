// Brings the example concept in a database up to date with the content batches (src/lib/seedContent.ts).
//
// Follows the pattern of the files seed (src/lib/story/seedFiles.ts): each batch is applied once per database,
// marked by an event that names the batch, on a pool client inside ready() (never tx()), under an advisory lock.
// A fresh install and an install seeded before a batch existed take the same path, so they end up the same.
//
//  - a row to add is left out when its section already has a row of that title (nothing is entered twice);
//  - a row to enrich is changed only while it still reads as the seed and the earlier batches left it, so
//    whatever a person has edited stays as they wrote it;
//  - a row to retire (a part or wire of the seeded design that a ruling supersedes) is removed only while it
//    still reads as seeded, the way the app's own delete removes a row: its links go with it, and the history
//    keeps the row and the reason; a row a person has changed stays;
//  - a batch whose event exists is never applied again (a row someone later removes does not come back).
// Every row passes the checks a row typed in the app passes: the section's statuses, its data schema, and the
// rules for claims, print jobs, send rows and positioning (checkContentRow, also run by the tests on every row).
import type { Pool, PoolClient } from "pg";
import { ITEM_COLS, type ItemRow } from "@/lib/db";
import { newItem, parseData, STORE_STATUSES } from "@/lib/api/schemas";
import { assertNewSendRow } from "@/lib/channels/rules";
import { assertNewMarket } from "@/lib/market/rules";
import { assertClaimChange, assertNewClaim } from "@/lib/research/rules";
import { SEED_PROJECT } from "@/lib/seed";
import { addedRow, applyBatches, asSeeded, CONTENT_BATCHES, enrichedRow, matches, RULED_SECTIONS, seededRows, untouched, type ContentBatch, type ContentRow, type PlainRow } from "@/lib/seedContent";
import { assertNewPrintJob } from "@/lib/slicing/rules";
import { addedDetail, changedDetail, itemDiff, removedDetail } from "@/lib/trace/changes";
import { relinkKey } from "@/lib/trace/links";
import { keyOf } from "@/lib/trace/spec";

const EVENT = "seed.content";
const COLS = "id, project_id, section, title, body, data, status, sort";
type Row = { id: string; project_id: string; section: string; title: string; body: string; data: Record<string, unknown>; status: string; sort: number };

/** Statuses a batch may give a new row: the ones that claim nothing has been done, checked or approved. */
const LOWEST = new Set(["open", "draft", "candidate", "unverified", "not run", "planned", "estimate", "to check", "queued", "to buy", "to solder", "to print"]);

/**
 * Throws when a batch row would not be accepted from a person typing it in the app. `was` is the row an
 * enrichment changes (as the seed and the earlier batches leave it).
 */
export function checkContentRow(r: ContentRow, was?: PlainRow): PlainRow {
  if (r.op === "link") {
    if (!r.requirement || (!r.tests.length && !r.parts.length) || !r.because.trim()) throw new Error(`${r.proposal}: a link names a requirement, at least one test or part, and says why`);
    return { section: r.section, title: r.requirement, body: "", data: {}, status: "" };
  }
  if (r.op === "retire") {
    if (!was) throw new Error(`${r.proposal}: no row in ${r.section} matches ${JSON.stringify(r.match)}`);
    if (!r.why.trim()) throw new Error(`${r.proposal}: a retired row says why it is superseded`);
    return was;
  }
  if (r.op === "add") {
    // "decided" only for a question or a decision, and only with the owner's words that decide it
    const byRuling = r.status === "decided" && RULED_SECTIONS.has(r.section) && Boolean(r.ruling?.trim());
    if (!LOWEST.has(r.status) && !byRuling) throw new Error(`${r.proposal}: a seeded row cannot start as "${r.status}"`);
    if (r.ruling !== undefined && !byRuling) throw new Error(`${r.proposal}: a ruling decides a question or a decision, and the row must then be "decided"`);
    const row = addedRow(r);
    const b = newItem.parse(row);
    assertNewClaim(b);
    assertNewPrintJob(b);
    assertNewSendRow(b);
    assertNewMarket(b);
    return { ...row, data: b.data ?? {} };
  }
  if (!was) throw new Error(`${r.proposal}: no row in ${r.section} matches ${JSON.stringify(r.match)}`);
  if (r.decide) {
    if (!RULED_SECTIONS.has(r.section) || !r.decide.ruling.trim()) throw new Error(`${r.proposal}: only a question or a decision can be decided, and only with the owner's words`);
    const options = [...(Array.isArray(was.data.options) ? (was.data.options as { id?: string }[]) : []), ...((r.appendList?.options as { id?: string }[] | undefined) ?? [])];
    if (r.decide.chosen !== undefined && !options.some((o) => o.id === r.decide!.chosen)) throw new Error(`${r.proposal}: "${r.decide.chosen}" is not one of the decision's options`);
  }
  if (r.setStatus !== undefined && !LOWEST.has(r.setStatus)) throw new Error(`${r.proposal}: a seeded row cannot be set to "${r.setStatus}"`);
  const row = enrichedRow(was, r);
  if (r.setStatus !== undefined && !(STORE_STATUSES[r.section] ?? []).includes(r.setStatus)) throw new Error(`${r.proposal}: "${r.setStatus}" is not a status of ${r.section}`);
  if (row.body.length > 20_000) throw new Error(`${r.proposal}: the text is too long`);
  const data = parseData(r.section, row.data) ?? {};
  // a claim's status does not change and its evidence is not touched
  assertClaimChange({ section: was.section, status: was.status, data: was.data }, r.setStatus !== undefined ? { status: r.setStatus } : {});
  return { ...row, data };
}

/**
 * A print job names the file it prints by its name in Files (`fileName`); the file's id differs per database, so it
 * is looked up here. A job whose file is not in Files is entered without one, as a person would enter it.
 */
async function withStoredFile(c: PoolClient, id: string, row: PlainRow): Promise<PlainRow> {
  if (row.section !== "prototype/printing" || typeof row.data.fileName !== "string" || row.data.fileId !== undefined) return row;
  const f = (await c.query<{ id: string }>("SELECT (data->>'fileId')::bigint AS id FROM items WHERE project_id=$1 AND section='concept/files' AND title=$2 AND data ? 'fileId' ORDER BY id LIMIT 1", [id, row.data.fileName])).rows[0];
  return f?.id ? { ...row, data: { ...row.data, fileId: Number(f.id) } } : row;
}

const done = async (q: Pool | PoolClient, id: string) => new Set((await q.query<{ batch: string }>("SELECT data->>'batch' AS batch FROM events WHERE project_id=$1 AND kind=$2", [id, EVENT])).rows.map((r) => r.batch));

type Skipped = { proposal: string; why: string };

async function applyBatch(c: PoolClient, id: string, b: ContentBatch, expected: PlainRow[], log: (kind: string, summary: string, data: unknown) => Promise<void>) {
  let added = 0;
  let enriched = 0;
  let retired = 0;
  let linked = 0;
  const skipped: Skipped[] = [];
  const origin = b.from ?? "the owner's documents";
  for (const r of b.rows) {
    const from = { seeded: true, batch: b.batch, proposal: r.proposal, sourceFile: r.sourceFile, sourceLocation: r.sourceLocation };
    if (r.op === "link") {
      checkContentRow(r);
      const { linkSeedRows } = await import("@/lib/db");
      const n = await linkSeedRows(c, { requirement: r.requirement, tests: r.tests, parts: r.parts, because: r.because }, `from ${origin}`);
      if (n) linked += n;
      else skipped.push({ proposal: r.proposal, why: "the rows it links are not there" });
      continue;
    }
    if (r.op === "retire") {
      const want = expected.find((x) => matches(x, r));
      const found = (
        await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND ${r.match.ref !== undefined ? "data->>'ref'" : "title"} = $3 ORDER BY id LIMIT 1 FOR UPDATE`, [id, r.section, r.match.ref ?? r.match.title])
      ).rows[0];
      if (!found || !want) {
        skipped.push({ proposal: r.proposal, why: "the row it retires is not there" });
        continue;
      }
      if (!asSeeded({ section: found.section, title: found.title, body: found.body, data: found.data, status: found.status }, want)) {
        skipped.push({ proposal: r.proposal, why: "the row has been changed since it was seeded" });
        continue;
      }
      checkContentRow(r, want);
      // as the app's own delete does: the row goes, and rows that linked to it lose the link, each recorded
      await c.query("DELETE FROM items WHERE id=$1", [found.id]);
      const unlinked = await relinkKey(c, found, keyOf(found.data), null, `the linked row "${found.title}" was retired (${r.proposal})`);
      await log("item.removed", `Removed "${found.title}" from ${found.section}: ${r.why} (${r.proposal})`, { ...removedDetail(found, unlinked.length ? { unlinked: unlinked.map((u) => ({ itemId: u.id, title: u.title, field: u.field })) } : {}), reason: r.why, ...from });
      expected.splice(expected.indexOf(want), 1);
      retired++;
      continue;
    }
    if (r.op === "add") {
      if ((await c.query("SELECT 1 FROM items WHERE project_id=$1 AND section=$2 AND title=$3 LIMIT 1", [id, r.section, r.title])).rowCount) {
        skipped.push({ proposal: r.proposal, why: "a row of that title is already there" });
        continue;
      }
      // a part a person kept from a retired design still holds its reference: two parts may not share one
      if (r.section === "design/bom" && typeof r.data.ref === "string" && (await c.query("SELECT 1 FROM items WHERE project_id=$1 AND section=$2 AND data->>'ref'=$3 LIMIT 1", [id, r.section, r.data.ref])).rowCount) {
        skipped.push({ proposal: r.proposal, why: "a part of that reference is already there" });
        continue;
      }
      const row = await withStoredFile(c, id, checkContentRow(r));
      const res = await c.query<Row>(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1)) RETURNING ${COLS}`,
        [id, row.section, row.title, row.body, JSON.stringify(row.data), row.status]
      );
      await log("item.added", `Added "${row.title}" to ${row.section} from ${origin} (${r.proposal})`, { ...addedDetail(res.rows[0]), ...from });
      added++;
      continue;
    }
    const want = expected.find((x) => matches(x, r));
    const found = (
      await c.query<Row>(`SELECT ${COLS} FROM items WHERE project_id=$1 AND section=$2 AND ${r.match.ref !== undefined ? "data->>'ref'" : "title"} = $3 ORDER BY id LIMIT 1 FOR UPDATE`, [id, r.section, r.match.ref ?? r.match.title])
    ).rows[0];
    if (!found || !want) {
      skipped.push({ proposal: r.proposal, why: "the row it adds to is not there" });
      continue;
    }
    if (!untouched(found, want, r)) {
      skipped.push({ proposal: r.proposal, why: "the row has been changed since it was seeded" });
      continue;
    }
    const now = checkContentRow(r, { section: found.section, title: found.title, body: found.body, data: found.data, status: found.status });
    const upd = await c.query<Row>(`UPDATE items SET body=$2, data=$3, status=$4, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [found.id, now.body, JSON.stringify(now.data), now.status]);
    await log("item.edited", `"${found.title}": ${origin === "the owner's documents" ? "added what the owner's documents say" : `brought in line with ${origin}`} (${r.proposal})`, { ...changedDetail(upd.rows[0], itemDiff(found, upd.rows[0])), ...from });
    // later rows of the same batch read this row as it now is
    const i = expected.indexOf(want);
    expected[i] = enrichedRow(want, r);
    enriched++;
  }
  return { added, enriched, retired, linked, skipped };
}

/** Applies every batch this database has not had. Runs after the example and its additions are seeded. */
export async function seedContent(db: Pool, batches: ContentBatch[] = CONTENT_BATCHES) {
  const id = SEED_PROJECT.id;
  if (!(await db.query("SELECT 1 FROM projects WHERE id=$1", [id])).rowCount) return;
  const have = await done(db, id);
  if (batches.every((b) => have.has(b.batch))) return;
  const { logEventIn } = await import("@/lib/db");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`seed.content:${id}`]);
    const now = await done(c, id);
    for (let n = 0; n < batches.length; n++) {
      const b = batches[n];
      if (now.has(b.batch)) continue;
      // what the rows read as before this batch: the seed, then the batches before it
      const expected = applyBatches(seededRows(), batches.slice(0, n));
      const r = await applyBatch(c, id, b, expected, (kind, summary, data) => logEventIn(c, id, kind, summary, data));
      const left = r.skipped.length ? `; ${r.skipped.length} left alone` : "";
      const more = `${r.retired ? `, ${r.retired} superseded rows removed` : ""}${r.linked ? `, ${r.linked} links` : ""}`;
      await logEventIn(c, id, EVENT, `Entered the ${b.batch} content from ${b.from ?? "the owner's documents"}: ${r.added} rows added, ${r.enriched} rows added to${more}${left}`, { batch: b.batch, ...r, seeded: true });
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
