// The welcome page as the early-access page (owner, 22 Nov): what its words may not say, which plans it sells,
// and at what price. The page's words are in content.ts; the plan cards are worked out by paidPlans (Pricing.tsx).
import { describe, expect, it } from "vitest";
import { ACTION, CLOSING, FOOTER, GET, HERO, MECHANISM, META, NAV, PRICING, PROBLEM, PROOF, questions } from "@/components/welcome/content";
import { paidPlans } from "@/components/welcome/Pricing";
import { builtInCatalogue, levelsOf, type PublicLevel } from "@/lib/admin/planSchema";

const level = (o: Partial<PublicLevel>): PublicLevel => ({ key: "maker", name: "Maker", price: "", per: "a month", paid: true, who: "", what: "", includes: [], action: "request", ...o });
const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);

describe("the welcome page's words", () => {
  const plans = paidPlans(levelsOf(builtInCatalogue()).levels, false);
  const words = strings([ACTION, HERO, META, NAV, PROBLEM, GET, MECHANISM, PROOF, PRICING, CLOSING, FOOTER, questions(plans), PROOF.status.count(1, 2), PROOF.status.open(3)]).join("\n");

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

  it("ask six buying questions, with the prices the cards show", () => {
    const q = questions(plans);
    expect(q).toHaveLength(6);
    expect(q[0]!.q).toBe("What does it cost?");
    expect(q[0]!.a).toContain("Maker at $20 a month and Studio at $40 a month");
    expect(questions([]).map((x) => x.a).join(" ")).not.toMatch(/\$/);
  });
});

describe("the plans the page sells", () => {
  it("are Maker and Studio only, whatever else the catalogue shows, at $20 and $40 while its prices are hidden", () => {
    const built = levelsOf(builtInCatalogue());
    const plans = paidPlans(built.levels, built.showPrices);
    expect(plans.map((p) => [p.name, p.price, p.per])).toEqual([["Maker", "$20", "a month"], ["Studio", "$40", "a month"]]);
    expect(plans[1]!.note).toBe("Team seats open after early access.");
    expect(plans[0]!.note).toBe("");
  });

  it("take the catalogue's price once it shows prices", () => {
    expect(paidPlans([level({ price: "$25" })], true)[0]!.price).toBe("$25");
    expect(paidPlans([level({ price: "$25" })], false)[0]!.price).toBe("$20");
  });

  it("never draw a plan that costs nothing, is not paid, or is the run-it-yourself tier", () => {
    const levels = [level({ key: "free", name: "Free", price: "Free", paid: false }), level({ key: "zero", price: "$0" }), level({ key: "self", price: "Free", paid: false, action: "run" }), level({ key: "self-hosted", price: "$5" }), level({ key: "hosted-run", price: "$5", action: "run" })];
    expect(paidPlans(levels, true)).toEqual([]);
  });

  it("leave out a paid plan with no price anywhere, and write only the catalogue's own inclusions", () => {
    expect(paidPlans([level({ key: "team", name: "Team" })], true)).toEqual([]);
    expect(paidPlans([level({ includes: ["Several concepts"] })], false)[0]!.includes).toEqual(["Several concepts"]);
  });
});
