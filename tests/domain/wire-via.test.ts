// The removed wire field (integration item 6): a part in series is its own part with two wires since
// migration 0014, and `wireData.via` may only be "". Nothing reads it any more, so a stray value on an
// old row is never drawn, routed, soldered or traced.
import { describe, expect, it } from "vitest";
import { toPart, toWire } from "@/lib/domain";
import { buildHarnessRequest } from "@/lib/geometry/harness";
import { impactGraph } from "@/lib/ai/drafts/impact";
import { connectionsByPart, consumables, sequence } from "@/components/buildsheet/derive";
import { CSV_HEADER } from "@/components/schematic/model";
import type { Item } from "@/lib/types";

const item = (id: number, section: string, title: string, data: Record<string, unknown>): Item => ({ id, projectId: "p", section, title, body: "", data, status: "to solder", sort: id });
const parts = [item(1, "design/bom", "Board", { ref: "U1" }), item(2, "design/bom", "Module", { ref: "U2" }), item(3, "design/bom", "Resistor", { ref: "R1" })];
// an old row that still carries a part in series
const wire = item(10, "design/wiring", "Old wire", { from: "U1", fromPin: "TX", to: "U2", toPin: "RX", via: "R1", order: 1 });

describe("wireData.via has no readers", () => {
  it("the wire reader does not expose it", () => {
    expect("via" in toWire(wire)!).toBe(false);
  });
  it("the harness request, the build sheet and the CSV do not carry it", () => {
    const w = toWire(wire)!;
    const { request } = buildHarnessRequest("T", parts.map(toPart), [w], new Map());
    expect(request!.wires[0]).not.toHaveProperty("via");
    const blocks = connectionsByPart(sequence([w]));
    expect(blocks.map((b) => b.ref).sort()).toEqual(["U1", "U2"]);
    expect(blocks.flatMap((b) => b.rows).some((r) => r.pin === "in series")).toBe(false);
    expect(consumables([w])).toEqual({ wireJoints: 2, joints: 2, headers: [] });
    expect(CSV_HEADER).not.toContain("via");
  });
  it("the impact graph does not link the wire to a part only named as via", () => {
    const g = impactGraph([...parts, wire]);
    expect(g.edges.some((e) => e.why.includes("via"))).toBe(false);
    expect(g.edges.some((e) => e.from === "i3" && e.to === "i10")).toBe(false);
  });
});
