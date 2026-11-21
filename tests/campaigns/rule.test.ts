import { describe, expect, it } from "vitest";
import { evaluateRule, evaluateTarget, enoughData } from "@/lib/campaigns/rule";
import { formatMoney } from "@/lib/economics/money";
import type { Counts } from "@/lib/campaigns/metrics";

const money = (m: number) => formatMoney(m, "USD");
const counts = (o: Partial<Counts>): Counts => ({ spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0, ...o });
// stop above $10 per order, scale below $5 per order (by 25%), both judged after $100 spent
const RULE = { stopAboveMinor: 1000, scaleBelowMinor: 500, scaleByPercent: 25, afterSpendMinor: 10_000 };
const run = (c: Partial<Counts>, rule: Partial<typeof RULE> = RULE, extra = {}) => evaluateRule({ rule: rule as typeof RULE, counts: counts(c), minClicks: 100, minOrders: 10, budgetDailyMinor: 2000, money, ...extra });

describe("the stop, hold and scale rule", () => {
  it("stops when cost per order is above the stop line after the spend", () => {
    const e = run({ spend: 15_000, clicks: 400, orders: 12 }); // $12.50 per order
    expect(e.verdict).toBe("stop");
    expect(e.headline).toContain("$12.50");
    expect(e.headline).toContain("$10.00");
    expect(e.numbers.find((n) => n.label === "Cost per order")?.value).toBe("$12.50");
  });

  it("scales when cost per order is below the scale line, and says the new daily budget", () => {
    const e = run({ spend: 12_000, clicks: 400, orders: 30 }); // $4.00 per order
    expect(e.verdict).toBe("scale");
    expect(e.newDailyBudgetMinor).toBe(2500);
    expect(e.headline).toContain("by 25%, from $20.00 to $25.00");
  });

  it("holds between the lines", () => {
    const e = run({ spend: 12_000, clicks: 400, orders: 16 }); // $7.50 per order
    expect(e.verdict).toBe("hold");
    expect(e.newDailyBudgetMinor).toBeNull();
  });

  it("treats exactly on a line as inside it: stop is strictly above, scale strictly below", () => {
    expect(run({ spend: 10_000, clicks: 400, orders: 10 }).verdict).toBe("hold"); // $10.00: not above 10.00
    expect(run({ spend: 10_000, clicks: 400, orders: 20 }).verdict).toBe("hold"); // $5.00: not below 5.00
  });

  it("stops on spend with no orders once the sample is enough", () => {
    const e = run({ spend: 11_000, clicks: 150, orders: 0 });
    expect(e.verdict).toBe("stop");
    expect(e.headline).toContain("no orders");
  });

  it("says not enough data before the spend the rule waits for", () => {
    const e = run({ spend: 4000, clicks: 400, orders: 40 });
    expect(e.verdict).toBe("not_enough_data");
    expect(e.headline).toContain("$40.00 spent of the $100.00");
  });

  it("says not enough data on a small sample, and what the rule would say", () => {
    const e = run({ spend: 12_000, clicks: 60, orders: 5 }); // $24 per order: rule says stop
    expect(e.verdict).toBe("not_enough_data");
    expect(e.ruleSays).toBe("stop");
    expect(e.warnings[0]).toContain("Small sample: 60 clicks and 5 orders");
    expect(e.headline).toContain("could be chance");
  });

  it("is enough with either minimum met", () => {
    expect(enoughData(counts({ clicks: 100 }), 100, 10)).toBe(true);
    expect(enoughData(counts({ orders: 10 }), 100, 10)).toBe(true);
    expect(enoughData(counts({ clicks: 99, orders: 9 }), 100, 10)).toBe(false);
    expect(enoughData(counts({}), 0, 0)).toBe(true);
  });

  it("says so when nothing has been spent", () => {
    expect(run({}).verdict).toBe("not_enough_data");
    expect(run({}).headline).toBe("Nothing has been spent yet, so there is nothing to judge.");
  });

  it("has no verdict without a rule", () => {
    expect(run({ spend: 1, clicks: 1000 }, {}).verdict).toBe("no_rule");
  });

  it("waits for no spend when the rule names none", () => {
    const e = run({ spend: 5000, clicks: 200, orders: 3 }, { stopAboveMinor: 1000 }); // $16.67
    expect(e.verdict).toBe("stop");
  });

  it("warns when the scale line is above the stop line, and stop wins", () => {
    const e = run({ spend: 12_000, clicks: 400, orders: 12 }, { stopAboveMinor: 500, scaleBelowMinor: 2000 }); // $10 per order
    expect(e.verdict).toBe("stop");
    expect(e.warnings[0]).toContain("Where both apply, stop wins");
  });

  it("holds with no orders when only a scale line is set", () => {
    expect(run({ spend: 12_000, clicks: 400, orders: 0 }, { scaleBelowMinor: 500 }).verdict).toBe("hold");
  });
});

describe("the target", () => {
  it("at or below, for cost per order", () => {
    const met = evaluateTarget({ metric: "cost_per_order", value: 1000 }, counts({ spend: 9000, orders: 10 }), money);
    expect(met).toMatchObject({ met: true, actual: 900 });
    expect(met.text).toContain("at or below $10.00");
    const missed = evaluateTarget({ metric: "cost_per_order", value: 1000 }, counts({ spend: 11_000, orders: 10 }), money);
    expect(missed.met).toBe(false);
  });
  it("at or above, for sign-ups", () => {
    expect(evaluateTarget({ metric: "orders", value: 50 }, counts({ orders: 50 }), money).met).toBe(true);
    expect(evaluateTarget({ metric: "orders", value: 50 }, counts({ orders: 49 }), money).met).toBe(false);
  });
  it("is not worked out when the figure cannot be", () => {
    const r = evaluateTarget({ metric: "cost_per_order", value: 1000 }, counts({ spend: 5000 }), money);
    expect(r.met).toBeNull();
    expect(r.text).toContain("not worked out yet");
  });
  it("reads rates as percentages", () => {
    expect(evaluateTarget({ metric: "ctr", value: 0.02 }, counts({ impressions: 1000, clicks: 25 }), money).text).toContain("2.5%");
    expect(evaluateTarget({ metric: "roas", value: 3 }, counts({ spend: 1000, revenue: 4000 }), money).text).toContain("4x");
  });
});
