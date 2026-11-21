// Everything the Results screen and the explanation route say about one campaign, worked out from its
// rows. Pure. Browser and server call the same function, so the verdict on screen is the verdict the
// model is told about.
import { byCreative, byDay, derive, marginAfterAds, sumCounts, type ByCreative, type ByDay, type Counts, type Derived, type MarginAfterAds, type ResultRow } from "./metrics";
import type { Campaign, PlanSettings } from "./read";
import { evaluateRule, evaluateTarget, type Evaluation, type TargetResult } from "./rule";
import { compareRates, describeDifference, type Difference } from "./stats";

export type LinkClickRow = { campaignId: number; creativeId: number | null; day: string; clicks: number };

export type Comparison = {
  a: string;
  b: string;
  what: "Click-through rate" | "Conversion rate";
  /** trials on each side: impressions for click-through, clicks for conversion */
  nA: number;
  nB: number;
  result: Difference | null;
  text: string;
};

export type Analysis = {
  counts: Counts;
  derived: Derived;
  /** the click figure used, and where it came from: the platform's report or this app's tracked links */
  clicks: { value: number; source: "platform" | "links" | "none"; platform: number; links: number };
  marginAfter: MarginAfterAds | null;
  target: TargetResult | null;
  evaluation: Evaluation;
  days: ByDay[];
  creatives: ByCreative[];
  comparisons: Comparison[];
  /** a plain sentence when nothing has been entered */
  empty: boolean;
};

export type AnalyzeInput = {
  campaign: Campaign;
  rows: ResultRow[];
  linkClicks: LinkClickRow[];
  plan: Pick<PlanSettings, "minClicks" | "minOrders">;
  /** margin per unit before advertising on the campaign's sales channel, minor units; null when unknown */
  unitMarginBeforeAds: number | null;
  money: (minor: number) => string;
};

export function analyze(i: AnalyzeInput): Analysis {
  const { campaign, money } = i;
  const rows = i.rows.filter((r) => r.campaignId === campaign.id);
  const totals = sumCounts(rows);
  const links = i.linkClicks.filter((l) => l.campaignId === campaign.id).reduce((a, l) => a + l.clicks, 0);
  const platform = totals.clicks;
  const clicks = platform > 0 ? { value: platform, source: "platform" as const } : links > 0 ? { value: links, source: "links" as const } : { value: 0, source: "none" as const };
  // the click figure used everywhere below; link clicks stand in only when the report has none
  const counts: Counts = { ...totals, clicks: clicks.value };
  const evaluation = evaluateRule({
    rule: campaign.rule,
    counts,
    minClicks: i.plan.minClicks,
    minOrders: i.plan.minOrders,
    budgetDailyMinor: campaign.budgetDailyMinor,
    money,
  });
  const creatives = byCreative(rows);
  return {
    counts,
    derived: derive(counts),
    clicks: { ...clicks, platform, links },
    marginAfter: marginAfterAds(counts, i.unitMarginBeforeAds, money),
    target: campaign.target ? evaluateTarget(campaign.target, counts, money) : null,
    evaluation,
    days: byDay(rows),
    creatives,
    comparisons: compareCreatives(creatives),
    empty: rows.length === 0 && links === 0,
  };
}

/** Every pair of creatives (not the whole-campaign group) on click-through and on conversion. */
export function compareCreatives(list: ByCreative[]): Comparison[] {
  const named = list.filter((g) => g.creativeId !== null).slice(0, 6);
  const out: Comparison[] = [];
  for (let x = 0; x < named.length; x++) {
    for (let y = x + 1; y < named.length; y++) {
      const A = named[x];
      const B = named[y];
      const ctr = compareRates(A.counts.clicks, A.counts.impressions, B.counts.clicks, B.counts.impressions);
      out.push({ a: A.label, b: B.label, what: "Click-through rate", nA: A.counts.impressions, nB: B.counts.impressions, result: ctr, text: describeDifference(ctr, "Click-through rate", A.label, B.label) });
      const cvr = compareRates(A.counts.orders, A.counts.clicks, B.counts.orders, B.counts.clicks);
      out.push({ a: A.label, b: B.label, what: "Conversion rate", nA: A.counts.clicks, nB: B.counts.clicks, result: cvr, text: describeDifference(cvr, "Conversion rate", A.label, B.label) });
    }
  }
  return out;
}

