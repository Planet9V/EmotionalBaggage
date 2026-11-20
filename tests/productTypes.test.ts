import { describe, expect, it } from "vitest";
import { STAGES } from "@/lib/menu";
import { isProductType, PRODUCT_TYPE_KEYS, PRODUCT_TYPES, productType, sectionsFor, sectionVisible } from "@/lib/productTypes";

const keysOf = (stages: ReturnType<typeof sectionsFor>) => stages.flatMap((s) => s.sections.map((x) => `${s.key}/${x.key}`));
const menuKeys = STAGES.flatMap((s) => s.sections.map((x) => `${s.key}/${x.key}`));

describe("product types", () => {
  it("defines exactly the three types with their labels", () => {
    expect(PRODUCT_TYPES.map((t) => [t.key, t.label])).toEqual([
      ["electronics", "Electronics in an enclosure"],
      ["printed", "Printed part"],
      ["physical", "Physical product, no electronics"],
    ]);
    expect(PRODUCT_TYPE_KEYS).toEqual(["electronics", "printed", "physical"]);
  });

  it("electronics shows every section of the real menu", () => {
    expect(keysOf(sectionsFor("electronics"))).toEqual(menuKeys);
  });

  it.each(["printed", "physical"])("%s hides the schematic and wiring-and-soldering and keeps everything else", (type) => {
    const shown = keysOf(sectionsFor(type));
    expect(shown).toEqual(menuKeys.filter((k) => k !== "design/schematic" && k !== "prototype/wiring"));
    expect(shown).not.toContain("design/schematic");
    expect(shown).not.toContain("prototype/wiring");
    for (const kept of ["design/bom", "design/model", "design/layout", "prototype/printing", "prototype/sourcing"]) {
      expect(shown).toContain(kept);
    }
  });

  it("keeps every stage, in menu order, and does not change the menu itself", () => {
    const before = JSON.stringify(STAGES);
    for (const t of PRODUCT_TYPE_KEYS) {
      expect(sectionsFor(t).map((s) => s.key)).toEqual(STAGES.map((s) => s.key));
    }
    expect(JSON.stringify(STAGES)).toBe(before);
  });

  it("sectionVisible agrees with sectionsFor and refuses sections the menu does not have", () => {
    for (const t of PRODUCT_TYPE_KEYS) {
      const shown = new Set(keysOf(sectionsFor(t)));
      for (const k of menuKeys) {
        const [stage, section] = k.split("/");
        expect(sectionVisible(t, stage, section)).toBe(shown.has(k));
      }
    }
    expect(sectionVisible("electronics", "design", "nope")).toBe(false);
    expect(sectionVisible("electronics", "nope", "brief")).toBe(false);
  });

  it("treats an unknown stored type as electronics", () => {
    expect(isProductType("wooden")).toBe(false);
    expect(isProductType("printed")).toBe(true);
    expect(productType("wooden").key).toBe("electronics");
    expect(keysOf(sectionsFor("wooden"))).toEqual(menuKeys);
  });
});
