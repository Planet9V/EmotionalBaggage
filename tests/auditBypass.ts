// Tests that need to clear or age audit lines (the log is append-only for the app, migration 0026) do it through
// a superuser session with triggers off, for that one transaction. Never used by app code.
import { pool } from "@/lib/db";

export async function rewriteAuditLog(sql: string, args: unknown[] = []): Promise<void> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL session_replication_role = replica");
    await c.query(sql, args);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
