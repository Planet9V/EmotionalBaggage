// The welcome page as the early-access page (owner, 22 Nov): what its words may not say, which plans it sells,
// and at what price. The page's words are in content.ts; the plan cards are worked out by paidPlans (Pricing.tsx).
import { describe, expect, it } from "vitest";
import { ACTION, CLOSING, FOOTER, GET, HERO, MECHANISM, META, NAV, PRICING, PROBLEM, PROOF, questions } from "@/components/welcome/content";
import { paidPlans } from "@/components/welcome/Pricing";
import { builtInCatalogue, levelsOf, type PublicLevel } from "@/lib/admin/planSchema";

const level = (o: Partial<PublicLevel>): PublicLevel => ({ key: "maker", name: "Maker", price: "$20", per: "a month", paid: true, who: "", what: "", includes: [], action: "request", priceMonthly: 20, currency: "USD", ...o });
const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);

describe("the welcome page's words", () => {
  const plans = paidPlans(levelsOf(builtInCatalogue()).levels, true);
  const words = strings([ACTION, HERO, META, NAV, PROBLEM, GET, MECHANISM, PROOF, PRICING, CLOSING, FOOTER, questions(plans), PROOF.lead(34, 52), PROOF.status.count(1, 2), PROOF.status.open(3)]).join("\n");

  it.each(["free", "faster", "demo", "github", "open source", "open-source", "self-host", "docker", "apache", "being built", "run it yourself", "request access"])("never say %s", (word) => {
    expect(words.toLowerCase()).not.toContain(word);
  });

  it("have one name for the one action, and the privacy sentence as ruled", () => {
    expect(ACTION.label).toBe("Claim an early-access place");
    expect(FOOTER.privacy).toBe("Visits to this page are counted on our own server. Nothing is sent to anyone else.");
    expect(PRICING.first).toBe("Early-access members are asked first when paid plans open.");
  });

  it("link the header to four blocks of the page", () => {
    expect(NAV.map((n) => n.href)).toEqual(["#get", "#proof", "#pricing", "#faq"]);
  });

  it("show three of the problem's pairs", () => {
    expect(PROBLEM.shown).toHaveLength(3);
    for (const i of PROBLEM.shown) expect(PROBLEM.pairs[i]).toBeTruthy();
  });

  it("ask seven buying questions, with the prices the cards show, and answer who sees an idea in the owner's words", () => {
    const q = questions(plans);
    expect(q).toHaveLength(7);
    expect(q.find((x) => x.q === "Who can see my idea?")?.a).toBe("Your ideas are kept in your own workspace and are not shared with others.");
    expect(q.map((x) => `${x.q} ${x.a}`).join(" ").toLowerCase()).not.toMatch(/\bown(s|ed|er|ership)\b/);
    expect(q[0]!.q).toBe("What does it cost?");
    expect(q[0]!.a).toContain("Maker at $20 a month and Studio at $40 a month");
    expect(questions([]).map((x) => x.a).join(" ")).not.toMatch(/\$/);
  });
});

describe("the plans the page sells", () => {
  it("are the catalogue's two, Maker at $20 and Studio at $40 a month", () => {
    const built = levelsOf(builtInCatalogue());
    const plans = paidPlans(built.levels, built.showPrices);
    expect(plans.map((p) => [p.name, p.price, p.per])).toEqual([["Maker", "$20", "a month"], ["Studio", "$40", "a month"]]);
    // the catalogue itself says when Studio's team seats open; the page adds no line of its own
    expect(plans[1]!.includes.join(" ")).toMatch(/Team seats, opening after early access/);
  });

  it("take every price from the catalogue, and draw no card while it keeps prices off the page", () => {
    expect(paidPlans([level({ price: "$25", priceMonthly: 25 })], true)[0]!.price).toBe("$25");
    expect(paidPlans([level({})], false)).toEqual([]);
  });

  it("never draw a plan that costs nothing, is not paid, or has no price", () => {
    const levels = [level({ key: "free", name: "Free", price: "Free", priceMonthly: 0, paid: false }), level({ key: "zero", price: "Free", priceMonthly: 0 }), level({ key: "team", name: "Team", price: "", priceMonthly: null })];
    expect(paidPlans(levels, true)).toEqual([]);
  });

  it("write only the catalogue's own inclusions", () => {
    expect(paidPlans([level({ includes: ["Several concepts"] })], true)[0]!.includes).toEqual(["Several concepts"]);
  });
});
