import { describe, expect, it } from "vitest";
import { applyMapping, detectLayout, layoutFor, mappingFor, parseDayCell, parseNumber, parseReport } from "@/lib/campaigns/csv";

describe("numbers in cells", () => {
  it.each([
    ["1,234.56", 1234.56],
    ["$12", 12],
    ["1.234,56", 1234.56],
    ["12,5", 12.5],
    ["1,234", 1234],
    ["12,345,678", 12_345_678],
    ["1.234.567", 1_234_567],
    ["  42 ", 42],
    ["5.50%", 5.5],
    ["(3)", -3],
    ["-7", -7],
  ])("%s", (cell, want) => expect(parseNumber(cell)).toBeCloseTo(want, 6));
  it.each(["", "-", "n/a", "abc", "12abc", "1,2,3x"])("%j is not a number", (cell) => expect(parseNumber(cell)).toBeNull());
});

describe("dates in cells", () => {
  it.each([
    ["2026-12-01", "mdy", "2026-12-01"],
    ["2026-12-01 00:00:00", "mdy", "2026-12-01"],
    ["12/01/2026", "mdy", "2026-12-01"],
    ["12/01/2026", "dmy", "2026-01-12"],
    ["1 Dec 2026", "mdy", "2026-12-01"],
    ["Dec 1, 2026", "mdy", "2026-12-01"],
    ["December 1, 2026", "mdy", "2026-12-01"],
    ["Tue, Dec 1, 2026", "mdy", "2026-12-01"],
  ] as const)("%s as %s", (cell, order, want) => expect(parseDayCell(cell, order)).toBe(want));
  it.each(["2026-02-30", "13/13/2026", "soon", "", "Total"])("%j is not a date", (cell) => expect(parseDayCell(cell)).toBeNull());
});

const AMAZON = [
  "Date,Portfolio name,Campaign Name,Ad Group Name,Impressions,Clicks,Click-Thru Rate (CTR),Cost Per Click (CPC),Spend,7 Day Total Sales,Total Advertising Cost of Sales (ACoS),Total Return on Advertising Spend (RoAS),7 Day Total Orders (#)",
  'Dec 1 2026,,Launch,Group A,"1,200",24,2.00%,$0.50,$12.00,$60.00,20.00%,5.00,3',
  'Dec 1 2026,,Launch,Group B,800,10,1.25%,$0.40,$4.00,$0.00,0%,0,0',
  'Dec 2 2026,,Launch,Group A,"1,500",30,2.00%,$0.50,$15.00,$40.00,37.50%,2.67,2',
  'Dec 2 2026,,Other,Group Z,100,1,1%,$1.00,$1.00,$0.00,0%,0,0',
].join("\n");

const GOOGLE = [
  "Campaign report",
  "December 1, 2026 - December 7, 2026",
  "Day,Campaign,Currency code,Cost,Impr.,Clicks,Conversions,Conv. value",
  "2026-12-01,Search,USD,25.50,1000,40,2.5,125.00",
  "2026-12-02,Search,USD,30.00,1200,35,3,150.00",
  "Total: Campaigns,,,55.50,2200,75,5.5,275.00",
].join("\n");

describe("reading a report file", () => {
  it("finds the header below a title and a date range, and leaves out the total row", () => {
    const f = parseReport(GOOGLE);
    expect(f.skippedAbove).toBe(2);
    expect(f.headers[0]).toBe("Day");
    const d = detectLayout(f.headers)!;
    expect(d.layout.id).toBe("google-ads");
    const r = applyMapping(f.headers, f.rows, d.mapping, { currency: "USD" }, f.skippedAbove + 1);
    expect(r.problems).toEqual([]);
    expect(r.skipped).toBe(1);
    expect(r.records).toEqual([
      { day: "2026-12-01", creativeName: "", spend: 2550, impressions: 1000, clicks: 40, orders: 3, revenue: 12_500 },
      { day: "2026-12-02", creativeName: "", spend: 3000, impressions: 1200, clicks: 35, orders: 3, revenue: 15_000 },
    ]);
  });

  it("recognises an Amazon Ads report, takes one campaign, and adds a day's ad groups together", () => {
    const f = parseReport(AMAZON);
    const d = detectLayout(f.headers)!;
    expect(d.layout.id).toBe("amazon-ads");
    expect(d.mapping).toMatchObject({ day: "Date", spend: "Spend", orders: "7 Day Total Orders (#)", revenue: "7 Day Total Sales", clicks: "Clicks" });
    const r = applyMapping(f.headers, f.rows, { ...d.mapping, creative: undefined }, { currency: "USD", campaign: "launch" });
    expect(r.problems).toEqual([]);
    expect(r.rowsRead).toBe(4);
    expect(r.skipped).toBe(1);
    expect(r.rowsUsed).toBe(3);
    expect(r.records).toEqual([
      { day: "2026-12-01", creativeName: "", spend: 1600, impressions: 2000, clicks: 34, orders: 3, revenue: 6000 },
      { day: "2026-12-02", creativeName: "", spend: 1500, impressions: 1500, clicks: 30, orders: 2, revenue: 4000 },
    ]);
    expect(r.campaigns.sort()).toEqual(["Launch", "Other"]);
  });

  it("keeps creatives apart when an ad column is mapped", () => {
    const f = parseReport(AMAZON);
    const d = detectLayout(f.headers)!;
    const r = applyMapping(f.headers, f.rows, d.mapping, { currency: "USD", campaign: "Launch" });
    expect(r.records.map((x) => [x.day, x.creativeName, x.clicks])).toEqual([
      ["2026-12-01", "Group A", 24],
      ["2026-12-01", "Group B", 10],
      ["2026-12-02", "Group A", 30],
    ]);
  });

  it("recognises a Meta Ads Manager export", () => {
    const text = "Reporting starts,Campaign name,Ad name,Amount spent (USD),Impressions,Link clicks,Purchases,Purchases conversion value\n2026-12-03,Launch,Video 1,20.00,900,30,2,80.00";
    const f = parseReport(text);
    const d = detectLayout(f.headers)!;
    expect(d.layout.id).toBe("meta-ads");
    const r = applyMapping(f.headers, f.rows, d.mapping, { currency: "USD" });
    expect(r.records[0]).toEqual({ day: "2026-12-03", creativeName: "Video 1", spend: 2000, impressions: 900, clicks: 30, orders: 2, revenue: 8000 });
  });

  it("recognises nothing in a file with unknown columns, so the user maps it", () => {
    const f = parseReport("when,how much,seen,tapped\n2026-12-01,5,100,4");
    expect(detectLayout(f.headers)).toBeNull();
    expect(applyMapping(f.headers, f.rows, { day: "when", spend: "how much", impressions: "seen", clicks: "tapped" }, { currency: "USD" }).records).toEqual([
      { day: "2026-12-01", creativeName: "", spend: 500, impressions: 100, clicks: 4, orders: 0, revenue: 0 },
    ]);
  });

  it("uses the generic layout's names", () => {
    expect(mappingFor(layoutFor("generic")!, ["Date", "Spend", "Clicks"])).toEqual({ day: "Date", spend: "Spend", clicks: "Clicks" });
  });
});

describe("a bad row is refused with its line number, never guessed", () => {
  const map = { day: "Date", spend: "Spend", clicks: "Clicks" };
  const f = parseReport("Date,Spend,Clicks\n2026-12-01,5.00,10\nsoon,5.00,10\n2026-12-03,abc,10\n2026-12-04,-5,10\n2026-12-05,6.00,12");
  const r = applyMapping(f.headers, f.rows, map, { currency: "USD" });
  it("keeps the good rows", () => expect(r.records.map((x) => x.day)).toEqual(["2026-12-01", "2026-12-05"]));
  it("lists each problem on its line in the file", () => {
    expect(r.problems.map((p) => p.line)).toEqual([3, 4, 5]);
    expect(r.problems[0].problem).toContain('"soon"');
    expect(r.problems[1].problem).toContain('"abc" is not a number');
    expect(r.problems[2].problem).toContain("negative");
  });
  it("asks for a date column when none is mapped", () => {
    expect(applyMapping(f.headers, f.rows, { spend: "Spend" }, { currency: "USD" }).problems[0].problem).toContain("date");
  });
  it("reads money in the currency's own minor unit", () => {
    const yen = applyMapping(["Date", "Spend"], [["2026-12-01", "1500"]], { day: "Date", spend: "Spend" }, { currency: "JPY" });
    expect(yen.records[0].spend).toBe(1500);
  });
});
