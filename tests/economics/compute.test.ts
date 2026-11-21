import { describe, expect, it } from "vitest";
import { batchResults, channelResults, costBySize, fixedCosts, partLine, unitCost } from "@/lib/economics/compute";
import { formatMoney, minorDigits, toMinor } from "@/lib/economics/money";
import type { BatchRow, ChannelRow, CostRow, EconomicsInputs, MethodRow, PartInput } from "@/lib/economics/read";

const part = (id: number, over: Partial<PartInput> = {}): PartInput => ({ id, ref: `P${id}`, title: `Part ${id}`, qty: 1, unit: null, line: null, breaks: [], supplier: "", ...over });
const cost = (id: number, over: Partial<CostRow>): CostRow => ({
  id, title: `Row ${id}`, kind: "packaging", amount: null, labourMinutes: null, rate: null, grams: null, pricePerKg: null, printMinutes: null, machineRate: null, percent: null, ...over,
});
const channel = (id: number, over: Partial<ChannelRow> = {}): ChannelRow => ({
  id, title: `Channel ${id}`, status: "planned", price: null, platformPercent: null, platformFixed: null, paymentPercent: null, paymentFixed: null, fulfilment: null, returnsPercent: null, adCost: null, ...over,
});
const inputs = (over: Partial<EconomicsInputs> = {}): EconomicsInputs => ({ currency: "USD", parts: [], costs: [], channels: [], methods: [], batches: [], ...over });

describe("money", () => {
  it("knows the minor unit of a currency and rounds typed amounts without binary noise", () => {
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(toMinor(12.5, "USD")).toBe(1250);
    expect(toMinor(1.005, "USD")).toBe(101);
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(500, "JPY")).toBe(500);
  });
  it("formats with the currency's own digits", () => {
    expect(formatMoney(1250, "USD")).toBe("$12.50");
    expect(formatMoney(500, "JPY")).toBe("¥500");
    expect(formatMoney(-250, "USD")).toBe("-$2.50");
  });
});

describe("a part's line", () => {
  it("is quantity times unit price", () => {
    const l = partLine(part(1, { qty: 3, unit: 2.5 }), 1, "USD");
    expect(l.amount).toBe(750);
    expect(l.how).toContain("3 x $2.50 = $7.50");
  });
  it("uses the line cost when there is no unit price", () => {
    expect(partLine(part(1, { qty: 3, line: 4.2 }), 1, "USD").amount).toBe(420);
  });
  it("prefers the unit price to the line cost", () => {
    expect(partLine(part(1, { qty: 2, unit: 1, line: 99 }), 1, "USD").amount).toBe(200);
  });
  it("is not priced with neither, and says what to enter", () => {
    const l = partLine(part(1), 1, "USD");
    expect(l.amount).toBeNull();
    expect(l.missing?.what).toBe("P1 Part 1: not priced");
    expect(l.missing?.href).toBe("/s/production/pricing");
  });
  it("is not priced, not zero, when a unit price has no quantity", () => {
    const l = partLine(part(1, { qty: null, unit: 2 }), 1, "USD");
    expect(l.amount).toBeNull();
    expect(l.missing?.reason).toMatch(/quantity/);
  });
  it("a zero price is a price", () => {
    const l = partLine(part(1, { qty: 1, unit: 0 }), 1, "USD");
    expect(l.amount).toBe(0);
    expect(l.missing).toBeNull();
  });
  it("rounds each line to a minor unit on its own", () => {
    expect(partLine(part(1, { qty: 3, unit: 0.333 }), 1, "USD").amount).toBe(99); // the unit price is 33 minor units, times 3
    expect(partLine(part(1, { qty: 0.5, unit: 0.05 }), 1, "USD").amount).toBe(3); // 2.5 rounds up
  });
  it("picks the price break the ordered quantity reaches", () => {
    const p = part(1, { qty: 2, unit: 1, breaks: [{ qty: 100, unit: 0.8 }, { qty: 1000, unit: 0.5 }] });
    expect(partLine(p, 10, "USD").amount).toBe(200); // 20 ordered: base price
    expect(partLine(p, 50, "USD").amount).toBe(160); // 100 ordered: first break
    expect(partLine(p, 499, "USD").amount).toBe(160); // 998 ordered
    expect(partLine(p, 500, "USD").amount).toBe(100); // 1000 ordered: second break
    expect(partLine(p, 500, "USD").how).toMatch(/break at 1000/);
  });
  it("is not priced below the first break when there is no single-piece price", () => {
    const p = part(1, { qty: 1, unit: null, breaks: [{ qty: 100, unit: 0.8 }] });
    expect(partLine(p, 10, "USD").amount).toBeNull();
    expect(partLine(p, 100, "USD").amount).toBe(80);
  });
  it("does not scale a line cost with the batch", () => {
    expect(partLine(part(1, { qty: 3, line: 4 }), 500, "USD").amount).toBe(400);
  });
});

describe("unit cost build-up", () => {
  it("is zero and incomplete with no parts", () => {
    const u = unitCost(inputs(), 1);
    expect(u.total).toBe(0);
    expect(u.complete).toBe(false);
  });
  it("sums parts and per-unit lines and lists what is not priced", () => {
    const u = unitCost(
      inputs({
        parts: [part(1, { qty: 2, unit: 1.5 }), part(2)],
        costs: [cost(10, { kind: "packaging", amount: 0.75 }), cost(11, { kind: "shipping-in", amount: null })],
      }),
      1,
    );
    expect(u.partsSubtotal).toBe(300);
    expect(u.linesSubtotal).toBe(75);
    expect(u.total).toBe(375);
    expect(u.complete).toBe(false);
    expect(u.missing.map((m) => m.what)).toEqual(["P2 Part 2: not priced", "Row 11: not priced"]);
  });
  it("is complete when every line is priced", () => {
    expect(unitCost(inputs({ parts: [part(1, { unit: 1 })] }), 1).complete).toBe(true);
  });
  it("works out labour, print material and print time", () => {
    const u = unitCost(
      inputs({
        costs: [
          cost(1, { kind: "labour", labourMinutes: 12, rate: 30 }),
          cost(2, { kind: "print-material", grams: 45, pricePerKg: 24 }),
          cost(3, { kind: "print-time", printMinutes: 90, machineRate: 1.2 }),
        ],
      }),
      1,
    );
    expect(u.lines.map((l) => l.amount)).toEqual([600, 108, 180]);
    expect(u.lines[0].how).toBe("12 min x $30.00 per hour / 60 = $6.00");
    expect(u.lines[1].how).toBe("45 g x $24.00 per kg / 1000 = $1.08");
  });
  it("flags labour with a minute count but no rate", () => {
    const u = unitCost(inputs({ costs: [cost(1, { kind: "labour", labourMinutes: 12 })] }), 1);
    expect(u.lines[0].amount).toBeNull();
    expect(u.missing[0].reason).toMatch(/hourly rate/);
  });
  it("applies a scrap percentage to parts and per-unit lines, not to setup", () => {
    const u = unitCost(
      inputs({
        parts: [part(1, { unit: 10 })],
        costs: [cost(1, { kind: "packaging", amount: 2 }), cost(2, { kind: "scrap", percent: 5 }), cost(3, { kind: "setup", amount: 100 })],
      }),
      10,
    );
    expect(u.scrap).toBe(60); // 5% of 12.00
    expect(u.setupSpread).toBe(1000);
    expect(u.total).toBe(1000 + 200 + 60 + 1000);
    expect(u.variable).toBe(1260);
  });
  it("spreads setup over the batch size and rounds", () => {
    const rows = inputs({ parts: [part(1, { unit: 1 })], costs: [cost(1, { kind: "setup", amount: 100 })] });
    expect(unitCost(rows, 1).setupSpread).toBe(10000);
    expect(unitCost(rows, 3).setupSpread).toBe(3333);
    expect(unitCost(rows, 1000).setupSpread).toBe(10);
  });
  it("treats a batch size below one, a fraction or NaN as one unit", () => {
    const rows = inputs({ parts: [part(1, { unit: 1 })] });
    for (const n of [0, -4, NaN, 0.4]) expect(unitCost(rows, n).batchSize).toBe(1);
    expect(unitCost(rows, 7.9).batchSize).toBe(7);
  });
  it("adds a manufacturing method's per-unit cost", () => {
    const m: MethodRow = { id: 5, title: "Shell", method: "fdm", appliesTo: "ENC1", toolingCost: null, unitCost: 3.2 };
    const u = unitCost(inputs({ parts: [part(1, { unit: 1 })], methods: [m] }), 1);
    expect(u.linesSubtotal).toBe(320);
    expect(u.lines.at(-1)?.label).toBe("Shell (ENC1)");
  });
  it("lists rows typed before cost kinds existed and uses none of them", () => {
    const u = unitCost(inputs({ costs: [cost(1, { kind: null, title: "Prototype" })] }), 1);
    expect(u.ignored).toHaveLength(1);
    expect(u.total).toBe(0);
  });
  it("is the sum of its lines, exactly", () => {
    const u = unitCost(inputs({ parts: [part(1, { qty: 3, unit: 0.333 }), part(2, { qty: 7, unit: 0.1 })], costs: [cost(1, { kind: "scrap", percent: 3 })] }), 1);
    const sum = u.lines.reduce((a, l) => a + (l.amount ?? 0), 0);
    expect(u.total).toBe(sum);
  });
});

describe("fixed costs", () => {
  it("add tooling, certification, setup (once) and method tooling", () => {
    const f = fixedCosts(
      inputs({
        costs: [cost(1, { kind: "tooling", amount: 4000 }), cost(2, { kind: "certification", amount: 1500 }), cost(3, { kind: "setup", amount: 200 }), cost(4, { kind: "packaging", amount: 1 })],
        methods: [{ id: 9, title: "Mould", method: "injection", appliesTo: "", toolingCost: 8000, unitCost: null }],
      }),
    );
    expect(f.total).toBe(400000 + 150000 + 20000 + 800000);
    expect(f.lines).toHaveLength(4);
  });
  it("names a fixed row with no amount instead of counting zero", () => {
    const f = fixedCosts(inputs({ costs: [cost(1, { kind: "tooling", amount: null })] }));
    expect(f.total).toBe(0);
    expect(f.missing).toHaveLength(1);
  });
});

describe("channels", () => {
  const unit = unitCost(inputs({ parts: [part(1, { unit: 10 })] }), 1); // $10.00
  const none = fixedCosts(inputs());

  it("works margin from price, every fee, returns and advertising", () => {
    const [r] = channelResults(
      [channel(1, { price: 30, platformPercent: 15, platformFixed: 0.3, paymentPercent: 2.9, paymentFixed: 0.3, fulfilment: 3, returnsPercent: 4, adCost: 1.5 })],
      unit,
      none,
    );
    // price 3000; platform 450+30; payment 87+30 (2.9% of 3000 = 87); fulfilment 300; returns 120; ads 150
    expect(r.platformFee).toBe(480);
    expect(r.paymentFee).toBe(117);
    expect(r.margin).toBe(3000 - 1000 - 480 - 117 - 300 - 120 - 150);
    expect(r.marginPercent).toBeCloseTo((833 / 3000) * 100, 5);
    expect(r.complete).toBe(true);
    expect(r.how.at(-1)).toBe("Margin = $30.00 - $10.00 - $4.80 - $1.17 - $3.00 - $1.20 - $1.50 = $8.33");
  });
  it("has no margin without a price and names it", () => {
    const [r] = channelResults([channel(1, { platformPercent: 10 })], unit, none);
    expect(r.margin).toBeNull();
    expect(r.marginPercent).toBeNull();
    expect(r.breakEven).toBeNull();
    expect(r.missing.map((m) => m.what)).toContain("Channel 1: no price");
    expect(r.missing[0].href).toBe("/s/sales/channels");
  });
  it("is incomplete until the platform fee is entered, even as 0", () => {
    const [a] = channelResults([channel(1, { price: 20 })], unit, none);
    expect(a.complete).toBe(false);
    expect(a.margin).toBe(1000);
    const [b] = channelResults([channel(1, { price: 20, platformPercent: 0 })], unit, none);
    expect(b.complete).toBe(true);
  });
  it("is incomplete while the unit cost has unpriced lines", () => {
    const partial = unitCost(inputs({ parts: [part(1, { unit: 10 }), part(2)] }), 1);
    const [r] = channelResults([channel(1, { price: 20, platformPercent: 0 })], partial, none);
    expect(r.complete).toBe(false);
    expect(r.missing[0].what).toBe("Channel 1: unit cost is incomplete");
  });
  it("finds break-even in whole units, rounding up", () => {
    const fixed = fixedCosts(inputs({ costs: [cost(1, { kind: "tooling", amount: 1000 })] }));
    const [r] = channelResults([channel(1, { price: 25, platformPercent: 0 })], unit, fixed); // margin $15.00
    expect(r.breakEven?.units).toBe(67); // 100000 / 1500 = 66.67
    expect(r.breakEven?.reason).toBe("$1,000.00 fixed costs / $15.00 margin per unit = 67 units");
  });
  it("has break-even zero with no fixed costs", () => {
    const [r] = channelResults([channel(1, { price: 25, platformPercent: 0 })], unit, none);
    expect(r.breakEven?.units).toBe(0);
  });
  it("has no break-even when the margin is zero or negative", () => {
    const fixed = fixedCosts(inputs({ costs: [cost(1, { kind: "tooling", amount: 1000 })] }));
    const [zero] = channelResults([channel(1, { price: 10, platformPercent: 0 })], unit, fixed);
    expect(zero.margin).toBe(0);
    expect(zero.breakEven?.units).toBeNull();
    const [neg] = channelResults([channel(1, { price: 8, platformPercent: 0 })], unit, fixed);
    expect(neg.margin).toBe(-200);
    expect(neg.marginPercent).toBeCloseTo(-25);
    expect(neg.breakEven?.units).toBeNull();
  });
  it("handles a free product: no percent margin", () => {
    const [r] = channelResults([channel(1, { price: 0, platformPercent: 0 })], unit, none);
    expect(r.marginPercent).toBeNull();
  });
});

describe("cost by batch size", () => {
  const rows = inputs({
    parts: [part(1, { qty: 1, unit: 2, breaks: [{ qty: 100, unit: 1.5 }, { qty: 1000, unit: 1 }] })],
    costs: [cost(1, { kind: "setup", amount: 50 })],
  });
  it("follows price breaks and spreads setup", () => {
    const pts = costBySize(rows, [1000, 1, 100, 100]);
    expect(pts.map((p) => p.size)).toEqual([1, 100, 1000]);
    expect(pts.map((p) => p.unitCost)).toEqual([200 + 5000, 150 + 50, 100 + 5]);
  });
  it("reports how many lines are not priced at each size", () => {
    expect(costBySize(inputs({ parts: [part(1)] }), [1, 10]).map((p) => p.missing)).toEqual([1, 1]);
  });
});

describe("batches", () => {
  const batch = (id: number, over: Partial<BatchRow> = {}): BatchRow => ({ id, title: `Batch ${id}`, status: "planned", units: 100, targetDate: "", build: "", ...over });
  const rows = inputs({
    parts: [part(1, { qty: 2, unit: 1, breaks: [{ qty: 200, unit: 0.5 }] }), part(2)],
    costs: [cost(1, { kind: "setup", amount: 100 })],
    batches: [batch(1, { units: 100 }), batch(2, { units: 5 }), batch(3, { units: null })],
  });
  it("gives each batch its unit cost, the cash it needs and what is not priced", () => {
    const [a, b, c] = batchResults(rows);
    expect(a.unitCost).toBe(100 + 100); // 200 pieces ordered reach the break: 2 x $0.50, plus $1.00 of setup per unit
    expect(a.cash).toBe(100 * 100 + 10000);
    expect(a.missing.map((m) => m.what)).toEqual(["P2 Part 2: not priced"]);
    expect(b.unitCost).toBe(200 + 2000);
    expect(b.cash).toBe(5 * 200 + 10000);
    expect(c.units).toBeNull();
    expect(c.cash).toBeNull();
    expect(c.missing[0].what).toBe("Batch 3: no size");
  });
  it("shows the arithmetic", () => {
    expect(batchResults(rows)[0].how[1]).toBe("Cash = $1.00 per unit x 100 units + $100.00 setup = $200.00");
  });
});
