import { describe, expect, it } from "vitest";
import { budgetRollup, spread } from "@/lib/campaigns/budget";
import type { Campaign } from "@/lib/campaigns/read";

const c = (o: Partial<Campaign>): Campaign => ({
  id: 1, title: "A", body: "", status: "planned", sort: 1, objective: "", audience: null, salesChannel: null, channel: "", budgetTotalMinor: null, budgetDailyMinor: null,
  startDate: "", endDate: "", creative: [], target: null, rule: {}, message: "", reasoning: "", arithmetic: [], legacy: [], ...o,
});

describe("spreading a budget over months", () => {
  it("is exact: the months add back to the total", () => {
    const s = spread(100_000, "2026-12-15", "2027-02-10")!;
    expect(Object.keys(s)).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(100_000);
  });
  it("follows the days in each month", () => {
    // 2026-12-15..31 is 17 days, 2027-01 is 31 days, 2027-02-01..10 is 10 days: 58 days
    const s = spread(5800, "2026-12-15", "2027-02-10")!;
    expect(s).toEqual({ "2026-12": 1700, "2027-01": 3100, "2027-02": 1000 });
  });
  it("puts the remainder in the last month", () => {
    const s = spread(100, "2026-01-31", "2026-02-02")!; // 3 days: 1 + 2
    expect(s["2026-01"] + s["2026-02"]).toBe(100);
    expect(s["2026-01"]).toBe(33);
  });
  it("is null for an end before the start", () => {
    expect(spread(100, "2026-02-02", "2026-02-01")).toBeNull();
  });
});

describe("the budget roll-up", () => {
  const limits = { monthlyMinor: 150_000, totalMinor: 400_000 };

  it("adds the campaigns of each month and compares with the monthly budget", () => {
    const r = budgetRollup(
      [
        c({ id: 1, title: "A", budgetTotalMinor: 124_000, startDate: "2026-12-01", endDate: "2027-01-31" }), // 62 days: 2000/day
        c({ id: 2, title: "B", budgetDailyMinor: 1000, startDate: "2027-01-01", endDate: "2027-01-31" }), // 31,000
      ],
      limits
    );
    expect(r.months.map((m) => [m.month, m.planned, m.over])).toEqual([
      ["2026-12", 62_000, 0],
      ["2027-01", 62_000 + 31_000, 0],
    ]);
    expect(r.plannedTotal).toBe(155_000);
    expect(r.totalOver).toBe(0);
  });

  it("flags a month and the whole budget when they are over", () => {
    const r = budgetRollup([c({ budgetTotalMinor: 300_000, startDate: "2026-12-01", endDate: "2026-12-31" }), c({ id: 2, budgetTotalMinor: 150_000, startDate: "2026-12-01", endDate: "2026-12-31" })], { monthlyMinor: 400_000, totalMinor: 400_000 });
    expect(r.months[0]).toMatchObject({ planned: 450_000, over: 50_000 });
    expect(r.totalOver).toBe(50_000);
  });

  it("leaves out killed campaigns, and lists campaigns it cannot place with the reason", () => {
    const r = budgetRollup(
      [
        c({ id: 1, status: "killed", budgetTotalMinor: 1000, startDate: "2026-12-01", endDate: "2026-12-02" }),
        c({ id: 2, title: "no dates", budgetTotalMinor: 1000 }),
        c({ id: 3, title: "no money", startDate: "2026-12-01", endDate: "2026-12-02" }),
        c({ id: 4, title: "backwards", budgetTotalMinor: 1000, startDate: "2026-12-05", endDate: "2026-12-02" }),
      ],
      limits
    );
    expect(r.months).toEqual([]);
    expect(r.leftOut.map((l) => [l.title, l.reason.split(",")[0]])).toEqual([
      ["no dates", "no start and end date"],
      ["no money", "no budget entered"],
      ["backwards", "the end date is before the start date"],
    ]);
  });

  it("has no limits to compare with when none is set", () => {
    const r = budgetRollup([c({ budgetTotalMinor: 1000, startDate: "2026-12-01", endDate: "2026-12-01" })], { monthlyMinor: null, totalMinor: null });
    expect(r.months[0].limit).toBeNull();
    expect(r.months[0].over).toBe(0);
  });
});
