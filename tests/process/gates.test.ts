import { describe, expect, it } from "vitest";
import { STAGES } from "@/lib/menu";
import { PRODUCT_TYPE_KEYS, sectionFor, sectionsFor } from "@/lib/productTypes";
import { checkSection, PROCESS_DEFINITIONS, processFor, type Check } from "@/lib/process/definitions";
import { evaluateCheck, evaluateGate, gateOf, nextStep, type ProcessState } from "@/lib/process/evaluate";
import { lockingDecisions } from "@/lib/process/unlocks";
import type { Item } from "@/lib/types";

let nextId = 1;
const row = (section: string, status: string, data: Record<string, unknown> = {}, title = `row ${nextId}`): Item => ({
  id: nextId++, projectId: "p", section, title, body: "", data, status, sort: nextId,
});
const decision = (key: string, chosen = "", unlocks: string[] = [], title = `Decide ${key}?`) =>
  row("concept/decisions", chosen ? "decided" : "open", { key, chosen, unlocks, options: [{ id: "yes", label: "Yes", outcome: "" }, { id: "no", label: "No", outcome: "" }] }, title);

const check = <C extends Check>(c: C) => c;

describe("check kinds", () => {
  it("min-rows counts the rows of the section's store and says how many are missing", () => {
    const c = check({ id: "a", label: "Brief", kind: "min-rows", params: { section: "concept/brief", min: 3 } });
    const two = [row("concept/brief", "open"), row("concept/brief", "done"), row("concept/names", "open")];
    const r = evaluateCheck(c, two);
    expect(r).toMatchObject({ met: false, href: "/s/concept/brief", action: "Add 1 more row to Brief" });
    expect(r.detail).toBe("2 rows recorded, 3 needed.");
    expect(evaluateCheck(c, [...two, row("concept/brief", "open")]).met).toBe(true);
  });

  it("min-rows reads a section that shows another store (Sourcing shows the parts list)", () => {
    const c = check({ id: "a", label: "Parts", kind: "min-rows", params: { section: "prototype/sourcing", min: 1 } });
    expect(evaluateCheck(c, [row("design/bom", "to buy")]).met).toBe(true);
    expect(evaluateCheck(c, []).href).toBe("/s/prototype/sourcing");
  });

  it("all-status needs every row in one of the statuses; no rows leaves nothing to move", () => {
    const c = check({ id: "a", label: "Tests", kind: "all-status", params: { section: "prototype/tests", statuses: ["pass"] } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: true, detail: "No rows yet, so nothing is left to move." });
    const r = evaluateCheck(c, [row("prototype/tests", "pass"), row("prototype/tests", "fail"), row("prototype/tests", "not run")]);
    expect(r).toMatchObject({ met: false, detail: "2 of 3 rows not yet pass.", action: "Move 2 rows in Acceptance tests to pass" });
    expect(evaluateCheck(c, [row("prototype/tests", "pass")]).met).toBe(true);
  });

  it("decision-made finds the decision by key and needs a chosen option", () => {
    const c = check({ id: "a", label: "Go", kind: "decision-made", params: { key: "go" } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, detail: 'No decision has the key "go" yet.', href: "/s/concept/decisions" });
    expect(evaluateCheck(c, [decision("go", "", [], "Build it?")])).toMatchObject({ met: false, detail: "Not decided yet.", action: 'Decide "Build it?"' });
    expect(evaluateCheck(c, [decision("go", "yes")])).toMatchObject({ met: true, detail: "Chosen: Yes." });
    expect(evaluateCheck(c, [decision("other", "yes")]).met).toBe(false);
  });

  it("no-open counts open and blocked rows by default, or the statuses given", () => {
    const c = check({ id: "a", label: "Questions", kind: "no-open", params: { section: "concept/questions" } });
    expect(evaluateCheck(c, [row("concept/questions", "decided")]).met).toBe(true);
    expect(evaluateCheck(c, [row("concept/questions", "open"), row("concept/questions", "blocked")])).toMatchObject({ met: false, detail: "2 rows open or blocked." });
    const wrong = check({ id: "b", label: "Wrong", kind: "no-open", params: { section: "research/claims", statuses: ["wrong"] } });
    expect(evaluateCheck(wrong, [row("research/claims", "unverified")]).met).toBe(true);
    expect(evaluateCheck(wrong, [row("research/claims", "wrong")]).met).toBe(false);
  });

  it("claims-verified compares the verified share with the threshold; no claims is not met", () => {
    const c = check({ id: "a", label: "Claims", kind: "claims-verified", params: { share: 0.8 } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, detail: "No claims recorded yet.", href: "/s/research/claims" });
    const five = ["verified", "verified", "verified", "unverified", "wrong"].map((s) => row("research/claims", s));
    expect(evaluateCheck(c, five)).toMatchObject({ met: false, detail: "3 of 5 claims verified (60%), 80% needed.", action: "Verify 1 more claim" });
    five[3].status = "verified";
    expect(evaluateCheck(c, five).met).toBe(true);
  });

  it("field-set reads the concept's own fields", () => {
    const c = check({ id: "a", label: "One-liner", kind: "field-set", params: { field: "oneLiner" } });
    expect(evaluateCheck(c, [], {})).toMatchObject({ met: false, href: "/concepts", action: "Give the concept a one-line description" });
    expect(evaluateCheck(c, [], { oneLiner: "   " }).met).toBe(false);
    expect(evaluateCheck(c, [], { oneLiner: "A thing" }).met).toBe(true);
  });
});

describe("evaluateGate", () => {
  it("is met only when every check is, and keeps the checks in order", () => {
    const gate = gateOf(processFor("electronics"), "concept");
    const rows = [row("concept/brief", "open"), row("concept/brief", "open"), row("concept/brief", "open"), decision("go", "yes")];
    const r = evaluateGate(gate, rows, { oneLiner: "x" });
    expect(r.met).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual(gate.checks.map((c) => c.id));
    const r2 = evaluateGate(gate, [...rows, row("concept/questions", "open")], { oneLiner: "x" });
    expect(r2.met).toBe(false);
    expect(r2.checks.filter((c) => !c.met).map((c) => c.id)).toEqual(["concept.questions"]);
  });
});

describe("definitions", () => {
  it("every product type has a gate for each of the seven stages, in menu order", () => {
    for (const t of PRODUCT_TYPE_KEYS) {
      expect(PROCESS_DEFINITIONS[t].stages.map((g) => g.stage)).toEqual(STAGES.map((s) => s.key));
      for (const g of PROCESS_DEFINITIONS[t].stages) expect(g.checks.length).toBeGreaterThan(0);
    }
    expect(processFor("unknown").productType).toBe("electronics");
  });

  it("every check points at a section its product type shows", () => {
    for (const t of PRODUCT_TYPE_KEYS) {
      const shown = new Set(sectionsFor(t).flatMap((s) => s.sections.map((x) => `${s.key}/${x.key}`)));
      for (const g of PROCESS_DEFINITIONS[t].stages) {
        for (const c of g.checks) {
          const path = checkSection(c);
          if (path) expect(shown.has(path), `${t}: ${c.id} -> ${path}`).toBe(true);
        }
      }
    }
  });

  it("names nothing specific to one example product", () => {
    const text = JSON.stringify(PROCESS_DEFINITIONS).toLowerCase();
    for (const word of ["baggage", "suitcase", "speaker", "amazon", "kickstarter"]) expect(text).not.toContain(word);
  });
});

describe("a wooden toy (plan 2.7, done when)", () => {
  // A wooden toy is a physical product with no electronics.
  const type = "physical";
  const SOLDERING = ["design/schematic", "prototype/wiring"];

  it("shows no schematic and no wiring-and-soldering section", () => {
    const shown = sectionsFor(type).flatMap((s) => s.sections.map((x) => `${s.key}/${x.key}`));
    for (const k of SOLDERING) expect(shown).not.toContain(k);
    expect(sectionFor(type, "design", "schematic")).toBeNull();
    expect(sectionFor(type, "prototype", "wiring")).toBeNull();
  });

  it("has gates that mention no schematic, wire, joint or soldering", () => {
    const def = processFor(type);
    for (const g of def.stages) {
      for (const c of g.checks) {
        expect(SOLDERING).not.toContain(checkSection(c));
        expect(c.label.toLowerCase()).not.toMatch(/schematic|solder|wire|joint/);
      }
    }
    // And its next steps never send the user to one, even with nothing recorded.
    for (const stage of STAGES.map((s) => s.key)) {
      const n = nextStep(def, { stage, gates: [] }, [], {});
      expect(SOLDERING.some((k) => n.href.includes(k))).toBe(false);
    }
  });

  it("asks for requirements in its own terms", () => {
    const req = sectionFor(type, "design", "requirements")!.section;
    expect(req.columns?.map((c) => c.label)).toEqual(["Use condition", "Material or finish", "How it is tested"]);
    expect(sectionFor("electronics", "design", "requirements")!.section.columns?.map((c) => c.key)).toEqual(["trigger", "response", "verify"]);
    expect(sectionFor("printed", "design", "requirements")!.section.columns?.map((c) => c.key)).toEqual(["load", "material", "verify"]);
  });
});

describe("nextStep", () => {
  const empty: ProcessState = { stage: "concept", gates: [] };

  it.each(PRODUCT_TYPE_KEYS)("%s: a blank concept is first asked for its one-line description", (t) => {
    expect(nextStep(processFor(t), empty, [], {})).toEqual({
      label: "Give the concept a one-line description",
      reason: "The Concept gate needs this: the concept has a one-line description. Not set.",
      href: "/concepts",
    });
  });

  it.each(PRODUCT_TYPE_KEYS)("%s: the first unmet check of the current stage, then Advance once the gate is met", (t) => {
    const def = processFor(t);
    const rows = [row("concept/brief", "open"), row("concept/brief", "open"), row("concept/brief", "open")];
    expect(nextStep(def, empty, rows, { oneLiner: "x" })).toMatchObject({ label: 'Add the "go" decision to the decision tree', href: "/s/concept/decisions" });
    expect(nextStep(def, empty, [...rows, decision("go", "yes")], { oneLiner: "x" })).toEqual({
      label: "Advance to Research",
      reason: "Every check of the Concept gate is met.",
      href: "/process",
    });
  });

  it("differs by type in the Prototype stage", () => {
    const state: ProcessState = { stage: "prototype", gates: [] };
    expect(nextStep(processFor("electronics"), state, [row("design/bom", "in hand"), row("design/wiring", "to solder")]).href).toBe("/s/prototype/wiring");
    expect(nextStep(processFor("printed"), state, []).href).toBe("/s/prototype/printing");
    expect(nextStep(processFor("physical"), state, [row("design/bom", "in hand"), row("prototype/assembly", "open")]).href).toBe("/s/prototype/assembly");
  });

  it("an overridden gate counts as passed", () => {
    const state: ProcessState = { stage: "research", gates: [{ stage: "research", status: "go", overridden: true, note: "Checked by phone", decidedBy: "demo", decidedAt: null }] };
    expect(nextStep(processFor("printed"), state, [])).toEqual({ label: "Advance to Design", reason: "The Research gate was passed by override.", href: "/process" });
  });

  it("at the last stage with its gate passed there is nothing more to advance to", () => {
    const rows = [row("sales/channels", "live"), row("sales/listing", "ready")];
    expect(nextStep(processFor("electronics"), { stage: "sales", gates: [] }, rows).label).toBe("Every gate is passed");
  });

  it("an unknown stored stage is read as the first stage", () => {
    expect(nextStep(processFor("electronics"), { stage: "nope", gates: [] }, []).reason).toContain("Concept gate");
  });
});

describe("decisions that unlock a section (plan 3.3)", () => {
  it("lists undecided decisions whose unlocks name the section or its store", () => {
    const rows = [
      decision("go", "", ["prototype/sourcing"]),
      decision("name", "yes", ["prototype/sourcing"]),
      decision("enc", "", ["design/bom", "nonsense"]),
      decision("mk", "", ["marketing/ads"]),
    ];
    expect(lockingDecisions(rows, "prototype", "sourcing").map((d) => d.key)).toEqual(["go", "enc"]);
    expect(lockingDecisions(rows, "design", "layout").map((d) => d.key)).toEqual(["go", "enc"]);
    expect(lockingDecisions(rows, "marketing", "ads").map((d) => d.key)).toEqual(["mk"]);
    expect(lockingDecisions(rows, "concept", "brief")).toEqual([]);
    expect(lockingDecisions(rows, "nope", "nope")).toEqual([]);
  });
});
