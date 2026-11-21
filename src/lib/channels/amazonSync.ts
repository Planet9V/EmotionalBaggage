// "Sync now" for the Amazon sales monitor (plan 8.17). Reads orders updated since the last complete sync
// (30 days the first time), writes one sales monitor row per order (one row per order id: the unique
// index of migration 0021 turns a repeat into an update), and keeps Amazon's own daily totals for
// comparison. Read only: nothing is sent to Amazon but GET requests.
//
// Background sync: decided against for now. The app runs as one Next.js server in one container, so an
// in-process timer would work, but it would also start in `next dev`, in every test process and in a
// build worker, and it would call Amazon with nobody watching the result. "Sync now" with the last sync
// time on the screen (and a note when it is more than a day old) keeps every call one a person asked for.
import { plainMessage } from "@/lib/net/plain";
import { HttpError } from "@/lib/api/route";
import { currentActor } from "@/lib/actor";
import { logEventIn, tx } from "@/lib/db";
import { marketplace, orderMetricsByDay, searchOrders, type CleanOrder } from "./amazon";
import { CHANNEL } from "./schemas";
import { RateLimited, channelClock } from "./rateLimit";
import { amazonState, saveAmazonState } from "./state";

const FIRST_SYNC_DAYS = 30;
/** Overlap with the previous sync, so an order updated while it ran is read again. */
const OVERLAP_MS = 10 * 60_000;
/** At most this many pages in one press of the button. */
const MAX_PAGES = 25;
const CANCELLED = new Set(["CANCELLED", "CANCELED"]);

/** The sales monitor row for one order: what the monitor and campaign results read, nothing about the buyer. */
function orderRow(o: CleanOrder) {
  const cancelled = CANCELLED.has(o.status.toUpperCase());
  const units = cancelled ? 0 : o.items.reduce((a, i) => a + i.quantity, 0);
  const revenue = cancelled ? 0 : Math.round(o.items.reduce((a, i) => a + i.amount, 0) * 100) / 100;
  const date = (o.createdTime || o.lastUpdatedTime).slice(0, 10);
  return {
    title: `${date} Amazon order ${o.orderId}`,
    data: {
      date,
      channel: "Amazon",
      units,
      revenue,
      currency: o.currency,
      externalId: `amazon:${o.orderId}`,
      orderId: o.orderId,
      marketplaceId: o.marketplaceId,
      orderStatus: o.status,
      items: o.items,
      source: "sp-api" as const,
    },
  };
}

export type SyncResult = {
  ok: boolean;
  added: number;
  updated: number;
  unchanged: number;
  pages: number;
  /** true when Amazon's rate limit stopped the sync before the last page */
  partial: boolean;
  waitSeconds: number | null;
  metricsDays: number;
  metricsError: string | null;
  lastSyncAt: string;
  message: string;
};

/** Writes the orders as rows. Exported for tests. */
async function upsertOrders(projectId: string, orders: CleanOrder[]) {
  let added = 0;
  let updated = 0;
  await tx(async (c) => {
    for (const o of orders) {
      const r = orderRow(o);
      const res = await c.query<{ inserted: boolean }>(
        `INSERT INTO items (project_id, section, title, body, data, status, sort)
         VALUES ($1, $2, $3, '', $4, 'done', (SELECT COALESCE(MAX(sort),0)+1 FROM items WHERE project_id=$1))
         ON CONFLICT (project_id, section, (data->>'externalId')) WHERE data ? 'externalId'
         DO UPDATE SET title = EXCLUDED.title, data = EXCLUDED.data, updated_at = now()
         WHERE items.data IS DISTINCT FROM EXCLUDED.data
         RETURNING (xmax = 0) AS inserted`,
        [projectId, CHANNEL.monitor, r.title, JSON.stringify(r.data)]
      );
      if (res.rows[0]?.inserted) added++;
      else if (res.rows[0]) updated++;
    }
  });
  return { added, updated, unchanged: orders.length - added - updated };
}

export async function syncAmazon(projectId: string, opts: { marketplaceId?: string; maxWaitMs?: number } = {}): Promise<SyncResult> {
  const state = await amazonState(projectId);
  const marketplaceId = opts.marketplaceId ?? state.marketplaceId;
  if (!marketplaceId || !marketplace(marketplaceId)) throw new HttpError(400, "Pick the Amazon marketplace to read first.");
  const startedAt = new Date(channelClock().now());
  const since = state.cursor && state.marketplaceId === marketplaceId ? new Date(new Date(state.cursor).getTime() - OVERLAP_MS) : new Date(startedAt.getTime() - FIRST_SYNC_DAYS * 86_400_000);

  const orders: CleanOrder[] = [];
  let pages = 0;
  let partial = false;
  let waitSeconds: number | null = null;
  let token: string | undefined;
  try {
    do {
      const page = await searchOrders({ marketplaceId, lastUpdatedAfter: since.toISOString(), paginationToken: token, maxWaitMs: opts.maxWaitMs });
      pages++;
      orders.push(...page.orders.filter((o) => !o.marketplaceId || o.marketplaceId === marketplaceId));
      token = page.nextToken ?? undefined;
    } while (token && pages < MAX_PAGES);
    if (token) partial = true;
  } catch (e) {
    if (!(e instanceof RateLimited) || pages === 0) {
      await recordFailure(projectId, state, marketplaceId, e);
      throw e;
    }
    partial = true;
    waitSeconds = e.waitSeconds;
  }

  let metrics = state.marketplaceId === marketplaceId ? state.metrics : [];
  let metricsError: string | null = null;
  try {
    metrics = await orderMetricsByDay({ marketplaceId, days: FIRST_SYNC_DAYS, maxWaitMs: opts.maxWaitMs });
  } catch (e) {
    metricsError = plainMessage(e);
  }

  const counts = await upsertOrders(projectId, orders);
  const at = new Date(channelClock().now()).toISOString();
  const message = partial
    ? `Read ${orders.length} orders on ${pages} pages before Amazon's rate limit stopped the sync${waitSeconds ? ` (next call allowed in about ${waitSeconds} seconds)` : ""}. Press Sync now again to read the rest.`
    : `Read ${orders.length} orders: ${counts.added} new, ${counts.updated} changed, ${counts.unchanged} already up to date.`;
  await saveAmazonState(projectId, {
    marketplaceId,
    // Only a sync that read every page moves the cursor on; a partial one is read again from the same point.
    cursor: partial ? (state.marketplaceId === marketplaceId ? state.cursor : null) : startedAt.toISOString(),
    lastSyncAt: at,
    lastResult: { ok: true, message, at },
    metrics,
  });
  await tx((c) =>
    logEventIn(c, projectId, "channel.amazon.sync", `Amazon sales synced: ${message}`, {
      marketplaceId,
      since: since.toISOString(),
      pages,
      ...counts,
      partial,
      metricsDays: metrics.length,
      metricsError,
      by: currentActor(),
    })
  );
  return { ok: true, ...counts, pages, partial, waitSeconds, metricsDays: metrics.length, metricsError, lastSyncAt: at, message };
}

async function recordFailure(projectId: string, state: Awaited<ReturnType<typeof amazonState>>, marketplaceId: string, e: unknown) {
  const message = plainMessage(e);
  const at = new Date(channelClock().now()).toISOString();
  await saveAmazonState(projectId, { ...state, marketplaceId, lastResult: { ok: false, message, at } });
  await tx((c) => logEventIn(c, projectId, "channel.amazon.sync.failed", `Amazon sync failed: ${message}`, { marketplaceId }));
}
