// Two database roles (trial task 2): with DATABASE_APP_URL set, requests run as a role that owns nothing and cannot
// read the credential tables; without it, one pool serves everything as before.
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { APPEND_ONLY, APP_TABLES, READ_ONLY, WITHHELD, roleOf, scramVerifier } from "@/lib/auth2/dbRoles";

const OWNER_URL = process.env.DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r_ws2_test";
const ROLE = `zz_auth2_app_${process.pid}`;
const PASSWORD = randomBytes(18).toString("base64url");
const appUrlFor = (role: string, password: string) => {
  const u = new URL(OWNER_URL);
  u.username = role;
  u.password = password;
  return u.toString();
};
const APP_URL = appUrlFor(ROLE, PASSWORD);

type G = { __c2rPool?: { end(): Promise<void> }; __c2rOwnerPool?: { end(): Promise<void> }; __c2rReady?: unknown };
const g = globalThis as unknown as G;

/** Ends and forgets the app's pools, so the next import of db.ts reads the environment again. */
async function resetPools() {
  const a = g.__c2rPool;
  const b = g.__c2rOwnerPool;
  delete g.__c2rPool;
  delete g.__c2rOwnerPool;
  delete g.__c2rReady;
  await a?.end().catch(() => undefined);
  if (b && b !== a) await b.end().catch(() => undefined);
}

async function asSuper<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: OWNER_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function dropRole(name: string) {
  await asSuper(async (c) => {
    const has = await c.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [name]);
    if (!has.rowCount) return;
    // Connections of that role, from an earlier run that stopped half-way, would keep it alive.
    await c.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1", [name]);
    await c.query(`DROP OWNED BY "${name}"`);
    await c.query(`DROP ROLE "${name}"`);
  });
}

beforeAll(async () => {
  await resetPools();
  await dropRole(ROLE);
});

afterEach(async () => {
  delete process.env.DATABASE_APP_URL;
  await resetPools();
});

afterAll(async () => {
  await dropRole(ROLE);
  for (const suffix of ["_su", "_db", "_member"]) await dropRole(`${ROLE}${suffix}`);
  await asSuper((c) => c.query("DROP TABLE IF EXISTS zz_roles_unlisted"));
  await asSuper((c) => c.query("REVOKE SELECT ON verification FROM PUBLIC"));
});

/** A throw-away login role with extra rights, and the address that names it. */
async function oddRole(suffix: string, options: string) {
  const name = `${ROLE}${suffix}`;
  const pw = randomBytes(12).toString("base64url");
  await dropRole(name);
  await asSuper((c) => c.query(`CREATE ROLE "${name}" LOGIN ${options} PASSWORD '${scramVerifier(pw)}'`));
  return appUrlFor(name, pw);
}

describe("one role (DATABASE_APP_URL not set)", () => {
  it("uses one pool for requests and for the owner's work, as before", async () => {
    delete process.env.DATABASE_APP_URL;
    const db = await import("@/lib/db");
    expect(db.appUrl()).toBeNull();
    expect(db.ownerPool()).toBe(db.pool());
    const [me] = await db.q<{ u: string }>("SELECT current_user AS u");
    expect(me.u).toBe(new URL(OWNER_URL).username);
  });

  it("treats DATABASE_APP_URL equal to DATABASE_URL as one role", async () => {
    process.env.DATABASE_APP_URL = OWNER_URL;
    const db = await import("@/lib/db");
    expect(db.appUrl()).toBeNull();
    expect(db.ownerPool()).toBe(db.pool());
  });
});

describe("two roles (DATABASE_APP_URL set)", () => {
  it("creates the request role on start, and requests run as it", async () => {
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    await db.ready();
    expect(db.ownerPool()).not.toBe(db.pool());
    expect((await db.q<{ u: string }>("SELECT current_user AS u"))[0].u).toBe(ROLE);
    expect((await db.ownerPool().query<{ u: string }>("SELECT current_user AS u")).rows[0].u).toBe(new URL(OWNER_URL).username);
    expect(await db.tx(async (c) => (await c.query<{ u: string }>("SELECT current_user AS u")).rows[0].u)).toBe(ROLE);
    const r = await asSuper((c) => c.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }>("SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname=$1", [ROLE]));
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false });
  });

  it("the request role reads and writes the app's tables", async () => {
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    const id = `zz-roles-${process.pid}`;
    await db.q("DELETE FROM projects WHERE id=$1", [id]);
    await db.q("INSERT INTO projects (id, name) VALUES ($1, 'Roles test')", [id]);
    await db.q("INSERT INTO items (project_id, section, title) VALUES ($1, 'design/requirements', 'x')", [id]);
    expect((await db.q("SELECT 1 FROM items WHERE project_id=$1", [id])).length).toBe(1);
    await db.logEvent(id, "item.added", "roles test");
    await db.q("DELETE FROM projects WHERE id=$1", [id]);
  });

  it("the request role cannot read the credential tables or change the audit log", async () => {
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    await db.ready();
    for (const t of ["account", "session", "verification", '"twoFactor"', '"rateLimit"', "invitation", "auth2_totp_steps", "schema_migrations"]) {
      await expect(db.q(`SELECT 1 FROM ${t} LIMIT 1`), t).rejects.toMatchObject({ code: "42501" });
    }
    await expect(db.q("UPDATE audit_log SET summary = summary WHERE false")).rejects.toMatchObject({ code: "42501" });
    await expect(db.q("CREATE TABLE zz_roles_should_fail (x int)")).rejects.toMatchObject({ code: "42501" });
    // The owner still reads them.
    await expect(db.ownerPool().query('SELECT 1 FROM "session" LIMIT 1')).resolves.toBeDefined();
  });

  it("a second start keeps the role's password and grants", async () => {
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    await db.ready();
    expect((await db.q<{ u: string }>("SELECT current_user AS u"))[0].u).toBe(ROLE);
  });

  it("refuses a request role that is a superuser", async () => {
    process.env.DATABASE_APP_URL = await oddRole("_su", "SUPERUSER");
    const db = await import("@/lib/db");
    await expect(db.ready()).rejects.toThrow(/must not have: superuser/);
  });

  it("refuses a request role that may create databases or roles", async () => {
    process.env.DATABASE_APP_URL = await oddRole("_db", "CREATEDB CREATEROLE");
    const db = await import("@/lib/db");
    await expect(db.ready()).rejects.toThrow(/create roles, create databases/);
  });

  it("refuses a request role that belongs to the owner or to a role that reads everything", async () => {
    const url = await oddRole("_member", "");
    await asSuper((c) => c.query(`GRANT pg_read_all_data TO "${ROLE}_member"`));
    process.env.DATABASE_APP_URL = url;
    const db = await import("@/lib/db");
    await expect(db.ready()).rejects.toThrow(/member of other roles \(pg_read_all_data\)/);
    await asSuper((c) => c.query(`REVOKE pg_read_all_data FROM "${ROLE}_member"`));
    await asSuper((c) => c.query(`GRANT "${new URL(OWNER_URL).username}" TO "${ROLE}_member"`));
    await resetPools();
    const db2 = await import("@/lib/db");
    await expect(db2.ready()).rejects.toThrow(/member of other roles/);
  });

  it("refuses a request address on another database or server", async () => {
    const u = new URL(APP_URL);
    u.pathname = "/postgres";
    process.env.DATABASE_APP_URL = u.toString();
    const db = await import("@/lib/db");
    await expect(db.ready()).rejects.toThrow(/same server, port and database/);
  });

  it("refuses to start when a withheld table is reachable anyway (granted to PUBLIC)", async () => {
    await asSuper((c) => c.query("GRANT SELECT ON verification TO PUBLIC"));
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    await expect(db.ready()).rejects.toThrow(/can still reach the table verification/);
    await asSuper((c) => c.query("REVOKE SELECT ON verification FROM PUBLIC"));
  });

  it("grants by allow-list: sign-in tables read only, and a new table gets nothing", async () => {
    await asSuper((c) => c.query("CREATE TABLE IF NOT EXISTS zz_roles_unlisted (x int)"));
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    await db.ready();
    await expect(db.q('SELECT id, email, name FROM "user" LIMIT 1')).resolves.toBeDefined();
    await expect(db.q('SELECT "organizationId", role FROM member LIMIT 1')).resolves.toBeDefined();
    await expect(db.q("SELECT id, name FROM organization LIMIT 1")).resolves.toBeDefined();
    for (const sql of [
      `UPDATE "user" SET "emailVerified" = true WHERE false`,
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('zz', 'zz', 'zz@zz-auth2.test', true)`,
      `DELETE FROM "user" WHERE false`,
      `UPDATE member SET role = 'owner' WHERE false`,
      `INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ('zz', 'zz', 'zz', 'owner', now())`,
      `DELETE FROM organization WHERE false`,
      "SELECT 1 FROM zz_roles_unlisted",
    ]) await expect(db.q(sql), sql).rejects.toMatchObject({ code: "42501" });
  });
});

describe("the grant lists", () => {
  it("place every table of the migrated schema in exactly one list", async () => {
    const tables = await asSuper(async (c) => (await c.query<{ t: string }>("SELECT tablename AS t FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'zz_%' ORDER BY 1")).rows.map((r) => r.t));
    const lists = [...APP_TABLES, ...APPEND_ONLY, ...Object.keys(READ_ONLY), ...WITHHELD];
    expect(new Set(lists).size).toBe(lists.length);
    expect(tables.filter((t) => !lists.includes(t))).toEqual([]);
  });

  it("refuses an address with no role or no password, in plain words", () => {
    expect(() => roleOf("not a url")).toThrow(/not a database address/);
    expect(() => roleOf("postgresql://localhost/db")).toThrow(/must name a role/);
    expect(() => roleOf("postgresql://app@localhost/db")).toThrow(/password/);
  });
});
