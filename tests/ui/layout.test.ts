// The three automatic layouts are library layouts now: dagre for the decision tree, elkjs for the build
// order and for pins and wires. These check what a reader relies on: nothing overlaps, flow runs left to right.
import { describe, expect, it } from "vitest";
import { buildTree, layout, CARD_H, CARD_W, OPT_H } from "@/components/decisions/model";
import { elkFlow } from "@/lib/graphLayout";
import { buildGraph } from "@/components/schematic/model";
import type { Decision } from "@/lib/domain";

const dec = (key: string, parent: string, options = 0, sort = 0): Decision =>
  ({
    item: { id: sort, sort } as never, key, parent, question: key, context: "", chosen: "", dependsOn: [], unlocks: [], source: "",
    options: Array.from({ length: options }, (_, i) => ({ id: `o${i}`, label: `Option ${i}` })),
  }) as unknown as Decision;

describe("decision tree layout (dagre)", () => {
  const all = [dec("a", "", 3, 1), dec("b", "a", 0, 2), dec("c", "a", 2, 3), dec("d", "c", 0, 4), dec("e", "", 0, 5)];
  const byKey = new Map(all.map((d) => [d.key, d]));
  const tree = buildTree(all, byKey);
  const placed = layout({ tree, byKey, expanded: new Set(["a", "c"]), only: null, chosenOnly: false });
  const at = (k: string) => placed.find((p) => p.kind === "decision" && p.key === k)!;

  it("puts children to the right of their parent, one column per depth", () => {
    expect(at("b").x).toBeGreaterThan(at("a").x + CARD_W);
    expect(at("b").x).toBe(at("c").x);
    expect(at("d").x).toBeGreaterThan(at("c").x);
  });

  it("never overlaps two cards, or a card and the options under another", () => {
    const boxes = placed.map((p) => ({ x: p.x, y: p.y, w: p.kind === "decision" ? CARD_W : 220, h: p.kind === "decision" ? CARD_H : OPT_H }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
  });

  it("stacks the options of an open decision under its card", () => {
    const opts = placed.filter((p) => p.kind === "option" && p.key === "a");
    expect(opts).toHaveLength(3);
    expect(opts.every((o) => o.y >= at("a").y + CARD_H)).toBe(true);
  });
});

describe("elkFlow", () => {
  it("lays steps out left to right in dependency order and survives a loop", async () => {
    const n = (id: string) => ({ id, width: 100, height: 40 });
    const pos = await elkFlow([n("a"), n("b"), n("c"), n("d")], [{ id: "1", source: "a", target: "b" }, { id: "2", source: "b", target: "c" }, { id: "3", source: "a", target: "d" }]);
    expect(pos.a!.x).toBeLessThan(pos.b!.x);
    expect(pos.b!.x).toBeLessThan(pos.c!.x);
    const loop = await elkFlow([n("a"), n("b")], [{ id: "1", source: "a", target: "b" }, { id: "2", source: "b", target: "a" }]);
    expect(Object.keys(loop).sort()).toEqual(["a", "b"]);
  });
});

describe("schematic positions", () => {
  it("uses the elkjs positions it is given and still places every part when it has none", () => {
    const part = (ref: string) => ({ item: { id: 1, data: {} }, ref, title: ref, pins: [], schematic: null }) as never;
    const wire = { item: { id: 9, data: {} }, from: "P1", fromPin: "A", to: "P2", toPin: "B", net: "N", netClass: "signal", via: "", order: 1 } as never;
    const none = buildGraph([part("P1"), part("P2")], [wire], {});
    expect(new Set(none.nodes.map((x) => `${x.pos.x},${x.pos.y}`)).size).toBe(none.nodes.length);
    const given = buildGraph([part("P1"), part("P2")], [wire], {}, false, { P1: { x: 5, y: 7 }, P2: { x: 500, y: 7 } });
    expect(given.nodes.find((x) => x.ref === "P1")!.pos).toEqual({ x: 5, y: 7 });
  });
});
