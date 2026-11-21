import { describe, expect, it } from "vitest";
import { isReady, READINESS_CHECKS, readiness, type ReadinessRows } from "@/lib/economics/readiness";
import type { Item } from "@/lib/types";

let next = 1;
const item = (section: string, title: string, data: Record<string, unknown> = {}, status = "open"): Item => ({ id: next++, projectId: "p", section, title, body: "", data, status, sort: next });
const empty = (): ReadinessRows => ({ parts: [], economics: [], channels: [], methods: [], batches: [], suppliers: [], tests: [], compliance: [] });

/** A concept that meets every check. */
function ready(): ReadinessRows {
  return {
    ...empty(),
    parts: [item("design/bom", "Board", { ref: "U1", qty: 1, unit: 5, supplier: "ACME" })],
    suppliers: [item("production/suppliers", "Acme", { code: "ACME" }, "approved")],
    channels: [item("sales/channels", "Shop", { price: 20, platformPercent: 0 })],
    tests: [item("prototype/tests", "Boots", {}, "pass")],
    compliance: [item("production/compliance", "Toy safety", {}, "done"), item("production/compliance", "Battery", {}, "does not apply")],
    batches: [item("production/batches", "Run A", { units: 100, build: "Rev A" }, "planned")],
  };
}
const by = (rows: ReadinessRows, opts = {}) => Object.fromEntries(readiness(rows, opts).map((c) => [c.key, c]));

describe("readiness", () => {
  it("lists the four checks in order, with labels, as an export for the gates", () => {
    expect(READINESS_CHECKS.map((c) => c.key)).toEqual(["tests", "compliance", "parts", "economics"]);
    expect(readiness(empty()).map((c) => c.key)).toEqual(READINESS_CHECKS.map((c) => c.key));
  });
  it("is met on all four for a complete concept", () => {
    const checks = readiness(ready());
    expect(checks.every((c) => c.met)).toBe(true);
    expect(isReady(checks)).toBe(true);
  });
  it("is met on none, with a reason each, for an empty concept", () => {
    const checks = readiness(empty());
    expect(checks.some((c) => c.met)).toBe(false);
    for (const c of checks) {
      expect(c.detail).toMatch(/no |There are no/i);
      expect(c.href).toMatch(/^\/s\//);
    }
  });

  it("tests: every applicable test must pass, and names the ones that do not", () => {
    const rows = ready();
    rows.tests.push(item("prototype/tests", "Drop test", {}, "fail"), item("prototype/tests", "Range", {}, "not run"));
    const c = by(rows).tests;
    expect(c.met).toBe(false);
    expect(c.detail).toBe("1 of 3 tests passed.");
    expect(c.missing).toEqual(["Drop test (fail)", "Range (not run)"]);
  });
  it("tests: only tests for the batch's build count, and tests naming no build count for all", () => {
    const rows = ready();
    rows.tests.push(item("prototype/tests", "Old build soak", { build: "Rev A-" }, "fail"), item("prototype/tests", "Rev A soak", { build: "Rev A" }, "pass"));
    const batchId = rows.batches[0].id;
    expect(by(rows, { batchId }).tests.met).toBe(true);
    expect(by(rows, { batchId }).tests.detail).toContain('for build "Rev A"');
    expect(by(rows).tests.met).toBe(false); // no batch given: every test counts
  });

  it("compliance: a row still to check, or a draft, is not decided", () => {
    const rows = ready();
    rows.compliance.push(item("production/compliance", "Radio", {}, "to check"), item("production/compliance", "Mains", {}, "draft"));
    const c = by(rows).compliance;
    expect(c.met).toBe(false);
    expect(c.missing).toEqual(["Radio (to check)", "Mains (draft)"]);
  });
  it("compliance: no rows is not met", () => {
    const rows = ready();
    rows.compliance = [];
    expect(by(rows).compliance.met).toBe(false);
  });

  it("parts: an unpriced part, a part with no supplier and a part with a dropped supplier each stop it", () => {
    const rows = ready();
    rows.parts.push(item("design/bom", "Cable", { ref: "C1", qty: 1, supplier: "ACME" }));
    rows.parts.push(item("design/bom", "Case", { ref: "E1", qty: 1, unit: 3 }));
    rows.parts.push(item("design/bom", "Fan", { ref: "F1", qty: 1, unit: 3, supplier: "GONE" }));
    rows.suppliers.push(item("production/suppliers", "Gone", { code: "GONE" }, "dropped"));
    const c = by(rows).parts;
    expect(c.met).toBe(false);
    expect(c.missing).toEqual(["C1 Cable: not priced", "E1 Case: no supplier", 'F1 Fan: supplier "GONE" is not a current supplier']);
  });
  it("parts: price breaks are read at the batch's size", () => {
    const rows = ready();
    rows.parts = [item("design/bom", "Board", { ref: "U1", qty: 1, priceBreaks: [{ qty: 100, unit: 1 }], supplier: "ACME" })];
    expect(by(rows, { batchId: rows.batches[0].id }).parts.met).toBe(true); // 100 units reaches the break
    expect(by(rows).parts.met).toBe(false); // one unit is below the first break
  });

  it("economics: needs a channel with a price, a platform fee and a fully priced unit cost", () => {
    const rows = ready();
    rows.channels = [item("sales/channels", "No price", { platformPercent: 5 }), item("sales/channels", "No fee", { price: 20 })];
    const c = by(rows).economics;
    expect(c.met).toBe(false);
    expect(c.missing).toContain("No price: no price");
    expect(c.missing).toContain("No fee: platform fee not entered");
    rows.channels.push(item("sales/channels", "Complete", { price: 20, platformPercent: 5 }));
    expect(by(rows).economics.met).toBe(true);
    expect(by(rows).economics.detail).toBe("1 channel complete: Complete.");
  });
  it("economics: an unpriced part makes every channel incomplete", () => {
    const rows = ready();
    rows.parts.push(item("design/bom", "Cable", { ref: "C1", qty: 1 }));
    expect(by(rows).economics.met).toBe(false);
  });
});
