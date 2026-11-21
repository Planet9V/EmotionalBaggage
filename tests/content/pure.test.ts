// The content library without a database: channel limits and their sources, the no-proof check, the
// landing page renderer and the exports.
import { describe, expect, it } from "vitest";
import { AD_CHANNELS, SOCIAL_CHANNELS, LISTING_CATEGORIES, checkChannel, checkListing, checkSocial, listingCategory, measure, refusals, socialChannel } from "@/lib/content/channels";
import { evaluate, numbersIn, proofStateOf, type ProofRow } from "@/lib/content/claims";
import { adsCsv, launchHtml, launchText, listingFlatFile, listingText } from "@/lib/content/exports";
import { toCsvText } from "@/lib/csv";

const cell = (v: unknown) => toCsvText([[v]], { trailingNewline: false });
import { contrastReport, esc, renderPage, type LandingSection, type RenderEnv } from "@/lib/content/landing";
import type { Item } from "@/lib/types";

const row = (over: Partial<ProofRow> = {}): ProofRow => ({ id: 1, section: "research/claims", title: "Battery lasts 7 days", body: "", status: "verified", data: {}, ...over });

describe("channel specs", () => {
  it("covers the seven ad platforms the plan names", () => {
    const ids = AD_CHANNELS.map((c) => c.id);
    for (const want of ["amazon-sponsored-products", "amazon-sponsored-brands", "meta-facebook-feed", "meta-stories", "x-ads", "google-search-rsa", "tiktok-ads", "reddit-ads", "pinterest-ads"]) expect(ids).toContain(want);
  });

  it("a limit is enforced only when it carries a web address of the platform's own page", () => {
    for (const c of AD_CHANNELS) {
      for (const f of c.fields) {
        if (f.enforce) expect(f.source, `${c.id}.${f.key}`).toMatch(/^https:\/\//);
        else expect(f.source === undefined || /^https:\/\//.test(f.source), `${c.id}.${f.key}`).toBe(true);
      }
    }
  });

  it("every channel says what it was read from or that it could not be", () => {
    for (const c of AD_CHANNELS) expect(c.sources.length > 0 || !!c.unverified, c.id).toBe(true);
  });
});

describe("counting", () => {
  it("counts an emoji and a CJK character as two and a web address as 23 on X", () => {
    expect(measure("hi", true)).toBe(2);
    expect(measure("a😀", true)).toBe(3);
    expect(measure("日本", true)).toBe(4);
    expect(measure("see https://example.com/a/very/long/path/here now", true)).toBe(4 + 23 + 4);
    expect(measure("a😀")).toBe(2);
  });
});

describe("checking an ad", () => {
  const rsa = AD_CHANNELS.find((c) => c.id === "google-search-rsa")!;
  it("refuses a field over a limit that comes from the platform's page, and says by how much", () => {
    const p = checkChannel(rsa, { headlines: ["x".repeat(31), "b", "c"], descriptions: ["d", "e"] });
    const hard = refusals(p);
    expect(hard.some((h) => h.field === "headlines" && /31/.test(h.message))).toBe(true);
  });
  it("warns, and does not refuse, over a soft limit", () => {
    const meta = AD_CHANNELS.find((c) => c.id === "meta-facebook-feed")!;
    const p = checkChannel(meta, { primaryText: "x".repeat(200), headline: "ok" });
    const over = p.filter((x) => x.field === "primaryText");
    expect(over.length).toBeGreaterThan(0);
    expect(over.every((x) => x.level === "warn")).toBe(true);
  });
  it("needs three headlines and two descriptions for approval", () => {
    const p = checkChannel(rsa, { headlines: ["a"], descriptions: ["b"] }, { forApproval: true });
    expect(refusals(p).length).toBeGreaterThan(0);
  });
});

describe("social and listing limits", () => {
  it("finds a channel by id or by its label in any case", () => {
    expect(socialChannel("X")?.id).toBe(socialChannel("x")?.id);
    expect(socialChannel("Instagram")).toBeTruthy();
    expect(socialChannel("nonsense")).toBeUndefined();
    expect(SOCIAL_CHANNELS.length).toBeGreaterThanOrEqual(5);
  });
  it("an X post over 280 is a problem", () => {
    const x = socialChannel("x")!;
    expect(checkSocial(x, "a".repeat(281)).length).toBeGreaterThan(0);
    expect(checkSocial(x, "a".repeat(100))).toEqual([]);
  });
  it("a listing title over 200 characters is refused; claims Amazon does not allow are warnings with a source", () => {
    const cat = listingCategory("default");
    const long = checkListing(cat, { title: "t".repeat(201), bullets: [], description: "", searchTerms: "" });
    expect(refusals(long).some((p) => p.field === "title")).toBe(true);
    const claims = checkListing(cat, { title: "Cures anxiety", bullets: ["Best seller, cheapest price"], description: "Free shipping", searchTerms: "" });
    const warned = claims.filter((p) => "rule" in p && p.rule);
    expect(warned.length).toBeGreaterThan(0);
    for (const w of warned) {
      expect(w.level).toBe("warn");
      expect((w as { source?: string }).source).toMatch(/^https:\/\//);
    }
  });
  it("search terms are counted in bytes", () => {
    const cat = listingCategory("default");
    const p = checkListing(cat, { title: "ok", bullets: [], description: "", searchTerms: "é".repeat(130) });
    expect(p.some((x) => x.field === "searchTerms")).toBe(true);
    expect(LISTING_CATEGORIES.length).toBeGreaterThan(1);
  });
});

describe("the no-proof check", () => {
  it("passes a line with no number and no superlative", () => {
    expect(evaluate([{ field: "headline", text: "A bag that weighs itself" }], [])).toEqual([]);
  });
  it("flags a number with no linked row, and a superlative with no linked row", () => {
    const f = evaluate([{ field: "headline", text: "Lasts 7 days" }, { field: "line", text: "The best bag" }], []);
    expect(f.map((x) => x.kind).sort()).toEqual(["number", "superlative"]);
  });
  it("passes a number that appears in a verified claim it links to", () => {
    expect(evaluate([{ field: "headline", text: "Lasts 7 days" }], [row()])).toEqual([]);
  });
  it("flags a number that the linked row does not hold", () => {
    expect(evaluate([{ field: "headline", text: "Lasts 9 days" }], [row()]).length).toBe(1);
  });
  it("does not take an unverified claim as proof", () => {
    const r = row({ status: "unverified" });
    expect(proofStateOf(r)).toBe("not proof");
    expect(evaluate([{ field: "headline", text: "Lasts 7 days" }], [r]).length).toBe(1);
  });
  it("a requirement backs a number but not a superlative", () => {
    const req = row({ section: "design/requirements", status: "open", title: "Lasts 7 days" });
    expect(evaluate([{ field: "a", text: "Lasts 7 days" }], [req])).toEqual([]);
    expect(evaluate([{ field: "a", text: "The best battery" }], [req]).length).toBe(1);
  });
  it("ignores digits in the product's own name and in web addresses", () => {
    expect(evaluate([{ field: "a", text: "Meet Bag2Go at https://bag2go.com/7" }], [], ["Bag2Go"])).toEqual([]);
  });
  it("reads numbers with commas", () => {
    expect(numbersIn("1,200 and 3.50")).toEqual(["1200", "3.50"]);
  });
});

const sections = (over: Partial<LandingSection>[] = []): LandingSection[] =>
  [
    { id: 1, kind: "hero", content: { headline: "A bag that weighs itself", subhead: "Know before the airport.", ctaLabel: "Order", ctaHref: "https://example.com/buy" }, status: "approved", order: 0 },
    { id: 2, kind: "problem", content: { heading: "Overweight fees add up", points: ["You guess the weight."] }, status: "approved", order: 1 },
    { id: 3, kind: "how", content: { heading: "How it works", steps: [{ title: "Pack", text: "Fill it." }, { title: "Lift", text: "Read the screen." }] }, status: "approved", order: 2 },
    { id: 4, kind: "comparison", content: { heading: "How it compares", competitorIds: [10, 11] }, status: "approved", order: 3 },
    { id: 5, kind: "faq", content: { heading: "Questions", items: [{ q: "Is it waterproof?", a: "Not yet." }] }, status: "approved", order: 4 },
    { id: 6, kind: "footer", content: { text: "Footer text" }, status: "approved", order: 5 },
  ].map((s, i) => ({ ...(s as LandingSection), ...(over[i] ?? {}) }));

const env = (over: Partial<RenderEnv> = {}): RenderEnv => ({
  name: "Bag",
  primary: "#0b5fff",
  competitors: [
    { id: 10, title: "Sourced Co", claim: "Scale in handle", sourceUrl: "https://sourced.example/p", basis: "researched" },
    { id: 11, title: "Rumour Inc", claim: "Maybe cheaper", basis: "unsourced" },
  ],
  priceText: () => null,
  proofLabel: () => null,
  image: () => null,
  scheme: "light",
  ...over,
});

describe("the landing page renderer", () => {
  it("is one self-contained document with no script and no stat tiles", () => {
    const { html } = renderPage(sections(), env());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/stat|kpi|metric/i);
    expect(html).not.toMatch(/https?:\/\/[^"' ]+\.(css|js)/);
  });
  it("keeps headings in order: one h1, section headings h2", () => {
    const { html } = renderPage(sections(), env());
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });
  it("shows only competitors that have a source", () => {
    const { html } = renderPage(sections(), env());
    expect(html).toContain("Sourced Co");
    expect(html).toContain("https://sourced.example/p");
    expect(html).not.toContain("Rumour Inc");
  });
  it("lists the sections that are still drafts, and requires alt text with an image", () => {
    const s = sections([{}, { status: "draft" }]);
    s[0].content = { ...s[0].content, imageFileId: 5 };
    const out = renderPage(s, env({ image: () => ({ src: "images/5.png", file: "images/5.png" }) }));
    expect(out.unapproved).toEqual([2]);
    expect(out.problems.some((p) => /alt text/i.test(p))).toBe(true);
    // Without alt text the image is left out of the page and of the export.
    expect(out.images).toEqual([]);
    s[0].content = { ...s[0].content, imageAlt: "A bag on a scale" };
    const ok = renderPage(s, env({ image: () => ({ src: "images/5.png", file: "images/5.png" }) }));
    expect(ok.images).toEqual([{ fileId: 5, file: "images/5.png" }]);
    expect(ok.html).toContain('alt="A bag on a scale"');
  });
  it("escapes what is typed into it", () => {
    const s = sections();
    s[1].content = { heading: "<img src=x onerror=alert(1)>", points: ["a"] };
    const { html } = renderPage(s, env());
    expect(html).not.toContain("<img src=x");
    expect(esc("<&>\"'")).toBe("&lt;&amp;&gt;&quot;&#39;");
  });
  it("does not write a javascript: address", () => {
    const s = sections();
    s[0].content = { ...s[0].content, ctaHref: "javascript:alert(1)" };
    expect(renderPage(s, env()).html).not.toContain("javascript:");
  });
  it("every colour pair used for text reaches 4.5 to 1, whatever the brand colour", () => {
    for (const c of [null, "#0b5fff", "#ffee00", "#222222", "#ff00aa"]) for (const r of contrastReport(c)) expect(r.ratio, `${c} ${r.label}`).toBeGreaterThanOrEqual(4.5);
  });
});

const item = (data: Record<string, unknown>, over: Partial<Item> = {}): Item => ({ id: 1, section: "x", title: "T", body: "", status: "approved", sort: 0, data, ...over }) as Item;

describe("exports", () => {
  it("prefixes a spreadsheet formula so it is text", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)"]) expect(cell(v).replace(/^"|"$/g, "")).toMatch(/^'/);
    expect(cell("plain")).toBe("plain");
    expect(cell('a "quoted", cell')).toBe('"a ""quoted"", cell"');
  });
  it("writes the Google Ads Editor layout for a responsive search ad", () => {
    const spec = AD_CHANNELS.find((c) => c.id === "google-search-rsa")!;
    const out = adsCsv(spec, [item({ fields: { headlines: ["One", "Two", "Three"], descriptions: ["D1", "D2"], finalUrl: "https://example.com" } })], "Bag");
    const [head, first] = out.trim().split("\r\n");
    expect(head.split(",").slice(0, 4)).toEqual(["Campaign", "Ad group", "Ad type", "Headline 1"]);
    expect(first).toContain("Responsive search ad");
    expect(first).toContain("https://example.com");
  });
  it("writes a plain layout, with the stop rule and the two numbers, for other channels", () => {
    const spec = AD_CHANNELS.find((c) => c.id === "reddit-ads")!;
    const out = adsCsv(spec, [item({ fields: { headline: "Hello" }, stopRule: "Stop when cost per order is over the ceiling", costPerOrderCeilingMinor: 1250, minSpendBeforeJudgingMinor: 5000 })], "Bag");
    expect(out).toContain("Stop and scale rule");
    expect(out).toContain("12.50");
    expect(out).toContain("50.00");
  });
  it("writes the rule that governs each ad: the campaign's when a campaign runs it, in the concept's currency", () => {
    const spec = AD_CHANNELS.find((c) => c.id === "reddit-ads")!;
    const ad = { ...item({ fields: { headline: "Hello" }, stopRule: "Own rule", costPerOrderCeilingMinor: 1250, minSpendBeforeJudgingMinor: 5000 }), id: 42 };
    const campaign = { ...ad, id: 7, section: "marketing/campaigns", title: "Spring", data: { kind: "campaign", creative: [{ section: "marketing/ads", itemId: 42 }], rule: { stopAboveMinor: 800, afterSpendMinor: 3000 } } };
    const out = adsCsv(spec, [ad], "Bag", [campaign], "JPY");
    expect(out).toContain("campaign: Spring");
    expect(out).toContain("Cost per order ceiling (JPY)");
    expect(out).toContain(",800,3000,");
    expect(out).not.toContain("12.50");
  });
  it("writes a listing as text and as one flat-file row", () => {
    const l = { title: "Title", bullets: ["b1", "b2"], description: "Desc", searchTerms: "a b" };
    expect(listingText(l, "default")).toContain("b2");
    const flat = listingFlatFile(l, { brand: "Bag" }).trim().split("\n");
    expect(flat.length).toBeGreaterThanOrEqual(2);
    expect(flat[0].split("\t").length).toBe(flat[1].split("\t").length);
  });
  it("writes a launch email as text and as HTML with the body escaped", () => {
    const r = item({ kind: "email", subjects: ["Subject A"], previewText: "Preview" }, { body: "Hello <b>there</b>\n\nSecond paragraph" });
    expect(launchText(r)).toContain("Subject A");
    const html = launchHtml(r);
    expect(html).not.toContain("<b>there</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("numbers that are designations", () => {
  it("does not treat MK1 or V2 as a figure needing proof, and still catches 3x and 50%", async () => {
    const { numbersIn } = await import("@/lib/content/claims");
    expect(numbersIn("Baggage Claims MK1 ships in March, V2 later.")).toEqual([]);
    expect(numbersIn("3x louder, 50% lighter, lasts 12 hours")).toEqual(["3", "50", "12"]);
  });
});
