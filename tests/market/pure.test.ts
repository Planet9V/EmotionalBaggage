// The pure parts of the marketing tools: contrast, pricing arithmetic, name-check links, the
// proof check, the brand kit as text and CSS, and the competitor price reader.
import { describe, expect, it } from "vitest";
import { checkColour, contrastRatio, levelFor, parseHex } from "@/lib/market/contrast";
import { competitorRange, costPlusPrice, margin, position, pricingUnitCost } from "@/lib/market/pricing";
import { formatMoney, parseMinor } from "@/lib/economics/money";
import { referenceUnitCost } from "@/lib/economics/compute";
import { readEconomics } from "@/lib/economics/read";
import { GROUP_ORDER, handleOf, nameChecks, SCREENING_NOTE, screeningProgress } from "@/lib/market/nameChecks";
import { checkProof, type ProofRow } from "@/lib/market/proof";
import { brandCssVariables, brandText, findKit, onColour } from "@/lib/market/brandKit";
import { readPrice } from "@/lib/market/generators/competitors";
import { positioningLine } from "@/lib/market/positioning";
import { positioningFingerprint } from "@/lib/market/critique";
import { assertMarketChange, assertNewMarket } from "@/lib/market/rules";
import type { Item } from "@/lib/types";
import { VERIFIED } from "../research/verified";

const item = (over: Partial<Item> & Pick<Item, "section">): Item => ({ id: 1, projectId: "p", title: "t", body: "", data: {}, status: "draft", sort: 0, ...over });

describe("contrast (WCAG)", () => {
  it("matches the values WCAG publishes for known pairs", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#0000FF", "#FFFFFF")!).toBeCloseTo(8.59, 2);
    expect(contrastRatio("#FF0000", "#FFFFFF")!).toBeCloseTo(4.0, 1);
    // the usual AA boundary: #767676 on white is 4.54, #777777 is 4.48
    expect(contrastRatio("#767676", "#FFFFFF")!).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#777777", "#FFFFFF")!).toBeCloseTo(4.48, 2);
  });
  it("is symmetric and accepts a hex without the hash", () => {
    expect(contrastRatio("#E05A10", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "E05A10")!, 10);
  });
  it("rejects what is not six hex digits", () => {
    expect(parseHex("#FFF")).toBeNull();
    expect(parseHex("red")).toBeNull();
    expect(contrastRatio("#12345", "#FFFFFF")).toBeNull();
    expect(checkColour("nope")).toBeNull();
  });
  it("names the level", () => {
    expect(levelFor(7)).toBe("AAA");
    expect(levelFor(4.5)).toBe("AA");
    expect(levelFor(3)).toBe("AA large");
    expect(levelFor(2.99)).toBe("fails");
  });
  it("the better of white and black is never under 4.5 to 1, so the warning is about one side", () => {
    let worst = 99;
    for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 15) for (let bl = 0; bl < 256; bl += 15) {
      const c = checkColour(`#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`)!;
      worst = Math.min(worst, Math.max(c.onWhite.ratio, c.onBlack.ratio));
    }
    expect(worst).toBeGreaterThan(4.5);
  });
  it("warns on a colour too light for a white page, and only notes one too dark for a black page", () => {
    const light = checkColour("#FFE600")!; // yellow: about 1.3 to 1 on white
    expect(light.onWhite.ratio).toBeLessThan(3);
    expect(light.warning).toMatch(/Low contrast on white/);
    const dark = checkColour("#1A1A2E")!;
    expect(dark.onBlack.ratio).toBeLessThan(3);
    expect(dark.warning).toBeNull();
    expect(dark.note).toMatch(/Too dark for a black page/);
  });
  it("gives a note, not a warning, for a colour that reads at 3 to 4.5 on white", () => {
    const orange = checkColour("#E05A10")!; // Dutch Orange
    expect(orange.onWhite.ratio).toBeGreaterThan(3);
    expect(orange.onWhite.ratio).toBeLessThan(4.5);
    expect(orange.warning).toBeNull();
    expect(orange.note).toMatch(/large text/);
  });
  it("gives no warning for black or a dark blue", () => {
    for (const h of ["#000000", "#0B2A6F"]) expect(checkColour(h)!.warning).toBeNull();
  });
  it("picks the text colour that reads better", () => {
    expect(onColour("#000000")).toBe("#FFFFFF");
    expect(onColour("#FFFFFF")).toBe("#000000");
    expect(onColour("#E05A10")).toBe("#000000");
  });
});

describe("pricing arithmetic", () => {
  const unit = { known: true, minor: 1000, currency: "USD", missing: [] };

  it("works out margin per unit after percent and fixed fees", () => {
    const m = margin(2500, unit, { platformPercent: 15, platformFixed: 0.5, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null });
    expect(m.feeMinor).toBe(375 + 50);
    expect(m.marginMinor).toBe(2500 - 1000 - 425);
    expect(m.marginPercent).toBeCloseTo(43.0, 5);
    expect(m.partial).toBe(false);
  });
  it("shows a loss as a negative margin and marks an incomplete cost", () => {
    const m = margin(1000, { known: false, minor: 1200, currency: "USD", missing: ["Case"] }, { platformPercent: 0, platformFixed: 0, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null });
    expect(m.marginMinor).toBe(-200);
    expect(m.marginPercent).toBeCloseTo(-20, 5);
    expect(m.partial).toBe(true);
  });
  it("has no percent at a price of zero", () => {
    expect(margin(0, unit, { platformPercent: 0, platformFixed: 0, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null }).marginPercent).toBeNull();
  });
  it("cost plus returns the price that gives the target after fees, and inverts margin()", () => {
    const ch = { platformPercent: 15, platformFixed: 0.5, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null };
    const p = costPlusPrice(unit, 30, ch)!;
    // (1000 + 50) / (1 - 0.15 - 0.30) = 1909.09..., rounded up
    expect(p).toBe(1910);
    const back = margin(p, unit, ch);
    expect(back.marginPercent!).toBeGreaterThanOrEqual(29.9);
    expect(back.marginPercent!).toBeLessThan(30.2);
  });
  it("cost plus has no answer when fees and target take everything", () => {
    expect(costPlusPrice(unit, 90, { platformPercent: 10, platformFixed: 0, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null })).toBeNull();
    expect(costPlusPrice(unit, 85, { platformPercent: 15, platformFixed: 0, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null })).toBeNull();
  });
  it("finds low, median and high of competitor prices in one currency only", () => {
    const list = [
      { name: "a", priceMinor: 2000, currency: "USD", sourced: true },
      { name: "b", priceMinor: 3000, currency: "USD", sourced: true },
      { name: "c", priceMinor: 9000, currency: "USD", sourced: true },
      { name: "d", priceMinor: 100, currency: "EUR", sourced: true },
    ];
    expect(competitorRange(list, "USD")).toEqual({ count: 3, low: 2000, median: 3000, high: 9000 });
    expect(competitorRange(list.slice(0, 2), "USD")!.median).toBe(2500);
    expect(competitorRange(list, "GBP")).toBeNull();
  });
  it("places a price against the range", () => {
    const r = { count: 2, low: 2000, median: 2500, high: 3000 };
    expect(position(1500, r)).toBe("below all");
    expect(position(2500, r)).toBe("within the range");
    expect(position(3500, r)).toBe("above all");
    expect(position(2500, null)).toBe("no competitor prices");
  });
  it("reads the unit cost from the economics: price breaks and cost lines count, an unpriced part is named and left out", () => {
    const parts = [
      item({ section: "design/bom", id: 1, title: "Board", data: { line: 12.5 } }),
      item({ section: "design/bom", id: 2, title: "Case", data: {} }),
      // 2 per unit, 4.00 each, 3.00 each from 100 pieces: a batch of 50 orders 100
      item({ section: "design/bom", id: 3, title: "Cell", data: { qty: 2, unit: 4, priceBreaks: [{ qty: 100, unit: 3 }] } }),
    ];
    const economics = [item({ section: "production/economics", id: 9, title: "Assembly", data: { kind: "labour", labourMinutes: 6, rate: 30 } })];
    const batches = [item({ section: "production/batches", id: 10, title: "First run", data: { units: 50 } })];
    const rows = { parts, economics, channels: [], methods: [], batches };
    const u = pricingUnitCost(referenceUnitCost(readEconomics(rows, "EUR")));
    // 12.50 board + 2 x 3.00 cells at the break + 6 min x 30.00 / 60 labour = 21.50; the case is named, not counted
    expect(u).toEqual({ known: false, minor: 2150, currency: "EUR", missing: ["Case: not priced"], batchSize: 50 });
    const priced = pricingUnitCost(referenceUnitCost(readEconomics({ ...rows, parts: parts.filter((p) => p.title !== "Case") }, "EUR")));
    expect(priced.known).toBe(true);
    expect(pricingUnitCost(referenceUnitCost(readEconomics({ parts: [], economics: [], channels: [], methods: [], batches: [] }, "USD")))).toEqual({ known: false, minor: 0, currency: "USD", missing: [], batchSize: 1 });
  });
  it("parses typed money in the currency's own minor unit", () => {
    expect(parseMinor("1500", "JPY")).toBe(1500);
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
  });
  it("formats and parses money", () => {
    expect(formatMoney(2495, "USD")).toBe("$24.95");
    expect(parseMinor("$24.95")).toBe(2495);
    expect(parseMinor("1,200")).toBe(120000);
    expect(parseMinor("")).toBeNull();
    expect(parseMinor("-3")).toBeNull();
    expect(parseMinor("abc")).toBeNull();
  });
});

describe("name checks", () => {
  it("builds links from the name, encoded", () => {
    const links = nameChecks("Sass Case");
    const by = Object.fromEntries(links.map((l) => [l.id, l.href]));
    expect(by["amazon"]).toBe("https://www.amazon.com/s?k=Sass%20Case");
    expect(by["etsy"]).toBe("https://www.etsy.com/search?q=Sass%20Case");
    expect(by["domain-search"]).toBe("https://www.namecheap.com/domains/registration/results/?domain=sasscase");
    expect(by["domain-whois"]).toBe("https://who.is/whois/sasscase.com");
    expect(by["tm-euipo"]).toBe("https://euipo.europa.eu/eSearch/#basic/1+1+1+1/50+50+50+50/Sass%20Case");
    expect(by["tm-wipo"]).toContain("branddb.wipo.int/en/quicksearch?by=brandName&v=Sass%20Case");
    expect(by["tm-uspto"]).toBe("https://tmsearch.uspto.gov/search/search-information");
    expect(by["social-instagram"]).toBe("https://www.instagram.com/sasscase/");
    expect(by["social-x"]).toBe("https://x.com/sasscase");
    expect(by["social-tiktok"]).toBe("https://www.tiktok.com/@sasscase");
  });
  it("encodes characters that could break out of a link", () => {
    const links = nameChecks('A&B "Co" <x>#?');
    for (const l of links) {
      const u = new URL(l.href);
      expect(["https:"]).toContain(u.protocol);
      expect(l.href).not.toMatch(/[<> "]/);
    }
    expect(links.find((l) => l.id === "amazon")!.href).toContain("A%26B%20%22Co%22%20%3Cx%3E%23%3F");
  });
  it("has a check in every group for a name, and only phrase searches for a tagline", () => {
    expect(new Set(nameChecks("Acme").map((c) => c.group))).toEqual(new Set(GROUP_ORDER));
    const tag = nameChecks("Your luggage finally talks back.", "Tagline");
    expect(tag.map((c) => c.group)).not.toContain("domain");
    expect(tag.map((c) => c.group)).not.toContain("social");
    expect(tag.find((c) => c.id === "web")!.href).toContain("%22Your%20luggage");
  });
  it("returns nothing for an empty name and strips a handle to letters and digits", () => {
    expect(nameChecks("   ")).toEqual([]);
    expect(handleOf("Émile's Bag-2!")).toBe("emilesbag2");
  });
  it("never claims availability, anywhere in its words", () => {
    expect(SCREENING_NOTE.toLowerCase()).toContain("not a clearance");
    const words = nameChecks("Acme").map((c) => c.label).join(" ").toLowerCase();
    for (const claim of ["is available", "are available", "is free", "is clear", "is taken", "is not taken", "no conflicts", "cleared"]) {
      expect(words).not.toContain(claim);
    }
  });
  it("counts ticks", () => {
    const c = nameChecks("Acme");
    expect(screeningProgress(c, { amazon: true, etsy: true, nope: true })).toEqual({ done: 2, total: c.length });
    expect(screeningProgress(c, undefined).done).toBe(0);
  });
});

describe("proof check", () => {
  const rows = new Map<number, ProofRow>([
    [1, { id: 1, section: "research/claims", title: "Claim A", status: "verified", data: VERIFIED }],
    [2, { id: 2, section: "research/claims", title: "Claim B", status: "unverified", data: {} }],
    [3, { id: 3, section: "prototype/tests", title: "Test", status: "pass", data: {} }],
    [4, { id: 4, section: "prototype/tests", title: "Test 2", status: "fail", data: {} }],
    [5, { id: 5, section: "design/requirements", title: "Req", status: "open", data: {} }],
  ]);
  const ref = (itemId: number) => ({ itemId, section: "x" });
  it("counts a verified claim, a passing test and a requirement", () => {
    const [a, b, c] = checkProof([{ text: "a", proof: [ref(1)] }, { text: "b", proof: [ref(3)] }, { text: "c", proof: [ref(5)] }], rows);
    expect(a.hasProof && b.hasProof && c.hasProof).toBe(true);
    expect(a.links[0].state).toBe("verified claim");
    expect(b.links[0].state).toBe("passing test");
    expect(c.onlyRequirement).toBe(true);
    expect(a.onlyRequirement).toBe(false);
  });
  it("flags a message with no link, an unverified claim, a failing test or a link to nothing", () => {
    const out = checkProof([{ text: "none", proof: [] }, { text: "unverified", proof: [ref(2)] }, { text: "failing", proof: [ref(4)] }, { text: "gone", proof: [ref(99)] }], rows);
    expect(out.map((m) => m.hasProof)).toEqual([false, false, false, false]);
    expect(out.map((m) => m.links[0]?.state)).toEqual([undefined, "unverified claim", "test not passing", "missing"]);
  });
  it("one good link is enough even beside a bad one", () => {
    expect(checkProof([{ text: "x", proof: [ref(2), ref(1)] }], rows)[0].hasProof).toBe(true);
  });
});

describe("brand kit", () => {
  const kit = item({
    section: "marketing/brand",
    data: {
      kind: "kit",
      voiceSummary: "Deadpan.",
      rules: [{ rule: "First person.", doExample: "I weigh 12 kg.", dontExample: "The product weighs 12 kg." }, { rule: "  ", doExample: "", dontExample: "" }],
      colours: [{ role: "primary", name: "Orange", hex: "#e05a10" }, { role: "secondary", name: "Ink", hex: "#111111" }, { role: "secondary", name: "Bad", hex: "red; } body { display:none" }],
      headingFont: "Inter, sans-serif",
      bodyFont: "x; } * { color:red",
      tagline: "Talk back.",
      boilerplate: "About us.",
    },
  });
  it("finds the kit among other rows", () => {
    expect(findKit([item({ section: "marketing/brand", data: { kind: "voicecheck" } }), kit])).toBe(kit);
    expect(findKit([])).toBeNull();
  });
  it("renders voice, rules with examples, tagline and boilerplate as text", () => {
    const t = brandText(kit);
    expect(t).toContain("Voice: Deadpan.");
    expect(t).toContain('- First person. Do: "I weigh 12 kg." Do not: "The product weighs 12 kg."');
    expect(t).toContain("Tagline: Talk back.");
    expect(t).toContain("Boilerplate: About us.");
    expect(t).not.toContain("Orange");
    expect(brandText(null)).toBe("");
    expect(brandText(item({ section: "marketing/brand", data: { kind: "kit" } }))).toBe("");
  });
  it("writes CSS variables only from values that pass a strict pattern", () => {
    const css = brandCssVariables(kit);
    expect(css).toContain("--brand-primary: #E05A10;");
    expect(css).toContain("--brand-on-primary: #000000;");
    expect(css).toContain("--brand-secondary: #111111;");
    expect(css).toContain("--brand-font-heading: Inter, sans-serif;");
    expect(css).not.toContain("display:none");
    expect(css).not.toContain("color:red");
    expect(css).not.toContain("}\n}");
    expect(brandCssVariables(null)).toBe("");
  });
});

describe("competitor price reader", () => {
  it("reads one plain price and refuses a range or several", () => {
    expect(readPrice("$29.99")).toEqual({ minor: 2999, currency: "USD" });
    expect(readPrice("about €1,200 a year")).toEqual({ minor: 120000, currency: "EUR" });
    expect(readPrice("£5")).toEqual({ minor: 500, currency: "GBP" });
    expect(readPrice("$20 to $30")).toBeNull();
    expect(readPrice("free")).toBeNull();
  });
});

describe("positioning", () => {
  it("composes the line and leaves visible blanks for what is missing", () => {
    expect(positioningLine({ forWhom: "frequent flyers", need: "a laugh at the carousel", productIs: "talking tag", thatDoes: "complains aloud", unlike: "a plain tag", difference: "has a voice" }, "Acme"))
      .toBe("For frequent flyers, who need a laugh at the carousel, Acme is a talking tag that complains aloud. Unlike a plain tag, Acme has a voice.");
    expect(positioningLine({}, "Acme")).toContain("[who it is for]");
  });
  it("fingerprints the words and proof links, not other fields", () => {
    const a = { forWhom: "x", messages: [{ text: "m", proof: [{ itemId: 1 }] }], critique: { text: "c" } };
    expect(positioningFingerprint(a)).toBe(positioningFingerprint({ ...a, critique: { text: "other" }, generatedFrom: {} }));
    expect(positioningFingerprint(a)).not.toBe(positioningFingerprint({ ...a, forWhom: "y" }));
    expect(positioningFingerprint(a)).not.toBe(positioningFingerprint({ ...a, messages: [{ text: "m", proof: [{ itemId: 2 }] }] }));
  });
});

describe("approval rules for positioning", () => {
  const was = (data: Record<string, unknown>, status = "draft") => ({ section: "marketing/positioning", status, data });
  // every message of a positioning needs proof before it can be approved; this one links to a verified claim
  const proof = new Map<number, ProofRow>([[1, { id: 1, section: "research/claims", title: "Claim A", status: "verified", data: VERIFIED }]]);
  const words = { forWhom: "x", messages: [{ text: "It does A", proof: [{ itemId: 1, section: "research/claims" }] }] };
  const reviewed = { ...words, critique: { text: "weak", fingerprint: positioningFingerprint(words) } };
  it("refuses approval without a critique", () => {
    expect(() => assertMarketChange(was({ forWhom: "x" }), { status: "approved" }, proof)).toThrow(/attack this positioning once/);
  });
  it("allows approval with a critique of these words", () => {
    expect(() => assertMarketChange(was(reviewed), { status: "approved" }, proof)).not.toThrow();
  });
  it("refuses approval with no proof: no message, a message with no link, or a link that proves nothing", () => {
    const bare = { forWhom: "x", messages: [] };
    expect(() => assertMarketChange(was({ ...bare, critique: { text: "weak", fingerprint: positioningFingerprint(bare) } }), { status: "approved" }, proof)).toThrow(/cannot be approved: it has no supporting message/);
    expect(() => assertMarketChange(was(reviewed), { status: "approved" }, new Map())).toThrow(/1 of 1 message has no proof: "It does A"/);
    const unlinked = { forWhom: "x", messages: [{ text: "It does B", proof: [] }] };
    expect(() => assertMarketChange(was({ ...unlinked, critique: { text: "weak", fingerprint: positioningFingerprint(unlinked) } }), { status: "approved" }, proof)).toThrow(/no proof: "It does B"/);
  });
  it("refuses approval after the words changed, and an edit that leaves it approved", () => {
    expect(() => assertMarketChange(was(reviewed), { status: "approved", data: { forWhom: "changed" } }, proof)).toThrow(/changed after/);
    expect(() => assertMarketChange(was(reviewed, "approved"), { data: { forWhom: "changed" } }, proof)).toThrow(/changed after/);
    expect(() => assertMarketChange(was(reviewed, "approved"), { data: { forWhom: "changed" }, status: "draft" }, proof)).not.toThrow();
  });
  it("never lets the critique be written by hand", () => {
    expect(() => assertMarketChange(was({}), { data: { critique: { text: "x" } } }, proof)).toThrow(/written by the reviewer/);
    expect(() => assertNewMarket({ section: "marketing/positioning", data: { critique: {} } })).toThrow();
    expect(() => assertNewMarket({ section: "marketing/positioning", status: "approved" })).toThrow();
    expect(() => assertNewMarket({ section: "marketing/personas", status: "approved" })).not.toThrow();
  });
});

describe("pricing uses the economics' fee arithmetic", () => {
  it("platform and payment fees add, and agree with the sales channel's own result", async () => {
    const { channelResults } = await import("@/lib/economics/compute");
    const unit = { known: true, minor: 1000, currency: "USD", missing: [] };
    const fees = { platformPercent: 8, platformFixed: 0.3, paymentPercent: 2.9, paymentFixed: 0.3, fulfilment: null, returnsPercent: null, adCost: null };
    const m = margin(2499, unit, fees);
    const row = { id: 1, title: "Shop", status: "planned", price: 24.99, ...fees };
    const r = channelResults([row], { total: 1000, complete: true, currency: "USD", missing: [], lines: [] } as never, { total: 0, lines: [], missing: [] })[0];
    expect(m.feeMinor).toBe(r.platformFee + r.paymentFee);
    expect(m.marginMinor).toBe(r.margin);
  });
  it("JPY has no minor digits: a fixed fee of 30 yen is 30", () => {
    const m = margin(1000, { known: true, minor: 400, currency: "JPY", missing: [] }, { platformPercent: 10, platformFixed: 30, paymentPercent: 0, paymentFixed: 0, fulfilment: null, returnsPercent: null, adCost: null });
    expect(m.feeMinor).toBe(130);
  });
});
