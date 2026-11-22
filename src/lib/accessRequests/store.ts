/**
 * Access requests, on the server: storing one from the welcome page, listing them for Admin, setting a
 * status, and the CSV copy. Every write is recorded in the audit log. The audit line names the request by
 * its number only: the log is kept for ever and cannot be edited, so a person's name and email stay out of it.
 */
import { audit, auditIn, q, tx } from "@/lib/db";
import { toCsvText } from "@/lib/csv";
import { HttpError, notFound } from "@/lib/api/route";
import { ACCESS_LEVEL_LABEL, ACCESS_STATUS_LABEL, type AccessLevel, type AccessRequestRow, type AccessRequestValues, type AccessStatus } from "./shared";

type Row = { id: string; created_at: Date; name: string; email: string; building: string; company: string; level: AccessLevel | ""; status: AccessStatus; status_changed_at: Date | null };

const toRow = (r: Row): AccessRequestRow => ({
  id: Number(r.id),
  createdAt: new Date(r.created_at).toISOString(),
  name: r.name,
  email: r.email,
  building: r.building,
  company: r.company,
  level: r.level,
  status: r.status,
  statusChangedAt: r.status_changed_at ? new Date(r.status_changed_at).toISOString() : null,
});

/** Stores one request. The audit line is written in the same transaction, so a request is never kept unrecorded. */
export async function createAccessRequest(v: Omit<AccessRequestValues, "website">): Promise<number> {
  return tx(async (c) => {
    const r = await c.query<{ id: string }>(
      "INSERT INTO access_requests (name, email, building, company, level) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [v.name, v.email.toLowerCase(), v.building, v.company, v.level ?? ""]
    );
    const id = Number(r.rows[0]!.id);
    await auditIn(c, { action: "access.requested", summary: `Access request ${id} was sent from the welcome page`, detail: { id, company: v.company ? true : false, level: v.level ?? "" }, actor: "" });
    return id;
  });
}

/** Records a request that was dropped by the honeypot or the rate limit. Nothing the visitor typed is kept. */
export function auditRefusedRequest(reason: "honeypot" | "rate-limited") {
  return audit({
    action: "access.refused",
    summary: reason === "honeypot" ? "An access request was dropped: the hidden field was filled in" : "An access request was refused: too many from one address",
    detail: { reason },
    actor: "",
  });
}

/** Every request, newest first. There is no paging: an install receives a handful, and the cap keeps a flood readable. */
export async function listAccessRequests(limit = 1000): Promise<AccessRequestRow[]> {
  const rows = await q<Row>("SELECT * FROM access_requests ORDER BY created_at DESC, id DESC LIMIT $1", [limit]);
  return rows.map(toRow);
}

/** Sets a request's status and records the change with before and after. Setting the same status again changes nothing. */
export async function setAccessStatus(id: number, status: AccessStatus): Promise<AccessRequestRow> {
  return tx(async (c) => {
    const cur = await c.query<Row>("SELECT * FROM access_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!cur.rows.length) throw notFound("That access request");
    const before = cur.rows[0]!.status;
    if (before === status) return toRow(cur.rows[0]!);
    const r = await c.query<Row>("UPDATE access_requests SET status = $2, status_changed_at = now() WHERE id = $1 RETURNING *", [id, status]);
    await auditIn(c, {
      action: "access.status",
      summary: `Access request ${id} marked ${ACCESS_STATUS_LABEL[status].toLowerCase()}`,
      detail: { id, before, after: status },
    });
    return toRow(r.rows[0]!);
  });
}

const CSV_HEADER = ["id", "received", "status", "level", "name", "email", "company", "building"] as const;

/** The requests as CSV, newest first. Taking a copy is recorded, with the number of rows only. */
export async function accessRequestsCsv(): Promise<{ text: string; rows: number }> {
  const rows = await listAccessRequests(100_000);
  const text = toCsvText([CSV_HEADER, ...rows.map((r) => [r.id, r.createdAt, r.status, r.level ? ACCESS_LEVEL_LABEL[r.level] : "", r.name, r.email, r.company, r.building])], { trailingNewline: true });
  await audit({ action: "access.exported", summary: `Access requests were downloaded as CSV (${rows.length} row${rows.length === 1 ? "" : "s"})`, detail: { rows: rows.length } });
  return { text, rows: rows.length };
}

/**
 * The published default password is public (anyone can sign in as demo/demo), so while the signed-in account
 * still uses it, names and emails are not shown. The owner changes the password in Account first.
 */
export function refuseWhileDefaultPassword(usingDefaultPassword: boolean) {
  if (usingDefaultPassword) {
    throw new HttpError(
      403,
      "Access requests hold people's names and emails, and this account still uses the published demo password, so anyone could read them. Change the password in Account, then open this tab again."
    );
  }
}
