import { describe, expect, it } from "vitest";
import { buildSpec, enclosureOffered } from "@/lib/enclosure/spec";
import { exampleParts, part } from "./helpers";

describe("spec from parts", () => {
  it("takes the envelope from the shell and finds the three openings of the example", () => {
    const spec = buildSpec({ items: exampleParts() });
    expect(spec.envelope).toBe("shell");
    expect(spec.outer.min).toEqual([-40, 0, -30]);
    expect(spec.outer.max).toEqual([40, 42, 30]);
    const by = Object.fromEntries(spec.openings.map((o) => [o.partRef, o]));
    expect(Object.keys(by).sort()).toEqual(["S1", "S2", "SPK1"]);
    expect(by.S1.face).toBe("left");
    expect(by.S2.face).toBe("right");
    expect(by.SPK1.face).toBe("top");
    expect(by.SPK1.shape).toBe("circle");
    expect(spec.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
  it("puts the PCB on standoffs at its assumed holes, leaving out one that a part sits over", () => {
    const spec = buildSpec({ items: exampleParts() });
    expect(spec.standoffs?.holes).toHaveLength(3);
    expect(spec.standoffs?.dropped.length).toBe(1);
    expect(spec.standoffs?.assumed).toBe(true);
    expect(spec.standoffs?.height).toBeCloseTo(19.2, 5);
  });
  it("ignores a strap outside the envelope", () => {
    const spec = buildSpec({ items: exampleParts() });
    expect(spec.parts.find((p) => p.ref === "STR1")?.role).toBe("outside");
  });
});

describe("no shell", () => {
  it("sizes the box from the parts, the clearance and the walls", () => {
    const items = [part(1, "A", "Board", { shape: "box", size: [20, 10, 30], pos: [0, 5, 0] })];
    const spec = buildSpec({ items, params: { clearance: 1, wallThickness: 2, floorThickness: 2, lidThickness: 2 } });
    expect(spec.envelope).toBe("parts");
    expect(spec.outer.max[0] - spec.outer.min[0]).toBe(26);
    expect(spec.outer.max[1] - spec.outer.min[1]).toBe(15);
    expect(spec.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
  it("is not offered without a part that has a box", () => {
    expect(enclosureOffered([part(1, "A", "Wood block", null)])).toBe(false);
    expect(enclosureOffered([part(1, "A", "Wood block", { shape: "box", size: [1, 1, 1] })])).toBe(true);
    expect(enclosureOffered([part(1, "E", "Shell", { shape: "shell", size: [1, 1, 1] })])).toBe(false);
  });
  it("returns an error and no box when nothing has a box", () => {
    const spec = buildSpec({ items: [part(1, "A", "Wood block", null)] });
    expect(spec.issues[0].code).toBe("no-parts");
  });
});

describe("a row can state its kind and its opening", () => {
  const shell = { shape: "shell", size: [60, 30, 40], pos: [0, 15, 0] };
  it("uses data.kind and data.opening", () => {
    const items = [
      part(1, "E", "Shell", shell),
      part(2, "D1", "Thing", { shape: "box", size: [10, 4, 10], pos: [0, 10, 0] }, { kind: "display", opening: { face: "top", width: 12, height: 8 } }),
    ];
    const spec = buildSpec({ items });
    const o = spec.openings[0];
    expect(o).toMatchObject({ face: "top", width: 12, height: 8, source: "row" });
    expect(spec.parts[1]).toMatchObject({ kind: "display", kindFrom: "row" });
  });
  it("lets a row switch its opening off", () => {
    const items = [part(1, "E", "Shell", shell), part(2, "S", "Mode button", { shape: "box", size: [6, 5, 6], pos: [28, 10, 0] }, { opening: { off: true } })];
    expect(buildSpec({ items }).openings).toHaveLength(0);
  });
  it("does not guess a window for an IMU sensor", () => {
    const items = [part(1, "E", "Shell", shell), part(2, "U2", "IMU sensor", { shape: "box", size: [10, 3, 10], pos: [20, 10, 0] })];
    expect(buildSpec({ items }).openings).toHaveLength(0);
  });
});

describe("live validation", () => {
  const shell = { shape: "shell", size: [60, 30, 40], pos: [0, 15, 0] };
  it("says a part is taller than the inside", () => {
    const items = [part(1, "E", "Shell", shell), part(2, "T", "Tall thing", { shape: "box", size: [10, 40, 10], pos: [0, 15, 0] })];
    expect(buildSpec({ items }).issues.some((i) => i.code === "part-taller")).toBe(true);
  });
  it("says an opening is outside its wall", () => {
    const items = [part(1, "E", "Shell", shell), part(2, "D", "Screen", { shape: "box", size: [10, 4, 10], pos: [0, 10, 0] }, { kind: "display", opening: { face: "top", width: 70, height: 8 } })];
    expect(buildSpec({ items }).issues.some((i) => i.code === "opening-outside-wall")).toBe(true);
  });
  it("rejects parameters out of range", () => {
    const spec = buildSpec({ items: [part(1, "E", "Shell", shell)], params: { wallThickness: 0.2, cornerRadius: 30 } });
    expect(spec.issues.map((i) => i.about)).toEqual(expect.arrayContaining(["wallThickness"]));
    expect(spec.issues.some((i) => i.code === "radius-too-large" || i.about === "cornerRadius")).toBe(true);
  });
});
