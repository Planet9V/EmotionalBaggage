// Token buckets per operation, and backing off on HTTP 429. Amazon documents its limits as a token
// bucket ("rate" requests per second refilling a "burst" of tokens):
// https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits
// A request that would have to wait longer than the caller allows is refused with the wait in
// seconds, rather than holding the user's request open for minutes.
import { HttpError } from "@/lib/api/route";

export type Clock = { now(): number; sleep(ms: number): Promise<void> };

const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
let clock: Clock = realClock;

/** Tests replace the clock so waits are instant and measurable. */
export function setChannelClock(c: Clock | null) {
  clock = c ?? realClock;
}
export const channelClock = () => clock;

export class RateLimited extends HttpError {
  constructor(
    public waitSeconds: number,
    what: string
  ) {
    super(429, `${what} allows another call in about ${waitSeconds} seconds. Nothing more was fetched; try again then.`, { waitSeconds });
  }
}

export class TokenBucket {
  private tokens: number;
  private last: number;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    public readonly rate: number,
    public readonly burst: number
  ) {
    this.tokens = burst;
    this.last = clock.now();
  }

  private refill() {
    const now = clock.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
  }

  /** Milliseconds until a token is free (0 when one is free now). */
  waitMs(): number {
    this.refill();
    return this.tokens >= 1 ? 0 : Math.ceil(((1 - this.tokens) / this.rate) * 1000);
  }

  /** Takes one token, waiting up to maxWaitMs for it; refuses with RateLimited beyond that. Calls are served in order. */
  take(what: string, maxWaitMs: number): Promise<void> {
    const run = async () => {
      const wait = this.waitMs();
      if (wait > maxWaitMs) throw new RateLimited(Math.ceil(wait / 1000), what);
      if (wait > 0) await clock.sleep(wait);
      this.refill();
      this.tokens = Math.max(0, this.tokens - 1);
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** After a 429 the service's own count says the bucket is empty. */
  drain() {
    this.refill();
    this.tokens = 0;
  }
}

/** Seconds to wait after a 429: Retry-After when given, else 1, 2, 4 ... seconds. */
export function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter && /^\d+$/.test(retryAfter.trim())) return Number(retryAfter.trim()) * 1000;
  return 1000 * 2 ** attempt;
}

/**
 * Calls `send` through the bucket. On 429 it waits (backoffMs) and tries again,
 * up to `retries` times, never waiting past maxWaitMs in total. Any other answer is returned.
 */
export async function limited(bucket: TokenBucket, what: string, send: () => Promise<Response>, opts: { retries?: number; maxWaitMs?: number } = {}): Promise<Response> {
  const retries = opts.retries ?? 3;
  const maxWaitMs = opts.maxWaitMs ?? 20_000;
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    await bucket.take(what, Math.max(0, maxWaitMs - waited));
    const res = await send();
    if (res.status !== 429 || attempt >= retries) return res;
    // Not drained to zero: Amazon's own bucket can differ from ours, and its slowest rates would turn
    // one 429 into a three-minute wait. The backoff below spaces the retries instead.
    const wait = backoffMs(attempt, res.headers.get("retry-after"));
    if (waited + wait > maxWaitMs) return res;
    waited += wait;
    await res.body?.cancel().catch(() => undefined);
    await clock.sleep(wait);
  }
}
