// What a copy of a concept carries, row by row (plan 2.0 joined with 6.6 and 8.13 to 8.16). Pure:
// the duplicate route reads the rows, these decide what each copied row holds, the route writes them.
//
// - Every reference to another row of the same concept (a campaign's creatives and sales channel, a
//   piece's proof, a message's positioning row, a landing section's price and competitors) is pointed
//   at the copy of that row. A reference to a row the source does not hold is left as it is.
// - A print job is copied as queued: what it prints (its file, material, settings, build) stays; what
//   happened to it (slice result, send, start, result) and which printer it was sent to do not.
// - A tracked link is copied with a new short code and no clicks; results, drafts, history and the
//   audit log are never copied.
import { STORE } from "@/lib/domain/schemas";

/** Keys inside a row's data whose number (or list of numbers) is the id of another row of the concept. */
export const ROW_ID_KEYS = new Set(["itemId", "positioningId", "priceItemId", "proofItemId"]);
const ROW_ID_LIST_KEYS = new Set(["competitorIds"]);

/** Keys whose number (or list) is the id of a stored file of the concept (an image, a logo, a shape file). */
export const FILE_ID_KEYS = new Set(["fileId", "imageFileId"]);
const FILE_ID_LIST_KEYS = new Set(["logoFileIds", "photoFileIds"]);

/** The data with every row id and file id it names replaced by the id of that row's or file's copy. */
export function remapRowIds<T>(value: T, ids: ReadonlyMap<number, number>, files: ReadonlyMap<number, number> = new Map()): T {
  const one = (m: ReadonlyMap<number, number>, n: unknown) => (typeof n === "number" && m.has(n) ? m.get(n) : n);
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (ROW_ID_KEYS.has(k) && typeof x === "number") out[k] = one(ids, x);
      else if (ROW_ID_LIST_KEYS.has(k) && Array.isArray(x)) out[k] = x.map((n) => one(ids, n));
      else if (FILE_ID_KEYS.has(k) && typeof x === "number") out[k] = one(files, x);
      else if (FILE_ID_LIST_KEYS.has(k) && Array.isArray(x)) out[k] = x.map((n) => one(files, n));
      else out[k] = walk(x);
    }
    return out;
  };
  return walk(value) as T;
}

/** Keys of a print job that record what happened to it, or the printer it went to. Not copied. */
export const PRINT_RUN_KEYS = ["slice", "sliceError", "sentAt", "sentName", "startedAt", "result", "printerId", "printerName", "printerMaker", "printerModel", "printerFamily"] as const;

/** A print job as a copy holds it: queued, with its own file pointed at the copy, nothing that happened to it. */
export function copiedPrintJob(status: string, data: Record<string, unknown>, files: ReadonlyMap<number, number>): { status: string; data: Record<string, unknown> } {
  const next: Record<string, unknown> = { ...data };
  for (const k of PRINT_RUN_KEYS) delete next[k];
  if (typeof next.fileId === "number") next.fileId = files.get(next.fileId) ?? null;
  return { status: "queued", data: remapRowIds(next, new Map(), files) };
}

/** Files a print job's run produced (the sliced G-code and project file, result photos): they belong to the run, so they are not copied. */
export function printRunFileIds(rows: { section: string; data: Record<string, unknown> }[]): Set<number> {
  const out = new Set<number>();
  for (const r of rows) {
    if (r.section !== STORE.printing) continue;
    const s = r.data.slice as { gcodeFileId?: unknown; projectFileId?: unknown } | undefined;
    for (const v of [s?.gcodeFileId, s?.projectFileId]) if (typeof v === "number") out.add(v);
    const res = r.data.result as { photoFileIds?: unknown } | undefined;
    if (Array.isArray(res?.photoFileIds)) for (const v of res.photoFileIds) if (typeof v === "number") out.add(v);
  }
  return out;
}

/** A row of a copy: references pointed at the copies, a print job reset to queued, a file pointer moved to the file's copy. */
export function copiedRow(row: { section: string; status: string; data: Record<string, unknown> }, ids: ReadonlyMap<number, number>, files: ReadonlyMap<number, number>) {
  if (row.section === STORE.printing) return copiedPrintJob(row.status, row.data, files);
  return { status: row.status, data: remapRowIds(row.data, ids, files) };
}
