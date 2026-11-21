// D9: the parts-fit check covers part against part and the floor, with "held inside" telling a battery in
// its holder apart from a collision; a control is never opened in the floor unless its row asks; Place puts a
// part at the first free spot. The reviewer's reproduction: three parts at the default position.
import { describe, expect, it } from "vitest";
import { generateCaseMaker } from "@/lib/enclosure/casemaker";
import { computeChecks } from "@/lib/enclosure/checks";
import { buildSpec } from "@/lib/enclosure/spec";
import { findOverlaps, firstFreeSpot, type LayoutPart } from "@/components/layout/geom";
import { relationOf } from "@/lib/geometry/overlap";
import { exampleParts, part } from "./helpers";

const box = (size: number[], pos: number[]) => ({ shape: "box", size, pos, explode: [0, 0, 0], basis: "typical" });
const fit = async (items: ReturnType<typeof part>[]) => {
  const spec = buildSpec({ items, params: { lidType: "slip" } });
  const c = await computeChecks(spec, await generateCaseMaker(spec));
  return { spec, check: c.find((x) => x.key === "parts-fit")! };
};

describe("parts fit, part against part", () => {
  it("three parts at the default position overlap, and the check says so", async () => {
    const { check } = await fit([part(1, "P1", "Board", box([63, 10, 25], [0, 5, 0])), part(2, "P2", "Sensor", box([20, 5, 15], [30, 2.5, 30])), part(3, "P3", "Holder", box([77, 21, 19], [0, 10.5, 0]))]);
    expect(check.ok).toBe(false);
    expect(check.detail).toMatch(/P1 and P3 overlap by 63 x 10 x 19 mm/);
  }, 60_000);

  it("the example's batteries in their holder are held, not a collision", async () => {
    const { check } = await fit(exampleParts());
    expect(check.detail).not.toMatch(/BT1 and BAT overlap/);
    expect(check.detail).toMatch(/Held one inside the other, not a collision: BAT in BT1/);
  }, 60_000);

  it("a part stated to sit inside another is held even when it sticks out", () => {
    const a = { ref: "CELL", box: { min: [0, 0, 0], max: [10, 10, 30] }, insideOf: "HOLD" };
    const b = { ref: "HOLD", box: { min: [0, 0, 20], max: [10, 10, 40] } };
    expect(relationOf(a, b)).toEqual({ kind: "contained", inner: "CELL", outer: "HOLD", why: "row" });
    expect(relationOf({ ...a, insideOf: undefined }, b).kind).toBe("collision");
  });

  it("a part resting on the floor passes the floor check", async () => {
    const { check } = await fit([part(1, "P1", "Board", box([30, 10, 20], [0, 3, 0]))].map((p) => p));
    // the envelope is worked out from the parts, so a part on the floor passes
    expect(check.detail).not.toMatch(/into the floor/);
  }, 60_000);
});

describe("openings for controls", () => {
  it("a switch placed in the middle of the floor is not opened in the floor", () => {
    const spec = buildSpec({ items: [part(1, "ENC1", "Enclosure", { ...box([80, 40, 60], [0, 20, 0]), shape: "shell" }), part(2, "S1", "Power switch", box([4, 4, 9], [0, 4, 0]), { kind: "switch" })] });
    expect(spec.openings.filter((o) => o.face === "bottom")).toEqual([]);
  });
  it("a switch against a side wall is opened in that wall", () => {
    const spec = buildSpec({ items: [part(1, "ENC1", "Enclosure", { ...box([80, 40, 60], [0, 20, 0]), shape: "shell" }), part(2, "S1", "Power switch", box([4, 4, 9], [-36, 4, 0]), { kind: "switch" })] });
    expect(spec.openings.map((o) => o.face)).toEqual(["left"]);
  });
  it("the floor is opened when the row asks for it", () => {
    const spec = buildSpec({ items: [part(1, "ENC1", "Enclosure", { ...box([80, 40, 60], [0, 20, 0]), shape: "shell" }), part(2, "S1", "Power switch", box([4, 4, 9], [0, 4, 0]), { kind: "switch", opening: { face: "bottom" } })] });
    expect(spec.openings.map((o) => o.face)).toEqual(["bottom"]);
  });
});

describe("placing a part", () => {
  const lp = (id: number, ref: string, size: number[], pos: number[]): LayoutPart => ({ id, ref, label: ref, geometry: box(size, pos) as LayoutPart["geometry"] });
  it("goes to the first free spot, not on top of another part", () => {
    const placed = [lp(1, "P1", [40, 10, 20], [-15, 5, -15])];
    const inner = { min: [-38, 2, -28], max: [38, 40, 28] };
    const spot = firstFreeSpot([20, 5, 15], placed, inner);
    const next = lp(2, "P2", [20, 5, 15], [spot.x, 2.5, spot.z]);
    expect(findOverlaps([...placed, next])).toEqual([]);
    expect(spot.x - 10).toBeGreaterThanOrEqual(inner.min[0] - 1e-9);
  });
  it("the layout check does not warn about a battery in its holder", () => {
    const parts = [lp(1, "BT1", [58, 17, 48], [0, 10.5, 0]), { ...lp(2, "BAT", [43.5, 14.5, 50.5], [0, 10.5, 0]) }];
    expect(findOverlaps(parts)).toEqual([]);
  });
});
