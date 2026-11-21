import { describe, expect, it } from "vitest";
import { compareRates, describeDifference, METHOD_NAME, wilson } from "@/lib/campaigns/stats";
import { compareCreatives } from "@/lib/campaigns/analyze";

describe("Wilson score interval", () => {
  it("matches a hand calculation: 10 of 100", () => {
    const w = wilson(10, 100)!;
    // centre (2*100*0.1 + z^2) / (2*(100 + z^2)), half width z*sqrt(z^2 + 4*100*0.1*0.9) / (2*(100 + z^2))
    expect(w.low).toBeCloseTo(0.0552, 3);
    expect(w.high).toBeCloseTo(0.1744, 3);
  });
  it("stays inside 0 and 1 at the edges", () => {
    expect(wilson(0, 20)!.low).toBe(0);
    expect(wilson(20, 20)!.high).toBe(1);
  });
  it("is null with no trials", () => {
    expect(wilson(0, 0)).toBeNull();
  });
});

describe("Newcombe interval for a difference of two rates", () => {
  // Worked example, computed independently in Python from the Wilson formula and Newcombe's method 10:
  // 56 of 70 against 48 of 80 gives a difference of 0.2000 with a 95% interval of 0.0524 to 0.3339.
  it("56/70 against 48/80", () => {
    const d = compareRates(56, 70, 48, 80)!;
    expect(d.difference).toBeCloseTo(0.2, 10);
    expect(d.low).toBeCloseTo(0.0524, 4);
    expect(d.high).toBeCloseTo(0.3339, 4);
    expect(d.distinguishable).toBe(true);
    expect(d.method).toBe(METHOD_NAME);
  });

  it("a small gap on small numbers cannot be told apart", () => {
    const d = compareRates(5, 50, 2, 50)!;
    expect(d.low).toBeCloseTo(-0.0502, 4);
    expect(d.high).toBeCloseTo(0.1772, 4);
    expect(d.distinguishable).toBe(false);
  });

  it("works when one side has no successes", () => {
    const d = compareRates(0, 40, 3, 45)!;
    expect(d.low).toBeCloseTo(-0.1786, 4);
    expect(d.high).toBeCloseTo(0.0313, 4);
    expect(d.distinguishable).toBe(false);
  });

  it("is antisymmetric", () => {
    const a = compareRates(30, 100, 20, 100)!;
    const b = compareRates(20, 100, 30, 100)!;
    expect(a.low).toBeCloseTo(-b.high, 12);
    expect(a.high).toBeCloseTo(-b.low, 12);
  });

  it("is null when a side has no trials", () => {
    expect(compareRates(1, 0, 1, 10)).toBeNull();
  });

  it("describes the gap with its interval and what it means", () => {
    const t = describeDifference(compareRates(5, 50, 2, 50), "Conversion rate", "Ad A", "Ad B");
    expect(t).toContain("Ad A 10.00% against Ad B 4.00%");
    expect(t).toContain(METHOD_NAME);
    expect(t).toContain("cannot tell the two apart");
    expect(describeDifference(null, "Conversion rate", "A", "B")).toContain("cannot be compared");
  });
});

describe("comparing creatives", () => {
  it("compares every pair on click-through and on conversion, and skips the whole-campaign group", () => {
    const c = (clicks: number, impressions: number, orders: number) => ({ spend: 0, impressions, clicks, orders, revenue: 0 });
    const out = compareCreatives([
      { creativeId: null, label: "Whole campaign", counts: c(50, 1000, 5) },
      { creativeId: 1, label: "Ad A", counts: c(40, 1000, 8) },
      { creativeId: 2, label: "Ad B", counts: c(20, 1000, 2) },
    ]);
    expect(out.map((x) => `${x.a}|${x.b}|${x.what}`)).toEqual(["Ad A|Ad B|Click-through rate", "Ad A|Ad B|Conversion rate"]);
    expect(out[0].result?.distinguishable).toBe(true);
    expect(out[1].nA).toBe(40);
  });
});
