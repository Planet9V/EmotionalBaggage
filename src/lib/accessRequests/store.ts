/**
 * Access requests, on the server: storing one from the welcome page, listing them for Admin, setting a
 * status, and the CSV copy. Every write is recorded in the audit log. The audit line names the request by
 * its number only: the log is kept for ever and cannot be edited, so a person's name and email stay out of it.
 */
import { audit, auditIn, q } from "@/lib/db";
import { ATTEMPT_RESET_MS } from "@/lib/auth";
import { toCsvText } from "@/lib/csv";
import { HttpError, notFound } from "@/lib/api/route";
import { ACCESS_STATUS_LABEL, STORED_LEVEL_LABEL, type AccessRequestRow, type AccessStatus, type Placement, type StoredLevel } from "./shared";
import { withPlaces } from "./places";

type Row = {
  id: string;
  created_at: Date;
  name: string;
  email: string;
  building: string;
  company: string;
  level: StoredLevel | "";
  status: AccessStatus;
  status_changed_at: Date | null;
  place: number | null;
  placement: Placement | "";
  waiting_position?: string | null;
};

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
  place: r.place,
  waitingPosition: r.waiting_position ? Number(r.waiting_position) : null,
  placement: r.placement,
});

/** The columns Admin reads, with the waiting-list position worked out (rank among waiting requests not declined, oldest first). */
const SELECT_ROWS = `SELECT a.id, a.created_at, a.name, a.email, a.building, a.company, a.level, a.status, a.status_changed_at, a.place, a.placement,
  CASE WHEN a.place IS NULL AND a.status <> 'declined' THEN (SELECT count(*) FROM access_requests w WHERE w.place IS NULL AND w.status <> 'declined' AND w.id <= a.id) END AS waiting_position
  FROM access_requests a`;

/** Why a try was not stored: the hidden field was filled, the address is waiting, or the same request was already kept. */
export type RefusalReason = "honeypot" | "rate-limited" | "duplicate";

const REFUSAL_SUMMARY: Record<RefusalReason, string> = {
  honeypot: "An access request was dropped: the hidden field was filled in",
  "rate-limited": "An access request was refused: too many from one address",
  duplicate: "An access request was dropped: the same request was already kept",
};

/**
 * Counts one try that was not stored, per reason and network address, forgotten after an hour with none (the same
 * window as the form's own throttle). The count lives with the throttle's rows in `sign_in_attempts`, under a key
 * that starts with a space, so no username can share it. Answers the count in this window.
 */
async function countRefusal(reason: RefusalReason, client: string, now: Date): Promise<number> {
  const rows = await q<{ failures: number }>(
    `INSERT INTO sign_in_attempts AS a (username_key, client, failures, last_attempt_at, next_allowed_at)
     VALUES ($1, $2, 1, $3::timestamptz, $3::timestamptz)
     ON CONFLICT (username_key, client) DO UPDATE SET
       failures = CASE WHEN a.last_attempt_at <= $4::timestamptz THEN 1 ELSE a.failures + 1 END,
       last_attempt_at = $3::timestamptz,
       next_allowed_at = $3::timestamptz
     RETURNING failures`,
    [` access-refused ${reason}`, (client || "unknown").slice(0, 100), now, new Date(now.getTime() - ATTEMPT_RESET_MS)]
  );
  return rows[0]!.failures;
}

/**
 * Records a try that was dropped by the honeypot, the rate limit or as a repeat. Nothing the visitor typed and no
 * address is kept. The log is written to, not edited, so a flood is not one line per try: a line is written at
 * the 1st, 2nd, 4th, 8th ... try from one address in a window, and says how many there have been.
 */
export async function auditRefusedRequest(reason: RefusalReason, client: string, now = new Date()) {
  const count = await countRefusal(reason, client, now);
  if (count & (count - 1)) return;
  await audit({ action: "access.refused", summary: count === 1 ? REFUSAL_SUMMARY[reason] : `${REFUSAL_SUMMARY[reason]} (${count} so far from this address)`, detail: { reason, count }, actor: "" });
}

/** Every request, newest first. There is no paging: an install receives a handful, and the cap keeps a flood readable. */
export async function listAccessRequests(limit = 1000): Promise<AccessRequestRow[]> {
  const rows = await q<Row>(`${SELECT_ROWS} ORDER BY a.created_at DESC, a.id DESC LIMIT $1`, [limit]);
  return rows.map(toRow);
}

/**
 * Sets a request's status and records the change with before and after. Setting the same status again changes
 * nothing. Under the early-access lock (./places.ts): declining frees the request's place, which goes to the first
 * on the waiting list; a declined request taken back keeps its old number only while nobody holds it and the limit
 * allows, otherwise it joins the waiting list (in the order it first came).
 */
export async function setAccessStatus(id: number, status: AccessStatus): Promise<AccessRequestRow> {
  await withPlaces(async (c) => {
    const cur = await c.query<Row>("SELECT * FROM access_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!cur.rows.length) throw notFound("That access request");
    const before = cur.rows[0]!.status;
    if (before === status) return;
    if (before === "declined" && cur.rows[0]!.place !== null) {
      // its number may have been given again meanwhile; then it waits (fillPlaces gives it a place if one is free)
      const taken = await c.query("SELECT 1 FROM access_requests WHERE place = $1 AND status <> 'declined' AND id <> $2", [cur.rows[0]!.place, id]);
      if (taken.rows.length) await c.query("UPDATE access_requests SET place = NULL WHERE id = $1", [id]);
    }
    await c.query("UPDATE access_requests SET status = $2, status_changed_at = now() WHERE id = $1", [id, status]);
    await auditIn(c, {
      action: "access.status",
      summary: `Access request ${id} marked ${ACCESS_STATUS_LABEL[status].toLowerCase()}`,
      detail: { id, before, after: status },
    });
  });
  const rows = await q<Row>(`${SELECT_ROWS} WHERE a.id = $1`, [id]);
  return toRow(rows[0]!);
}

/** Deletes a request and records it, by its number and status only: the log keeps no name or email. A place it held goes to the waiting list. */
export async function deleteAccessRequest(id: number): Promise<void> {
  await withPlaces(async (c) => {
    const r = await c.query<{ status: AccessStatus }>("DELETE FROM access_requests WHERE id = $1 RETURNING status", [id]);
    if (!r.rows.length) throw notFound("That access request");
    await auditIn(c, { action: "access.deleted", summary: `Access request ${id} was deleted`, detail: { id, status: r.rows[0]!.status } });
  });
}

const CSV_HEADER = ["id", "received", "status", "place", "waiting", "level", "name", "email", "company", "building", "placement"] as const;

/** The requests as CSV, newest first. Taking a copy is recorded, with the number of rows only. */
export async function accessRequestsCsv(): Promise<{ text: string; rows: number }> {
  const rows = await listAccessRequests(100_000);
  const text = toCsvText([CSV_HEADER, ...rows.map((r) => [r.id, r.createdAt, r.status, r.place ?? "", r.waitingPosition ?? "", r.level ? STORED_LEVEL_LABEL[r.level] : "", r.name, r.email, r.company, r.building, r.placement])], { trailingNewline: true });
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
