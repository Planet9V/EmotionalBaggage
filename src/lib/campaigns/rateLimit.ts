// A fixed-window limit for the open short-link route. It counts requests by link code and in all,
// never by who sent them: no address, no user agent and nothing else about the visitor is read or
// kept. The cost is that one visitor can use up a link's allowance for everyone for the rest of the
// minute; the allowance is set well above what a real campaign link receives (see LIMITS).
// The counters live in this process's memory. Several app instances each keep their own, so the
// effective limit is the number of instances times these figures.

export const LIMITS = {
  /** per code per window */
  perCode: 120,
  /** all codes together per window */
  total: 1200,
  /** requests for codes that do not exist, per window: stops a search for valid codes */
  unknown: 30,
  windowMs: 60_000,
} as const;

type Bucket = { start: number; count: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private limits: { perCode: number; total: number; unknown: number; windowMs: number } = LIMITS,
    private now: () => number = Date.now
  ) {}

  private hit(key: string, max: number): { ok: boolean; retryAfter: number } {
    const t = this.now();
    let b = this.buckets.get(key);
    if (!b || t - b.start >= this.limits.windowMs) {
      b = { start: t, count: 0 };
      this.buckets.set(key, b);
    }
    if (b.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.start + this.limits.windowMs - t) / 1000)) };
    b.count++;
    return { ok: true, retryAfter: 0 };
  }

  /** Counts one request for a code against the code's allowance and the total. */
  allow(code: string): { ok: boolean; retryAfter: number } {
    this.sweep();
    const all = this.hit("*", this.limits.total);
    if (!all.ok) return all;
    return this.hit(`c:${code}`, this.limits.perCode);
  }

  /** Counts a request for a code that does not exist. */
  allowUnknown(): { ok: boolean; retryAfter: number } {
    this.sweep();
    return this.hit("unknown", this.limits.unknown);
  }

  /** Forgets every count. For tests. */
  reset() {
    this.buckets.clear();
  }

  private sweep() {
    if (this.buckets.size < 2000) return;
    const t = this.now();
    for (const [k, b] of this.buckets) if (t - b.start >= this.limits.windowMs) this.buckets.delete(k);
  }
}

const g = globalThis as unknown as { __c2rLinkLimiter?: RateLimiter };
/** The process-wide limiter the route uses. */
export const limiter = () => (g.__c2rLinkLimiter ??= new RateLimiter());
