import { Pool } from "pg";
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT } from "./seed";

// One pool per process. DATABASE_URL points at PostgreSQL (pgvector image in Docker).
const g = globalThis as unknown as { __c2rPool?: Pool; __c2rReady?: Promise<{ vector: boolean }> };

export function pool() {
  if (!g.__c2rPool) {
    g.__c2rPool = new Pool({
      connectionString: process.env.DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r",
      max: 10,
    });
  }
  return g.__c2rPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  one_liner text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Every section of every concept stores its rows here: same shape, same wiring.
-- data carries the section's columns, a part's geometry, a step's key/after/minutes.
CREATE TABLE IF NOT EXISTS items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_section ON items(project_id, section, sort, id);
-- Files live in PostgreSQL (no object store): STL exports, uploads, reports.
CREATE TABLE IF NOT EXISTS files (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime text NOT NULL DEFAULT 'application/octet-stream',
  kind text NOT NULL DEFAULT 'upload',
  size int NOT NULL,
  sha256 text NOT NULL,
  bytes bytea NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (size <= 26214400)
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, created_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS research (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query text NOT NULL,
  answer text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]',
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Everything that happens is recorded here; the report reads from it.
CREATE TABLE IF NOT EXISTS events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  summary text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id, id DESC);
`;

/** Creates the schema, turns on pgvector when the server has it, and seeds the example concept. */
export function ready() {
  if (!g.__c2rReady) {
    g.__c2rReady = (async () => {
      const db = pool();
      await db.query(SCHEMA);
      let vector = false;
      try {
        await db.query("CREATE EXTENSION IF NOT EXISTS vector");
        await db.query("ALTER TABLE items ADD COLUMN IF NOT EXISTS embedding vector(1024)");
        vector = true;
      } catch {
        // Plain PostgreSQL without the pgvector extension: search falls back to text matching.
      }
      const { rows } = await db.query("SELECT count(*)::int AS n FROM projects");
      if (rows[0].n === 0) await seed();
      await seedAdditions();
      return { vector };
    })().catch((e) => {
      g.__c2rReady = undefined;
      throw e;
    });
  }
  return g.__c2rReady;
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

export function logEvent(projectId: string, kind: string, summary: string, data: unknown = {}) {
  return q("INSERT INTO events (project_id, kind, summary, data) VALUES ($1,$2,$3,$4)", [
    projectId,
    kind,
    summary,
    JSON.stringify(data),
  ]);
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
