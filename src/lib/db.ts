import { currentActor } from "./actor";
import { join } from "node:path";
import { runner } from "node-pg-migrate";
import { Pool, type PoolClient } from "pg";
import { SEED_ADDITIONS, SEED_ITEMS, SEED_LINKS, SEED_PROJECT, type SeedLink } from "./seed";

// Two connections, two database roles (docs/guide/admin.md, "Two database roles"):
// - DATABASE_URL names the owner: the role that owns the tables. Migrations, start-up seeding, the pgvector table and
//   the new sign-in (src/lib/auth2/) use it.
// - DATABASE_APP_URL, when set, names a second role that owns nothing. Every request's queries (q(), tx(), pool())
//   use it, so row-level security can apply to them later (PostgreSQL never applies it to a superuser, and not to a
//   table's owner unless forced). The owner creates that role on start if it is missing and grants it the tables it
//   needs, never the ones holding passwords, session tokens, reset tokens or second-factor secrets.
// Without DATABASE_APP_URL there is one pool for everything, as before.
const g = globalThis as unknown as {
  __c2rPool?: Pool;
  __c2rOwnerPool?: Pool;
  __c2rReady?: Promise<{ vector: boolean; vectorProblem: string | null }>;
};

const DEFAULT_URL = "postgresql://c2r:c2r@localhost:5432/c2r";
const ownerUrl = () => process.env.DATABASE_URL ?? DEFAULT_URL;
/** The request role's address, or null when this install uses one role for everything. */
export const appUrl = () => {
  const u = process.env.DATABASE_APP_URL?.trim();
  return u && u !== ownerUrl() ? u : null;
};

function newPool(connectionString: string) {
  const p = new Pool({ connectionString, max: 10 });
  // An idle connection reports an error when the database restarts or drops it. Without a listener
  // Node treats that as fatal and the app stops; the pool replaces the connection by itself.
  p.on("error", (e) => console.error(`database connection dropped: ${e.message}`));
  return p;
}

/** The pool requests use: the request role when DATABASE_APP_URL is set, otherwise the one role. */
export function pool() {
  g.__c2rPool ??= newPool(appUrl() ?? ownerUrl());
  return g.__c2rPool;
}

/** The owner's pool: migrations, seeding, the pgvector table, the new sign-in. The same pool as pool() with one role. */
export function ownerPool() {
  if (!appUrl()) return pool();
  g.__c2rOwnerPool ??= newPool(ownerUrl());
  return g.__c2rOwnerPool;
}

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

/** Applies every migration in ./migrations that this database has not seen. Safe to call on every start. */
async function migrate() {
  const c = await ownerPool().connect();
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
export type VectorState = { vector: boolean; vectorProblem: string | null };

async function vectorSupport(): Promise<VectorState> {
  const db = ownerPool();
  try {
    await db.query("CREATE EXTENSION IF NOT EXISTS vector");
  } catch (e) {
    // pgvector is not installed in this PostgreSQL: expected on some installs, and said so in Admin as the
    // database test's "pgvector is not active". Logged once at start-up, not hidden.
    console.warn(`[db] pgvector is not available, so search by meaning is off: ${(e as Error).message}`);
    return { vector: false, vectorProblem: null };
  }
  try {
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
    // One bit per number, kept beside each vector and maintained by PostgreSQL. At 4,096 numbers it is
    // 512 bytes and sits in the table itself, while the vector (16 KB) is stored out of line; a search
    // compares these first and reads only the best candidates' full vectors.
    // Measured in docs/design/vector-search.md.
    await db.query("ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS bq bit varying GENERATED ALWAYS AS (binary_quantize(embedding)::bit varying) STORED");
    // Every search is for one concept, one model and one width.
    await db.query("CREATE INDEX IF NOT EXISTS embeddings_scope ON embeddings (project_id, model, dims)");
    await sourceChunkVectors(db);
    return { vector: true, vectorProblem: null };
  } catch (e) {
    // pgvector is there but its table could not be made: a real fault, logged and shown in Admin, Setup.
    // The table is made here rather than in a migration because its vector column has no fixed width
    // (the embedding model, and so the width, is chosen in Admin) and the extension is optional.
    const message = (e as Error).message ?? String(e);
    console.error("[db] the embeddings table could not be set up, so search by meaning is off:", message);
    return { vector: false, vectorProblem: `The embeddings table could not be set up: ${message.slice(0, 300)}` };
  }
}

/**
 * A passage of a source (`source_chunks`, migration 0029) is embedded like a row: the embeddings table gets a
 * third target column, and its one-target rule counts it. Safe to run on every start.
 */
async function sourceChunkVectors(db: Pool) {
  await db.query("ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS chunk_id bigint REFERENCES source_chunks(id) ON DELETE CASCADE");
  // The one-target rule made with the table names two columns; it is replaced by one that names three.
  await db.query(`DO $$
    DECLARE c record;
    BEGIN
      FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'embeddings'::regclass AND contype = 'c'
                 AND pg_get_constraintdef(oid) LIKE '%num_nonnulls%' AND pg_get_constraintdef(oid) NOT LIKE '%chunk_id%' LOOP
        EXECUTE format('ALTER TABLE embeddings DROP CONSTRAINT %I', c.conname);
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'embeddings'::regclass AND conname = 'embeddings_one_target') THEN
        ALTER TABLE embeddings ADD CONSTRAINT embeddings_one_target CHECK (num_nonnulls(item_id, research_id, chunk_id) = 1);
      END IF;
    END $$`);
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS embeddings_chunk_model ON embeddings (chunk_id, model) WHERE chunk_id IS NOT NULL");
}

/** Brings the database up to date, turns on pgvector when the server has it, and loads the example concept once. */
export function ready() {
  if (!g.__c2rReady) {
    g.__c2rReady = (async () => {
      // The new sign-in's settings module (src/lib/auth2/config.ts); its checks run after the migrations, below.
      const auth2 = await import("./auth2/config");
      await migrate();
      // After the migrations, so the stored switch can be read (review N13); the override counts as well.
      if (auth2.override() ?? (await auth2.storedSwitch(ownerPool()).catch(() => false))) {
        await auth2.checkAuth2Settings();
        // A fresh install: a new set-up code for the first-run page, printed to the log (review B2).
        await (await import("./auth2/firstRun")).ensureSetupCode(ownerPool());
      }
      await (await import("./auth")).ensureDefaultUser(ownerPool());
      const vector = await vectorSupport();
      await seedOnce();
      await seedAdditions();
      await seedLinks();
      await (await import("./story/seed")).seedStory(ownerPool());
      await (await import("./story/seedFiles")).seedFiles(ownerPool());
      await (await import("./story/seedFiles")).upgradeSeedFiles(ownerPool());
      await (await import("./story/seedFiles")).addSeedFiles(ownerPool());
      // the welcome film's voice-over clips, into the files store, once per batch
      await (await import("./voice/seedVoiceovers")).seedVoiceovers(ownerPool());
      await (await import("./economics/movePricingChannels")).movePricingChannels(ownerPool());
      // content entered from the owner's documents after the first seed, one dated batch at a time
      await (await import("./seedContentDb")).seedContent(ownerPool());
      // Last, so the tables made above are included. Only with two roles.
      const app = appUrl();
      if (app) await (await import("./auth2/dbRoles")).ensureAppRole(ownerPool(), app, ownerUrl());
      return vector;
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
  const db = ownerPool();
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
  const c = await ownerPool().connect();
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
  const db = ownerPool();
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

/**
 * Links one requirement of the example to tests and parts, at both ends, with a history line that says why. Rows
 * that are not there are skipped. Returns the number of links written. Used by the first seed (SEED_LINKS) and by
 * the content batches (src/lib/seedContentDb.ts).
 */
export async function linkSeedRows(c: PoolClient, link: SeedLink, origin: string): Promise<number> {
  const { ensureKey, mirrorLinks } = await import("./trace/mirror");
  const { changedDetail } = await import("./trace/changes");
  const find = async (section: string, field: "title" | "ref", value: string) =>
    (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section=$2 AND ${field === "title" ? "title" : "data->>'ref'"} = $3 ORDER BY id LIMIT 1 FOR UPDATE`, [SEED_PROJECT.id, section, value])).rows[0];
    const req = await find("design/requirements", "title", link.requirement);
    if (!req) return 0;
    // One at a time: a pg client runs a single query at a time.
    const tests: ItemRow[] = [];
    for (const t of link.tests) { const r = await find("prototype/tests", "title", t); if (r) tests.push(r); }
    const parts: ItemRow[] = [];
    for (const p of link.parts) { const r = await find("design/bom", "ref", p); if (r) parts.push(r); }
    if (!tests.length && !parts.length) return 0;
    const reqKey = await ensureKey(c, req);
    const testKeys = [];
    for (const t of tests) testKeys.push(await ensureKey(c, t));
    const partKeys = [];
    for (const p of parts) partKeys.push(await ensureKey(c, p));
    const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1`, [req.id])).rows[0];
    const have = (f: string) => (Array.isArray(was.data[f]) ? (was.data[f] as unknown[]).filter((x): x is string => typeof x === "string") : []);
    const nextTests = [...new Set([...have("tests"), ...testKeys])];
    const nextParts = [...new Set([...have("parts"), ...partKeys])];
    const upd = await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb, updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [req.id, JSON.stringify({ tests: nextTests, parts: nextParts })]);
    const now = upd.rows[0];
    const what = [tests.length ? `${tests.length} test${tests.length === 1 ? "" : "s"}` : "", parts.length ? `${parts.length} part${parts.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
    await logEventIn(c, SEED_PROJECT.id, "item.edited", `"${now.title}": linked to ${what} ${origin} (${reqKey})`, {
      ...changedDetail(now, { before: { "data.tests": have("tests"), "data.parts": have("parts") }, after: { "data.tests": nextTests, "data.parts": nextParts } }),
      reason: link.because,
      seeded: true,
    });
    await mirrorLinks(c, { data: { ...was.data, tests: have("tests"), parts: have("parts") } }, now);
  return tests.length + parts.length;
}

/**
 * Links the example's requirements, tests and parts where its own texts say they correspond (SEED_LINKS), once per
 * database and only for rows still there. Each link is written at both ends and recorded as a history line that says
 * why, so the Activity page and the traceability matrix of the example are not empty.
 */
async function seedLinks() {
  const db = ownerPool();
  const has = await db.query("SELECT 1 FROM projects WHERE id=$1", [SEED_PROJECT.id]);
  if (!has.rowCount) return;
  const done = await db.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.links'", [SEED_PROJECT.id]);
  if (done.rowCount) return;
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    // Another process starting at the same time must not seed twice.
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`seed.links:${SEED_PROJECT.id}`]);
    if ((await c.query("SELECT 1 FROM events WHERE project_id=$1 AND kind='seed.links'", [SEED_PROJECT.id])).rowCount) {
      await c.query("ROLLBACK");
      return;
    }
    let linked = 0;
    for (const link of SEED_LINKS) linked += await linkSeedRows(c, link, "from the source documents");
    await logEventIn(c, SEED_PROJECT.id, "seed.links", `Linked the example's requirements, tests and parts where its own texts say they correspond (${linked} links)`, { links: linked });
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
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
  return inTransaction(pool(), fn);
}

/**
 * tx() on the owner's connection, for the few things a request does that only a table's owner may: making a
 * per-width vector index the first time a width is used (src/lib/ai/embeddings.ts), and turning the new sign-in on in
 * Admin, Sign-in, which ends the old sign-in's sessions (src/app/api/admin/sign-in/route.ts). Nothing else should use it.
 */
export async function ownerTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ready();
  return inTransaction(ownerPool(), fn);
}

async function inTransaction<T>(p: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await p.connect();
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

