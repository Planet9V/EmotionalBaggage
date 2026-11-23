/**
 * Funnel events, on the server: storing one (the public route POST /api/events, and the early-access route for a
 * sent form), the retention cleanup, and the Admin funnel report. In PostgreSQL only; nothing is sent anywhere.
 *
 * Not recorded at all: a browser that asks not to be tracked (DNT: 1 or Sec-GPC: 1), and known crawlers. Never
 * stored: a network address, the browser string, a name or an email (see ./shared.ts cleanDetail).
 */
import { audit, q } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { HttpError } from "@/lib/api/route";
import { cleanDetail, cleanPath, type EventDetail, type EventName, type FunnelCounts, type FunnelReport } from "./shared";

export const RETENTION_KEY = "events.retentionDays";
const DEFAULT_RETENTION_DAYS = 180;
export const MAX_RETENTION_DAYS = 3650;

/** Crawlers, link previewers, monitors and command-line clients: not visitors. An empty browser string counts as one. */
const CRAWLER = /bot|crawl|spider|slurp|scrap|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|go-http|java\/|okhttp|axios|node-fetch|postman/i;

export const isCrawler = (userAgent: string | null) => !userAgent || CRAWLER.test(userAgent);

/** The browser asked not to be tracked: Do Not Track or Global Privacy Control. */
export const optedOut = (req: Request) => req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1";

// ---------------------------------------------------------------------------------------------
// Rate limit: per network address, in this process's memory (the address is never written down). A page view sends
// a dozen events at most; 240 in ten minutes from one address is far past a person reading the page.

const WINDOW_MS = 10 * 60 * 1000;
export const EVENTS_PER_WINDOW = 240;
const MAX_TRACKED_ADDRESSES = 5000;
const windows = new Map<string, { start: number; n: number }>();

/** Counts one event for this address; false when it is over the limit. */
export function underLimit(client: string, now = Date.now()): boolean {
  const w = windows.get(client);
  if (!w || now - w.start >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED_ADDRESSES) for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k);
    if (windows.size >= MAX_TRACKED_ADDRESSES) windows.clear();
    windows.set(client, { start: now, n: 1 });
    return true;
  }
  w.n += 1;
  return w.n <= EVENTS_PER_WINDOW;
}

/** For tests: forget every address's count. */
export function resetEventLimits() {
  windows.clear();
}

// ---------------------------------------------------------------------------------------------
// Retention: there is no periodic job in the app, so the cleanup runs on a write, at most once an hour per process.

const CLEANUP_EVERY_MS = 60 * 60 * 1000;
let lastCleanup = 0;

const validDays = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_RETENTION_DAYS ? v : null);

async function retentionDays(): Promise<number> {
  return validDays(await getSetting<unknown>(RETENTION_KEY, null)) ?? DEFAULT_RETENTION_DAYS;
}

/** Deletes events older than the retention period. Answers how many went. */
export async function cleanupEvents(now = new Date()): Promise<number> {
  lastCleanup = now.getTime();
  const days = await retentionDays();
  const r = await q<{ n: number }>("WITH gone AS (DELETE FROM site_events WHERE at < $1::timestamptz - make_interval(days => $2) RETURNING 1) SELECT count(*)::int AS n FROM gone", [now, days]);
  return r[0]!.n;
}

/** Saves the retention period and deletes what is now older than it. */
export async function setRetentionDays(days: number): Promise<number> {
  if (validDays(days) === null) throw new HttpError(400, `Keep events from 1 to ${MAX_RETENTION_DAYS} days.`);
  const before = await retentionDays();
  await q("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [RETENTION_KEY, JSON.stringify(days)]);
  if (before !== days) {
    await audit({ action: "setting.changed", summary: `Funnel events are kept ${days} days (were ${before})`, detail: { key: RETENTION_KEY, before, after: days } });
  }
  await cleanupEvents();
  return days;
}

// ---------------------------------------------------------------------------------------------

export type StoredEvent = { event: EventName; path: string; section: string; visit: string; detail: EventDetail };

const hostOf = (req: Request) => {
  try {
    return (req.headers.get("host") ?? new URL(req.url).host).split(":")[0] ?? "";
  } catch {
    return "";
  }
};

/** Stores one event, cleaned. The caller has checked opt-out, crawler and rate limit. */
export async function storeEvent(e: StoredEvent, req: Request): Promise<void> {
  await q("INSERT INTO site_events (event, path, section, detail, visit) VALUES ($1, $2, $3, $4, $5)", [e.event, cleanPath(e.path), e.section.slice(0, 60), JSON.stringify(cleanDetail(e.detail, hostOf(req))), e.visit]);
  if (Date.now() - lastCleanup > CLEANUP_EVERY_MS) void cleanupEvents().catch(() => undefined);
}

/**
 * An event the server records itself (the early-access form's `form_submit`, which is also counted when it was sent
 * without script). Opt-out is respected; nothing here can fail the request that called it.
 */
export async function recordServerEvent(req: Request, e: { event: EventName; section?: string; visit?: string; detail?: EventDetail }): Promise<void> {
  if (optedOut(req)) return;
  try {
    await storeEvent({ event: e.event, path: "/welcome", section: e.section ?? "", visit: e.visit ?? "", detail: e.detail ?? {} }, req);
  } catch (err) {
    console.warn(`[events] not stored: ${(err as Error)?.message ?? "error"}`);
  }
}

// ---------------------------------------------------------------------------------------------
// The funnel report (Admin, Funnel). A visit is one visit id; a form sent without script has none and counts as a
// visit of its own that sent a form. Days are UTC days, by the visit's first event.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

type Agg = { visits: number; pricing: number; started: number; sent: number; claimed: number };
const counts = (r: Agg): FunnelCounts => ({ visits: r.visits, reachedPricing: r.pricing, startedForm: r.started, sentForm: r.sent, claimedPlace: r.claimed });

const VISITS_CTE = `WITH ev AS (
    SELECT id, at, event, section, detail, CASE WHEN visit <> '' THEN visit ELSE 'row:' || id END AS v
    FROM site_events WHERE at >= $1::date AND at < $2::date + 1
  ), visits AS (
    SELECT v, (min(at) AT TIME ZONE 'UTC')::date AS day,
      bool_or(event = 'page_view') AS viewed,
      bool_or(event = 'section_view' AND section = 'pricing') AS pricing,
      bool_or(event = 'form_start') AS started,
      bool_or(event = 'form_submit') AS sent,
      bool_or(event = 'form_submit' AND detail ->> 'outcome' = 'place') AS claimed,
      coalesce((array_agg(detail ->> 'referrer' ORDER BY at, id) FILTER (WHERE event = 'page_view'))[1], '') AS referrer,
      coalesce((array_agg(detail ->> 'utm_campaign' ORDER BY at, id) FILTER (WHERE event = 'page_view'))[1], '') AS campaign
    FROM ev GROUP BY v
  )`;
const SUMS = `count(*) FILTER (WHERE viewed)::int AS visits, count(*) FILTER (WHERE pricing)::int AS pricing, count(*) FILTER (WHERE started)::int AS started,
  count(*) FILTER (WHERE sent)::int AS sent, count(*) FILTER (WHERE claimed)::int AS claimed`;

export async function funnelReport(from: string, to: string): Promise<FunnelReport> {
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) throw new HttpError(400, "Give the range as two dates, YYYY-MM-DD.");
  if (from > to) throw new HttpError(400, "The first day must not be after the last.");
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_RANGE_DAYS) throw new HttpError(400, `Choose at most ${MAX_RANGE_DAYS} days.`);
  const [days, total, bySource, keep] = await Promise.all([
    q<Agg & { day: string }>(
      `${VISITS_CTE} SELECT to_char(d, 'YYYY-MM-DD') AS day, ${SUMS}
       FROM generate_series($1::date, $2::date, interval '1 day') d LEFT JOIN visits v ON v.day = d::date GROUP BY d ORDER BY d`,
      [from, to]
    ),
    q<Agg>(`${VISITS_CTE} SELECT ${SUMS} FROM visits`, [from, to]),
    q<Agg & { referrer: string; campaign: string }>(`${VISITS_CTE} SELECT referrer, campaign, ${SUMS} FROM visits GROUP BY referrer, campaign ORDER BY count(*) FILTER (WHERE viewed) DESC, referrer, campaign LIMIT 100`, [from, to]),
    retentionDays(),
  ]);
  return {
    from,
    to,
    retentionDays: keep,
    days: days.map((d) => ({ day: d.day, ...counts(d) })),
    total: counts(total[0]!),
    bySource: bySource.map((s) => ({ referrer: s.referrer, campaign: s.campaign, ...counts(s) })),
  };
}
