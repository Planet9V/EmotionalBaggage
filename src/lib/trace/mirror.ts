// Keeps the two ends of a requirement link the same (traceability). A requirement lists the tests that check it
// and the parts it needs (`tests`, `parts`); a test or part lists the requirements it serves (`requirements`,
// what drafting writes). Whichever end a write changes, the other end is changed in the same transaction, each
// change recorded as an edit of the row that holds it. Renames and deletions are relinkKey's (links.ts), which
// walks every list in LINK_FIELDS, both ends included.
import type { PoolClient } from "pg";
import { ITEM_COLS, logEventIn, type ItemRow } from "@/lib/db";
import { STORE } from "@/lib/domain/schemas";
import { changedDetail } from "./changes";
import { keyOf, listOf, MIRRORED } from "./spec";
import { slugify } from "@/lib/format";

type Row = Pick<ItemRow, "id" | "project_id" | "section" | "title" | "data">;

const diff = (was: string[], now: string[]) => ({ added: now.filter((k) => !was.includes(k)), removed: was.filter((k) => !now.includes(k)) });

/** A key no row of the concept uses, made from the row's reference or title. */
async function freeKey(c: PoolClient, projectId: string, row: Row): Promise<string> {
  const prefix = row.section === STORE.tests ? "test" : row.section === STORE.parts ? "part" : "req";
  const ref = typeof row.data.ref === "string" ? row.data.ref : "";
  const slug = slugify(ref || row.title, { max: 40, fallback: prefix });
  const base = ref ? slug : `${prefix}-${slug}`;
  const used = new Set((await c.query<{ key: string }>("SELECT data->>'key' AS key FROM items WHERE project_id=$1 AND data ? 'key'", [projectId])).rows.map((r) => r.key));
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
  return key;
}

/** Sets one list (or the key) inside a row's data, and records the change with before and after. */
async function setField(c: PoolClient, id: number, field: string, value: unknown, why: string): Promise<ItemRow> {
  const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 FOR UPDATE`, [id])).rows[0];
  const r = await c.query<ItemRow>(`UPDATE items SET data = data || jsonb_build_object($2::text, $3::jsonb), updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [
    id,
    field,
    JSON.stringify(value),
  ]);
  const now = r.rows[0];
  await logEventIn(c, now.project_id, "item.edited", `"${now.title}": ${why}`, changedDetail(now, { before: field in (was.data ?? {}) ? { [`data.${field}`]: was.data[field] } : {}, after: { [`data.${field}`]: value } }));
  return now;
}

/** Gives a row a key when it has none, so the other end can name it. Returns the key. */
async function ensureKey(c: PoolClient, row: Row): Promise<string> {
  const own = keyOf(row.data);
  if (own) return own;
  const key = await freeKey(c, row.project_id, row);
  await setField(c, Number(row.id), "key", key, `given the key ${key} so its links can name it`);
  return key;
}

/**
 * Brings the other end in line after `after` was written (`before` is the row as it was, or null for a new row).
 * Call inside the write's transaction, after the row is saved and its links were checked (assertLinks).
 */
export async function mirrorLinks(c: PoolClient, before: Pick<Row, "data"> | null, after: Row): Promise<void> {
  const pid = after.project_id;
  const mirrored = MIRRORED.find((m) => m.section === after.section);
  if (mirrored) {
    // A test or a part: its `requirements` list changed; each requirement's `tests`/`parts` list follows.
    const { added, removed } = diff(listOf(before?.data, "requirements"), listOf(after.data, "requirements"));
    if (!added.length && !removed.length) return;
    const own = added.length ? await ensureKey(c, after) : keyOf(after.data);
    if (!own) return;
    const reqs = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND data->>'key' = ANY($3::text[]) ORDER BY id FOR UPDATE`, [
      pid,
      STORE.requirements,
      [...added, ...removed],
    ]);
    for (const req of reqs.rows) {
      const k = keyOf(req.data);
      const list = listOf(req.data, mirrored.field);
      if (added.includes(k) && !list.includes(own)) await setField(c, Number(req.id), mirrored.field, [...list, own], `linked to "${after.title}" from its other end`);
      if (removed.includes(k) && list.includes(own)) await setField(c, Number(req.id), mirrored.field, list.filter((x) => x !== own), `unlinked from "${after.title}" at its other end`);
    }
    return;
  }
  if (after.section !== STORE.requirements) return;
  // A requirement: its `tests` and `parts` lists changed; each test's or part's `requirements` list follows.
  const changes = MIRRORED.map((m) => ({ ...m, ...diff(listOf(before?.data, m.field), listOf(after.data, m.field)) })).filter((m) => m.added.length || m.removed.length);
  if (!changes.length) return;
  const own = changes.some((m) => m.added.length) ? await ensureKey(c, after) : keyOf(after.data);
  if (!own) return;
  for (const m of changes) {
    const rows = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND data->>'key' = ANY($3::text[]) ORDER BY id FOR UPDATE`, [
      pid,
      m.section,
      [...m.added, ...m.removed],
    ]);
    for (const r of rows.rows) {
      const k = keyOf(r.data);
      const list = listOf(r.data, "requirements");
      if (m.added.includes(k) && !list.includes(own)) await setField(c, Number(r.id), "requirements", [...list, own], `linked to the requirement "${after.title}" from its other end`);
      if (m.removed.includes(k) && list.includes(own)) await setField(c, Number(r.id), "requirements", list.filter((x) => x !== own), `unlinked from the requirement "${after.title}" at its other end`);
    }
  }
}
