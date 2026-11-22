// Two database roles (trial task 2): with DATABASE_APP_URL set, requests run as a role that owns nothing and cannot
// read the credential tables; without it, one pool serves everything as before.
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { roleOf, scramVerifier } from "@/lib/auth2/dbRoles";

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
  await dropRole(`${ROLE}_su`);
});

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
      if (!(await db.ownerPool().query("SELECT to_regclass($1) IS NOT NULL AS ok", [t])).rows[0].ok) continue;
      await expect(db.q(`SELECT 1 FROM ${t} LIMIT 1`), t).rejects.toMatchObject({ code: "42501" });
    }
    await expect(db.q("UPDATE audit_log SET summary = summary WHERE false")).rejects.toMatchObject({ code: "42501" });
    await expect(db.q("CREATE TABLE zz_roles_should_fail (x int)")).rejects.toMatchObject({ code: "42501" });
    // The owner still reads them.
    await expect(db.ownerPool().query("SELECT 1 FROM schema_migrations LIMIT 1")).resolves.toBeDefined();
  });

  it("a second start keeps the role's password and grants", async () => {
    process.env.DATABASE_APP_URL = APP_URL;
    const db = await import("@/lib/db");
    await db.ready();
    expect((await db.q<{ u: string }>("SELECT current_user AS u"))[0].u).toBe(ROLE);
  });

  it("refuses a request role that is a superuser", async () => {
    const su = `${ROLE}_su`;
    const pw = randomBytes(12).toString("base64url");
    await asSuper((c) => c.query(`CREATE ROLE "${su}" LOGIN SUPERUSER PASSWORD '${scramVerifier(pw)}'`));
    process.env.DATABASE_APP_URL = appUrlFor(su, pw);
    const db = await import("@/lib/db");
    await expect(db.ready()).rejects.toThrow(/superuser/);
  });

  it("refuses an address with no role or no password, in plain words", () => {
    expect(() => roleOf("not a url")).toThrow(/not a database address/);
    expect(() => roleOf("postgresql://localhost/db")).toThrow(/must name a role/);
    expect(() => roleOf("postgresql://app@localhost/db")).toThrow(/password/);
  });
});
