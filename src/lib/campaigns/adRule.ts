// One source for an ad's stop and scale rule (plan 8.8 joined with 8.13 and 8.15). A campaign carries
// the rule numbers it is judged by (data.rule); an ad that a campaign runs (listed in the campaign's
// data.creative) is governed by that campaign's rule and shows it. An ad no campaign runs keeps its own
// sentence and two numbers (data.stopRule, costPerOrderCeilingMinor, minSpendBeforeJudgingMinor).
// Pure: the content rules, the ads screen and the ads export all read it.
import type { Item } from "@/lib/types";
import { slugify } from "@/lib/format";

export type AdRule = {
  source: "campaign" | "ad" | "none";
  /** the campaign whose rule governs, when it is one */
  campaign: { id: number; title: string } | null;
  /** other campaigns that also run this ad (their rules are not applied to it) */
  alsoIn: { id: number; title: string }[];
  /** stop when the cost per order stays above this, minor units */
  stopAboveMinor: number | null;
  /** judge only after this much is spent, minor units */
  afterSpendMinor: number | null;
  /** scale when the cost per order is below this, minor units (campaigns only) */
  scaleBelowMinor: number | null;
  sentence: string;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Campaign rows (kind "campaign") that list this ad among their creatives, in their saved order. */
function campaignsRunning(adId: number, campaigns: Item[]): Item[] {
  return campaigns.filter((c) => c.data.kind !== "plan" && Array.isArray(c.data.creative) && (c.data.creative as { itemId?: unknown }[]).some((r) => r?.itemId === adId));
}

export function effectiveAdRule(ad: Item, campaigns: Item[]): AdRule {
  const running = campaignsRunning(ad.id, campaigns);
  if (running.length) {
    const c = running[0];
    const r = (c.data.rule ?? {}) as { stopAboveMinor?: unknown; afterSpendMinor?: unknown; scaleBelowMinor?: unknown };
    return {
      source: "campaign",
      campaign: { id: c.id, title: c.title },
      alsoIn: running.slice(1).map((x) => ({ id: x.id, title: x.title })),
      stopAboveMinor: num(r.stopAboveMinor),
      afterSpendMinor: num(r.afterSpendMinor),
      scaleBelowMinor: num(r.scaleBelowMinor),
      sentence: `Set on the campaign "${c.title}", which runs this ad.`,
    };
  }
  const stop = num(ad.data.costPerOrderCeilingMinor);
  const after = num(ad.data.minSpendBeforeJudgingMinor);
  const sentence = String(ad.data.stopRule ?? "").trim();
  return { source: stop === null && after === null && !sentence ? "none" : "ad", campaign: null, alsoIn: [], stopAboveMinor: stop, afterSpendMinor: after, scaleBelowMinor: null, sentence };
}

/** Whether the rule that governs the ad has both numbers a verdict needs (the stop line and the spend to judge after). */
export const ruleComplete = (r: AdRule) => r.stopAboveMinor !== null && r.afterSpendMinor !== null && (r.source === "campaign" || r.sentence !== "");

/** The utm_content of a tracked link for a creative: taken from the creative row, so results can be tied back to it. */
export const creativeUtmContent = (creative: { title: string }) => slugify(creative.title, 60);
