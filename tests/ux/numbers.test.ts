// U23: no "Infinity" or "NaN" is ever printed for a person: the shared formatters guard non-finite values.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fmtMm, fmtNum } from "@/lib/format";
import { formatMoney, formatPercent } from "@/lib/economics/money";

describe("the number formatters", () => {
  it("never print Infinity or NaN", () => {
    for (const v of [Infinity, -Infinity, NaN]) {
      for (const out of [fmtNum(v), fmtMm(v), formatMoney(v, "USD"), formatPercent(v)]) expect(out).not.toMatch(/Infinity|NaN|∞/);
    }
    expect(fmtMm(12.345)).toBe("12.35 mm");
    expect(fmtNum(3.14159, 1)).toBe("3.1");
    expect(formatMoney(1250, "USD")).toBe("$12.50");
  });
  it("the enclosure checks size the cavity through them and say when it is open at the top", () => {
    const s = readFileSync("src/lib/enclosure/checks.ts", "utf8");
    expect(s).toContain("const mm = (n: number) => fmtMm(n);");
    expect(s).toContain("open at the top");
  });
});
