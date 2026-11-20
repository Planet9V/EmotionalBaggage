import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import { decisionReady, partsByRef, pinsOf, readWires, stepsFromItems, sumLine, toDecision, toPart } from "@/lib/domain";
import { SEED_ADDITIONS, SEED_ITEMS } from "@/lib/seed";
import { planFallback } from "@/lib/plan";

let n = 0;
const item = (section: string, data: Record<string, unknown>, extra: Partial<Item> = {}): Item => ({
  id: ++n, projectId: "t", section, title: `row ${n}`, body: "", data, status: "open", sort: n, ...extra,
});
const seeded = [...SEED_ITEMS, ...Object.values(SEED_ADDITIONS).flat()].map((r, i) => ({
  id: i + 1, projectId: "baggage-claims", section: r.section, title: r.title, body: r.body ?? "", data: (r.data ?? {}) as Record<string, unknown>, status: r.status ?? "open", sort: i,
}));

describe("toPart", () => {
  it("leaves an unset quantity and cost as null, not 0 or 1", () => {
    const p = toPart(item("design/bom", { ref: "U1" }));
    expect([p.qty, p.line, p.geometry, p.schematic]).toEqual([null, null, null, null]);
  });
  it("reads numbers, trims the ref, removes repeated pins", () => {
    const p = toPart(item("design/bom", { ref: " U1 ", qty: "2", line: 9.5, pins: ["3V3", "GND", "3V3", ""] }));
    expect([p.ref, p.qty, p.line, p.pins]).toEqual(["U1", 2, 9.5, ["3V3", "GND"]]);
  });
  it("treats geometry that breaks the schema as no geometry", () => {
    expect(toPart(item("design/bom", { geometry: { shape: "box", size: [1, 0, 1] } })).geometry).toBeNull();
  });
  it("totals the seeded parts list at 64.80 across 16 rows", () => {
    const parts = seeded.filter((i) => i.section === "design/bom").map(toPart);
    expect(parts.length).toBe(16);
    expect(sumLine(parts).toFixed(2)).toBe("64.80");
  });
  it("indexes parts by ref, first one wins", () => {
    const m = partsByRef([item("design/bom", { ref: "R1", qty: 1 }), item("design/bom", { ref: "R1", qty: 9 }), item("design/bom", {})]);
    expect([m.size, m.get("R1")?.qty]).toEqual([1, 1]);
  });
});

describe("wires", () => {
  it("reads the 18 seeded wires in soldering order and finds a part's pins", () => {
    const wires = readWires(seeded.filter((i) => i.section === "design/wiring"));
    expect(wires.length).toBe(18);
    expect(wires.map((w) => w.order)).toEqual([...wires.map((w) => w.order)].sort((a, b) => a - b));
    expect(pinsOf("U1", wires).length).toBeGreaterThan(3);
  });
  it("ignores a row that does not name both ends and falls back to signal for an unknown class", () => {
    expect(readWires([item("design/wiring", { from: "U1" })])).toEqual([]);
    expect(readWires([item("design/wiring", { from: "U1", to: "U2", netClass: "odd" })])[0].netClass).toBe("signal");
  });
});

describe("decisions", () => {
  it("reads key lists whether stored as an array or an older comma string", () => {
    const a = toDecision(item("concept/decisions", { key: "a", dependsOn: ["x", "y"], unlocks: "design/model, prototype/printing" }))!;
    expect([a.dependsOn, a.unlocks]).toEqual([["x", "y"], ["design/model", "prototype/printing"]]);
  });
  it("is ready only when everything it depends on is decided", () => {
    const go = toDecision(item("concept/decisions", { key: "go", chosen: "" }))!;
    const next = toDecision(item("concept/decisions", { key: "next", dependsOn: ["go"] }))!;
    expect(decisionReady(next, [go, next])).toBe(false);
    expect(decisionReady(next, [{ ...go, chosen: "yes" }, next])).toBe(true);
  });
  it("reads the eight seeded decisions", () => {
    expect(seeded.map(toDecision).filter((d) => d && d.item.section === "concept/decisions").length).toBe(8);
  });
});

describe("steps and the plan", () => {
  it("drops links to steps that do not exist and to itself", () => {
    const steps = stepsFromItems([item("x/y", { key: "a", after: ["a", "ghost"] }), item("x/y", { key: "b", after: "a" })]);
    expect(steps.map((s) => s.after)).toEqual([[], ["a"]]);
  });
  it("plans the seeded assembly: critical path p0, p1, p6, p7, p8 at 430 minutes", () => {
    const plan = planFallback(stepsFromItems(seeded.filter((i) => i.section === "prototype/assembly")));
    expect(plan.criticalPath).toEqual(["p0", "p1", "p6", "p7", "p8"]);
    expect(plan.totalMinutes).toBe(430);
    expect(plan.cycles).toEqual([]);
  });
});
