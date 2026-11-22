// Brings the example concept in a database up to date with the content batches (src/lib/seedContent.ts).
//
// Follows the pattern of the files seed (src/lib/story/seedFiles.ts): each batch is applied once per database,
// marked by an event that names the batch, on a pool client inside ready() (never tx()), under an advisory lock.
// A fresh install and an install seeded before a batch existed take the same path, so they end up the same.
//
//  - a row to add is left out when its section already has a row of that title (nothing is entered twice);
//  - a row to enrich is changed only while it still reads as the seed and the earlier batches left it, so
//    whatever a person has edited stays as they wrote it;
//  - nothing is deleted, and a batch whose event exists is never applied again (a row someone later removes
//    does not come back).
// Every row passes the checks a row typed in the app passes: the section's statuses, its data schema, and the
// rules for claims, print jobs, send rows and positioning (checkContentRow, also run by the tests on every row).
import type { Pool, PoolClient } from "pg";
import { newItem, parseData } from "@/lib/api/schemas";
import { assertNewSendRow } from "@/lib/channels/rules";
import { assertNewMarket } from "@/lib/market/rules";
import { assertClaimChange, assertNewClaim } from "@/lib/research/rules";
import { SEED_PROJECT } from "@/lib/seed";
import { addedRow, applyBatches, CONTENT_BATCHES, enrichedRow, matches, seededRows, untouched, type ContentBatch, type ContentRow, type PlainRow } from "@/lib/seedContent";
import { assertNewPrintJob } from "@/lib/slicing/rules";
import { addedDetail, changedDetail, itemDiff } from "@/lib/trace/changes";

const EVENT = "seed.content";
const COLS = "id, project_id, section, title, body, data, status, sort";
type Row = { id: string; project_id: string; section: string; title: string; body: string; data: Record<string, unknown>; status: string; sort: number };

/** Statuses a batch may give a new row: the ones that claim nothing has been done, checked or approved. */
const LOWEST = new Set(["open", "draft", "candidate", "unverified", "not run", "planned", "estimate", "to check", "queued", "to buy", "to solder"]);

/**
 * Throws when a batch row would not be accepted from a person typing it in the app. `was` is the row an
 * enrichment changes (as the seed and the earlier batches leave it).
 */
export function checkContentRow(r: ContentRow, was?: PlainRow): PlainRow {
  if (r.op === "add") {
    if (!LOWEST.has(r.status)) throw new Error(`${r.proposal}: a seeded row cannot start as "${r.status}"`);
    const row = addedRow(r);
    const b = newItem.parse(row);
    assertNewClaim(b);
    assertNewPrintJob(b);
    assertNewSendRow(b);
    assertNewMarket(b);
    return { ...row, data: b.data ?? {} };
  }
  if (!was) throw new Error(`${r.proposal}: no row in ${r.section} matches ${JSON.stringify(r.match)}`);
  const row = enrichedRow(was, r);
  if (row.body.length > 20_000) throw new Error(`${r.proposal}: the text is too long`);
  const data = parseData(r.section, row.data) ?? {};
  // the status does not change, and a claim's evidence is not touched
  assertClaimChange({ section: was.section, status: was.status, data: was.data }, {});
  return { ...row, data };
}

const done = async (q: Pool | PoolClient, id: string) => new Set((await q.query<{ batch: string }>("SELECT data->>'batch' AS batch FROM events WHERE project_id=$1 AND kind=$2", [id, EVENT])).rows.map((r) => r.batch));

type Skipped = { proposal: string; why: string };

async function applyBatch(c: PoolClient, id: string, b: ContentBatch, expected: PlainRow[], log: (kind: string, summary: string, data: unknown) => Promise<void>) {
  let added = 0;
  let enriched = 0;
  const skipped: Skipped[] = [];
  for (const r of b.rows) {
    const from = { seeded: true, batch: b.batch, proposal: r.proposal, sourceFile: r.sourceFile, sourceLocation: r.sourceLocation };
    if (r.op === "add") {
      if ((await c.query("SELECT 1 FROM items WHERE project_id=$1 AND section=$2 AND title=$3 LIMIT 1", [id, r.section, r.title])).rowCount) {
        skipped.push({ proposal: r.proposal, why: "a row of that title is already there" });
        continue;
      }
      const row = checkContentRow(r);
      const res = await c.query<Row>(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1)) RETURNING ${COLS}`,
        [id, row.section, row.title, row.body, JSON.stringify(row.data), row.status]
      );
      await log("item.added", `Added "${row.title}" to ${row.section} from the owner's documents (${r.proposal})`, { ...addedDetail(res.rows[0]), ...from });
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
    const upd = await c.query<Row>(`UPDATE items SET body=$2, data=$3, updated_at=now() WHERE id=$1 RETURNING ${COLS}`, [found.id, now.body, JSON.stringify(now.data)]);
    await log("item.edited", `"${found.title}": added what the owner's documents say (${r.proposal})`, { ...changedDetail(upd.rows[0], itemDiff(found, upd.rows[0])), ...from });
    // later rows of the same batch read this row as it now is
    const i = expected.indexOf(want);
    expected[i] = enrichedRow(want, r);
    enriched++;
  }
  return { added, enriched, skipped };
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
      await logEventIn(c, id, EVENT, `Entered the ${b.batch} content from the owner's documents: ${r.added} rows added, ${r.enriched} rows added to${left}`, { batch: b.batch, ...r, seeded: true });
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
