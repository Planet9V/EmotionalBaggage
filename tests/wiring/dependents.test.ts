// Wiring check 5: changing a positioning line, a claim or a part lists the marketing and assembly
// rows that depend on it. The dependency graph (impactGraph) knows the links those rows already
// store: a message's proof, a piece of copy's proof and its message, a step's parts, a price's cost.
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as IMPACT } from "@/app/api/drafts/impact/route";
import { impactGraph, type ImpactReply } from "@/lib/ai/drafts/impact";
import { meaningful } from "@/components/drafts/ImpactNotice";
import type { Item } from "@/lib/types";
import { json, read } from "../api/helpers";
import { addItem as insert, makeConcept } from "../drafts/helpers";
import { VERIFIED } from "../research/verified";

const row = (id: number, section: string, title: string, data: Record<string, unknown> = {}): Item => ({ id, projectId: "p", section, title, body: "", data, status: "draft", sort: id });

describe("the dependency graph", () => {
  const claim = row(1, "research/claims", "Travellers laugh at it", VERIFIED);
  const test = row(2, "prototype/tests", "Drop", { key: "t-drop" });
  const pos = row(3, "marketing/positioning", "Line", { kind: "statement", messages: [{ text: "It is funny", proof: [{ itemId: 1, section: "research/claims" }] }, { text: "It survives", proof: [{ itemId: 2, section: "prototype/tests" }] }] });
  const message = { positioningId: 3, index: 0, text: "It is funny" };
  const ad = row(4, "marketing/ads", "Ad", { message, proof: [{ itemId: 1, section: "research/claims" }] });
  const hero = row(5, "marketing/landing", "Hero", { message, kind: "hero" });
  const proofBand = row(6, "marketing/landing", "Proof", { kind: "proof", content: { items: [{ text: "Tested", proofItemId: 2 }] } });
  const post = row(7, "marketing/social", "Post", { message: { ...message, index: 1 } });
  const listing = row(8, "sales/listing", "Listing", { message });
  const part = row(9, "design/bom", "Speaker", { ref: "LS1", qty: 1, unit: 1.8 });
  const step = row(10, "prototype/assembly", "Glue the speaker", { key: "s1", parts: ["LS1"] });
  const price = row(11, "marketing/pricing", "24.95", { kind: "price", priceMinor: 2495 });
  const g = impactGraph([claim, test, pos, ad, hero, proofBand, post, listing, part, step, price]);
  const from = (id: number) => g.edges.filter((e) => e.from === `i${id}`).map((e) => e.to).sort();
  const why = (a: number, b: number) => g.edges.find((e) => e.from === `i${a}` && e.to === `i${b}`)?.why ?? "";

  it("a claim leads to the positioning that cites it and the copy that cites it", () => {
    expect(from(1)).toEqual(["i3", "i4"]);
    expect(why(1, 3)).toBe('proof for the message "It is funny"');
    expect(why(1, 4)).toBe("its copy cites this as proof");
  });
  it("a test or requirement used as proof does the same", () => {
    expect(from(2)).toEqual(["i3", "i6"]);
  });
  it("a positioning leads to every ad, page section, post and listing written from one of its messages", () => {
    expect(from(3)).toEqual(["i4", "i5", "i7", "i8"]);
    expect(why(3, 7)).toBe('written from its message "It survives"');
  });
  it("a part leads to the assembly steps that use it and to the prices whose margin rests on its cost", () => {
    expect(from(9)).toEqual(["i10", "i11"]);
    expect(why(9, 11)).toBe("its margin is worked from the unit cost, which includes every part");
  });
  it("saving a positioning or a claim asks what it affects; for a claim, a status change counts", () => {
    expect(meaningful({ section: "marketing/positioning" }, { data: { messages: [] } })).toBe(true);
    expect(meaningful({ section: "research/claims" }, { title: "x" })).toBe(true);
    expect(meaningful({ section: "research/claims" }, { status: "unverified" })).toBe(true);
    expect(meaningful({ section: "marketing/positioning" }, { status: "approved" })).toBe(false);
  });
});

describe("asked through the API, with the real planner", () => {
  const P = "zz-wiring-dependents";
  const ids: Record<string, number> = {};
  const saved = process.env.PLANNER_URL;
  const impact = async (itemId: number) => {
    const r = await read<ImpactReply>(await IMPACT(json("POST", { projectId: P, itemId })));
    if (r.body.engine !== "networkx") throw new Error(r.body.note);
    return Object.fromEntries(r.body.groups.map((g) => [g.section, g.rows.map((x) => x.title).sort()]));
  };

  beforeAll(async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    await makeConcept(P, "ZZ Dependents", "electronics", "A tag that talks");
    ids.claim = await insert(P, "research/claims", "Travellers laugh at it", VERIFIED, "", "verified");
    ids.pos = await insert(P, "marketing/positioning", "Line", { kind: "statement", messages: [{ text: "It is funny", proof: [{ itemId: ids.claim, section: "research/claims" }] }] }, "", "draft");
    const message = { positioningId: ids.pos, index: 0, text: "It is funny" };
    await insert(P, "marketing/ads", "Carousel ad", { message }, "", "draft");
    await insert(P, "marketing/landing", "Hero", { message, kind: "hero" }, "", "draft");
    await insert(P, "sales/listing", "Amazon listing", { message }, "", "draft");
    ids.part = await insert(P, "design/bom", "Speaker", { ref: "LS1", qty: 1, unit: 1.8 });
    await insert(P, "prototype/assembly", "Glue the speaker behind the grille", { key: "s1", parts: ["LS1"] });
    await insert(P, "prototype/assembly", "Flash the firmware", { key: "s2" });
    await insert(P, "marketing/pricing", "24.95", { kind: "price", priceMinor: 2495, currency: "USD" }, "", "draft");
  });
  afterAll(async () => {
    if (saved === undefined) delete process.env.PLANNER_URL;
    else process.env.PLANNER_URL = saved;
    await q("DELETE FROM projects WHERE id=$1", [P]);
    await pool().end();
  });

  it("a positioning line lists the marketing rows written from it", async () => {
    expect(await impact(ids.pos)).toEqual({ "marketing/ads": ["Carousel ad"], "marketing/landing": ["Hero"], "sales/listing": ["Amazon listing"] });
  });
  it("a claim lists the positioning it proves and, through it, the same marketing rows", async () => {
    expect(await impact(ids.claim)).toEqual({ "marketing/positioning": ["Line"], "marketing/ads": ["Carousel ad"], "marketing/landing": ["Hero"], "sales/listing": ["Amazon listing"] });
  });
  it("a part lists the assembly steps that use it and the prices that rest on its cost", async () => {
    expect(await impact(ids.part)).toEqual({ "prototype/assembly": ["Glue the speaker behind the grille"], "marketing/pricing": ["24.95"] });
  });
});
