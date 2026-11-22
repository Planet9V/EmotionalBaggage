/**
 * The request role (trial task 2, docs/research/auth-trial-findings.md, question 8).
 *
 * With DATABASE_APP_URL set, requests connect as a role that owns no table, so PostgreSQL's row-level security
 * will apply to them once policies exist (a superuser is never subject to it, and a table's owner only when the
 * policy is forced). ensureAppRole runs on every start, on the owner's connection, after the migrations and the
 * start-up tables:
 *
 * - it creates the role named in DATABASE_APP_URL when it does not exist, with that URL's password, sent as a
 *   SCRAM-SHA-256 verifier so the password itself never reaches the server's statement log;
 * - it refuses to go on when DATABASE_APP_URL names another server or database, or when that role is a superuser,
 *   may bypass row-level security, create roles or databases, replicate, belongs to any other role (the owner, a
 *   built-in role that reads everything), or owns a table here: any of those would make the second role pointless;
 * - it takes back every grant and gives exactly the allow-list below, then proves with has_table_privilege that the
 *   role cannot reach any withheld table; a table in no list gets nothing and is named in a warning.
 *
 * An existing role's password is never changed here: whoever made it manages it.
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { escapeIdentifier, escapeLiteral, type Pool, type PoolClient } from "pg";

/**
 * What the request role may do, table by table: an allow-list (security review B3). A table that is in none of these
 * lists is granted nothing, so a later sign-in or billing table is closed to requests until someone decides
 * otherwise; tests/auth2/roles.test.ts fails while any table of the migrated schema is unlisted.
 */
/** Read and write: the app's own tables. `users`, `sessions` and `sign_in_attempts` belong to the old sign-in, which
 *  runs on the request connection until the cut-over. */
export const APP_TABLES = [
  "access_requests", "campaign_results", "chat_messages", "chats", "credentials", "drafts", "embeddings", "events", "files", "gates",
  "items", "link_clicks", "messages", "pins", "printers", "projects", "research", "settings", "sign_in_attempts", "sessions",
  "source_chunks", "tracked_links", "users",
] as const;
/** Read and add to, never change. */
export const APPEND_ONLY = ["audit_log"] as const;
/** Read only, and only these columns (Better Auth writes them on the owner's connection). A column added later, such
 *  as a billing customer id, is not readable until listed here. */
export const READ_ONLY: Record<string, readonly string[]> = {
  user: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "twoFactorEnabled"],
  organization: ["id", "name", "slug", "logo", "createdAt", "metadata"],
  member: ["id", "organizationId", "userId", "role", "createdAt"],
};
/** Nothing at all: passwords, session and reset tokens, second-factor secrets, invitations, throttle counts. */
export const WITHHELD = ["account", "session", "verification", "twoFactor", "rateLimit", "invitation", "auth2_totp_steps", "auth2_secrets", "auth2_invitation_tokens", "auth2_workspace_policy", "auth2_member_flags", "auth2_sign_in_waits", "auth2_install", "auth2_settings", "auth2_setup_code", "auth2_reenrol", "auth2_two_factor_resets", "schema_migrations"] as const;

/** Built-in roles that read or write everything, or reach the server's files: the request role may be in none. */
const PRIVILEGED_ROLES = ["pg_read_all_data", "pg_write_all_data", "pg_read_server_files", "pg_write_server_files", "pg_execute_server_program", "pg_signal_backend", "pg_monitor", "pg_database_owner"];

const ROLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** The role name and password in a postgres:// address. */
export function roleOf(url: string): { name: string; password: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("DATABASE_APP_URL is not a database address (postgresql://role:password@host:port/database).");
  }
  const name = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  if (!ROLE_NAME.test(name)) throw new Error("DATABASE_APP_URL must name a role: letters, digits and underscores, starting with a letter.");
  if (!password) throw new Error("DATABASE_APP_URL must carry the role's password.");
  return { name, password };
}

/**
 * PostgreSQL's stored form of a SCRAM-SHA-256 password (RFC 5802, RFC 7677), as `CREATE ROLE ... PASSWORD`
 * accepts it: `SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>`.
 */
export function scramVerifier(password: string, salt = randomBytes(16), iterations = 4096): string {
  const salted = pbkdf2Sync(password.normalize("NFKC"), salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

const target = (url: string) => {
  const u = new URL(url);
  return `${u.hostname.toLowerCase()}:${u.port || "5432"}${decodeURIComponent(u.pathname) || "/"}`;
};

/** Refuses a request role that could undo what the second role is for (security review F3). */
async function refusePrivileged(c: PoolClient, name: string, owner: string) {
  const r = await c.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean; rolreplication: boolean }>(
    "SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles WHERE rolname = $1",
    [name]
  );
  const f = r.rows[0];
  const rights = [f.rolsuper && "superuser", f.rolbypassrls && "bypass row-level security", f.rolcreaterole && "create roles", f.rolcreatedb && "create databases", f.rolreplication && "replication"].filter(Boolean);
  if (rights.length) throw new Error(`The database role "${name}" named in DATABASE_APP_URL has rights a request role must not have: ${rights.join(", ")}. Use a plain role.`);
  // Any membership: of the owner (its tables), of a built-in role that reads everything, or of anything else.
  const m = await c.query<{ rolname: string }>(
    "SELECT r.rolname FROM pg_auth_members a JOIN pg_roles r ON r.oid = a.roleid WHERE a.member = (SELECT oid FROM pg_roles WHERE rolname = $1) ORDER BY 1",
    [name]
  );
  const inOwner = (await c.query<{ yes: boolean }>("SELECT pg_has_role($1, $2, 'USAGE') AS yes", [name, owner])).rows[0].yes;
  const named = m.rows.map((x) => x.rolname);
  if (inOwner || named.length) {
    const special = named.filter((x) => PRIVILEGED_ROLES.includes(x) || x === owner);
    throw new Error(`The database role "${name}" named in DATABASE_APP_URL is a member of other roles (${(special.length ? special : named).join(", ") || owner}). A request role must belong to none.`);
  }
}

/** Makes sure the request role exists, is not privileged, and has exactly the grants described above. */
export async function ensureAppRole(owner: Pool, url: string, ownerUrl: string): Promise<void> {
  const { name, password } = roleOf(url);
  if (target(url) !== target(ownerUrl)) {
    throw new Error("DATABASE_APP_URL must name the same server, port and database as DATABASE_URL, with another role.");
  }
  const role = escapeIdentifier(name);
  const c = await owner.connect();
  try {
    const me = (await c.query<{ me: string }>("SELECT current_user AS me")).rows[0].me;
    if (me === name) throw new Error("DATABASE_APP_URL names the same role as DATABASE_URL. Name a second role, or leave DATABASE_APP_URL out to use one role.");
    // One start at a time: two processes creating the role at once would make one of them fail.
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.app_role'))");
    const found = await c.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [name]);
    if (!found.rowCount) {
      try {
        await c.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION NOINHERIT PASSWORD ${escapeLiteral(scramVerifier(password))}`);
      } catch (e) {
        throw new Error(
          `The database role "${name}" named in DATABASE_APP_URL does not exist and the owner could not create it. ` +
            "Create it by hand (docs/guide/admin.md, \"Two database roles\") or give the owner the CREATEROLE right.",
          { cause: e }
        );
      }
    }
    await refusePrivileged(c, name, me);
    const owns = await c.query<{ t: string }>(
      "SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = $1) LIMIT 1",
      [name]
    );
    if (owns.rowCount) throw new Error(`The database role "${name}" named in DATABASE_APP_URL owns the table ${owns.rows[0].t}. The request role must own nothing.`);

    const db = escapeIdentifier((await c.query<{ d: string }>("SELECT current_database() AS d")).rows[0].d);
    const schemaName = (await c.query<{ s: string }>("SELECT current_schema() AS s")).rows[0].s;
    const schema = escapeIdentifier(schemaName);
    const q = (t: string) => `${schema}.${escapeIdentifier(t)}`;
    await c.query(`GRANT CONNECT ON DATABASE ${db} TO ${role}`);
    await c.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    // Start from nothing, then grant the lists: a grant from an earlier version of this code is not left behind.
    await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM ${role}`);
    await c.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${schema} FROM ${role}`);
    const tables = new Set((await c.query<{ t: string }>("SELECT tablename AS t FROM pg_tables WHERE schemaname = $1", [schemaName])).rows.map((r) => r.t));
    const grant = async (t: string, privileges: string) => {
      await c.query(`GRANT ${privileges} ON ${q(t)} TO ${role}`);
      // Identity and serial sequences of that table, for its INSERTs.
      const seqs = await c.query<{ s: string }>(
        "SELECT s.relname AS s FROM pg_depend d JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S' WHERE d.refobjid = $1::regclass AND d.deptype IN ('a', 'i')",
        [q(t)]
      );
      for (const r of seqs.rows) await c.query(`GRANT USAGE, SELECT ON SEQUENCE ${q(r.s)} TO ${role}`);
    };
    for (const t of APP_TABLES) if (tables.has(t)) await grant(t, "SELECT, INSERT, UPDATE, DELETE");
    for (const t of APPEND_ONLY) if (tables.has(t)) await grant(t, "SELECT, INSERT");
    for (const [t, cols] of Object.entries(READ_ONLY)) {
      if (tables.has(t)) await c.query(`GRANT SELECT (${cols.map(escapeIdentifier).join(", ")}) ON ${q(t)} TO ${role}`);
    }
    // Proof, not trust: the role can do nothing on the withheld tables, whatever PUBLIC or anyone else granted.
    for (const t of WITHHELD) {
      if (!tables.has(t)) continue;
      const r = await c.query<{ any: boolean }>(
        "SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') OR has_table_privilege($1, $2, 'UPDATE') OR has_table_privilege($1, $2, 'DELETE') OR has_any_column_privilege($1, $2, 'SELECT') AS any",
        [name, q(t)]
      );
      if (r.rows[0].any) throw new Error(`The database role "${name}" can still reach the table ${t} (granted to PUBLIC or through another role). Revoke that grant; requests must not reach it.`);
    }
    const listed = new Set<string>([...APP_TABLES, ...APPEND_ONLY, ...Object.keys(READ_ONLY), ...WITHHELD]);
    const unlisted = [...tables].filter((t) => !listed.has(t)).sort();
    if (unlisted.length) console.warn(`[db] tables not granted to the request role (not yet in src/lib/auth2/dbRoles.ts): ${unlisted.join(", ")}`);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
