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
 * - it refuses to go on when that role is a superuser, may bypass row-level security, or owns a table here: any of
 *   those would make the second role pointless;
 * - it grants reading and writing on every table and sequence in the schema, then takes back everything on the
 *   tables that hold passwords, session tokens, reset tokens and second-factor secrets (WITHHELD), which only the
 *   owner's connection reads, and leaves the audit log append-only for it (no UPDATE or DELETE privilege, on top
 *   of the trigger in migration 0026).
 *
 * An existing role's password is never changed here: whoever made it manages it.
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { escapeIdentifier, escapeLiteral, type Pool } from "pg";

/** Tables the request role may not touch at all. Better Auth's credential tables, read on the owner's connection. */
export const WITHHELD = ["account", "session", "verification", "twoFactor", "rateLimit", "invitation", "auth2_totp_steps", "schema_migrations"] as const;
/** Tables the request role may read and add to, never change. */
const APPEND_ONLY = ["audit_log"] as const;

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

/** Makes sure the request role exists, is not privileged, and has exactly the grants described above. */
export async function ensureAppRole(owner: Pool, url: string): Promise<void> {
  const { name, password } = roleOf(url);
  const role = escapeIdentifier(name);
  const c = await owner.connect();
  try {
    const me = (await c.query<{ me: string }>("SELECT current_user AS me")).rows[0].me;
    if (me === name) throw new Error("DATABASE_APP_URL names the same role as DATABASE_URL. Name a second role, or leave DATABASE_APP_URL out to use one role.");
    // One start at a time: two processes creating the role at once would make one of them fail.
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtext('c2r.app_role'))");
    const found = await c.query<{ rolsuper: boolean; rolbypassrls: boolean }>("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1", [name]);
    if (!found.rowCount) {
      try {
        await c.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${escapeLiteral(scramVerifier(password))}`);
      } catch (e) {
        throw new Error(
          `The database role "${name}" named in DATABASE_APP_URL does not exist and the owner could not create it. ` +
            "Create it by hand (docs/guide/admin.md, \"Two database roles\") or give the owner the CREATEROLE right.",
          { cause: e }
        );
      }
    } else if (found.rows[0].rolsuper || found.rows[0].rolbypassrls) {
      throw new Error(`The database role "${name}" named in DATABASE_APP_URL is a superuser or may bypass row-level security. Use a plain role.`);
    }
    const owns = await c.query<{ t: string }>(
      "SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = $1) LIMIT 1",
      [name]
    );
    if (owns.rowCount) throw new Error(`The database role "${name}" named in DATABASE_APP_URL owns the table ${owns.rows[0].t}. The request role must own nothing.`);

    const db = escapeIdentifier((await c.query<{ d: string }>("SELECT current_database() AS d")).rows[0].d);
    const schema = escapeIdentifier((await c.query<{ s: string }>("SELECT current_schema() AS s")).rows[0].s);
    await c.query(`GRANT CONNECT ON DATABASE ${db} TO ${role}`);
    await c.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`);
    await c.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`);
    const present = async (t: string) => (await c.query("SELECT to_regclass($1) IS NOT NULL AS ok", [`${schema}.${escapeIdentifier(t)}`])).rows[0].ok as boolean;
    for (const t of WITHHELD) if (await present(t)) await c.query(`REVOKE ALL ON ${schema}.${escapeIdentifier(t)} FROM ${role}`);
    for (const t of APPEND_ONLY) if (await present(t)) await c.query(`REVOKE UPDATE, DELETE, TRUNCATE ON ${schema}.${escapeIdentifier(t)} FROM ${role}`);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
