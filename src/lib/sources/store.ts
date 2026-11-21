// A concept's sources, on the server: add one (a file or pasted text), read it again, remove it, list them with
// what cites them, and find the passages most relevant to a question (for drafting). Every change is one
// transaction and is recorded in the concept's history and the audit log, like any other row.
import type { PoolClient } from "pg";
import { currentActor } from "@/lib/actor";
import { HttpError, notFound } from "@/lib/api/route";
import { indexSource, meaningReady, questionWords, searchSourcesByMeaning, type IndexCounts, type Unavailable } from "@/lib/ai/embeddings";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { sha256 } from "@/lib/hash";
import { addedDetail, changedDetail, itemDiff, removedDetail } from "@/lib/trace/changes";
import type { Item } from "@/lib/types";
import { citedSourceIds, SOURCES_STORE, STORY_STORE, type SourceData } from "@/lib/story/parts";
import { chunkText, MAX_CHUNKS, normaliseText } from "./chunk";
import { extractText, type Extracted } from "./extract";

/** The longest pasted text (characters). A file is limited by the file store's 25 MB. */
export const MAX_PASTED = 1_000_000;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type NewSource = {
  title: string;
  /** what it is, in words (the row's body) */
  what?: string;
  kind?: SourceData["kind"];
  origin?: string;
  url?: string;
  file?: { name: string; mime: string; bytes: Uint8Array };
  text?: string;
  /** the folder to file it in; "" or absent for the top level */
  folder?: string;
};

/** What indexing for search by meaning did after a change: counts, or why it did not run. */
export type IndexOutcome = { ok: true; indexed: number; skipped: number; failed: number; error?: string } | { ok: false; reason: string };

async function embedSource(itemId: number): Promise<IndexOutcome> {
  try {
    const r: IndexCounts | Unavailable = await indexSource(itemId);
    if (!r.ok) return { ok: false, reason: r.reason };
    return { ok: true, indexed: r.indexed, skipped: r.skipped, failed: r.failed, ...(r.error ? { error: r.error } : {}) };
  } catch (e) {
    return { ok: false, reason: `Search by meaning was not updated: ${(e as Error).message}` };
  }
}

async function writeChunks(c: PoolClient, projectId: string, itemId: number, text: string) {
  const all = chunkText(text);
  const kept = all.slice(0, MAX_CHUNKS);
  for (let i = 0; i < kept.length; i++) {
    await c.query("INSERT INTO source_chunks (project_id, item_id, n, text) VALUES ($1,$2,$3,$4)", [projectId, itemId, i + 1, kept[i]]);
  }
  return { chunks: kept.length, cut: all.length - kept.length };
}

const statusFor = (x: Extracted) => (x.text ? "stored" : x.method === "image" ? "stored" : "unreadable");

/** Adds a source: stores its file (pasted text is stored as a .txt file), its row and its passages, then indexes it for search by meaning when that is set up. */
export async function addSource(projectId: string, input: NewSource): Promise<{ item: Item; chunks: number; index: IndexOutcome }> {
  const title = input.title.trim();
  let file: { name: string; mime: string; bytes: Uint8Array };
  let x: Extracted;
  if (input.file) {
    if (input.file.bytes.length > MAX_FILE_BYTES) throw new HttpError(413, "Files are limited to 25 MB.");
    x = await extractText(input.file.name, input.file.mime, input.file.bytes);
    file = { name: input.file.name, mime: x.mime, bytes: input.file.bytes };
  } else {
    const text = normaliseText(input.text ?? "");
    if (!text) throw new HttpError(400, "Upload a file or paste some text.");
    if (text.length > MAX_PASTED) throw new HttpError(413, `Pasted text is limited to ${MAX_PASTED.toLocaleString("en")} characters.`);
    const base = title.replace(/[^\w.\- ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "source";
    file = { name: `${base}.txt`, mime: "text/plain", bytes: new TextEncoder().encode(text) };
    x = { text, method: "pasted", mime: "text/plain", kind: "note" };
  }
  const out = await tx(async (c) => {
    const bytes = Buffer.from(file.bytes);
    const f = await c.query<{ id: string }>(
      "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,'source',$4,$5,$6,$7) RETURNING id",
      [projectId, file.name, file.mime, bytes.length, sha256(bytes), bytes, JSON.stringify({ source: true })]
    );
    const fileId = Number(f.rows[0].id);
    // A source listed with no file yet (the example names its documents this way) is filled in, not repeated:
    // matched by title or by file name (a text copy "Plan.pdf.txt" fills "Plan.pdf"), so the story parts that cite it keep citing it.
    const placeholder = (
      await c.query<ItemRow>(
        `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND status='not uploaded' AND NOT (data ? 'fileId' AND jsonb_typeof(data->'fileId') = 'number')
           AND (lower(title) = lower($3) OR lower(data->>'fileName') = lower($4) OR lower(title) = lower(regexp_replace($4, '\\.txt$', ''))) ORDER BY sort, id LIMIT 1 FOR UPDATE`,
        [projectId, SOURCES_STORE, title, file.name]
      )
    ).rows[0];
    const data: SourceData = {
      kind: input.kind ?? (placeholder?.data.kind as SourceData["kind"] | undefined) ?? x.kind,
      origin: input.origin?.trim() || (input.file ? "Uploaded file" : "Pasted text"),
      ...(input.url?.trim() ? { url: input.url.trim() } : {}),
      fileId,
      fileName: file.name,
      mime: file.mime,
      size: bytes.length,
      sha256: sha256(bytes),
      addedBy: currentActor(),
      addedAt: new Date().toISOString(),
      chars: x.text.length,
      chunks: 0,
      extract: { method: x.method, ...(x.note ? { note: x.note } : {}) },
      ...(input.folder?.trim() ? { folder: input.folder.trim() } : placeholder?.data.folder ? { folder: String(placeholder.data.folder) } : {}),
    };
    const row = placeholder
      ? (
          await c.query<ItemRow>(`UPDATE items SET body = CASE WHEN $2 = '' THEN body ELSE $2 END, data = data || $3::jsonb, status=$4, updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [
            placeholder.id,
            (input.what ?? "").trim(),
            JSON.stringify({ ...data, origin: input.origin?.trim() || data.origin }),
            statusFor(x),
          ])
        ).rows[0]
      : (
          await c.query<ItemRow>(
            `INSERT INTO items (project_id, section, title, body, data, status, sort)
             VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1)) RETURNING ${ITEM_COLS}`,
            [projectId, SOURCES_STORE, title, (input.what ?? "").trim(), JSON.stringify(data), statusFor(x)]
          )
        ).rows[0];
    const { chunks, cut } = await writeChunks(c, projectId, Number(row.id), x.text);
    const note = cut ? `${x.note ? `${x.note} ` : ""}Only the first ${MAX_CHUNKS} passages were kept.` : x.note;
    const done = (
      await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb WHERE id=$1 RETURNING ${ITEM_COLS}`, [
        row.id,
        JSON.stringify({ chunks, extract: { method: x.method, ...(note ? { note } : {}) } }),
      ])
    ).rows[0];
    const passages = `${chunks} ${chunks === 1 ? "passage" : "passages"}`;
    if (placeholder) {
      await logEventIn(c, projectId, "item.edited", `Stored the file for the source "${done.title}" (${file.name}, ${passages})`, { ...changedDetail(done, itemDiff(placeholder, done)), fileId, chunks });
    } else {
      await logEventIn(c, projectId, "item.added", `Added the source "${title}" (${file.name}, ${passages})`, { ...addedDetail(done), fileId, chunks });
    }
    return { item: toItem(done), chunks };
  });
  return { ...out, index: await embedSource(out.item.id) };
}

async function lockSource(c: PoolClient, projectId: string, itemId: number): Promise<ItemRow> {
  const r = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3 FOR UPDATE`, [itemId, projectId, SOURCES_STORE]);
  if (!r.rows.length) throw notFound("That source");
  return r.rows[0];
}

/** Reads a source's stored file again: new passages, new counts, and the index updated. */
export async function reindexSource(projectId: string, itemId: number): Promise<{ item: Item; chunks: number; index: IndexOutcome }> {
  const out = await tx(async (c) => {
    const was = await lockSource(c, projectId, itemId);
    const fileId = typeof was.data.fileId === "number" ? was.data.fileId : null;
    const f = fileId ? (await c.query<{ name: string; mime: string; bytes: Buffer }>("SELECT name, mime, bytes FROM files WHERE id=$1 AND project_id=$2", [fileId, projectId])).rows[0] : undefined;
    if (!f) throw new HttpError(400, `"${was.title}" has no stored file to read. Upload the file, or paste its text, as a new source.`);
    const x: Extracted = was.data.extract && (was.data.extract as { method?: string }).method === "pasted"
      ? { text: normaliseText(f.bytes.toString("utf8")), method: "pasted", mime: "text/plain", kind: "note" }
      : await extractText(f.name, f.mime, new Uint8Array(f.bytes));
    await c.query("DELETE FROM source_chunks WHERE item_id=$1", [itemId]);
    const { chunks, cut } = await writeChunks(c, projectId, itemId, x.text);
    const note = cut ? `${x.note ? `${x.note} ` : ""}Only the first ${MAX_CHUNKS} passages were kept.` : x.note;
    const now = (
      await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb, status=$3, updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [
        itemId,
        JSON.stringify({ chars: x.text.length, chunks, extract: { method: x.method, ...(note ? { note } : {}) } }),
        statusFor(x),
      ])
    ).rows[0];
    await logEventIn(c, projectId, "item.edited", `Read the source "${was.title}" again (${chunks} ${chunks === 1 ? "passage" : "passages"})`, { ...changedDetail(now, itemDiff(was, now)), reindexed: true });
    return { item: toItem(now), chunks };
  });
  return { ...out, index: await embedSource(itemId) };
}

/**
 * Replaces a file with a new version: the new bytes become the file, its text is read again, and the old file
 * stays in the file store, listed under the row's versions with when and by whom it was replaced.
 */
export async function replaceVersion(projectId: string, itemId: number, file: { name: string; mime: string; bytes: Uint8Array }): Promise<{ item: Item; chunks: number; index: IndexOutcome }> {
  if (file.bytes.length > MAX_FILE_BYTES) throw new HttpError(413, "Files are limited to 25 MB.");
  const x = await extractText(file.name, file.mime, file.bytes);
  const out = await tx(async (c) => {
    const was = await lockSource(c, projectId, itemId);
    const bytes = Buffer.from(file.bytes);
    const sha = sha256(bytes);
    const f = await c.query<{ id: string }>(
      "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,'source',$4,$5,$6,$7) RETURNING id",
      [projectId, file.name, x.mime, bytes.length, sha, bytes, JSON.stringify({ source: true })]
    );
    const fileId = Number(f.rows[0].id);
    const versions = Array.isArray(was.data.versions) ? [...(was.data.versions as unknown[])] : [];
    if (typeof was.data.fileId === "number") {
      versions.unshift({
        fileId: was.data.fileId,
        fileName: String(was.data.fileName ?? ""),
        size: Number(was.data.size ?? 0),
        ...(typeof was.data.sha256 === "string" ? { sha256: was.data.sha256 } : {}),
        replacedAt: new Date().toISOString(),
        replacedBy: currentActor(),
      });
    }
    await c.query("DELETE FROM source_chunks WHERE item_id=$1", [itemId]);
    const { chunks, cut } = await writeChunks(c, projectId, itemId, x.text);
    const note = cut ? `${x.note ? `${x.note} ` : ""}Only the first ${MAX_CHUNKS} passages were kept.` : x.note;
    const now = (
      await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb, status=$3, updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [
        itemId,
        JSON.stringify({ fileId, fileName: file.name, mime: x.mime, size: bytes.length, sha256: sha, chars: x.text.length, chunks, extract: { method: x.method, ...(note ? { note } : {}) }, versions: versions.slice(0, 100) }),
        statusFor(x),
      ])
    ).rows[0];
    await logEventIn(c, projectId, "item.edited", `Replaced "${was.title}" with a new version (${file.name}); the earlier one is kept`, { ...changedDetail(now, itemDiff(was, now)), fileId });
    return { item: toItem(now), chunks };
  });
  return { ...out, index: await embedSource(itemId) };
}

/** Removes a source: its row, its passages and vectors, and its file when no other row points at it. Story rows stop citing it, each change recorded. */
export async function removeSource(projectId: string, itemId: number, why = ""): Promise<{ uncited: number; fileRemoved: boolean }> {
  return tx(async (c) => {
    const was = await lockSource(c, projectId, itemId);
    let uncited = 0;
    const citing = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND id <> $2 AND data::text LIKE '%sourceIds%' FOR UPDATE`, [projectId, itemId]);
    for (const r of citing.rows) {
      if (!citedSourceIds(r.data).includes(itemId)) continue;
      const strip = (v: unknown) => (Array.isArray(v) ? v.filter((n) => n !== itemId) : v);
      const data: Record<string, unknown> = { ...r.data };
      if ("sourceIds" in data) data.sourceIds = strip(data.sourceIds);
      if (Array.isArray(data.claims)) data.claims = data.claims.map((cl) => (cl && typeof cl === "object" && "sourceIds" in cl ? { ...cl, sourceIds: strip((cl as { sourceIds: unknown }).sourceIds) } : cl));
      const now = (await c.query<ItemRow>(`UPDATE items SET data=$2, updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [r.id, JSON.stringify(data)])).rows[0];
      await logEventIn(c, projectId, "item.edited", `"${r.title}" no longer cites the source "${was.title}", which was removed`, { ...changedDetail(now, itemDiff(r, now)), reason: `the source "${was.title}" was removed` });
      uncited++;
    }
    await c.query("DELETE FROM items WHERE id=$1", [itemId]);
    let fileRemoved = false;
    const fileId = typeof was.data.fileId === "number" ? was.data.fileId : null;
    // its current file and every earlier version, unless another row points at one of them
    const ids = [fileId, ...(Array.isArray(was.data.versions) ? (was.data.versions as { fileId?: unknown }[]).map((v) => v.fileId) : [])].filter((n): n is number => typeof n === "number");
    for (const id of ids) {
      const other = await c.query("SELECT 1 FROM items WHERE project_id=$1 AND data->>'fileId' = $2 LIMIT 1", [projectId, String(id)]);
      if (other.rowCount) continue;
      const gone = ((await c.query("DELETE FROM files WHERE id=$1 AND project_id=$2", [id, projectId])).rowCount ?? 0) > 0;
      if (id === fileId) fileRemoved = gone;
    }
    await logEventIn(c, projectId, "item.removed", `Removed the source "${was.title}"${fileRemoved ? " and its file" : ""}`, {
      ...removedDetail(was, { fileRemoved, uncited }),
      ...(why ? { reason: why } : {}),
    });
    return { uncited, fileRemoved };
  });
}

type Citation = { itemId: number; title: string; section: string; how: "cites" | "drafted from" };
export type SourceListEntry = { item: Item; citedBy: Citation[] };

/**
 * Every file of a concept, in order, with the story parts and rows that cite it or were drafted from it. With a
 * search, only files whose title, description or file name contains it, or whose text matches its words.
 */
export async function listSources(projectId: string, search = ""): Promise<SourceListEntry[]> {
  const term = search.trim().slice(0, 200);
  const words = questionWords(term);
  const sources = (
    term
      ? await q<ItemRow>(
          `SELECT ${ITEM_COLS} FROM items i WHERE project_id=$1 AND section=$2 AND (title ILIKE $3 OR body ILIKE $3 OR data->>'fileName' ILIKE $3
             OR EXISTS (SELECT 1 FROM source_chunks c WHERE c.item_id = i.id AND (c.text ILIKE $3 OR ($4 <> '' AND c.search @@ to_tsquery('english', $4)))))
           ORDER BY sort, id`,
          [projectId, SOURCES_STORE, `%${term.replace(/[\\%_]/g, "\\$&")}%`, words.join(" | ")]
        )
      : await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 ORDER BY sort, id`, [projectId, SOURCES_STORE])
  ).map(toItem);
  if (!sources.length) return [];
  const ids = new Set(sources.map((s) => s.id));
  const cited = new Map<number, Citation[]>();
  const add = (sourceId: number, cit: Citation) => {
    const list = cited.get(sourceId) ?? [];
    if (!list.some((x) => x.itemId === cit.itemId)) list.push(cit);
    cited.set(sourceId, list);
  };
  const citing = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section <> $2 AND data::text LIKE '%sourceIds%' ORDER BY section = $3 DESC, sort, id`, [projectId, SOURCES_STORE, STORY_STORE]);
  for (const r of citing) for (const sid of citedSourceIds(r.data)) if (ids.has(sid)) add(sid, { itemId: Number(r.id), title: r.title, section: r.section, how: "cites" });
  const drafted = await q<{ item_id: string; sources: { kind?: string; id?: number }[]; title: string; section: string }>(
    `SELECT d.item_id, d.sources, i.title, i.section FROM drafts d JOIN items i ON i.id = d.item_id
      WHERE d.project_id=$1 AND d.status='approved' ORDER BY d.decided_at, d.id`,
    [projectId]
  );
  for (const d of drafted) for (const s of d.sources ?? []) if (s.kind === "item" && typeof s.id === "number" && ids.has(s.id)) add(s.id, { itemId: Number(d.item_id), title: d.title, section: d.section, how: "drafted from" });
  return sources.map((item) => ({ item, citedBy: cited.get(item.id) ?? [] }));
}

/** One source with its whole text (its passages joined in order). */
export async function sourceDetail(projectId: string, itemId: number): Promise<{ item: Item; text: string; passages: number }> {
  const r = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3`, [itemId, projectId, SOURCES_STORE]);
  if (!r.length) throw notFound("That source");
  const parts = await q<{ text: string }>("SELECT text FROM source_chunks WHERE item_id=$1 ORDER BY n", [itemId]);
  return { item: toItem(r[0]), text: parts.map((p) => p.text).join("\n\n"), passages: parts.length };
}

/** A passage handed to a drafting generator, with the source it comes from. */
export type Passage = { sourceId: number; title: string; n: number; text: string };

/** How many passages, and how many characters in all, a drafting run is given at most. Never the whole library. */
const DRAFT_PASSAGES = 8;
const DRAFT_PASSAGE_CHARS = 12_000;

/**
 * The passages of a concept's sources most relevant to a request, best first, bounded by count and by total
 * length. By meaning and by words when search by meaning is ready; by words otherwise. Nothing when the concept
 * has no stored source text.
 */
export async function relevantPassages(projectId: string, query: string, o: { limit?: number; maxChars?: number; signal?: AbortSignal } = {}): Promise<Passage[]> {
  const limit = o.limit ?? DRAFT_PASSAGES;
  const maxChars = o.maxChars ?? DRAFT_PASSAGE_CHARS;
  const any = await q("SELECT 1 FROM source_chunks WHERE project_id=$1 LIMIT 1", [projectId]);
  if (!any.length) return [];
  const found = new Map<number, Passage & { score: number }>();
  const ready = await meaningReady(projectId);
  if (ready.ok) {
    try {
      const r = await searchSourcesByMeaning(projectId, query, limit * 3, { use: ready.emb, signal: o.signal });
      r.hits.forEach((h, place) => {
        if (h.kind === "source") found.set(h.chunk.id, { sourceId: h.item.id, title: h.item.title, n: h.chunk.n, text: h.chunk.text, score: 1 / (60 + place + 1) });
      });
    } catch {
      // the words below still find passages
    }
  }
  const words = questionWords(query);
  if (words.length) {
    const rows = await q<{ id: string; item_id: string; n: number; text: string; title: string }>(
      `SELECT c.id, c.item_id, c.n, c.text, i.title FROM source_chunks c JOIN items i ON i.id = c.item_id, to_tsquery('english', $2) AS t(query)
        WHERE c.project_id=$1 AND c.search @@ t.query ORDER BY ts_rank_cd(c.search, t.query) DESC, c.item_id, c.n LIMIT $3`,
      [projectId, words.join(" | "), limit * 3]
    );
    rows.forEach((r, place) => {
      const id = Number(r.id);
      const was = found.get(id);
      const score = 1 / (60 + place + 1);
      if (was) was.score += score;
      else found.set(id, { sourceId: Number(r.item_id), title: r.title, n: Number(r.n), text: r.text, score });
    });
  }
  const out: Passage[] = [];
  let used = 0;
  for (const p of [...found.values()].sort((a, b) => b.score - a.score)) {
    if (out.length >= limit) break;
    const room = maxChars - used;
    if (room < 200) break;
    const text = p.text.length > room ? `${p.text.slice(0, room - 1)}…` : p.text;
    out.push({ sourceId: p.sourceId, title: p.title, n: p.n, text });
    used += text.length;
  }
  return out;
}
