// F1: the next step leads through Marketing and Prototype in order, naming what is missing and linking to the
// control that fixes it. Pure: rows are added one step at a time and the next step is read after each.
import { describe, expect, it } from "vitest";
import { processFor } from "@/lib/process/definitions";
import { nextStep, type ProcessState } from "@/lib/process/evaluate";
import type { Item } from "@/lib/types";
import { VERIFIED } from "../research/verified";

let id = 1;
const row = (section: string, status: string, data: Record<string, unknown> = {}, title = `row ${id}`): Item => ({ id: id++, projectId: "p", section, title, body: "", data, status, sort: id });

/** An approved positioning that carries the gate: one message, linked to a verified claim (the claim row comes with it). */
const provenPositioning = (): Item[] => {
  const claim = row("research/claims", "verified", VERIFIED, "Buyers want it");
  return [claim, row("marketing/positioning", "approved", { messages: [{ text: "Buyers want it", proof: [{ itemId: claim.id, section: claim.section }] }] })];
};

const walk = (stage: string, type: string, steps: { add: Item[]; expect: { label: RegExp | string; href: RegExp | string } }[], facts: Record<string, unknown> = {}) => {
  const rows: Item[] = [];
  const state: ProcessState = { stage, gates: [] };
  const seen: string[] = [];
  for (const s of steps) {
    rows.push(...s.add);
    const n = nextStep(processFor(type), state, rows, { name: "Thing", oneLiner: "x" }, facts);
    seen.push(`${n.label} -> ${n.href}`);
    if (typeof s.expect.label === "string") expect(n.label, seen.join("\n")).toBe(s.expect.label);
    else expect(n.label, seen.join("\n")).toMatch(s.expect.label);
    if (typeof s.expect.href === "string") expect(n.href, seen.join("\n")).toBe(s.expect.href);
    else expect(n.href, seen.join("\n")).toMatch(s.expect.href);
  }
};

describe("the Marketing chain", () => {
  it("personas, competitors, positioning (attacked, approved), pricing, name, brand, ads, landing, listing, social, launch email, budget, campaigns, launch plan, links, results", () => {
    const persona = row("marketing/personas", "draft", {}, "Careful Chris");
    const pos = row("marketing/positioning", "draft", { forWhom: "a" }, "For careful buyers");
    walk("marketing", "printed", [
      { add: [], expect: { label: "Draft Personas with AI, or add a row by hand", href: "/s/marketing/personas#draft-with-ai" } },
      { add: [persona], expect: { label: 'Approve "Careful Chris" in Personas', href: "/s/marketing/personas" } },
      { add: [{ ...persona, id: id++, status: "approved" }], expect: { label: "Research competitors and alternatives, then review the rows", href: "/s/marketing/competitors#research-competitors" } },
      { add: [row("marketing/competitors", "approved")], expect: { label: "Draft the positioning with AI, from the personas and competitors", href: "/s/marketing/positioning#draft-with-ai" } },
      { add: [pos], expect: { label: 'Ask the reviewer to attack the positioning "For careful buyers"', href: `/s/marketing/positioning#positioning-${pos.id}` } },
    ]);
  });

  it("an attacked positioning asks for approval, then the chain moves on to pricing and the rest in order", () => {
    const rows: Item[] = [row("marketing/personas", "approved"), row("marketing/competitors", "approved"), row("concept/press", "reviewed")];
    const claim = row("research/claims", "verified", VERIFIED, "Buyers want it");
    const unproven = row("marketing/positioning", "draft", { forWhom: "a", critique: { text: "Weak." } }, "Line");
    const pos = { ...unproven, data: { ...unproven.data, messages: [{ text: "Buyers want it", proof: [{ itemId: claim.id, section: claim.section }] }] } };
    const state: ProcessState = { stage: "marketing", gates: [] };
    const next = () => nextStep(processFor("electronics"), state, rows, { name: "Thing" }, { links: rows.some((r) => r.title === "link") ? 1 : 0, results: rows.some((r) => r.title === "result") ? 1 : 0 });
    // attacked, but with no message tied to proof it cannot be approved: the next step says so
    rows.push(unproven);
    expect(next()).toMatchObject({ label: 'Link proof to the messages of the positioning "Line"', href: `/s/marketing/positioning#positioning-${pos.id}` });
    rows.splice(rows.indexOf(unproven), 1, claim, pos);
    expect(next()).toMatchObject({ label: 'Approve the positioning "Line"', href: `/s/marketing/positioning#positioning-${pos.id}` });
    rows.push({ ...pos, id: id++, status: "approved" });
    const order: [string, string, Item][] = [
      ["/s/marketing/pricing#add-price", "pricing", row("marketing/pricing", "approved")],
      ["/s/marketing/names#draft-with-ai", "name", row("concept/names", "chosen")],
      ["/s/marketing/brand#brand-kit", "brand", row("marketing/brand", "approved")],
      ["/s/marketing/ads#draft-with-ai", "ads", row("marketing/ads", "approved")],
      ["/s/marketing/landing#draft-with-ai", "landing", row("marketing/landing", "approved")],
      ["/s/sales/listing#draft-with-ai", "listing", row("sales/listing", "draft")],
      ["/s/marketing/social#draft-with-ai", "social", row("marketing/social", "approved")],
      ["/s/marketing/announce#draft-with-ai", "announce", row("marketing/announce", "approved")],
      ["/s/marketing/campaigns#campaign-budget", "budget", row("marketing/campaigns", "planned", { kind: "plan", planTotalMinor: 100000, allowableSharePercent: 30 })],
      ["/s/marketing/campaigns#draft-with-ai", "campaigns", row("marketing/campaigns", "planned", { kind: "campaign" })],
      ["/s/marketing/launch#launch-template", "launch", row("marketing/launch", "open")],
      ["/s/marketing/links#new-link", "links", row("x/none", "", {}, "link")],
      ["/s/marketing/results#enter-results", "results", row("x/none", "", {}, "result")],
    ];
    for (const [href, what, r] of order) {
      expect(next().href, what).toBe(href);
      rows.push(r);
    }
    expect(next()).toMatchObject({ label: "Advance to Sales", href: "/process#advance" });
  });

  it("the budget row alone is not a campaign; a half-set budget says what is missing", () => {
    const rows: Item[] = [];
    const state: ProcessState = { stage: "marketing", gates: [] };
    for (const s of ["marketing/personas", "marketing/competitors", "marketing/pricing", "marketing/brand", "marketing/ads", "marketing/landing", "marketing/social", "marketing/announce"]) rows.push(row(s, "approved"));
    rows.push(...provenPositioning(), row("concept/names", "chosen"), row("sales/listing", "draft"));
    rows.push(row("marketing/campaigns", "planned", { kind: "plan", planTotalMinor: 5000 }));
    expect(nextStep(processFor("printed"), state, rows, {}, {})).toMatchObject({ label: "Set the share of the margin a campaign may spend in Campaigns", href: "/s/marketing/campaigns#campaign-budget" });
  });
});

describe("the Prototype chain", () => {
  it("electronics: parts in hand, a print job, printed, the build sheet, tests written, tests pass, a build passed", () => {
    const part = row("design/bom", "to buy", {}, "Dev board");
    walk("prototype", "electronics", [
      { add: [part], expect: { label: 'Move "Dev board" in Sourcing to in hand or to print', href: "/s/prototype/sourcing" } },
      { add: [{ ...part, id: id++, status: "in hand" }].map((x) => x), expect: { label: /Move "Dev board"/, href: "/s/prototype/sourcing" } },
    ]);
    const rows: Item[] = [row("design/bom", "in hand"), row("design/bom", "to print")];
    const state: ProcessState = { stage: "prototype", gates: [] };
    const n = () => nextStep(processFor("electronics"), state, rows, {}, {});
    expect(n()).toMatchObject({ label: "Set up a print job: a file, a printer and the settings", href: "/s/prototype/printing#new-print-job" });
    const job = row("prototype/printing", "queued", {}, "Enclosure base");
    rows.push(job);
    expect(n()).toMatchObject({ label: 'Move "Enclosure base" in 3D printing to done', href: "/s/prototype/printing" });
    rows.splice(rows.indexOf(job), 1, { ...job, status: "done" });
    const wire = row("design/wiring", "soldered", {}, "VCC to sensor");
    rows.push(wire);
    expect(n()).toMatchObject({ label: 'Move "VCC to sensor" in Wiring and soldering to tested', href: "/s/prototype/wiring" });
    rows.splice(rows.indexOf(wire), 1, { ...wire, status: "tested" });
    expect(n()).toMatchObject({ label: "Draft Acceptance tests with AI, or add a row by hand", href: "/s/prototype/tests#draft-with-ai" });
    const t = row("prototype/tests", "not run", {}, "Drop test");
    rows.push(t);
    expect(n()).toMatchObject({ label: 'Move "Drop test" in Acceptance tests to pass', href: `/s/prototype/tests?item=${t.id}` });
    rows.splice(rows.indexOf(t), 1, { ...t, status: "pass" });
    expect(n()).toMatchObject({ label: "Add a build with its exit criteria and tests", href: "/s/prototype/builds#add-build" });
    const b = row("prototype/builds", "testing", {}, "EVT");
    rows.push(b);
    // a build with nothing to prove cannot pass: the step says to give it evidence first
    expect(n()).toMatchObject({ label: 'Add exit criteria and tests to the build "EVT"', href: "/s/prototype/builds" });
    const evidence = { criteria: [{ text: "Boots", met: true }], tests: ["t1"] };
    rows.splice(rows.indexOf(b), 1, { ...b, data: evidence });
    rows.splice(rows.indexOf(rows.find((r) => r.id === t.id)!), 1, { ...t, status: "pass", data: { key: "t1" } });
    expect(n()).toMatchObject({ label: 'Pass the build "EVT" in Builds', href: "/s/prototype/builds" });
    const ready = rows.find((r) => r.id === b.id)!;
    rows.splice(rows.indexOf(ready), 1, { ...ready, status: "passed" });
    expect(n()).toMatchObject({ label: "Advance to Production", href: "/process#advance" });
  });

  it("a finished print counts: the job status is done (the gate asked for printed, which no job reaches)", () => {
    const state: ProcessState = { stage: "prototype", gates: [] };
    const rows = [row("design/bom", "to print"), row("prototype/printing", "done")];
    expect(nextStep(processFor("printed"), state, rows).href).toBe("/s/prototype/tests#draft-with-ai");
  });
});

describe("content rows: the next step names what stops the first draft", () => {
  const before = () => [
    row("marketing/personas", "approved"), row("marketing/competitors", "approved"), ...provenPositioning(),
    row("marketing/pricing", "approved"), row("concept/names", "chosen"), row("marketing/brand", "approved"),
  ];
  const state: ProcessState = { stage: "marketing", gates: [] };
  it("an ad with no stop and scale rule: write the rule, then approve it", () => {
    const ad = row("marketing/ads", "draft", { channel: "meta" }, "Meta ad A");
    expect(nextStep(processFor("printed"), state, [...before(), ad])).toMatchObject({ label: 'Write the stop and scale rule for "Meta ad A", then approve it', href: "/s/marketing/ads" });
    const ruled = { ...ad, data: { ...ad.data, stopRule: "Stop above 8", costPerOrderCeilingMinor: 800, minSpendBeforeJudgingMinor: 2400 } };
    expect(nextStep(processFor("printed"), state, [...before(), ruled])).toMatchObject({ label: 'Approve "Meta ad A" in Ads' });
  });
  it("an ad a campaign runs takes the campaign's rule", () => {
    const ad = row("marketing/ads", "draft", {}, "Ad B");
    const camp = row("marketing/campaigns", "planned", { kind: "campaign", creative: [{ section: "marketing/ads", itemId: ad.id }], rule: { stopAboveMinor: 900, afterSpendMinor: 3000 } });
    expect(nextStep(processFor("printed"), state, [...before(), ad, camp]).label).toBe('Approve "Ad B" in Ads');
  });
  it("a draft with a line that has no proof: link proof or take it out", () => {
    const post = row("marketing/landing", "draft", { noProof: true }, "Hero");
    const rows = [...before(), row("marketing/ads", "approved"), post];
    expect(nextStep(processFor("printed"), state, rows)).toMatchObject({ label: 'Link proof to "Hero" or take the flagged line out, then approve it', href: "/s/marketing/landing" });
  });
});

describe("a check that needs a row elsewhere first", () => {
  it("the launch email is written from a reviewed press release: with none, the next step is the press release", () => {
    const state: ProcessState = { stage: "marketing", gates: [] };
    const rows = ["marketing/personas", "marketing/competitors", "marketing/pricing", "marketing/brand", "marketing/ads", "marketing/landing", "marketing/social"].map((s) => row(s, "approved"));
    rows.push(...provenPositioning(), row("concept/names", "chosen"), row("sales/listing", "draft"));
    expect(nextStep(processFor("printed"), state, rows)).toMatchObject({ label: "Write the press release and mark it reviewed: the launch email is written from it", href: "/s/concept/press#draft-with-ai" });
    const press = row("concept/press", "draft", {}, "Launch");
    rows.push(press);
    expect(nextStep(processFor("printed"), state, rows)).toMatchObject({ label: 'Mark "Launch" reviewed or final in Press release', href: `/s/concept/press?item=${press.id}` });
    rows.push(row("concept/press", "reviewed", {}, "Launch v2"));
    expect(nextStep(processFor("printed"), state, rows)).toMatchObject({ label: "Draft Launch email and press note with AI, or add a row by hand", href: "/s/marketing/announce#draft-with-ai" });
  });
});
