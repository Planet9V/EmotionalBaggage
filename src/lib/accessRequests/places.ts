/**
 * Early-access places, on the server (owner, 22 Nov: "limit early access to 50 only").
 *
 * The rule: a request HOLDS A PLACE when it has a place number and its status is not "declined". New and
 * contacted requests keep their place; declining one frees it. The places left are the limit (the setting
 * earlyAccess.limit, default 50) less the places held, never below 0. A request that is not declined and has no
 * place number is ON THE WAITING LIST; its position is its rank among those, oldest first.
 *
 * Every change to who holds a place (a claim, a status change, a deletion, a new limit) runs inside one transaction
 * that first takes the transaction-level advisory lock EARLY_ACCESS_LOCK, so two claims at the same moment are
 * counted one after the other and exactly `limit` get a place. A place freed while people wait goes to the first
 * on the waiting list at once (fillPlaces), so nobody who arrives later overtakes someone waiting.
 */
import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { auditIn, q, tx } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { HttpError } from "@/lib/api/route";
import type { AccessRequestParsed, EarlyAccessCount, EarlyAccessOutcome } from "./shared";

/** The settings row that holds the number of early-access places. */
export const EARLY_ACCESS_LIMIT_KEY = "earlyAccess.limit";
export const DEFAULT_EARLY_ACCESS_LIMIT = 50;
export const MAX_EARLY_ACCESS_LIMIT = 100_000;
/** Any fixed number: the key of the advisory lock every place change takes. */
const EARLY_ACCESS_LOCK = 4_212_025_022;
/** How long the confirmation step may add name, company and level. */
const DETAILS_TOKEN_MS = 24 * 60 * 60 * 1000;

const lock = (c: PoolClient) => c.query("SELECT pg_advisory_xact_lock($1)", [EARLY_ACCESS_LOCK]);
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const validLimit = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_EARLY_ACCESS_LIMIT ? v : null);

/** The limit in force: the saved setting, or 50. */
export async function earlyAccessLimit(): Promise<number> {
  return validLimit(await getSetting<unknown>(EARLY_ACCESS_LIMIT_KEY, null)) ?? DEFAULT_EARLY_ACCESS_LIMIT;
}

async function limitIn(c: PoolClient): Promise<number> {
  const r = await c.query<{ value: unknown }>("SELECT value FROM settings WHERE key = $1", [EARLY_ACCESS_LIMIT_KEY]);
  return validLimit(r.rows[0]?.value) ?? DEFAULT_EARLY_ACCESS_LIMIT;
}

const COUNT_SQL = `SELECT count(*) FILTER (WHERE place IS NOT NULL AND status <> 'declined')::int AS held,
                          count(*) FILTER (WHERE place IS NULL AND status <> 'declined')::int AS waiting
                   FROM access_requests`;

/** The count line: limit, places held, places left and the length of the waiting list. */
export async function earlyAccessCount(): Promise<EarlyAccessCount> {
  const [limit, rows] = await Promise.all([earlyAccessLimit(), q<{ held: number; waiting: number }>(COUNT_SQL)]);
  const { held, waiting } = rows[0]!;
  return { limit, held, waiting, left: Math.max(0, limit - held) };
}

/** The lowest place number no held request has. Numbers freed by a decline are given again. */
async function freeNumber(c: PoolClient): Promise<number> {
  const r = await c.query<{ n: number }>(
    `SELECT min(n)::int AS n FROM generate_series(1, (SELECT count(*) + 1 FROM access_requests WHERE place IS NOT NULL AND status <> 'declined')) n
     WHERE NOT EXISTS (SELECT 1 FROM access_requests WHERE place = n AND status <> 'declined')`
  );
  return r.rows[0]!.n;
}

/**
 * Gives free places to the waiting list, oldest first, until the limit is reached or nobody waits. Called under the
 * lock after anything that may free a place or raise the limit. Answers the ids that got a place.
 */
async function fillPlaces(c: PoolClient): Promise<number[]> {
  const limit = await limitIn(c);
  const promoted: number[] = [];
  for (;;) {
    const { held } = (await c.query<{ held: number }>(COUNT_SQL)).rows[0]!;
    if (held >= limit) break;
    const next = await c.query<{ id: string }>("SELECT id FROM access_requests WHERE place IS NULL AND status <> 'declined' ORDER BY id LIMIT 1");
    if (!next.rows.length) break;
    const id = Number(next.rows[0]!.id);
    await c.query("UPDATE access_requests SET place = $2 WHERE id = $1", [id, await freeNumber(c)]);
    promoted.push(id);
  }
  if (promoted.length) {
    await auditIn(c, { action: "access.promoted", summary: `Early access: ${promoted.length} request${promoted.length === 1 ? "" : "s"} moved from the waiting list to a place (${promoted.join(", ")})`, detail: { ids: promoted } });
  }
  return promoted;
}

/** Runs `fn` under the early-access lock, then hands any freed places to the waiting list, in one transaction. */
export function withPlaces<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  return tx(async (c) => {
    await lock(c);
    const out = await fn(c);
    await fillPlaces(c);
    return out;
  });
}

async function positionOf(c: PoolClient, id: number): Promise<number> {
  const r = await c.query<{ n: number }>("SELECT count(*)::int AS n FROM access_requests WHERE place IS NULL AND status <> 'declined' AND id <= $1", [id]);
  return r.rows[0]!.n;
}

export type ClaimResult = { outcome: EarlyAccessOutcome; id: number | null; token: string | null };

/**
 * Stores one early-access request and gives it a place or a place on the waiting list, in one transaction under
 * the lock. An address already on the list (any status, compared without case) gets no second place and nothing
 * is stored: the answer is "listed", which says only that the address is on the list. The audit line names the
 * request by its number only.
 */
export async function claimEarlyAccess(v: Omit<AccessRequestParsed, "website" | "visit">, now = new Date()): Promise<ClaimResult> {
  const email = v.email.toLowerCase();
  return tx(async (c) => {
    await lock(c);
    const dup = await c.query("SELECT 1 FROM access_requests WHERE lower(email) = $1 LIMIT 1", [email]);
    if (dup.rows.length) return { outcome: { kind: "listed" }, id: null, token: null };
    const limit = await limitIn(c);
    const counts = (await c.query<{ held: number; waiting: number }>(COUNT_SQL)).rows[0]!;
    const place = counts.held < limit && counts.waiting === 0 ? await freeNumber(c) : null;
    const token = randomBytes(24).toString("base64url");
    const r = await c.query<{ id: string }>(
      `INSERT INTO access_requests (name, email, building, company, level, placement, place, details_token_hash, details_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [v.name, email, v.building, v.company, v.level, v.placement, place, hashToken(token), new Date(now.getTime() + DETAILS_TOKEN_MS)]
    );
    const id = Number(r.rows[0]!.id);
    const outcome: EarlyAccessOutcome = place !== null ? { kind: "place", place } : { kind: "waiting", position: await positionOf(c, id) };
    await auditIn(c, {
      action: "access.requested",
      summary: place !== null ? `Access request ${id} was sent from the welcome page and holds early-access place ${place}` : `Access request ${id} was sent from the welcome page and is on the waiting list`,
      detail: { id, company: v.company ? true : false, level: v.level, placement: v.placement, place, waiting: place === null },
      actor: "",
    });
    return { outcome, id, token };
  });
}

/** The request a confirmation token belongs to, while the token is valid. */
async function byToken(c: PoolClient | null, token: string, now: Date): Promise<number | null> {
  const sql = "SELECT id FROM access_requests WHERE details_token_hash = $1 AND details_token_expires > $2";
  const rows = c ? (await c.query<{ id: string }>(sql, [hashToken(token), now])).rows : await q<{ id: string }>(sql, [hashToken(token), now]);
  return rows[0] ? Number(rows[0].id) : null;
}

const EXPIRED = "This confirmation has expired. Your request is kept; send the form again to add the details.";

/** Where the request this token belongs to stands now (for the confirmation page), or null for an unknown or old token. */
export async function outcomeByToken(token: string, now = new Date()): Promise<EarlyAccessOutcome | null> {
  const id = await byToken(null, token, now);
  if (id === null) return null;
  const rows = await q<{ place: number | null; status: string }>("SELECT place, status FROM access_requests WHERE id = $1", [id]);
  const r = rows[0];
  if (!r || r.status === "declined") return { kind: "listed" };
  if (r.place !== null) return { kind: "place", place: r.place };
  const pos = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests WHERE place IS NULL AND status <> 'declined' AND id <= $1", [id]);
  return { kind: "waiting", position: pos[0]!.n };
}

/**
 * The confirmation step: adds name, company and plan to the request the token belongs to. Only these three fields;
 * a blank one leaves what is stored. Recorded by number and by which fields were given, never their values.
 */
export async function addRequestDetails(token: string, d: { name: string; company: string; level: string }, now = new Date()): Promise<number> {
  return tx(async (c) => {
    const id = await byToken(c, token, now);
    if (id === null) throw new HttpError(410, EXPIRED);
    await c.query(
      `UPDATE access_requests SET name = CASE WHEN $2 = '' THEN name ELSE $2 END, company = CASE WHEN $3 = '' THEN company ELSE $3 END,
              level = CASE WHEN $4 = '' THEN level ELSE $4 END WHERE id = $1`,
      [id, d.name, d.company, d.level]
    );
    const fields = (["name", "company", "level"] as const).filter((k) => d[k] !== "");
    await auditIn(c, { action: "access.details", summary: `Access request ${id}: details added on the confirmation step (${fields.join(", ") || "none"})`, detail: { id, fields }, actor: "" });
    return id;
  });
}

/** Saves the number of places and records before and after. A higher limit gives free places to the waiting list at once. */
export async function setEarlyAccessLimit(limit: number): Promise<EarlyAccessCount> {
  if (validLimit(limit) === null) throw new HttpError(400, `The number of places must be a whole number from 0 to ${MAX_EARLY_ACCESS_LIMIT}.`);
  await withPlaces(async (c) => {
    const before = await limitIn(c);
    if (before === limit) return;
    await c.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [EARLY_ACCESS_LIMIT_KEY, JSON.stringify(limit)]);
    await auditIn(c, { action: "setting.changed", summary: `Early-access places set to ${limit} (were ${before})`, detail: { key: EARLY_ACCESS_LIMIT_KEY, before, after: limit } });
  });
  return earlyAccessCount();
}
