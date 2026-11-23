import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exampleData } from "@/components/welcome/exampleData";
import { storyData } from "@/components/welcome/storyData";
import { tagsFor } from "@/components/welcome/product/PartsPanel";

describe("the example's enclosure as the app holds it, and the tags on its parts", () => {
  it("reads the printed pieces, their print jobs, the design's checks and the renders from the example's rows", async () => {
    const { printed } = storyData(await exampleData());
    expect(printed).not.toBeNull();
    const p = printed!;
    expect(p.pieces.map((x) => x.ref)).toEqual(["ENC1", "ENC2", "ENC3", "ENC4", "STR1"]);
    for (const piece of p.pieces) {
      expect(piece.grams, piece.ref).toBeGreaterThan(0);
      expect(piece.cost, piece.ref).toMatch(/^\$\d/);
    }
    expect(p.jobs).toHaveLength(2);
    // the strap is in the job that names it; the body, the plate and the doors are in the other, by their material
    const strap = p.pieces.find((x) => x.ref === "STR1")!;
    expect(p.jobs[strap.job]!.material).toBe("TPU");
    for (const piece of p.pieces.filter((x) => x.ref !== "STR1")) expect(p.jobs[piece.job]!.material, piece.ref).toBe("PETG");
    expect(p.checks.length).toBeGreaterThan(0);
    expect(p.checks.every((c) => c.ok)).toBe(true);
    // whose checks they are is said, in the row's own words
    expect(p.checkedBy).toContain("not measured by this app");
    // every render the tab shows is a file this page serves
    expect(p.renders.length).toBeGreaterThan(0);
    for (const r of p.renders) expect(existsSync(`public${r.src}`), r.src).toBe(true);
  });

  it("names the parts in order of importance, and for a chosen part the parts it joins and each net between them", async () => {
    const { product } = storyData(await exampleData());
    const all = tagsFor(product, true, null)!;
    expect(all[0]!.ref).toBe("ENC1");
    expect(all.slice(0, 4).map((t) => t.ref)).toEqual(["ENC1", "PCB1", "BAT", "SPK1"]);
    expect(all.every((t) => !t.ref.includes(">"))).toBe(true);
    expect(all.find((t) => t.ref === "SPK1")).toMatchObject({ text: "Speaker 28 mm", note: "4 ohm, 3 W" });
    // nothing chosen and labels off: no tags at all
    expect(tagsFor(product, false, null)).toBeUndefined();
    const spk = tagsFor(product, false, "SPK1")!;
    expect(spk.map((t) => t.ref)).toEqual(expect.arrayContaining(["SPK1", "U4", "SPK1>U4"]));
    expect(spk.find((t) => t.ref === "SPK1>U4")!.text).toBe("SPK_P, SPK_N");
  });
});
