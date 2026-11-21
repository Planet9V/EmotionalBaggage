import { describe, expect, it } from "vitest";
import { checkUnits } from "@/lib/geometry/units";

describe("unit detection", () => {
  it("accepts a part of ordinary size", () => {
    expect(checkUnits([25, 17, 3]).ok).toBe(true);
    expect(checkUnits([0.5, 0.5, 0.5]).ok).toBe(true);
    expect(checkUnits([600, 100, 100]).ok).toBe(true);
  });
  it("flags a 0.03 mm part (metres read as millimetres) and suggests metres", () => {
    const r = checkUnits([0.03, 0.02, 0.005]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problem).toBe("tiny");
    expect(r.message).toMatch(/not been rescaled/);
    expect(r.suggestions.map((s) => s.factor)).toContain(1000);
    expect(r.suggestions.find((s) => s.factor === 1000)?.longestMm).toBeCloseTo(30, 6);
  });
  it("flags a 30 m part (micrometre or mm in the wrong place) and suggests the small factor", () => {
    const r = checkUnits([30000, 2000, 500]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problem).toBe("huge");
    expect(r.suggestions.map((s) => s.factor)).toContain(0.001);
  });
  it("an inch file reads small, and inches are among the suggestions", () => {
    const r = checkUnits([0.4, 0.3, 0.1]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.suggestions.map((s) => s.factor)).toContain(25.4);
  });
  it("judges the size after a confirmed scale", () => {
    expect(checkUnits([0.03, 0.02, 0.005], 1000).ok).toBe(true);
  });
  it("a file with no extent is flagged with no suggestion", () => {
    const r = checkUnits([0, 0, 0]);
    expect(r.ok).toBe(false);
  });
});
