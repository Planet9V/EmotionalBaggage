// The example concept's documents as real files in its Files area. They live in the repository under
// seed/concepts/baggage-claims/files, with manifest.json saying where each came from and its sha256. Since
// 21 Nov 2026 they are the owner's originals, byte for byte; before that sixteen were copies made from the Drive
// preview, and upgradeSeedFiles (below) brings an install seeded with those copies up to the originals. They are loaded once per database, after the story (which names them), on a fresh install and on an
// install seeded before they existed: a pool client, never tx(), guarded by the event "seed.files" and an advisory
// lock. A listed file that already has a stored file (someone uploaded it) is left alone.
// Files the owner adds later carry `addedOn` in the manifest: a fresh install loads them with the rest, and
// addSeedFiles (below) adds each such batch once to an install that was seeded before it existed.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";
import { sha256 } from "@/lib/hash";
import { SEED_PROJECT } from "@/lib/seed";
import { chunkText, MAX_CHUNKS } from "@/lib/sources/chunk";
import { extractText, type Extracted } from "@/lib/sources/extract";
import { SOURCES_STORE, type SourceData } from "./parts";

export const SEED_FILES_DIR = join("seed", "concepts", "baggage-claims");

export type ManifestEntry = { file: string; title: string; folder: string; what: string; kind: SourceData["kind"]; driveFileId: string; driveSize: string; size: number; sha256: string; copy: string; readOn: string; /** the sha256 of the preview copy this original replaced, when it replaced one */ replacedCopySha256?: string; /** where the file came from, when it is not the Drive folder */ origin?: string; /** the day (YYYY-MM-DD) a file was added after the first 21: installs seeded earlier get the batch once */ addedOn?: string };

export async function readManifest(root = process.cwd()): Promise<ManifestEntry[] | null> {
  try {
    const m = JSON.parse(await readFile(join(root, SEED_FILES_DIR, "manifest.json"), "utf8")) as { files: ManifestEntry[] };
    return m.files;
  } catch {
    return null;
  }
}

const MIME: Record<string, string> = { md: "text/markdown", txt: "text/plain", csv: "text/csv", sql: "application/sql", yml: "application/yaml", json: "application/json", png: "image/png", jpg: "image/jpeg", pdf: "application/pdf" };

/**
 * Seeded files that hold no text to read: kept as files to download, never opened or run. The Files page's own
 * upload does not take these kinds; the example's set-up stores them because they are the owner's working files.
 */
const BINARY: Record<string, { mime: string; note: string }> = {
  npy: { mime: "application/octet-stream", note: "A NumPy array (binary). It is kept as a file to download; there is no text in it to search." },
  stl: { mime: "model/stl", note: "A 3D model (binary STL). It is kept as a file to download; there is no text in it to search." },
  "3mf": { mime: "model/3mf", note: "A 3D model and print layout (3MF, a zip). It is kept as a file to download; there is no text in it to search." },
};

type Loaded = { e: ManifestEntry; bytes: Buffer; mime: string; x: Extracted };

/** Reads and checks every listed file before anything is written. */
async function load(entries: ManifestEntry[], root: string): Promise<Loaded[]> {
  const loaded: Loaded[] = [];
  for (const e of entries) {
    const bytes = await readFile(join(root, SEED_FILES_DIR, "files", e.file));
    if (sha256(bytes) !== e.sha256) throw new Error(`[seed] ${e.file} does not match the sha256 in its manifest`);
    const ext = e.file.toLowerCase().split(".").pop() ?? "";
    const binary = BINARY[ext];
    const mime = binary?.mime ?? MIME[ext] ?? "text/plain";
    const x: Extracted = binary ? { text: "", method: "binary", mime: binary.mime, kind: "document", note: binary.note } : await extractText(e.file, mime, new Uint8Array(bytes));
    loaded.push({ e, bytes, mime, x });
  }
  return loaded;
}

const originOf = (e: ManifestEntry) => e.origin ?? `From the owner's Google Drive folder "Emotional baggage" (${e.readOn}): ${e.copy}.`;
const metaOf = (e: ManifestEntry) => JSON.stringify({ seed: true, ...(e.driveFileId ? { driveFileId: e.driveFileId } : {}), ...(e.addedOn ? { addedOn: e.addedOn } : {}) });
const statusOf = (x: Extracted) => (x.text || x.method === "image" || x.method === "binary" ? "stored" : "unreadable");

/**
 * Stores one listed file and its row in Files, inside the caller's transaction. A row of that title that already
 * has a file is left alone (false); a row without one gets the file; no row: one is made at `sort`.
 */
async function storeEntry(c: PoolClient, id: string, { e, bytes, mime, x }: Loaded, sort: number): Promise<boolean> {
  const row = (await c.query<{ id: string; data: Record<string, unknown> }>("SELECT id, data FROM items WHERE project_id=$1 AND section=$2 AND title=$3 ORDER BY id LIMIT 1 FOR UPDATE", [id, SOURCES_STORE, e.title])).rows[0];
  if (row && typeof row.data.fileId === "number") return false;
  const f = await c.query<{ id: string }>(
    "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,'source',$4,$5,$6,$7) RETURNING id",
    [id, e.file, x.mime || mime, bytes.length, e.sha256, bytes, metaOf(e)]
  );
  const chunks = chunkText(x.text).slice(0, MAX_CHUNKS);
  const data: SourceData = {
    kind: e.kind,
    origin: originOf(e),
    fileId: Number(f.rows[0].id),
    fileName: e.file,
    mime: x.mime || mime,
    size: bytes.length,
    addedBy: "the example's set-up",
    addedAt: `${e.readOn}T12:00:00.000Z`,
    chars: x.text.length,
    chunks: chunks.length,
    extract: { method: x.method, ...(x.note ? { note: x.note } : {}) },
    folder: e.folder,
  };
  const itemId = row
    ? Number((await c.query<{ id: string }>("UPDATE items SET data = data || $2::jsonb, status=$3, updated_at=now() WHERE id=$1 RETURNING id", [row.id, JSON.stringify(data), statusOf(x)])).rows[0].id)
    : Number((await c.query<{ id: string }>("INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [id, SOURCES_STORE, e.title, e.what, JSON.stringify(data), statusOf(x), sort])).rows[0].id);
  await c.query("DELETE FROM source_chunks WHERE item_id=$1", [itemId]);
  for (let n = 0; n < chunks.length; n++) await c.query("INSERT INTO source_chunks (project_id, item_id, n, text) VALUES ($1,$2,$3,$4)", [id, itemId, n + 1, chunks[n]]);
  return true;
}

export async function seedFiles(db: Pool, root = process.cwd()) {
  const id = SEED_PROJECT.id;
  if (!(await db.query("SELECT 1 FROM projects WHERE id=$1", [id])).rowCount) return;
  if ((await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.files'", [id])).rowCount) return;
  const entries = await readManifest(root);
  if (!entries) {
    console.warn(`[seed] ${SEED_FILES_DIR}/manifest.json is missing, so the example concept's files were not loaded`);
    return;
  }
  const loaded = await load(entries, root);
  const { logEventIn } = await import("@/lib/db");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`seed.files:${id}`]);
    if ((await c.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.files'", [id])).rowCount) {
      await c.query("ROLLBACK");
      return;
    }
    let stored = 0;
    const later = entries.filter((e) => e.addedOn).length;
    for (const [i, l] of loaded.entries()) if (await storeEntry(c, id, l, -500 + i)) stored++;
    await logEventIn(c, id, "seed.files", `Stored ${stored} of the owner's ${loaded.length} documents in Files: ${loaded.length - later} copied from his Drive folder${later ? ` and ${later} he supplied afterwards` : ""}`, { stored, files: loaded.length, seeded: true });
    // the later batches came in with the rest: an install seeded today has nothing to add
    for (const batch of batchesOf(entries)) await logEventIn(c, id, ADDED_EVENT, `The owner's files added on ${batch} came with the example's first set-up`, { batch, added: 0, seeded: true });
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

const ADDED_EVENT = "seed.files.added";
const batchesOf = (entries: ManifestEntry[]) => [...new Set(entries.map((e) => e.addedOn).filter((d): d is string => !!d))].sort();

/**
 * Adds the files the owner supplied after the first set-up (manifest entries with `addedOn`) to an install that was
 * seeded before them. Each batch (one day's additions) is added once per database, marked by an event that names
 * the batch, so a file someone later removes does not come back. A file whose title is already in Files with a
 * stored file is left alone, so nothing is stored twice. Runs after seedFiles, which marks every batch it loaded.
 */
export async function addSeedFiles(db: Pool, root = process.cwd()) {
  const id = SEED_PROJECT.id;
  if (!(await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.files'", [id])).rowCount) return;
  const entries = await readManifest(root);
  if (!entries) return;
  const done = async (q: Pool | PoolClient) => new Set((await q.query<{ batch: string }>("SELECT data->>'batch' AS batch FROM events WHERE project_id=$1 AND kind=$2", [id, ADDED_EVENT])).rows.map((r) => r.batch));
  const have = await done(db);
  const pending = batchesOf(entries).filter((b) => !have.has(b));
  if (!pending.length) return;
  const loaded = await load(entries.filter((e) => e.addedOn && pending.includes(e.addedOn)), root);
  const { logEventIn } = await import("@/lib/db");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`seed.files:${id}`]);
    const now = await done(c);
    for (const batch of pending) {
      if (now.has(batch)) continue;
      const mine = loaded.filter((l) => l.e.addedOn === batch);
      let added = 0;
      for (const l of mine) if (await storeEntry(c, id, l, -500 + entries.indexOf(l.e))) added++;
      await logEventIn(c, id, ADDED_EVENT, `Added ${added} of the ${mine.length} files the owner supplied on ${batch} to Files`, { batch, added, files: mine.length, seeded: true });
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

const UPGRADE_EVENT = "seed.files.originals";

/**
 * Brings an install that was seeded with the preview copies up to the originals. For each listed file whose
 * stored file is still the seeded copy (same sha256 as the copy, marked as seeded), the original becomes the
 * file, its text is read again, and the copy stays in the file store under the row's earlier versions. A file
 * someone has replaced or removed is left alone. Runs once per database, after seedFiles.
 */
export async function upgradeSeedFiles(db: Pool, root = process.cwd()) {
  const id = SEED_PROJECT.id;
  if (!(await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.files'", [id])).rowCount) return;
  if ((await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind=$2", [id, UPGRADE_EVENT])).rowCount) return;
  const entries = (await readManifest(root))?.filter((e) => e.replacedCopySha256);
  if (!entries?.length) return;
  const loaded = await load(entries, root);
  const { logEventIn } = await import("@/lib/db");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`seed.files:${id}`]);
    if ((await c.query("SELECT 1 FROM events WHERE project_id=$1 AND kind=$2", [id, UPGRADE_EVENT])).rowCount) {
      await c.query("ROLLBACK");
      return;
    }
    let replaced = 0;
    for (const { e, bytes, mime, x } of loaded) {
      const row = (
        await c.query<{ id: string; data: Record<string, unknown>; file_id: string; name: string; size: number }>(
          `SELECT i.id, i.data, f.id AS file_id, f.name, f.size FROM items i JOIN files f ON f.id = (i.data->>'fileId')::bigint
           WHERE i.project_id=$1 AND i.section=$2 AND i.title=$3 AND f.sha256=$4 AND f.meta->>'seed'='true' ORDER BY i.id LIMIT 1 FOR UPDATE OF i`,
          [id, SOURCES_STORE, e.title, e.replacedCopySha256]
        )
      ).rows[0];
      if (!row) continue;
      const f = await c.query<{ id: string }>(
        "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,'source',$4,$5,$6,$7) RETURNING id",
        [id, e.file, x.mime || mime, bytes.length, e.sha256, bytes, metaOf(e)]
      );
      const chunks = chunkText(x.text).slice(0, MAX_CHUNKS);
      const versions = Array.isArray(row.data.versions) ? [...(row.data.versions as unknown[])] : [];
      versions.unshift({ fileId: Number(row.file_id), fileName: row.name, size: Number(row.size), sha256: e.replacedCopySha256, replacedAt: new Date().toISOString(), replacedBy: "the example's set-up" });
      const data: Record<string, unknown> = {
        origin: originOf(e),
        fileId: Number(f.rows[0].id),
        fileName: e.file,
        mime: x.mime || mime,
        size: bytes.length,
        chars: x.text.length,
        chunks: chunks.length,
        extract: { method: x.method, ...(x.note ? { note: x.note } : {}) },
        versions: versions.slice(0, 100),
      };
      await c.query("UPDATE items SET data = data || $2::jsonb, status=$3, updated_at=now() WHERE id=$1", [row.id, JSON.stringify(data), statusOf(x)]);
      await c.query("DELETE FROM source_chunks WHERE item_id=$1", [row.id]);
      for (let n = 0; n < chunks.length; n++) await c.query("INSERT INTO source_chunks (project_id, item_id, n, text) VALUES ($1,$2,$3,$4)", [id, row.id, n + 1, chunks[n]]);
      replaced++;
    }
    await logEventIn(c, id, UPGRADE_EVENT, `Replaced ${replaced} preview copies in Files with the owner's original documents; each copy is kept as an earlier version`, { replaced, listed: loaded.length, seeded: true });
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}
