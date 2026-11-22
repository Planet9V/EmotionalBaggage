// Wiring check 2: one cost. The Optimise page's cost measurement and Unit economics work the cost
// of the parts and the unit cost out with the same function, from the same rows, at the same batch size.
import { describe, expect, it } from "vitest";
import { describe as words, measureCost } from "@/lib/ai/drafts/measure";
import { referenceUnitCost } from "@/lib/economics/compute";
import { readEconomics } from "@/lib/economics/read";
import type { Item } from "@/lib/types";

const item = (id: number, section: string, title: string, data: Record<string, unknown> = {}): Item => ({ id, projectId: "p", section, title, body: "", data, status: "open", sort: id });

// Priced the way Part prices and Sourcing price a part: quantity x unit price, a price break, a chosen offer. No typed line cost.
const parts = [
  item(1, "design/bom", "Dev board", { ref: "U1", qty: 1, unit: 9.5, priceBreaks: [{ qty: 50, unit: 7.25 }] }),
  item(2, "design/bom", "M3 screws", { ref: "HW1", qty: 4, unit: 0.1 }),
  item(3, "design/bom", "Speaker", { ref: "LS1", qty: 1, line: 1.8 }),
];
const rest = {
  economics: [item(4, "production/economics", "Assembly", { kind: "labour", labourMinutes: 6, rate: 30 })],
  channels: [],
  methods: [],
  batches: [item(5, "production/batches", "Pilot", { units: 50 })],
  printJobs: [],
};

describe("one cost", () => {
  const unit = referenceUnitCost(readEconomics({ parts, ...rest }, "USD"));
  const m = measureCost(parts, rest, "USD");

  it("Optimise prices every part Unit economics prices, at the same amount", () => {
    expect(unit.partsSubtotal).toBe(725 + 40 + 180);
    expect(m.priced).toBe(3);
    expect(m.total).toBe(unit.partsSubtotal / 100);
  });

  it("Optimise states the unit cost Unit economics shows, at the same batch size", () => {
    expect(m.unitCost).toBe(unit.total / 100);
    expect(m.batchSize).toBe(unit.batchSize);
    expect(words("cost", m, "USD")).toBe("9.45 for 3 parts; unit cost 12.45 at 50 units");
  });

  it("a part Unit economics cannot price is not priced on Optimise either, and the other way round", () => {
    const some = [...parts, item(6, "design/bom", "Label", { qty: 1 })];
    const u = referenceUnitCost(readEconomics({ parts: some, ...rest }, "USD"));
    const c = measureCost(some, rest, "USD");
    expect(c.total).toBeNull();
    expect(c.priced).toBe(u.lines.filter((l) => l.group === "part" && l.amount !== null).length);
    expect(c.pricedTotal).toBe(u.partsSubtotal / 100);
  });
});
