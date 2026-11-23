import { describe, expect, it } from "vitest";
import { schematicCrop } from "@/components/welcome/get/heroArt";
import { shellOutlineFor } from "@/components/welcome/get/tagShell";
import { TAG_MM } from "@/components/welcome/scenes/film/tagShape";

describe("a shell with an outline of its own (the example's tag)", () => {
  it("gives the tag's outline to an enclosure of the tag's size, and none to any other", () => {
    const o = shellOutlineFor([TAG_MM.w, TAG_MM.t, TAG_MM.h])!;
    const xs = o.outer.map((p) => p[0]);
    const zs = o.outer.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(TAG_MM.w, 5);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(TAG_MM.h, 5);
    // the strap's end is at -z, as in the example's layout: the slot is there, and the shoulders narrow that end
    expect(Math.max(...o.lidHoles![0]!.map((p) => p[1]))).toBeLessThan(-30);
    const narrow = o.outer.filter((p) => p[1] < -45.9).map((p) => p[0]);
    expect(Math.max(...narrow) - Math.min(...narrow)).toBeLessThan(40);
    expect(shellOutlineFor([80, 42, 60])).toBeUndefined();
    expect(shellOutlineFor(undefined)).toBeUndefined();
  });
});

describe("the hero's schematic: a crop of the real one", () => {
  it("draws the controller, the chip beside it, the amplifier and the speaker with the app's symbols, and the nets between them", async () => {
    const { exampleData } = await import("@/components/welcome/exampleData");
    const d = await exampleData();
    const crop = schematicCrop(d.parts, d.wires)!;
    expect(crop.symbols.map((s) => s.ref)).toEqual(["U1", "U2", "U4", "SPK1"]);
    // the chips are boxes with a stub for every pin; the speaker is its drawn symbol
    expect(crop.symbols[0]!.rect).not.toBeNull();
    expect(crop.symbols[0]!.stubs.length).toBeGreaterThan(10);
    expect(crop.symbols[3]!.rect).toBeNull();
    expect(crop.symbols[3]!.strokes.length).toBeGreaterThan(0);
    // the nets are the schematic's own, by name and class: the audio pair to the speaker, the buses to the chips
    const nets = new Map(crop.routes.map((r) => [r.net, r.netClass]));
    expect(nets.get("SPK_P")).toBe("audio");
    expect(nets.get("SPK_N")).toBe("audio");
    for (const n of ["I2S_BCLK", "I2S_LRCK", "I2S_DIN", "IMU_SCK", "IMU_MOSI", "IMU_CS"]) expect(nets.get(n), n).toBe("signal");
    expect(crop.nets).toBe(crop.routes.length);
    expect(crop.of).toBeGreaterThan(crop.nets);
    // no two lines turn in the same channel, and a few are named
    const turns = crop.routes.filter((r) => !r.net.startsWith("SPK")).map((r) => /H(-?[\d.]+)V/.exec(r.d)![1]);
    expect(new Set(turns).size).toBe(turns.length);
    expect(crop.routes.filter((r) => r.name).length).toBeGreaterThanOrEqual(1);
    // every line stays inside the picture
    const [x, , w] = crop.box;
    for (const r of crop.routes) for (const m of r.d.matchAll(/[MH](-?[\d.]+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(x + w);
  });
});
