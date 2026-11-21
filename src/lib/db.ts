import { currentActor } from "./actor";
import { join } from "node:path";
import { runner } from "node-pg-migrate";
import { Pool, type PoolClient } from "pg";
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT } from "./seed";

// One pool per process. DATABASE_URL points at PostgreSQL (pgvector image in Docker).
const g = globalThis as unknown as { __c2rPool?: Pool; __c2rReady?: Promise<{ vector: boolean }> };

export function pool() {
  if (!g.__c2rPool) {
    g.__c2rPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r",
      max: 10,
    });
    // An idle connection reports an error when the database restarts or drops it. Without a listener
    // Node treats that as fatal and the app stops; the pool replaces the connection by itself.
    g.__c2rPool.on("error", (e) => console.error(`database connection dropped: ${e.message}`));
  }
  return g.__c2rPool;
}

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

/** Applies every migration in ./migrations that this database has not seen. Safe to call on every start. */
async function migrate() {
  const c = await pool().connect();
  try {
    await runner({
      dbClient: c,
      dir: MIGRATIONS_DIR,
      direction: "up",
      migrationsTable: "schema_migrations",
      checkOrder: true,
      log: () => undefined,
    });
  } finally {
    c.release();
  }
}

/**
 * pgvector is optional: without it everything works and search matches text.
 * With it, embeddings live in their own table. The vector column has no fixed width
 * because the embedding model is chosen in Admin; each width gets its own index when first used.
 */
async function vectorSupport() {
  const db = pool();
  try {
    await db.query("CREATE EXTENSION IF NOT EXISTS vector");
    await db.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        item_id bigint REFERENCES items(id) ON DELETE CASCADE,
        research_id bigint REFERENCES research(id) ON DELETE CASCADE,
        model text NOT NULL,
        dims int NOT NULL CHECK (dims > 0),
        content_sha256 text NOT NULL,
        embedding vector NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (num_nonnulls(item_id, research_id) = 1),
        CHECK (vector_dims(embedding) = dims)
      )`);
    await db.query("CREATE UNIQUE INDEX IF NOT EXISTS embeddings_item_model ON embeddings (item_id, model) WHERE item_id IS NOT NULL");
    await db.query("CREATE UNIQUE INDEX IF NOT EXISTS embeddings_research_model ON embeddings (research_id, model) WHERE research_id IS NOT NULL");
    await db.query("ALTER TABLE items DROP COLUMN IF EXISTS embedding");
    return true;
  } catch {
    return false;
  }
}

/** Brings the database up to date, turns on pgvector when the server has it, and loads the example concept once. */
export function ready() {
  if (!g.__c2rReady) {
    g.__c2rReady = (async () => {
      await migrate();
      await (await import("./auth")).ensureDefaultUser(pool());
      const vector = await vectorSupport();
      await seedOnce();
      await seedAdditions();
      return { vector };
    })().catch((e) => {
      g.__c2rReady = undefined;
      throw e;
    });
  }
  return g.__c2rReady;
}

/**
 * The example concept is loaded once per database, recorded in `settings`.
 * Deleting it later does not bring it back on the next start.
 */
async function seedOnce() {
  const db = pool();
  const done = await db.query("SELECT 1 FROM settings WHERE key = 'seed.example'");
  if (done.rowCount) return;
  const { rows } = await db.query("SELECT count(*)::int AS n FROM projects");
  if (rows[0].n === 0) await seed();
  await db.query(
    "INSERT INTO settings (key, value) VALUES ('seed.example', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify({ concept: SEED_PROJECT.id, loaded: rows[0].n === 0 })]
  );
}

async function seed() {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    await c.query("INSERT INTO projects (id, name, one_liner) VALUES ($1,$2,$3)", [
      SEED_PROJECT.id,
      SEED_PROJECT.name,
      SEED_PROJECT.oneLiner,
    ]);
    for (let i = 0; i < SEED_ITEMS.length; i++) {
      const it = SEED_ITEMS[i];
      await c.query(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [SEED_PROJECT.id, it.section, it.title, it.body ?? "", JSON.stringify(it.data ?? {}), it.status ?? "open", i]
      );
    }
    await c.query("INSERT INTO events (project_id, kind, summary) VALUES ($1,'project.seeded',$2)", [
      SEED_PROJECT.id,
      `Seeded ${SEED_ITEMS.length} items from the Rev A source documents`,
    ]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Fills stores that were added later, only for the example concept and only when the store is empty. */
async function seedAdditions() {
  const db = pool();
  const has = await db.query("SELECT 1 FROM projects WHERE id=$1", [SEED_PROJECT.id]);
  if (!has.rowCount) return;
  for (const [store, items] of Object.entries(SEED_ADDITIONS)) {
    const marker = `seed.${store}`;
    const done = await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind=$2", [SEED_PROJECT.id, marker]);
    if (done.rowCount) continue;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.query(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [SEED_PROJECT.id, it.section, it.title, it.body ?? "", JSON.stringify(it.data ?? {}), it.status ?? "open", 1000 + i]
      );
    }
    await db.query("INSERT INTO events (project_id, kind, summary) VALUES ($1,$2,$3)", [
      SEED_PROJECT.id,
      marker,
      `Seeded ${items.length} rows into ${store} from the source documents`,
    ]);
  }
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  await ready();
  const r = await pool().query(text, params);
  return r.rows as T[];
}

/** Runs several statements as one unit: all of them land, or none do. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ready();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

const EVENT_SQL = "INSERT INTO events (project_id, kind, summary, data) VALUES ($1,$2,$3,$4)";

// The install-wide record (migrations/0005_audit_log.sql). It keeps the concept's id and name as text and
// has no link to the concept, so it outlives the concept.
const AUDIT_SQL = `INSERT INTO audit_log (actor, project_id, project_name, action, summary, detail)
  VALUES ($1, $2, COALESCE(NULLIF($3, ''), (SELECT name FROM projects WHERE id = $2), ''), $4, $5, $6)`;

const detailOf = (data: unknown) =>
  JSON.stringify(data && typeof data === "object" && !Array.isArray(data) ? data : data === undefined ? {} : { value: data });

type AuditEntry = { action: string; summary: string; detail?: unknown; projectId?: string; projectName?: string; actor?: string };
const auditArgs = (e: AuditEntry) => [e.actor ?? currentActor(), e.projectId ?? "", e.projectName ?? "", e.action, e.summary, detailOf(e.detail)];

/**
 * Writes one line to the install-wide audit log. Use it directly for work that belongs to no concept
 * (keys, settings, printers, sign-in) and for deleting a concept; everything recorded with logEvent
 * is written here as well. Never put a key, password or token in `detail`.
 */
export function audit(e: AuditEntry) {
  return q(AUDIT_SQL, auditArgs(e));
}

/** Same as audit, inside a transaction: the line is kept only if the work is. */
export function auditIn(c: PoolClient, e: AuditEntry) {
  return c.query(AUDIT_SQL, auditArgs(e));
}

/** Records a change to a concept, inside a transaction: in the concept's activity list and in the audit log. */
export async function logEventIn(c: PoolClient, projectId: string, kind: string, summary: string, data: unknown = {}) {
  await c.query(EVENT_SQL, [projectId, kind, summary, JSON.stringify(data)]);
  await auditIn(c, { action: kind, summary, detail: data, projectId });
}

/** Records a change to a concept: in the concept's activity list and in the audit log, together or not at all. */
export function logEvent(projectId: string, kind: string, summary: string, data: unknown = {}) {
  return tx((c) => logEventIn(c, projectId, kind, summary, data));
}

export type ItemRow = {
  id: string;
  project_id: string;
  section: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  status: string;
  sort: number;
};

export function toItem(r: ItemRow) {
  return {
    id: Number(r.id),
    projectId: r.project_id,
    section: r.section,
    title: r.title,
    body: r.body,
    data: r.data,
    status: r.status,
    sort: r.sort,
  };
}

export const ITEM_COLS = "id, project_id, section, title, body, data, status, sort";

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "concept"
  );
}
