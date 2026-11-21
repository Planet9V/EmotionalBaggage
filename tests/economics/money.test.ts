// The one money module: minor units, text for inputs, reading what a person types, and the one currency lookup.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q } from "@/lib/db";
import { currencyOf } from "@/lib/economics/currency";
import { formatMoney, majorText, minorDigits, parseMinor, toInputText, toMajor, toMinor } from "@/lib/economics/money";
import { evaluate, type ProofRow } from "@/lib/content/claims";

describe("minor units follow the currency", () => {
  it("knows two, none and three decimals", () => {
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KWD")).toBe(3);
    expect(toMinor(12.5, "USD")).toBe(1250);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMinor(1.234, "KWD")).toBe(1234);
    expect(toMajor(1234, "KWD")).toBeCloseTo(1.234, 10);
  });
  it("writes a minor amount as input text with the currency's own decimals", () => {
    expect(toInputText(1250, "USD")).toBe("12.50");
    expect(toInputText(1500, "JPY")).toBe("1500");
    expect(toInputText(1234, "KWD")).toBe("1.234");
    expect(majorText(12.5, "USD")).toBe("12.50");
    expect(majorText(1500, "JPY")).toBe("1500");
  });
  it("formats money, and writes the code after the number when the runtime does not know it", () => {
    expect(formatMoney(2495, "USD")).toBe("$24.95");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
    expect(formatMoney(1250, "not-a-code")).toBe("12.50 not-a-code");
  });
});

describe("parseMinor reads what a person types", () => {
  it("accepts a symbol, a code, spaces and thousands commas", () => {
    expect(parseMinor("24.95")).toBe(2495);
    expect(parseMinor("$24.95")).toBe(2495);
    expect(parseMinor("1,200")).toBe(120000);
    expect(parseMinor(" 12 USD ")).toBe(1200);
    expect(parseMinor("24,95 €", "EUR")).toBe(249500);
    expect(parseMinor("1500", "JPY")).toBe(1500);
    expect(parseMinor("1.234", "KWD")).toBe(1234);
    expect(parseMinor(".5")).toBe(50);
  });
  it("is null for empty, negative and not a number", () => {
    for (const v of ["", " ", "-3", "abc", ".", "1.2.3", "1e3"]) expect(parseMinor(v), v).toBeNull();
  });
});

describe("a price in the copy is checked against the price row in the row's own currency", () => {
  const price = (priceMinor: number, currency: string): ProofRow => ({ id: 1, section: "marketing/pricing", title: "Price", body: "", status: "approved", data: { kind: "price", priceMinor, currency } });
  it("JPY: 1500 yen is found as 1500, not 15", () => {
    expect(evaluate([{ field: "headline", text: "Now ¥1500" }], [price(1500, "JPY")])).toEqual([]);
    expect(evaluate([{ field: "headline", text: "Now ¥15" }], [price(1500, "JPY")]).map((f) => f.text)).toEqual(["15"]);
  });
  it("KWD: 1234 fils is found as 1.234", () => {
    expect(evaluate([{ field: "headline", text: "Just 1.234 dinar" }], [price(1234, "KWD")])).toEqual([]);
  });
  it("USD is unchanged: 2495 is 24.95", () => {
    expect(evaluate([{ field: "headline", text: "Now $24.95" }], [price(2495, "USD")])).toEqual([]);
    expect(evaluate([{ field: "headline", text: "Now $24.50" }], [price(2495, "USD")]).map((f) => f.text)).toEqual(["24.50"]);
  });
});

describe("currencyOf", () => {
  const ID = "zz-currency-of";
  beforeAll(async () => {
    await q("DELETE FROM projects WHERE id=$1", [ID]);
    await q("INSERT INTO projects (id, name, one_liner, product_type, currency) VALUES ($1, 'ZZ currency', 'x', 'electronics', 'KWD')", [ID]);
  });
  afterAll(async () => {
    await q("DELETE FROM projects WHERE id=$1", [ID]);
  });
  it("reads the concept's currency, and USD for an unknown concept", async () => {
    expect(await currencyOf(ID)).toBe("KWD");
    expect(await currencyOf("zz-no-such-concept")).toBe("USD");
  });
});
