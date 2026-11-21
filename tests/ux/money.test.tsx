// @vitest-environment jsdom
// U22: "$150" and "1,200" are accepted in every money field; one money input shows the currency before the box.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { moneyOrNull, readMoney } from "@/lib/moneyText";
import { MoneyInput } from "@/components/ui/money-input";
import { STEP_SCHEMAS, buildItems, emptyAnswers } from "@/components/wizard/model";
import { parseMinor } from "@/lib/economics/money";
import { parseAmount } from "@/components/parts/bom";
import { num } from "@/lib/economics/read";

afterEach(cleanup);

describe("reading money", () => {
  it("accepts a currency sign or code and thousands separators", () => {
    expect(readMoney("$150")).toBe(150);
    expect(readMoney("150 USD")).toBe(150);
    expect(readMoney("1,200.50")).toBe(1200.5);
    expect(readMoney("€ 1.200,50")).toBe(1200.5);
    expect(readMoney("12,5")).toBe(12.5);
    expect(readMoney("1,200")).toBe(1200);
    expect(readMoney("")).toBeNull();
    expect(Number.isNaN(readMoney("twelve"))).toBe(true);
    expect(moneyOrNull("abc")).toBeNull();
  });
  it("every money parser in the app uses it", () => {
    expect(parseMinor("$24.95")).toBe(2495);
    expect(parseAmount("$1,200")).toBe(1200);
    expect(num("$150")).toBe(150);
  });
  it("the wizard accepts $150 as a cost and a price", () => {
    const a = { ...emptyAnswers(), name: "X", oneLiner: "Y", testCost: "$150", price: "$24.95" };
    expect(STEP_SCHEMAS.proof.safeParse(a).success).toBe(true);
    expect(STEP_SCHEMAS.selling.safeParse(a).success).toBe(true);
    a.channel = "Shop";
    expect(buildItems(a).find((i) => i.section === "sales/channels")?.data).toEqual({ price: 24.95 });
  });
});

describe("MoneyInput", () => {
  it("shows the currency before the box and opens a decimal keyboard", () => {
    render(<MoneyInput aria-label="Price" currency="USD" defaultValue="" />);
    const box = screen.getByLabelText("Price");
    expect(box.getAttribute("inputmode")).toBe("decimal");
    expect(box.parentElement!.textContent).toContain("$");
  });
});
