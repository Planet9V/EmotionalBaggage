import { describe, expect, it } from "vitest";
import { byCreative, byDay, derive, marginAfterAds, NO_COUNTS, sumCounts, type ResultRow } from "@/lib/campaigns/metrics";
import { formatMoney } from "@/lib/economics/money";

const money = (m: number) => formatMoney(m, "USD");
const row = (o: Partial<ResultRow>): ResultRow => ({ id: 1, campaignId: 1, creativeId: null, creativeLabel: "", day: "2026-12-01", spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0, source: "manual", ...o });

describe("derived figures", () => {
  it("works out each figure from the counts", () => {
    const d = derive({ spend: 5000, impressions: 10_000, clicks: 200, orders: 10, revenue: 25_000 });
    expect(d.ctr).toBeCloseTo(0.02, 10);
    expect(d.cpc).toBeCloseTo(25, 10);
    expect(d.cvr).toBeCloseTo(0.05, 10);
    expect(d.cpo).toBeCloseTo(500, 10);
    expect(d.roas).toBeCloseTo(5, 10);
  });

  it("gives null, never 0 or Infinity, when the divisor is zero", () => {
    expect(derive(NO_COUNTS)).toEqual({ ctr: null, cpc: null, cvr: null, cpo: null, roas: null });
    const spendOnly = derive({ spend: 1000, impressions: 0, clicks: 0, orders: 0, revenue: 0 });
    expect(spendOnly.cpo).toBeNull();
    expect(spendOnly.cpc).toBeNull();
    expect(spendOnly.roas).toBe(0);
    const freeClicks = derive({ spend: 0, impressions: 100, clicks: 10, orders: 2, revenue: 500 });
    expect(freeClicks.cpc).toBe(0);
    expect(freeClicks.roas).toBeNull();
  });

  it("keeps a real zero as zero", () => {
    expect(derive({ spend: 0, impressions: 100, clicks: 0, orders: 0, revenue: 0 }).ctr).toBe(0);
  });
});

describe("margin after ads", () => {
  it("is orders x unit margin before ads, less spend, and shows the sum", () => {
    const m = marginAfterAds({ spend: 4000, impressions: 0, clicks: 0, orders: 10, revenue: 0 }, 1200, money);
    expect(m?.amount).toBe(8000);
    expect(m?.how).toBe("10 orders x $12.00 margin before ads - $40.00 spend = $80.00");
  });
  it("can be negative", () => {
    expect(marginAfterAds({ spend: 5000, impressions: 0, clicks: 0, orders: 2, revenue: 0 }, 1000, money)?.amount).toBe(-3000);
  });
  it("is null when the unit margin is not known", () => {
    expect(marginAfterAds({ spend: 5000, impressions: 0, clicks: 0, orders: 2, revenue: 0 }, null, money)).toBeNull();
  });
});

describe("grouping", () => {
  const rows = [
    row({ id: 1, day: "2026-12-02", spend: 100, clicks: 5 }),
    row({ id: 2, day: "2026-12-01", spend: 200, clicks: 7, creativeId: 9, creativeLabel: "Ad A" }),
    row({ id: 3, day: "2026-12-02", spend: 300, clicks: 1, creativeId: 9, creativeLabel: "Ad A" }),
  ];
  it("adds by day, oldest first", () => {
    expect(byDay(rows).map((d) => [d.day, d.spend, d.clicks])).toEqual([["2026-12-01", 200, 7], ["2026-12-02", 400, 6]]);
  });
  it("adds by creative and names the rows with none", () => {
    const g = byCreative(rows);
    expect(g.map((x) => [x.label, x.counts.spend])).toEqual([["Whole campaign", 100], ["Ad A", 500]]);
  });
  it("sums counts", () => {
    expect(sumCounts(rows).spend).toBe(600);
  });
});
