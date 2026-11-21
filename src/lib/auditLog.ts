// Reading the install-wide audit log (migrations/0005_audit_log.sql). Writing is `audit` and `logEvent` in db.ts.
import { z } from "zod";
import { q } from "@/lib/db";

export type AuditRow = {
  id: number;
  at: string;
  actor: string;
  projectId: string;
  projectName: string;
  action: string;
  summary: string;
  detail: Record<string, unknown>;
};

export const auditQuery = z.object({
  /** only lines for this concept id; works for a concept that has since been deleted */
  project: z.string().trim().max(200).optional(),
  /** only lines whose action starts with this, e.g. "project." or "credential." */
  action: z.string().trim().max(80).optional(),
  /** text to find in the summary, the concept name or the actor */
  q: z.string().trim().max(200).optional(),
  /** lines older than this id: pass the last id of the previous page */
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type AuditQuery = z.infer<typeof auditQuery>;

const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const COLS = `id::int AS id, at, actor, project_id AS "projectId", project_name AS "projectName", action, summary, detail`;

function where(f: Omit<AuditQuery, "limit">) {
  const cond: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    cond.push(sql.replaceAll("?", `$${args.length}`));
  };
  if (f.project) add("project_id = ?", f.project);
  if (f.action) add("action LIKE ?", `${f.action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (f.q) add("(summary ILIKE ? OR project_name ILIKE ? OR actor ILIKE ?)", like(f.q));
  if (f.before) add("id < ?", f.before);
  return { sql: cond.length ? `WHERE ${cond.join(" AND ")}` : "", args };
}

/** Newest first. `next` is the id to pass as `before` for the following page, or null at the end. */
export async function readAuditLog(f: AuditQuery): Promise<{ entries: AuditRow[]; next: number | null }> {
  const w = where(f);
  const rows = await q<AuditRow>(`SELECT ${COLS} FROM audit_log ${w.sql} ORDER BY id DESC LIMIT ${f.limit + 1}`, w.args);
  const more = rows.length > f.limit;
  const entries = more ? rows.slice(0, f.limit) : rows;
  return { entries, next: more ? entries[entries.length - 1].id : null };
}

/** The whole log, oldest first, one JSON object per line. */
export async function auditLogFile(f: Omit<AuditQuery, "limit" | "before">): Promise<string> {
  const w = where(f);
  const rows = await q<AuditRow>(`SELECT ${COLS} FROM audit_log ${w.sql} ORDER BY id`, w.args);
  return rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
}

/** Concepts that appear in the log, including deleted ones, for the filter. */
export async function auditConcepts(): Promise<{ id: string; name: string; exists: boolean }[]> {
  return q(
    `SELECT a.project_id AS id, (array_agg(a.project_name ORDER BY a.id DESC))[1] AS name, bool_or(p.id IS NOT NULL) AS exists
     FROM audit_log a LEFT JOIN projects p ON p.id = a.project_id
     WHERE a.project_id <> '' GROUP BY a.project_id ORDER BY 2`
  );
}
