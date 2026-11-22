// A part's quantity is a whole number from 1 to 100,000: one rule for the server, the forms and the import, and
// the largest quantity at the largest price cannot overflow the money arithmetic (integer minor units).
import { describe, expect, it } from "vitest";
import { partData } from "@/lib/domain";
import { QTY_MAX, QTY_MESSAGE, quantityProblem } from "@/lib/parts/quantity";
import { partLine } from "@/lib/economics/compute";
import { toMinor } from "@/lib/economics/money";
import { mapImport } from "@/components/parts/bom";
import type { PartInput } from "@/lib/economics/read";

const part = (over: Partial<PartInput>): PartInput => ({ id: 1, ref: "P1", title: "Part", qty: 1, unit: null, line: null, breaks: [], supplier: "", ...over });

describe("quantityProblem", () => {
  it("names the rule in plain words", () => {
    expect(QTY_MESSAGE).toBe("Enter a whole number of pieces from 1 to 100,000.");
    expect(QTY_MAX).toBe(100_000);
  });
  it.each([[1], [2], [99_999], [100_000], [null]])("accepts %s", (n) => expect(quantityProblem(n)).toBeNull());
  it.each([[0], [-3], [2.5], [100_001], [1e9], [Number.NaN]])("refuses %s", (n) => expect(quantityProblem(n)).toBe(QTY_MESSAGE));
});

describe("the part schema", () => {
  it("accepts 1 and 100000, also typed as text", () => {
    expect(partData.safeParse({ qty: 1 }).success).toBe(true);
    expect(partData.safeParse({ qty: "100000" }).success).toBe(true);
  });
  it.each([[100_001], ["250000"], [0], [2.5], [-1]])("refuses a quantity of %s with the plain message", (qty) => {
    const r = partData.safeParse({ qty });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(QTY_MESSAGE);
  });
});

describe("the CSV import", () => {
  it("marks a row above the bound as a problem, with the message", () => {
    const { rows } = mapImport([["ref", "title", "qty"], ["U1", "Chip", "250000"], ["U2", "Other", "3"]]);
    expect(rows.find((r) => r.ref === "U1")?.problem).toBe(QTY_MESSAGE);
    expect(rows.find((r) => r.ref === "U2")?.problem).toBe("");
  });
});

describe("the money arithmetic", () => {
  it("the largest quantity at the largest unit price the schema allows is never added up wrongly", () => {
    const l = partLine(part({ qty: QTY_MAX, unit: 1e9 }), 1, "USD");
    // 100000 x 1,000,000,000.00 is more than integer minor units hold exactly: the line says so instead of adding a rounded figure
    expect(l.amount).toBeNull();
    expect(l.missing?.reason).toMatch(/too large/);
  });
  it("a large but exact line is priced as before", () => {
    const l = partLine(part({ qty: QTY_MAX, unit: 1e6 }), 1, "USD");
    expect(l.amount).toBe(QTY_MAX * toMinor(1e6, "USD"));
    expect(Number.isSafeInteger(l.amount)).toBe(true);
  });
  it("an existing row above the bound still prices; it is not dropped", () => {
    expect(partLine(part({ qty: 250_000, unit: 2 }), 1, "USD").amount).toBe(250_000 * 200);
  });
});
