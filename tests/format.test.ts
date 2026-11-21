// The shared text helpers in src/lib/format.ts.
import { describe, expect, it } from "vitest";
import { fileSlug, slugify } from "@/lib/format";
import { fileSafe } from "@/lib/content/http";

describe("slugify", () => {
  it("writes lower case ASCII with single hyphens and folds accents", () => {
    expect(slugify("Meta Feed #2!")).toBe("meta-feed-2");
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
    expect(slugify("  --x--  ")).toBe("x");
  });
  it("is empty when nothing is left, unless a fallback is given", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("!!!", { fallback: "concept" })).toBe("concept");
    expect(slugify("", { max: 40, fallback: "part" })).toBe("part");
  });
  it("cuts to `max` (a number is max) and never ends on a hyphen", () => {
    expect(slugify("a".repeat(100)).length).toBe(60);
    expect(slugify("a".repeat(100), 30).length).toBe(30);
    expect(slugify("ab cd ef", { max: 3 })).toBe("ab");
    expect(slugify("a".repeat(100), { max: Infinity }).length).toBe(100);
  });
  it("keeps the rules of each named use", () => {
    // a concept id: 48 characters, "concept" when empty; an accent no longer drops the letter ("caf-bag" before)
    expect(slugify("Café Bag", { max: 48, fallback: "concept" })).toBe("cafe-bag");
    expect(slugify("x ".repeat(60), { max: 48, fallback: "concept" }).length).toBeLessThanOrEqual(48);
    // a file name
    expect(fileSlug("???")).toBe("concept");
    expect(fileSlug("???", "part")).toBe("part");
    expect(fileSafe("My Product: MK1")).toBe("my-product-mk1");
    expect(fileSafe("***")).toBe("export");
    // a heading anchor keeps long headings whole
    expect(slugify("1. How the order of operations is worked out, step by step, from the requirement links to the plan page", { max: Infinity })).toBe("1-how-the-order-of-operations-is-worked-out-step-by-step-from-the-requirement-links-to-the-plan-page");
    // a row key: 40 characters, the section prefix when empty
    expect(slugify("Battery / charger board R1".repeat(3), { max: 40, fallback: "row" }).length).toBeLessThanOrEqual(40);
    expect(slugify("···", { max: 40, fallback: "row" })).toBe("row");
  });
});
