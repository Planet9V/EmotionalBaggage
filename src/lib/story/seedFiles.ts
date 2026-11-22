// The example concept's documents as real files in its Files area. They live in the repository under
// seed/concepts/baggage-claims/files, with manifest.json saying where each came from and its sha256. Since
// 21 Nov 2026 they are the owner's originals, byte for byte; before that sixteen were copies made from the Drive
// preview, and upgradeSeedFiles (below) brings an install seeded with those copies up to the originals. They are loaded once per database, after the story (which names them), on a fresh install and on an
// install seeded before they existed: a pool client, never tx(), guarded by the event "seed.files" and an advisory
// lock. A listed file that already has a stored file (someone uploaded it) is left alone.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { sha256 } from "@/lib/hash";
import { SEED_PROJECT } from "@/lib/seed";
import { chunkText, MAX_CHUNKS } from "@/lib/sources/chunk";
import { extractText } from "@/lib/sources/extract";
import { SOURCES_STORE, type SourceData } from "./parts";

export const SEED_FILES_DIR = join("seed", "concepts", "baggage-claims");

export type ManifestEntry = { file: string; title: string; folder: string; what: string; kind: SourceData["kind"]; driveFileId: string; driveSize: string; size: number; sha256: string; copy: string; readOn: string; /** the sha256 of the preview copy this original replaced, when it replaced one */ replacedCopySha256?: string };

export async function readManifest(root = process.cwd()): Promise<ManifestEntry[] | null> {
  try {
    const m = JSON.parse(await readFile(join(root, SEED_FILES_DIR, "manifest.json"), "utf8")) as { files: ManifestEntry[] };
    return m.files;
  } catch {
    return null;
  }
}

const MIME: Record<string, string> = { md: "text/markdown", txt: "text/plain", csv: "text/csv", sql: "application/sql", yml: "application/yaml", png: "image/png", pdf: "application/pdf" };

export async function seedFiles(db: Pool, root = process.cwd()) {
  const id = SEED_PROJECT.id;
  if (!(await db.query("SELECT 1 FROM projects WHERE id=$1", [id])).rowCount) return;
  if ((await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.files'", [id])).rowCount) return;
  const entries = await readManifest(root);
  if (!entries) {
    console.warn(`[seed] ${SEED_FILES_DIR}/manifest.json is missing, so the example concept's files were not loaded`);
    return;
  }
  // Read and check every file before anything is written.
  const loaded = [];
  for (const e of entries) {
    const bytes = await readFile(join(root, SEED_FILES_DIR, "files", e.file));
    if (sha256(bytes) !== e.sha256) throw new Error(`[seed] ${e.file} does not match the sha256 in its manifest`);
    const ext = e.file.toLowerCase().split(".").pop() ?? "";
    const mime = MIME[ext] ?? "text/plain";
    loaded.push({ e, bytes, mime, x: await extractText(e.file, mime, new Uint8Array(bytes)) });
  }
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
    for (const [i, { e, bytes, mime, x }] of loaded.entries()) {
      const row = (await c.query<{ id: string; data: Record<string, unknown> }>("SELECT id, data FROM items WHERE project_id=$1 AND section=$2 AND title=$3 ORDER BY id LIMIT 1 FOR UPDATE", [id, SOURCES_STORE, e.title])).rows[0];
      if (row && typeof row.data.fileId === "number") continue;
      const f = await c.query<{ id: string }>(
        "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,'source',$4,$5,$6,$7) RETURNING id",
        [id, e.file, x.mime || mime, bytes.length, e.sha256, bytes, JSON.stringify({ seed: true, driveFileId: e.driveFileId })]
      );
      const chunks = chunkText(x.text).slice(0, MAX_CHUNKS);
      const data: SourceData = {
        kind: e.kind,
        origin: `From the owner's Google Drive folder "Emotional baggage" (${e.readOn}): ${e.copy}.`,
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
      const status = x.text || x.method === "image" ? "stored" : "unreadable";
      const itemId = row
        ? Number((await c.query<{ id: string }>("UPDATE items SET data = data || $2::jsonb, status=$3, updated_at=now() WHERE id=$1 RETURNING id", [row.id, JSON.stringify(data), status])).rows[0].id)
        : Number((await c.query<{ id: string }>("INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [id, SOURCES_STORE, e.title, e.what, JSON.stringify(data), status, -500 + i])).rows[0].id);
      await c.query("DELETE FROM source_chunks WHERE item_id=$1", [itemId]);
      for (let n = 0; n < chunks.length; n++) await c.query("INSERT INTO source_chunks (project_id, item_id, n, text) VALUES ($1,$2,$3,$4)", [id, itemId, n + 1, chunks[n]]);
      stored++;
    }
    await logEventIn(c, id, "seed.files", `Stored ${stored} of the owner's ${loaded.length} documents in Files, copied from his Drive folder`, { stored, files: loaded.length, seeded: true });
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
  const loaded = [];
  for (const e of entries) {
    const bytes = await readFile(join(root, SEED_FILES_DIR, "files", e.file));
    if (sha256(bytes) !== e.sha256) throw new Error(`[seed] ${e.file} does not match the sha256 in its manifest`);
    const ext = e.file.toLowerCase().split(".").pop() ?? "";
    const mime = MIME[ext] ?? "text/plain";
    loaded.push({ e, bytes, mime, x: await extractText(e.file, mime, new Uint8Array(bytes)) });
  }
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
        [id, e.file, x.mime || mime, bytes.length, e.sha256, bytes, JSON.stringify({ seed: true, driveFileId: e.driveFileId })]
      );
      const chunks = chunkText(x.text).slice(0, MAX_CHUNKS);
      const versions = Array.isArray(row.data.versions) ? [...(row.data.versions as unknown[])] : [];
      versions.unshift({ fileId: Number(row.file_id), fileName: row.name, size: Number(row.size), sha256: e.replacedCopySha256, replacedAt: new Date().toISOString(), replacedBy: "the example's set-up" });
      const data: Record<string, unknown> = {
        origin: `From the owner's Google Drive folder "Emotional baggage" (${e.readOn}): ${e.copy}.`,
        fileId: Number(f.rows[0].id),
        fileName: e.file,
        mime: x.mime || mime,
        size: bytes.length,
        chars: x.text.length,
        chunks: chunks.length,
        extract: { method: x.method, ...(x.note ? { note: x.note } : {}) },
        versions: versions.slice(0, 100),
      };
      const status = x.text || x.method === "image" ? "stored" : "unreadable";
      await c.query("UPDATE items SET data = data || $2::jsonb, status=$3, updated_at=now() WHERE id=$1", [row.id, JSON.stringify(data), status]);
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
