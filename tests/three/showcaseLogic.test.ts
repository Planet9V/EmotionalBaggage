import { describe, expect, it } from "vitest";
import { TAG_GAP, assemblySteps, assemblyTargets, combineFade, explodedAt, heightOfLayer, hiddenByLayers, layerAt, layerCount, layerHeightOf, layerOf, placeTags, type AssemblyPart, type TagSpot } from "@/components/three/showcaseLogic";

describe("layers from part kinds", () => {
  it("groups the example's kinds into enclosure, electronics, power and fasteners", () => {
    expect(layerOf("enclosure")).toBe("enclosure");
    for (const k of ["microcontroller", "sensor", "module", "speaker", "button", "circuit board", "resistor"]) expect(layerOf(k)).toBe("electronics");
    expect(layerOf("battery")).toBe("power");
    expect(layerOf("switch")).toBe("power");
    expect(layerOf("mechanical")).toBe("fasteners");
    expect(layerOf(" Mechanical ")).toBe("fasteners");
  });
  it("reads a row with no kind from its reference and title", () => {
    expect(layerOf("", "BAT", "Batteries")).toBe("power");
    expect(layerOf("", "STR1", "Mount strap")).toBe("fasteners");
    expect(layerOf("", "ENC2", "Housing")).toBe("enclosure");
    expect(layerOf("", "SD1", "Storage")).toBe("electronics");
  });
  it("hides the parts of the layers switched off", () => {
    const parts = [{ id: 1, layer: "power" as const }, { id: 2, layer: "electronics" as const }, { id: 3, layer: "power" as const }];
    expect([...hiddenByLayers(parts, new Set(["power"]))]).toEqual([1, 3]);
    expect(hiddenByLayers(parts, new Set()).size).toBe(0);
  });
});

const P = (id: number, ref: string, layer: AssemblyPart["layer"], extra: Partial<AssemblyPart> = {}): AssemblyPart => ({ id, ref, title: ref.toLowerCase(), layer, board: false, shell: false, ...extra });
const parts = [P(1, "ENC1", "enclosure", { shell: true }), P(2, "PCB1", "electronics", { board: true }), P(3, "U1", "electronics"), P(4, "BT1", "power"), P(5, "S1", "power"), P(6, "BAT", "power"), P(7, "STR1", "fasteners"), P(8, "U2", "electronics")];
const solder = [
  { name: "BAT+", from: "BT1", fromPin: "+", to: "S1", toPin: "1" },
  { name: "VIN", from: "S1", fromPin: "2", to: "U1", toPin: "5V" },
  { name: "GND", from: "BT1", fromPin: "-", to: "U1", toPin: "GND" },
  { name: "SDA", from: "U1", fromPin: "8", to: "U2", toPin: "SDA" },
];
const phases = [{ key: "p1", title: "Phase 1 — Print the enclosure" }, { key: "p2", title: "Phase 2 — Electronics" }, { key: "p6", title: "Phase 6 — Integration" }];

describe("assembly order from the build sheet", () => {
  const steps = assemblySteps(parts, solder, phases);
  it("prints the enclosure first, then the board, then each soldering step's new parts, then the rest, and closes the lid last", () => {
    expect(steps.map((s) => s.ids)).toEqual([[1], [2], [4, 5], [3], [8], [6], [7], []]);
    expect(steps[0]!.phase).toBe("Phase 1: Print the enclosure");
    expect(steps[2]!.label).toBe("BAT+: BT1.+ to S1.1");
    expect(steps[2]!.phase).toBe("Phase 2: Electronics");
    expect(steps.at(-1)).toMatchObject({ label: "Lid closed", closes: [1], phase: "Phase 6: Integration" });
  });
  it("places every part exactly once and leaves out a step that places nothing", () => {
    const all = steps.flatMap((s) => s.ids);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(parts.map((p) => p.id).sort());
    // the GND step joins two parts already placed, so it is not a step
    expect(steps.some((s) => s.label.startsWith("GND"))).toBe(false);
  });
  it("falls back to plain phase names when the rows have none", () => {
    expect(assemblySteps(parts, solder, [])[0]!.phase).toBe("Enclosure");
  });

  it("keeps unplaced parts out of sight and exploded, placed parts in place, and the lid up until it closes", () => {
    const ids = parts.map((p) => p.id);
    const none = assemblyTargets(steps, 0, ids);
    expect([...none.fade.values()].every((f) => f === 0)).toBe(true);
    const three = assemblyTargets(steps, 3, ids);
    expect(three.fade.get(4)).toBe(1);
    expect(three.weights.get(4)).toBe(0);
    expect(three.fade.get(3)).toBe(0);
    expect(three.weights.get(3)).toBe(1);
    expect(three.fade.get(1)).toBe(1);
    expect(three.weights.get(1)).toBe(1); // the lid is still open
    const all = assemblyTargets(steps, steps.length, ids);
    expect([...all.weights.values()].every((w) => w === 0)).toBe(true);
    expect([...all.fade.values()].every((f) => f === 1)).toBe(true);
  });
});

describe("fades and explode offsets", () => {
  it("multiplies fades and forces hidden parts to 0", () => {
    expect(combineFade(null, null, null, [1, 2])).toBeNull();
    const out = combineFade(new Map([[1, 0.5]]), new Map([[1, 0.5], [2, 1]]), new Set([2]), [1, 2, 3]);
    expect([...out!.entries()]).toEqual([[1, 0.25], [2, 0], [3, 1]]);
  });
  it("moves a part along its explode vector by the factor", () => {
    expect(explodedAt([0, 22, 0], [0, 8, 0], 0)).toEqual([0, 22, 0]);
    expect(explodedAt([0, 22, 0], [0, 8, 0], 0.5)).toEqual([0, 26, 0]);
    expect(explodedAt([-38, 14, 0], [-26, 0, 0], 1)).toEqual([-64, 14, 0]);
  });
});

describe("tag placement", () => {
  const size = { width: 1000, height: 500 };
  it("never puts two tags in a column closer than the gap, and keeps them in the view", () => {
    const at = new Map<number, { x: number; y: number }>();
    for (let i = 0; i < 12; i++) at.set(i, { x: i % 2 ? 560 : 440, y: 240 + (i % 3) });
    const { spots } = placeTags(at, new Map(), size, 1);
    for (const side of [-1, 1]) {
      const ys = [...spots.values()].filter((s) => s.side === side).map((s) => s.y).sort((a, b) => a - b);
      ys.forEach((y, i) => i && expect(y - ys[i - 1]!).toBeGreaterThanOrEqual(TAG_GAP - 1e-9));
      for (const y of ys) {
        expect(y).toBeGreaterThanOrEqual(14);
        expect(y).toBeLessThanOrEqual(size.height - 14);
      }
    }
  });
  it("puts a tag on the side of the model its part is on, and keeps it there near the middle", () => {
    const at = new Map([[1, { x: 300, y: 100 }], [2, { x: 700, y: 100 }], [3, { x: 505, y: 300 }]]);
    const first = placeTags(at, new Map<number, TagSpot>([[3, { side: -1, x: 350, y: 300 }]]), size, 1).spots;
    expect(first.get(1)!.side).toBe(-1);
    expect(first.get(2)!.side).toBe(1);
    expect(first.get(3)!.side).toBe(-1);
    expect(first.get(1)!.x).toBeLessThan(first.get(2)!.x);
  });
  it("glides toward the new place and says it is still moving", () => {
    const at = new Map([[1, { x: 300, y: 100 }]]);
    const out = placeTags(at, new Map([[1, { side: -1 as const, x: 0, y: 0 }]]), size, 0.5);
    expect(out.moving).toBe(true);
    expect(placeTags(at, out.spots, size, 1).moving).toBe(false);
  });
});

describe("print layers", () => {
  it("reads the layer height from the print job's settings", () => {
    expect(layerHeightOf("0.2 mm layers, 4 perimeters, 25% infill")).toBe(0.2);
    expect(layerHeightOf("0.12mm layer height")).toBe(0.12);
    expect(layerHeightOf("4 perimeters")).toBeNull();
  });
  it("turns a cutting height into the layer being laid, and back", () => {
    expect(layerCount(21, 0.2)).toBe(105);
    expect(layerCount(21.1, 0.2)).toBe(106);
    expect(layerAt(0, 0.2, 21)).toBe(0);
    expect(layerAt(0.05, 0.2, 21)).toBe(1);
    expect(layerAt(0.2, 0.2, 21)).toBe(1);
    expect(layerAt(0.21, 0.2, 21)).toBe(2);
    expect(layerAt(10, 0.2, 21)).toBe(50);
    expect(layerAt(99, 0.2, 21)).toBe(105);
    expect(heightOfLayer(50, 0.2, 21)).toBeCloseTo(10);
    expect(heightOfLayer(200, 0.2, 21)).toBe(21);
    for (const n of [1, 7, 50, 105]) expect(layerAt(heightOfLayer(n, 0.2, 21), 0.2, 21)).toBe(n);
  });
});
