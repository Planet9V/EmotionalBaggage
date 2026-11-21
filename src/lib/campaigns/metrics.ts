// The figures worked out from what a campaign spent and got. Pure: counts in, figures out.
//
// Money is whole minor units (cents), as everywhere else. A figure that cannot be worked out because
// its divisor is zero is `null`, never 0 and never Infinity: "no clicks yet" is not "a click costs
// nothing". The screens say "not worked out" in words for a null.

export type Counts = { spend: number; impressions: number; clicks: number; orders: number; revenue: number };

export const NO_COUNTS: Counts = { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };

const addCounts = (a: Counts, b: Counts): Counts => ({
  spend: a.spend + b.spend,
  impressions: a.impressions + b.impressions,
  clicks: a.clicks + b.clicks,
  orders: a.orders + b.orders,
  revenue: a.revenue + b.revenue,
});

export const sumCounts = (list: Counts[]): Counts => list.reduce(addCounts, NO_COUNTS);

export type Derived = {
  /** clicks / impressions, as a fraction (0.02 is 2%) */
  ctr: number | null;
  /** spend / clicks, minor units */
  cpc: number | null;
  /** orders / clicks, as a fraction */
  cvr: number | null;
  /** spend / orders, minor units */
  cpo: number | null;
  /** revenue / spend */
  roas: number | null;
};

const ratio = (top: number, bottom: number) => (bottom > 0 && Number.isFinite(top) && Number.isFinite(bottom) ? top / bottom : null);

export function derive(c: Counts): Derived {
  return {
    ctr: ratio(c.clicks, c.impressions),
    cpc: ratio(c.spend, c.clicks),
    cvr: ratio(c.orders, c.clicks),
    cpo: ratio(c.spend, c.orders),
    roas: ratio(c.revenue, c.spend),
  };
}

export type MarginAfterAds = {
  /** orders x margin per unit before ads, less what was spent; minor units */
  amount: number;
  how: string;
};

/**
 * What the orders earned after paying for the ads: orders x the unit margin before advertising,
 * less the spend. The unit margin comes from the unit economics (src/lib/campaigns/margin.ts); when
 * it cannot be worked out (no price, parts not priced) the answer is null and the screen says why.
 */
export function marginAfterAds(c: Counts, unitMarginBeforeAds: number | null, format: (minor: number) => string): MarginAfterAds | null {
  if (unitMarginBeforeAds === null) return null;
  const amount = Math.round(c.orders * unitMarginBeforeAds - c.spend);
  return { amount, how: `${c.orders} orders x ${format(unitMarginBeforeAds)} margin before ads - ${format(c.spend)} spend = ${format(amount)}` };
}

export const percent = (fraction: number | null, digits = 2) => (fraction === null ? "not worked out" : `${Number((fraction * 100).toFixed(digits))}%`);

/** One row of the results, by day, as read from the database. */
export type ResultRow = Counts & { id: number; campaignId: number; creativeId: number | null; creativeLabel: string; day: string; source: string };

export type ByDay = { day: string } & Counts;

/** Totals by day across the given rows, oldest day first. */
export function byDay(rows: Pick<ResultRow, "day" | keyof Counts>[]): ByDay[] {
  const m = new Map<string, Counts>();
  for (const r of rows) m.set(r.day, addCounts(m.get(r.day) ?? NO_COUNTS, r));
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, c]) => ({ day, ...c }));
}

export type ByCreative = { creativeId: number | null; label: string; counts: Counts };

/** Totals per creative; rows with no creative are one group labelled "Whole campaign". */
export function byCreative(rows: ResultRow[]): ByCreative[] {
  const m = new Map<string, ByCreative>();
  for (const r of rows) {
    const k = String(r.creativeId ?? "none");
    const g = m.get(k) ?? { creativeId: r.creativeId, label: r.creativeId === null ? "Whole campaign" : r.creativeLabel || `Creative #${r.creativeId}`, counts: NO_COUNTS };
    g.counts = addCounts(g.counts, r);
    if (r.creativeId !== null && r.creativeLabel) g.label = r.creativeLabel;
    m.set(k, g);
  }
  return [...m.values()];
}
