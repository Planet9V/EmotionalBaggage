// Embeddings for search by meaning (plan 4.7, 8.6): build the text of a row, embed it with the
// embedding model chosen in Admin, store it in the `embeddings` table, and find the nearest rows.
//
// The table exists only when PostgreSQL has pgvector (see vectorSupport() in src/lib/db.ts). Its
// vector column has no fixed width because the installer chooses the model, so the approximate
// index is made per width, on first use, as a partial expression index. Form taken from the
// pgvector README (FAQ "Can I store vectors with different dimensions in the same column?"):
//   CREATE INDEX ON embeddings USING hnsw ((embedding::vector(3)) vector_l2_ops) WHERE (model_id = 123);
//   SELECT * FROM embeddings WHERE model_id = 123 ORDER BY embedding::vector(3) <-> '[3,1,2]' LIMIT 5;
// with the cosine operator class (vector_cosine_ops, operator <=>; similarity = 1 - distance).
// The README limits HNSW (and IVFFlat) indexes on `vector` to 2,000 dimensions; a wider model is
// searched exactly, without an index.
import { createHash } from "node:crypto";
import { ITEM_COLS, q, ready, toItem, tx, type ItemRow } from "@/lib/db";
import { embed, getEmbedding, ModelError, type EmbeddingInfo, type NotConfigured, type ReadyEmbedding } from "./models";

/** pgvector README: "vector - up to 2,000 dimensions" for HNSW and IVFFlat. */
export const MAX_INDEXED_DIMS = 2000;
export const DEFAULT_BATCH_SIZE = 32;

export type Unavailable = { ok: false; missing: "pgvector" | "unindexed" | NotConfigured["missing"]; reason: string };

export const NO_PGVECTOR =
  "Search by meaning needs the pgvector extension in PostgreSQL, and this database does not have it. Text search still works.";

// ---------------------------------------------------------------------------------------------
// Pure parts (unit-tested without a database)

/** The text embedded for a row: title, body, then every string value inside `data`, in order. */
export function itemText(row: { title: string; body?: string | null; data?: unknown }): string {
  const parts: string[] = [];
  const add = (s: unknown) => {
    if (typeof s === "string" && s.trim()) parts.push(s.trim());
  };
  add(row.title);
  add(row.body);
  const walk = (v: unknown) => {
    if (typeof v === "string") add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(row.data);
  return parts.join("\n");
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export function batches<T>(list: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("batch size must be a positive whole number");
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** pgvector's text form, '[1,2,3]'. */
export function vectorLiteral(v: number[]) {
  if (!v.length || v.some((x) => !Number.isFinite(x))) throw new RangeError("a vector needs at least one finite number");
  return `[${v.join(",")}]`;
}

function width(dims: number) {
  if (!Number.isInteger(dims) || dims < 1 || dims > 100_000) throw new RangeError(`not a vector width: ${dims}`);
  return dims;
}

export const indexName = (dims: number) => `embeddings_hnsw_${width(dims)}`;

/** The per-width approximate index, or null when the width is over pgvector's indexing limit. */
export function hnswIndexSql(dims: number): string | null {
  const n = width(dims);
  if (n > MAX_INDEXED_DIMS) return null;
  return `CREATE INDEX IF NOT EXISTS ${indexName(n)} ON embeddings USING hnsw ((embedding::vector(${n})) vector_cosine_ops) WHERE dims = ${n}`;
}

const ITEM_COLS_I = ITEM_COLS.split(",").map((c) => `i.${c.trim()}`).join(", ");

/**
 * The nearest rows of one concept for one model. The width is written into the statement (it
 * cannot be a parameter of a cast) and repeated in the WHERE clause, so the planner can match the
 * partial index above. Parameters: $1 project id, $2 model, $3 query vector, $4 limit.
 */
export function nearestSql(dims: number) {
  const n = width(dims);
  const dist = `e.embedding::vector(${n}) <=> $3::vector(${n})`;
  return (
    `SELECT ${ITEM_COLS_I}, 1 - (${dist}) AS score FROM embeddings e JOIN items i ON i.id = e.item_id ` +
    `WHERE e.project_id = $1 AND e.model = $2 AND e.dims = ${n} AND e.item_id IS NOT NULL ` +
    `ORDER BY ${dist} LIMIT $4`
  );
}

export const UPSERT_SQL =
  "INSERT INTO embeddings (project_id, item_id, model, dims, content_sha256, embedding) VALUES ($1, $2, $3, $4, $5, $6::vector) " +
  "ON CONFLICT (item_id, model) WHERE item_id IS NOT NULL DO UPDATE SET project_id = EXCLUDED.project_id, dims = EXCLUDED.dims, " +
  "content_sha256 = EXCLUDED.content_sha256, embedding = EXCLUDED.embedding, created_at = now()";

// ---------------------------------------------------------------------------------------------
// Database parts

/** True when the `embeddings` table exists (PostgreSQL has pgvector). */
export async function vectorAvailable(): Promise<boolean> {
  const { vector } = await ready();
  if (!vector) return false;
  const rows = await q<{ ok: boolean }>("SELECT to_regclass('embeddings') IS NOT NULL AS ok");
  return !!rows[0]?.ok;
}

const g = globalThis as unknown as { __c2rHnsw?: Set<number> };

/**
 * Makes the approximate index for a width the first time it is used. Returns "hnsw" when the
 * index exists, "exact" when the width is over the limit (or the index could not be made).
 */
export async function ensureWidthIndex(dims: number): Promise<"hnsw" | "exact"> {
  const sql = hnswIndexSql(dims);
  if (!sql) return "exact";
  g.__c2rHnsw ??= new Set();
  if (g.__c2rHnsw.has(dims)) return "hnsw";
  try {
    await q(sql);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Two processes creating the same index at once: the loser sees a duplicate; the index is there.
    if (code !== "42P07" && code !== "23505") {
      console.error(`[embeddings] could not create ${indexName(dims)}; searching exactly`, e);
      return "exact";
    }
  }
  g.__c2rHnsw.add(dims);
  return "hnsw";
}

type Ready = { ok: true; emb: ReadyEmbedding };

async function prerequisites(): Promise<Ready | Unavailable> {
  if (!(await vectorAvailable())) return { ok: false, missing: "pgvector", reason: NO_PGVECTOR };
  const emb = await getEmbedding();
  if (!emb.ok) return emb;
  return { ok: true, emb };
}

export type IndexCounts = {
  ok: true;
  indexed: number;
  /** text unchanged since it was last embedded with this model, or nothing to embed */
  skipped: number;
  failed: number;
  model: string;
  dims: number;
  search: "hnsw" | "exact";
  /** the first failure, in plain words */
  error?: string;
};

export type IndexOptions = { batchSize?: number; signal?: AbortSignal; timeoutMs?: number; maxRetries?: number };

async function indexRows(rows: ItemRow[], emb: ReadyEmbedding, o: IndexOptions): Promise<IndexCounts> {
  const info: EmbeddingInfo = emb.info;
  const search = await ensureWidthIndex(info.dims);
  const out: IndexCounts = { ok: true, indexed: 0, skipped: 0, failed: 0, model: info.model, dims: info.dims, search };
  if (!rows.length) return out;

  const known = new Map(
    (
      await q<{ item_id: string; content_sha256: string; dims: number }>(
        "SELECT item_id, content_sha256, dims FROM embeddings WHERE model = $1 AND item_id = ANY($2::bigint[])",
        [info.model, rows.map((r) => r.id)]
      )
    ).map((r) => [String(r.item_id), r])
  );

  const todo: { row: ItemRow; text: string; hash: string }[] = [];
  for (const row of rows) {
    const text = itemText(row);
    const hash = sha256(text);
    const prev = known.get(String(row.id));
    if (!text || (prev && prev.content_sha256 === hash && prev.dims === info.dims)) out.skipped++;
    else todo.push({ row, text, hash });
  }

  const groups = batches(todo, o.batchSize ?? DEFAULT_BATCH_SIZE);
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    let vectors: number[][];
    try {
      vectors = (await embed(group.map((t) => t.text), { use: emb, signal: o.signal, timeoutMs: o.timeoutMs, maxRetries: o.maxRetries })).vectors;
    } catch (e) {
      // A failed batch is almost always the model host (down, wrong key, wrong width), which the
      // next batch would hit too: stop, and count this batch and the rest as failed.
      out.failed += groups.slice(gi).reduce((n, g2) => n + g2.length, 0);
      out.error = e instanceof Error ? e.message : String(e);
      break;
    }
    for (let k = 0; k < group.length; k++) {
      const t = group[k];
      try {
        await q(UPSERT_SQL, [t.row.project_id, t.row.id, info.model, info.dims, t.hash, vectorLiteral(vectors[k])]);
        out.indexed++;
      } catch (e) {
        out.failed++;
        out.error ??= e instanceof Error ? e.message : String(e);
      }
    }
  }
  return out;
}

/** Embeds one row (if its text changed for the current model). */
export async function indexItem(itemId: number, o: IndexOptions = {}): Promise<IndexCounts | Unavailable> {
  const p = await prerequisites();
  if (!p.ok) return p;
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id = $1`, [itemId]);
  return indexRows(rows, p.emb, o);
}

/** Embeds every row of a concept whose text changed for the current model. */
export async function indexProject(projectId: string, o: IndexOptions = {}): Promise<IndexCounts | Unavailable> {
  const p = await prerequisites();
  if (!p.ok) return p;
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id = $1 ORDER BY sort, id`, [projectId]);
  return indexRows(rows, p.emb, o);
}

/** Whether a concept has rows embedded with the current model (for search mode "auto"). */
export async function meaningReady(projectId: string): Promise<Ready | Unavailable> {
  const p = await prerequisites();
  if (!p.ok) return p;
  const rows = await q("SELECT 1 FROM embeddings WHERE project_id = $1 AND model = $2 AND dims = $3 LIMIT 1", [
    projectId,
    p.emb.info.model,
    p.emb.info.dims,
  ]);
  if (!rows.length) return { ok: false, missing: "unindexed", reason: "This concept has no rows indexed for the current embedding model. Re-index it first." };
  return p;
}

export type MeaningHit = ReturnType<typeof toItem> & { score: number };

/** The rows of a concept nearest in meaning to the query, with cosine similarity (1 = same direction). */
export async function searchByMeaning(
  projectId: string,
  query: string,
  limit = 20,
  o: { signal?: AbortSignal; timeoutMs?: number; use?: ReadyEmbedding } = {}
): Promise<{ ok: true; items: MeaningHit[]; model: string; dims: number } | Unavailable> {
  let emb = o.use;
  if (!emb) {
    const p = await prerequisites();
    if (!p.ok) return p;
    emb = p.emb;
  }
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  const { vectors } = await embed([query], { use: emb, signal: o.signal, timeoutMs: o.timeoutMs });
  const dims = emb.info.dims;
  if (vectors[0]?.length !== dims) throw new ModelError(502, "The query vector has the wrong width.", "width");
  await ensureWidthIndex(dims);
  const rows = await tx(async (c) => {
    // The index covers every concept, and filters apply after the index scan; iterative scans
    // (pgvector 0.8+) keep reading the index until enough rows of this concept are found.
    // Relaxed order may return rows slightly out of order, so they are sorted again below.
    await c.query("SAVEPOINT iterative");
    try {
      await c.query("SET LOCAL hnsw.iterative_scan = relaxed_order");
    } catch {
      await c.query("ROLLBACK TO SAVEPOINT iterative"); // older pgvector: plain scan
    }
    const r = await c.query<ItemRow & { score: number }>(nearestSql(dims), [projectId, emb.info.model, vectorLiteral(vectors[0]), n]);
    return r.rows;
  });
  const items = rows.map((r) => ({ ...toItem(r), score: Number(r.score) })).sort((a, b) => b.score - a.score);
  return { ok: true, items, model: emb.info.model, dims };
}
