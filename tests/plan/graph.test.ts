import { describe, expect, inject, it } from "vitest";
import type { Item } from "@/lib/types";
import { planFromService, planGraph, plannerRequest, planUnavailable, UNLOCK_STORES, type PlannerResponse } from "@/lib/plan";
import { SEED_ADDITIONS, SEED_ITEMS } from "@/lib/seed";

let n = 0;
const item = (section: string, data: Record<string, unknown>, extra: Partial<Item> = {}): Item => ({
  id: ++n, projectId: "t", section, title: `row ${n}`, body: "", data, status: "open", sort: n, ...extra,
});
const step = (key: string, after: string[] = [], minutes = 10, extra: Partial<Item> = {}, section = "prototype/assembly") =>
  item(section, { key, after, minutes }, extra);
const decision = (key: string, data: Record<string, unknown> = {}, extra: Partial<Item> = {}) =>
  item("concept/decisions", { key, options: [{ id: "a", label: "A" }], chosen: "", ...data }, extra);
const pairs = (g: ReturnType<typeof planGraph>, rule?: string) =>
  g.edges.filter((e) => !rule || e.rule === rule).map((e) => `${e.from}>${e.to}`);

const seeded: Item[] = [...SEED_ITEMS, ...Object.values(SEED_ADDITIONS).flat()].map((r, i) => ({
  id: i + 1, projectId: "baggage-claims", section: r.section, title: r.title, body: r.body ?? "", data: (r.data ?? {}) as Record<string, unknown>, status: r.status ?? "open", sort: i,
}));

async function planned(items: Item[]) {
  const g = planGraph(items);
  const res = await fetch(`${inject("plannerUrl")}/plan`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plannerRequest(g)),
  });
  expect(res.status).toBe(200);
  return planFromService(g, (await res.json()) as PlannerResponse);
}

describe("planGraph nodes", () => {
  it("makes a step of every keyed row outside the decision tree, and a decision of every keyed decision row", () => {
    const g = planGraph([step("a"), decision("d"), item("prototype/assembly", { minutes: 5 }), item("concept/decisions", { options: [] })]);
    expect(g.nodes.map((x) => [x.id, x.kind])).toEqual([["a", "step"], ["d", "decision"]]);
  });
  it("counts a closed step as zero remaining minutes and keeps its stored minutes", () => {
    const g = planGraph([step("a", [], 30, { status: "done" }), step("b", [], 20, { status: "in hand" }), step("c", [], 15)]);
    expect(g.nodes.map((x) => [x.minutes, x.remaining, x.done])).toEqual([[30, 0, true], [20, 0, true], [15, 15, false]]);
  });
  it("gives a decision zero minutes and marks it done only when an option is chosen", () => {
    const g = planGraph([decision("open", { minutes: 99 }), decision("made", { chosen: "a" })]);
    expect(g.nodes.map((x) => [x.minutes, x.remaining, x.done])).toEqual([[0, 0, false], [0, 0, true]]);
  });
  it("reads a negative or unreadable duration as zero", () => {
    expect(planGraph([step("a", [], -5), item("x/y", { key: "b", minutes: "lots" })]).nodes.map((x) => x.minutes)).toEqual([0, 0]);
  });
  it("plans the first row of a repeated key and reports the key", () => {
    const g = planGraph([step("a", [], 5), step("a", [], 50)]);
    expect([g.nodes.length, g.nodes[0].minutes, g.duplicates]).toEqual([1, 5, ["a"]]);
  });
});

describe("planGraph edges", () => {
  it("links a -> b for each key in step b's after, read from an array or an older comma string", () => {
    const g = planGraph([step("a"), step("b", ["a"]), item("x/y", { key: "c", after: "a, b" })]);
    expect(pairs(g, "after")).toEqual(["a>b", "a>c", "b>c"]);
  });
  it("links d1 -> d2 for each key in decision d2's dependsOn", () => {
    const g = planGraph([decision("d1"), decision("d2", { dependsOn: ["d1"] }), decision("d3", { dependsOn: "d1, d2" })]);
    expect(pairs(g, "dependsOn")).toEqual(["d1>d2", "d1>d3", "d2>d3"]);
    expect(g.nodes.find((x) => x.id === "d3")!.after).toEqual(["d1", "d2"]);
  });
  it("links a decision to every step in a section it unlocks, and to nothing outside it", () => {
    const g = planGraph([
      decision("go", { unlocks: ["prototype/assembly"] }),
      step("s1"), step("s2", ["s1"]), step("t1", [], 5, {}, "prototype/tests"),
    ]);
    expect(pairs(g, "unlocks")).toEqual(["go>s1", "go>s2"]);
  });
  it("resolves an unlocked section that is a view onto another store to that store's rows", () => {
    const g = planGraph([
      decision("buy", { unlocks: "prototype/sourcing" }), // rows live in design/bom
      decision("solder", { unlocks: "prototype/wiring" }), // rows live in design/wiring
      step("part", [], 5, {}, "design/bom"), step("joint", [], 5, {}, "design/wiring"),
    ]);
    expect(pairs(g, "unlocks")).toEqual(["buy>part", "solder>joint"]);
    expect([UNLOCK_STORES.get("prototype/sourcing"), UNLOCK_STORES.get("design/layout"), UNLOCK_STORES.get("design/schematic")]).toEqual(["design/bom", "design/bom", "design/wiring"]);
  });
  it("ignores unlocks entries that are not sections, without reporting them", () => {
    const g = planGraph([decision("go", { unlocks: ["the whole launch", "prototype/assembly"] }), step("s1")]);
    expect([pairs(g), g.dropped]).toEqual([["go>s1"], []]);
  });
  it("does not let a decision unlock other decisions", () => {
    const g = planGraph([decision("go", { unlocks: ["concept/decisions"] }), decision("next")]);
    expect(g.edges).toEqual([]);
  });
  it("lets a step wait on a decision through its after", () => {
    expect(pairs(planGraph([decision("go"), step("s", ["go"])]))).toEqual(["go>s"]);
  });
  it("keeps one edge when two rules link the same pair, under the first rule", () => {
    const g = planGraph([decision("go", { unlocks: ["prototype/assembly"] }), step("s", ["go"])]);
    expect(g.edges).toEqual([{ from: "go", to: "s", rule: "after" }]);
  });
  it("drops and reports links to keys that do not exist and links to itself", () => {
    const g = planGraph([step("a", ["a", "ghost"]), decision("d", { dependsOn: ["d", "nobody"] }), step("b", ["a"])]);
    expect(pairs(g)).toEqual(["a>b"]);
    expect(g.dropped).toEqual([
      { from: "a", to: "a", rule: "after", reason: "self" },
      { from: "ghost", to: "a", rule: "after", reason: "unknown key" },
      { from: "d", to: "d", rule: "dependsOn", reason: "self" },
      { from: "nobody", to: "d", rule: "dependsOn", reason: "unknown key" },
    ]);
    expect(g.nodes.map((x) => x.after)).toEqual([[], [], ["a"]]);
  });
});

describe("planUnavailable", () => {
  it("lists the nodes with no order, no wave, no times and nothing critical", () => {
    const p = planUnavailable(planGraph([step("a"), step("b", ["a"])]), "not running");
    expect([p.engine, p.order, p.criticalPath, p.totalMinutes, p.plannedMinutes, p.note]).toEqual(["unavailable", [], [], 0, 0, "not running"]);
    expect(p.nodes.map((x) => [x.wave, x.start, x.finish, x.critical, x.blocked])).toEqual([[-1, 0, 0, false, false], [-1, 0, 0, false, false]]);
    expect(p.edges).toEqual([{ from: "a", to: "b", rule: "after" }]);
  });
});

describe("the planner on built graphs", () => {
  it("blocks a loop and everything downstream of it", async () => {
    const p = await planned([step("a", ["b"]), step("b", ["a"]), step("c", ["b"]), step("free")]);
    expect(p.cycles).toEqual([["a", "b"]]);
    expect(p.order).toEqual(["free"]);
    expect(p.nodes.map((x) => [x.id, x.blocked, x.wave])).toEqual([["a", true, -1], ["b", true, -1], ["c", true, -1], ["free", false, 0]]);
  });
  it("lets an undecided decision gate the steps it unlocks", async () => {
    const p = await planned([decision("go", { unlocks: "prototype/assembly" }), step("s1", [], 10), step("s2", ["s1"], 5)]);
    expect(p.order).toEqual(["go", "s1", "s2"]);
    expect(p.criticalPath).toEqual(["go", "s1", "s2"]);
    expect([p.totalMinutes, p.plannedMinutes]).toEqual([15, 15]);
  });
});

describe("the seeded concept", () => {
  const g = planGraph(seeded);
  it("has 17 nodes: 9 steps and 8 decisions", () => {
    expect(g.nodes.length).toBe(17);
    expect(g.nodes.filter((x) => x.kind === "step").map((x) => x.id)).toEqual(["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]);
    expect(g.nodes.filter((x) => x.kind === "decision").map((x) => x.id)).toEqual(["go", "name", "enclosure", "gate1", "channel", "ks-goal", "stack", "gate2"]);
    expect(g.nodes.filter((x) => x.done).map((x) => x.id)).toEqual(["channel"]);
  });
  it("has 24 edges: 10 after, 5 dependsOn, 9 unlocks; nothing dropped or repeated", () => {
    expect(pairs(g, "after")).toEqual(["p0>p1", "p0>p2", "p2>p3", "p3>p4", "p0>p5", "p1>p6", "p4>p6", "p5>p6", "p6>p7", "p7>p8"]);
    expect(pairs(g, "dependsOn")).toEqual(["go>gate1", "gate1>channel", "channel>ks-goal", "gate1>stack", "gate1>gate2"]);
    expect(pairs(g, "unlocks")).toEqual(["go>p0", "go>p1", "go>p2", "go>p3", "go>p4", "go>p5", "go>p6", "go>p7", "go>p8"]);
    expect([g.edges.length, g.dropped, g.duplicates]).toEqual([24, [], []]);
  });
  it("plans through the real planner: go, p0, p1, p6, p7, p8; 430 minutes left of 430", async () => {
    const p = await planned(seeded);
    expect(p.engine).toBe("networkx");
    expect(p.criticalPath).toEqual(["go", "p0", "p1", "p6", "p7", "p8"]);
    expect([p.totalMinutes, p.plannedMinutes]).toEqual([430, 430]);
    expect(p.cycles).toEqual([]);
    expect(p.order.length).toBe(17);
  });
  it("puts the electronics branch on the critical path once bench and print are done", async () => {
    const done = seeded.map((i) => (["p0", "p1"].includes(String(i.data.key)) && i.section === "prototype/assembly" ? { ...i, status: "done" } : i));
    const p = await planned(done);
    expect(p.criticalPath).toEqual(["go", "p0", "p2", "p3", "p4", "p6", "p7", "p8"]);
    expect([p.totalMinutes, p.plannedMinutes]).toEqual([190, 205]);
  });
});
