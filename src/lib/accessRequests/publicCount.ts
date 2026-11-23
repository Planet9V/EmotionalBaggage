/**
 * The public count of early-access places, for GET /api/access-requests/count: only { left, limit, full }, read from
 * the database at most once every few seconds however many visitors ask, and limited per network address in this
 * process's memory (the address is never written down), as the funnel events are (src/lib/events/store.ts).
 */
import { earlyAccessCount } from "./places";
import { publicPlaces, type PublicPlaces } from "./shared";

/** How long one reading of the count is served before the database is asked again. */
export const COUNT_CACHE_MS = 5_000;

let cached: { value: PublicPlaces; at: number } | null = null;

/** The count, from the cache while it is younger than COUNT_CACHE_MS. Throws when the database cannot be read. */
export async function cachedPlaces(now = Date.now()): Promise<PublicPlaces> {
  if (cached && now - cached.at < COUNT_CACHE_MS) return cached.value;
  const value = publicPlaces(await earlyAccessCount());
  cached = { value, at: now };
  return value;
}

/** A place was claimed in this process: the next reading goes to the database. */
export function forgetCachedPlaces(): void {
  cached = null;
}

const WINDOW_MS = 10 * 60 * 1000;
/** A page asks once on load at most and again when its tab comes back into view; 120 in ten minutes is far past that. */
export const COUNT_READS_PER_WINDOW = 120;
const MAX_TRACKED_ADDRESSES = 5000;
const windows = new Map<string, { start: number; n: number }>();

/** Counts one reading for this address; the seconds to wait when it is over the limit, else 0. */
export function countReadWait(client: string, now = Date.now()): number {
  const w = windows.get(client);
  if (!w || now - w.start >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED_ADDRESSES) for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k);
    if (windows.size >= MAX_TRACKED_ADDRESSES) windows.clear();
    windows.set(client, { start: now, n: 1 });
    return 0;
  }
  w.n += 1;
  return w.n <= COUNT_READS_PER_WINDOW ? 0 : Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000));
}
