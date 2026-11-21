import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { cents, needOf, pieceUnitPrice, shoppingCsv, shoppingList, type ListPart } from "@/lib/sourcing/list";
import { isCited, parseAnswer, questionFor } from "@/lib/sourcing/research";
import { DISTRIBUTORS, searchLinks, searchTerm } from "@/lib/sourcing/links";
import { alternateSchema, offerSchema, orderSchema, readSourcing, sourcingData } from "@/lib/sourcing/schemas";

const offer = (o: Record<string, unknown> = {}) => ({ id: "o1", supplier: "Mouser", price: 1.5, packSize: 1, checkedAt: "2026-11-21", source: "entered", ...o });
const part = (id: number, qty: number | null, sourcing: unknown, status = "to buy", ref = `R${id}`): ListPart => ({ id, ref, title: `Part ${id}`, qty, status, data: sourcing === undefined ? {} : { sourcing } });

describe("money is added in cents", () => {
  it("does not drift on 0.1 + 0.2 style sums", () => {
    expect(cents(0.1) + cents(0.2)).toBe(30);
    expect(cents(19.99)).toBe(1999);
    const list = shoppingList([part(1, 3, { offers: [offer({ price: 0.1 })], chosen: "o1" }), part(2, 3, { offers: [offer({ id: "o2", price: 0.2 })], chosen: "o2" })]);
    expect(list.totalCents).toBe(90);
  });

  it("works out the price of one piece from a pack", () => {
    expect(pieceUnitPrice(offerSchema.parse(offer({ price: 12, packSize: 100 })))).toBe(0.12);
    expect(pieceUnitPrice(offerSchema.parse(offer({ price: 1, packSize: 3 })))).toBe(0.333333);
  });
});

describe("the shopping list", () => {
  it("buys whole packs and counts the spares", () => {
    const l = shoppingList([part(1, 25, { offers: [offer({ price: 4, packSize: 10 })], chosen: "o1" })]);
    const line = l.groups[0].lines[0];
    expect(line).toMatchObject({ need: 25, packs: 3, spare: 5, priceCents: 400, totalCents: 1200 });
    expect(l.totalCents).toBe(1200);
  });

  it("groups by supplier, sorted, with a subtotal each", () => {
    const l = shoppingList([
      part(1, 2, { offers: [offer({ supplier: "Mouser", price: 1 })], chosen: "o1" }),
      part(2, 1, { offers: [offer({ id: "o2", supplier: "Adafruit", price: 5 })], chosen: "o2" }),
      part(3, 4, { offers: [offer({ id: "o3", supplier: "Mouser", price: 0.5 })], chosen: "o3" }),
    ]);
    expect(l.groups.map((g) => [g.supplier, g.totalCents])).toEqual([["Adafruit", 500], ["Mouser", 400]]);
    expect(l.totalCents).toBe(900);
  });

  it("lists a part with offers but no choice apart, and adds nothing for it", () => {
    const l = shoppingList([part(1, 2, { offers: [offer()] })]);
    expect(l.groups).toEqual([]);
    expect(l.unchosen).toEqual([{ partId: 1, ref: "R1", title: "Part 1", need: 2, offers: 1 }]);
    expect(l.totalCents).toBe(0);
  });

  it("leaves out printed, in-hand and already-ordered parts, and says why", () => {
    const l = shoppingList([
      part(1, 1, undefined, "to print"),
      part(2, 1, undefined, "in hand"),
      part(3, 5, { offers: [offer()], chosen: "o1", order: { status: "ordered", qtyOrdered: 5 } }, "ordered"),
    ]);
    expect(l.excluded.map((e) => e.why)).toEqual(["printed, not bought", "already in hand", "already ordered"]);
  });

  it("asks only for the rest when an order came up short", () => {
    const p = part(1, 10, { offers: [offer()], chosen: "o1", order: { status: "short", qtyOrdered: 10, qtyReceived: 7 } }, "ordered");
    expect(needOf(p)).toEqual({ need: 3 });
    expect(shoppingList([p]).groups[0].lines[0]).toMatchObject({ need: 3, packs: 3 });
  });

  it("treats a part with no quantity as one", () => {
    expect(needOf(part(1, null, undefined)).need).toBe(1);
  });

  it("is empty for no parts", () => {
    expect(shoppingList([])).toEqual({ groups: [], unchosen: [], excluded: [], totalCents: 0 });
  });
});

describe("the CSV", () => {
  const list = shoppingList([
    part(1, 25, { offers: [offer({ price: 4, packSize: 10, url: "https://www.mouser.com/p/1", partNumber: "ABC-1" })], chosen: "o1" }),
    part(2, 1, { offers: [offer({ id: "o2", supplier: "=HYPERLINK(\"http://evil\")", price: 2 })], chosen: "o2" }),
    part(3, 2, { offers: [] }),
  ]);
  const rows = Papa.parse<string[]>(shoppingCsv(list, "USD")).data;

  it("has the head, a row per line, a subtotal per supplier, the unchosen and a total", () => {
    expect(rows[0]).toContain("Price per pack (USD)");
    expect(rows.filter((r) => r[0].endsWith("subtotal"))).toHaveLength(2);
    expect(rows.find((r) => r[0] === "No supplier chosen")?.[2]).toBe("Part 3");
    expect(rows.at(-1)?.[0]).toBe("Total");
    expect(rows.at(-1)?.[9]).toBe("14.00");
  });

  it("neutralises text a spreadsheet would run as a formula", () => {
    const supplier = rows.find((r) => r[2] === "Part 2")?.[0] ?? "";
    expect(supplier.startsWith("=")).toBe(false);
  });

  it("round-trips a comma and a quote", () => {
    const l = shoppingList([{ id: 1, ref: "R1", title: 'Cap, "big"', qty: 1, status: "to buy", data: { sourcing: { offers: [offer()], chosen: "o1" } } }]);
    expect(Papa.parse<string[]>(shoppingCsv(l, "EUR")).data[1][2]).toBe('Cap, "big"');
  });
});

describe("what research may save", () => {
  const src = [{ url: "https://www.mouser.com/ProductDetail/ABC-1/", title: "Mouser" }, { url: "https://adafruit.com/product/9", title: "Adafruit" }];

  it("matches a cited page by host and path, ignoring www, query and a trailing slash", () => {
    expect(isCited("https://mouser.com/ProductDetail/ABC-1?qs=x", src as never)).toBe(true);
    expect(isCited("https://www.adafruit.com/product/9/", src as never)).toBe(true);
    expect(isCited("https://www.digikey.com/x", src as never)).toBe(false);
    expect(isCited("not a url", src as never)).toBe(false);
  });

  const answer = [
    "SUPPLIER | PRICE | CUR | PACK | STOCK | URL",
    "---|---|---|---|---|---",
    "Mouser | 1.25 | USD | 10 | 400 in stock | https://www.mouser.com/ProductDetail/ABC-1/",
    "Adafruit | 3.00 | EUR | 1 | in stock | https://adafruit.com/product/9",
    "Mystery Shop | 0.50 | USD | 1 | | https://mystery.example/item",
    "Broken | line",
  ].join("\n");

  it("keeps a cited price in the concept's currency, as a draft with its source", () => {
    const r = parseAnswer("prices", answer, src as never, "USD", "2026-11-21");
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0]).toMatchObject({ kind: "offer", citation: "https://www.mouser.com/ProductDetail/ABC-1/" });
    expect(r.drafts[0].offer).toMatchObject({ supplier: "Mouser", price: 1.25, packSize: 10, source: "research", checkedAt: "2026-11-21" });
  });

  it("drops, and says why, a price with no cited page, in another currency, or not in the form asked for", () => {
    const r = parseAnswer("prices", answer, src as never, "USD", "2026-11-21");
    expect(r.dropped.join("\n")).toMatch(/Adafruit: priced in EUR/);
    expect(r.dropped.join("\n")).toMatch(/Mystery Shop: no cited page/);
    expect(r.dropped.join("\n")).toMatch(/Broken: not in the form/);
  });

  it("saves no price at all when no source was cited", () => {
    expect(parseAnswer("prices", answer, [], "USD", "2026-11-21").drafts).toEqual([]);
  });

  it("reads alternates and drops one with no cited page", () => {
    const a = "Part A | PA-1 | pins differ | https://adafruit.com/product/9\nPart B | PB-2 | none | https://nowhere.example/b";
    const r = parseAnswer("alternates", a, src as never, "USD", "2026-11-21");
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].alternate).toMatchObject({ name: "Part A", partNumber: "PA-1", whatChanges: "pins differ", source: "research" });
    expect(r.dropped[0]).toMatch(/Part B: no cited page/);
  });

  it("asks in the concept's currency and in a fixed form", () => {
    const q = questionFor("prices", { title: "Buck converter", body: "5 V", ref: "U1", partNumber: "LM2596", search: "" }, "EUR");
    expect(q).toContain("EUR");
    expect(q).toContain("LM2596");
    expect(q).toContain("SUPPLIER | PRICE OF ONE PACK");
  });
});

describe("the sourcing data on a part", () => {
  it("refuses a researched price with no citation", () => {
    expect(offerSchema.safeParse(offer({ source: "research" })).success).toBe(false);
    expect(offerSchema.safeParse(offer({ source: "research", citation: "https://x.example/p" })).success).toBe(true);
  });

  it("refuses a negative price, a fractional or zero pack, a bad date and a non-http link", () => {
    expect(offerSchema.safeParse(offer({ price: -1 })).success).toBe(false);
    expect(offerSchema.safeParse(offer({ packSize: 0 })).success).toBe(false);
    expect(offerSchema.safeParse(offer({ packSize: 2.5 })).success).toBe(false);
    expect(offerSchema.safeParse(offer({ checkedAt: "21/11/2026" })).success).toBe(false);
    expect(offerSchema.safeParse(offer({ url: "javascript:alert(1)" })).success).toBe(false);
  });

  it("accepts numbers typed as text, as a form sends them", () => {
    expect(offerSchema.parse(offer({ price: "2.50", packSize: "5" }))).toMatchObject({ price: 2.5, packSize: 5 });
  });

  it("checks the order", () => {
    expect(orderSchema.safeParse({ status: "ordered", qtyOrdered: 4, orderedOn: "2026-11-20" }).success).toBe(true);
    expect(orderSchema.safeParse({ status: "lost" }).success).toBe(false);
    expect(orderSchema.safeParse({ status: "short", qtyReceived: -1 }).success).toBe(false);
  });

  it("reads a part with no sourcing, or with damaged sourcing, as empty", () => {
    expect(readSourcing({})).toEqual({ offers: [], alternates: [], drafts: [] });
    expect(readSourcing({ sourcing: { offers: "nope" } })).toEqual({ offers: [], alternates: [], drafts: [] });
  });

  it("makes a draft carry its citation", () => {
    const d = { id: "d1", kind: "offer", createdAt: "x", researchId: 1, offer: offer() };
    expect(sourcingData.safeParse({ drafts: [d] }).success).toBe(false);
    expect(sourcingData.safeParse({ drafts: [{ ...d, citation: "https://x.example/p" }] }).success).toBe(true);
    expect(alternateSchema.safeParse({ id: "a", name: "x" }).success).toBe(true);
  });
});

describe("distributor search links", () => {
  it("covers the eight distributors and encodes the term", () => {
    expect(DISTRIBUTORS.map((d) => d.label)).toEqual(["Digi-Key", "Mouser", "LCSC", "Adafruit", "SparkFun", "Amazon", "AliExpress", "McMaster-Carr"]);
    for (const l of searchLinks("M3 x 8 & nut")) {
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.url).not.toContain(" ");
      expect(l.url).not.toContain("&nut");
    }
  });

  it("prefers the part number, then the search term, then the name", () => {
    expect(searchTerm({ title: "Cap", search: "10uF cap", partNumber: "GRM188" })).toBe("GRM188");
    expect(searchTerm({ title: "Cap", search: "10uF  cap" })).toBe("10uF cap");
    expect(searchTerm({ title: "Cap" })).toBe("Cap");
  });
});
