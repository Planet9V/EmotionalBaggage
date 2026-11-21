// What a change to a row looks like in the record, and how it is read back.
//
// Every write that changes a row puts two objects in the event's data: `before` and `after`, each
// keyed by field and holding only the fields that changed ("title", "body", "status", "sort" and
// "data.<name>" for a value inside the row's data). A new row has only `after` (every field), a
// removed row only `before`. project.edited and the claim evidence routes already used this shape;
// the reader below accepts it from every kind of event.
import { isDeepStrictEqual } from "node:util";
import type { ItemRow } from "@/lib/db";

export type Fields = Record<string, unknown>;

/** The fields of a row as the record keeps them. */
export function itemFields(r: Pick<ItemRow, "title" | "body" | "status" | "sort" | "data">): Fields {
  const out: Fields = { title: r.title, body: r.body, status: r.status, sort: r.sort };
  for (const [k, v] of Object.entries(r.data ?? {})) out[`data.${k}`] = v;
  return out;
}

/** The fields that differ between a row before and after a write, as `{ before, after }`. A field that did not exist is left out of `before`. */
export function itemDiff(was: ItemRow, now: ItemRow): { before: Fields; after: Fields } {
  const a = itemFields(was);
  const b = itemFields(now);
  const before: Fields = {};
  const after: Fields = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (isDeepStrictEqual(a[k], b[k])) continue;
    if (k in a) before[k] = a[k];
    if (k in b) after[k] = b[k];
  }
  return { before, after };
}

/** Event data for a row that was added. */
export const addedDetail = (row: ItemRow) => ({ itemId: Number(row.id), section: row.section, title: row.title, after: itemFields(row) });

/** Event data for a row that was removed. */
export const removedDetail = (row: ItemRow, extra: Fields = {}) => ({ itemId: Number(row.id), section: row.section, title: row.title, before: itemFields(row), ...extra });

/** Event data for a row that changed. */
export const changedDetail = (now: ItemRow, d: { before: Fields; after: Fields }) => ({ itemId: Number(now.id), section: now.section, title: now.title, ...d });
