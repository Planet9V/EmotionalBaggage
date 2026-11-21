// The verdict on a running campaign. The rule is the user's, set as numbers on the campaign; this
// file only applies it. It is code, not a model: the same results always give the same verdict,
// and every figure behind the verdict is returned with it. A model may add a labelled explanation
// beside it (src/app/api/projects/[id]/campaigns/explain) but never changes it.
import { derive, type Counts } from "./metrics";
import { TARGET_INFO, type StopScaleRule, type Target } from "./schemas";

export type Verdict = "stop" | "hold" | "scale" | "not_enough_data" | "no_rule";

export type Evaluation = {
  verdict: Verdict;
  /** the sentence the screen leads with */
  headline: string;
  /** what the rule says when the data are too thin to act on it; null otherwise */
  ruleSays: "stop" | "hold" | "scale" | null;
  /** the figures behind the verdict, in the order the table shows them */
  numbers: { label: string; value: string }[];
  /** plain warnings: a small sample, a scale line above the stop line */
  warnings: string[];
  /** for "scale": the daily budget after scaling, when the rule and the campaign give both numbers */
  newDailyBudgetMinor: number | null;
};

export type EvaluateInput = {
  rule: StopScaleRule;
  counts: Counts;
  minClicks: number;
  minOrders: number;
  budgetDailyMinor?: number | null;
  /** formats a minor-unit amount in the concept's currency */
  money: (minor: number) => string;
};

/** Enough to judge: the clicks OR the orders have reached their minimum (a minimum of 0 is no minimum). */
export const enoughData = (c: Counts, minClicks: number, minOrders: number) => c.clicks >= minClicks || c.orders >= minOrders;

export function evaluateRule(i: EvaluateInput): Evaluation {
  const { rule, counts, money } = i;
  const d = derive(counts);
  const after = rule.afterSpendMinor ?? 0;
  const numbers: Evaluation["numbers"] = [
    { label: "Spent", value: money(counts.spend) },
    { label: "Orders", value: String(counts.orders) },
    { label: "Clicks", value: String(counts.clicks) },
    { label: "Cost per order", value: d.cpo === null ? "not worked out (no orders)" : money(Math.round(d.cpo)) },
  ];
  if (rule.stopAboveMinor !== undefined) numbers.push({ label: "Stop above", value: money(rule.stopAboveMinor) });
  if (rule.scaleBelowMinor !== undefined) numbers.push({ label: "Scale below", value: money(rule.scaleBelowMinor) });
  if (rule.afterSpendMinor !== undefined) numbers.push({ label: "Judged after spend of", value: money(rule.afterSpendMinor) });
  const warnings: string[] = [];
  const base = { numbers, warnings, ruleSays: null, newDailyBudgetMinor: null } as const;

  if (rule.stopAboveMinor === undefined && rule.scaleBelowMinor === undefined) {
    return { ...base, verdict: "no_rule", headline: "No stop or scale rule is set on this campaign, so there is nothing to judge it by." };
  }
  if (rule.stopAboveMinor !== undefined && rule.scaleBelowMinor !== undefined && rule.scaleBelowMinor > rule.stopAboveMinor) {
    warnings.push(`The scale line (${money(rule.scaleBelowMinor)}) is above the stop line (${money(rule.stopAboveMinor)}). Where both apply, stop wins.`);
  }
  if (counts.spend <= 0) {
    return { ...base, verdict: "not_enough_data", headline: "Nothing has been spent yet, so there is nothing to judge." };
  }
  if (counts.spend < after) {
    return { ...base, verdict: "not_enough_data", headline: `Not enough data: ${money(counts.spend)} spent of the ${money(after)} the rule waits for before judging.` };
  }

  let says: "stop" | "hold" | "scale" = "hold";
  let because = "";
  if (rule.stopAboveMinor !== undefined && (d.cpo === null || d.cpo > rule.stopAboveMinor)) {
    says = "stop";
    because = d.cpo === null ? `${money(counts.spend)} spent and no orders, against a stop line of ${money(rule.stopAboveMinor)} per order` : `cost per order is ${money(Math.round(d.cpo))}, above the stop line of ${money(rule.stopAboveMinor)}`;
  } else if (rule.scaleBelowMinor !== undefined && d.cpo !== null && d.cpo < rule.scaleBelowMinor) {
    says = "scale";
    because = `cost per order is ${money(Math.round(d.cpo))}, below the scale line of ${money(rule.scaleBelowMinor)}`;
  } else {
    because = d.cpo === null ? "there are no orders yet, and no stop line is set" : `cost per order is ${money(Math.round(d.cpo))}, between the lines`;
  }

  if (!enoughData(counts, i.minClicks, i.minOrders)) {
    warnings.push(`Small sample: ${counts.clicks} clicks and ${counts.orders} orders. The minimum before a verdict is ${i.minClicks} clicks or ${i.minOrders} orders (set on the Campaigns page).`);
    return {
      ...base,
      numbers,
      warnings,
      verdict: "not_enough_data",
      ruleSays: says,
      headline: `Not enough data to act on. The rule would say ${says} (${because}), but with ${counts.clicks} clicks and ${counts.orders} orders that could be chance.`,
    };
  }

  let newDaily: number | null = null;
  let scaleText = "";
  if (says === "scale" && rule.scaleByPercent !== undefined && i.budgetDailyMinor != null) {
    newDaily = Math.round(i.budgetDailyMinor * (1 + rule.scaleByPercent / 100));
    scaleText = ` Raise the daily budget by ${rule.scaleByPercent}%, from ${money(i.budgetDailyMinor)} to ${money(newDaily)}.`;
  } else if (says === "scale" && rule.scaleByPercent !== undefined) {
    scaleText = ` Raise the daily budget by ${rule.scaleByPercent}%.`;
  }
  const word = says === "stop" ? "Stop" : says === "scale" ? "Scale" : "Hold";
  return { numbers, warnings, ruleSays: null, newDailyBudgetMinor: newDaily, verdict: says, headline: `${word}: ${because}.${scaleText}` };
}

export type TargetResult = {
  metric: Target["metric"];
  label: string;
  /** the value reached, null when it cannot be worked out */
  actual: number | null;
  target: number;
  met: boolean | null;
  /** the target and the value in words, with units */
  text: string;
};

/** How far the campaign is from its measure of success. Money and counts are in the units they are stored in. */
export function evaluateTarget(t: Target, counts: Counts, money: (minor: number) => string): TargetResult {
  const info = TARGET_INFO[t.metric];
  const d = derive(counts);
  const actual: number | null =
    t.metric === "cost_per_order" ? d.cpo
    : t.metric === "cost_per_click" ? d.cpc
    : t.metric === "roas" ? d.roas
    : t.metric === "ctr" ? d.ctr
    : t.metric === "cvr" ? d.cvr
    : t.metric === "orders" ? counts.orders
    : t.metric === "clicks" ? counts.clicks
    : counts.revenue;
  const fmt = (v: number) =>
    info.kind === "money" ? money(Math.round(v)) : info.kind === "fraction" ? `${Number((v * 100).toFixed(2))}%` : info.kind === "ratio" ? `${Number(v.toFixed(2))}x` : String(Math.round(v));
  const word = info.direction === "at_most" ? "at or below" : "at or above";
  const met = actual === null ? null : info.direction === "at_most" ? actual <= t.value : actual >= t.value;
  const text = `${info.label} ${word} ${fmt(t.value)}: ${actual === null ? "not worked out yet" : `${fmt(actual)}, ${met ? "met" : "not met"}`}`;
  return { metric: t.metric, label: info.label, actual, target: t.value, met, text };
}
