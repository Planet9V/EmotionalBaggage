import { describe, expect, it } from "vitest";
import { STAGES } from "@/lib/menu";
import { PRODUCT_TYPE_KEYS, sectionFor, sectionsFor } from "@/lib/productTypes";
import { checkSection, PROCESS_DEFINITIONS, processFor, type Check } from "@/lib/process/definitions";
import { evaluateCheck, evaluateGate, gateOf, nextStep, type ProcessState } from "@/lib/process/evaluate";
import { lockingDecisions } from "@/lib/process/unlocks";
import type { Item } from "@/lib/types";
import { VERIFIED } from "../research/verified";

let nextId = 1;
const row = (section: string, status: string, data: Record<string, unknown> = {}, title = `row ${nextId}`): Item => ({
  id: nextId++, projectId: "p", section, title, body: "", data, status, sort: nextId,
});
const decision = (key: string, chosen = "", unlocks: string[] = [], title = `Decide ${key}?`) =>
  row("concept/decisions", chosen ? "decided" : "open", { key, chosen, unlocks, options: [{ id: "yes", label: "Yes", outcome: "" }, { id: "no", label: "No", outcome: "" }] }, title);

const check = <C extends Check>(c: C) => c;
/** The story's pitch, written, and a file that is stored: what the first two Concept checks count. */
const pitch = (): Item => ({ ...row("concept/story", "draft", { part: "pitch" }, "The pitch"), body: "A toy that teaches knots." });
const file = (): Item => row("concept/files", "stored", { kind: "note", fileId: 1, fileName: "notes.txt" }, "Notes");
/** A wire names both its ends. */
const wire = (status: string): Item => row("design/wiring", status, { from: "BT1", fromPin: "+", to: "U1", toPin: "VCC" }, "Power");

describe("check kinds", () => {
  it("min-rows counts the rows of the section's store and says how many are missing", () => {
    const c = check({ id: "a", label: "Brief", kind: "min-rows", params: { section: "concept/brief", min: 3 } });
    const two = [row("concept/brief", "open"), row("concept/brief", "done"), row("concept/names", "open")];
    const r = evaluateCheck(c, two);
    expect(r).toMatchObject({ met: false, href: "/s/concept/brief", action: "Add 1 more brief line" });
    expect(r.detail).toBe("2 brief lines recorded, 3 needed.");
    expect(evaluateCheck(c, [...two, row("concept/brief", "open")]).met).toBe(true);
  });

  it("min-rows reads a section that shows another store (Sourcing shows the parts list)", () => {
    const c = check({ id: "a", label: "Parts", kind: "min-rows", params: { section: "prototype/sourcing", min: 1 } });
    expect(evaluateCheck(c, [row("design/bom", "to buy")]).met).toBe(true);
    expect(evaluateCheck(c, []).href).toBe("/s/prototype/sourcing");
  });

  it("all-status needs every row in one of the statuses; no rows fails unless the definition allows an empty section (process review 5)", () => {
    const c = check({ id: "a", label: "Tests", kind: "all-status", params: { section: "prototype/tests", statuses: ["pass"] } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, detail: "No acceptance tests yet, so nothing shows this is pass.", action: "Add acceptance tests" });
    expect(evaluateCheck({ ...c, todo: "Write the tests" }, [])).toMatchObject({ met: false, action: "Write the tests" });
    expect(evaluateCheck(check({ id: "a", label: "Tests", kind: "all-status", params: { section: "prototype/tests", statuses: ["pass"], allowEmpty: true } }), [])).toMatchObject({ met: true, detail: "No acceptance tests yet, so nothing is left to move." });
    const r = evaluateCheck(c, [row("prototype/tests", "pass"), row("prototype/tests", "fail"), row("prototype/tests", "not run")]);
    expect(r).toMatchObject({ met: false, detail: "2 of 3 acceptance tests not yet pass.", action: expect.stringMatching(/^Move 2 acceptance tests to pass, starting with "/) });
    // the next step opens the first row that stops it (Acceptance tests open a row from ?item=)
    expect(r.href).toMatch(/^\/s\/prototype\/tests\?item=\d+$/);
    expect(evaluateCheck(c, [row("prototype/tests", "pass")]).met).toBe(true);
  });

  it("decision-made finds the decision by key and needs a chosen option", () => {
    const c = check({ id: "a", label: "Go", kind: "decision-made", params: { key: "go" } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, detail: "This decision is not in the decision tree yet.", href: "/s/concept/decisions" });
    expect(evaluateCheck(c, [decision("go", "", [], "Build it?")])).toMatchObject({ met: false, detail: '"Build it?" is not decided yet.', action: 'Decide "Build it?"' });
    expect(evaluateCheck(c, [decision("go", "yes")])).toMatchObject({ met: true, detail: "Chosen: Yes." });
    expect(evaluateCheck(c, [decision("other", "yes")]).met).toBe(false);
  });

  it("decision-made with fallback root reads the first top-level decision when no decision has the key", () => {
    const c = check({ id: "a", label: "Go", kind: "decision-made", params: { key: "go", fallback: "root" } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, detail: "The decision tree is empty.", action: "Add the go/no-go question as the first decision" });
    const child = { ...decision("child", "yes"), data: { key: "child", parent: "build-first-batch", chosen: "yes", options: [] } };
    const root = decision("build-first-batch", "", [], "Build the first batch?");
    const r = evaluateCheck(c, [child, root]);
    expect(r.met).toBe(false);
    expect(r.detail).toBe('"Build the first batch?" is not decided yet. The first decision in the tree is read as this one.');
    expect(evaluateCheck(c, [decision("build-first-batch", "yes")]).met).toBe(true);
    // A decision with the key wins over the root.
    expect(evaluateCheck(c, [decision("first", "yes"), decision("go", "")]).met).toBe(false);
  });

  it("no-open counts open and blocked rows by default, or the statuses given; an empty section fails unless allowed", () => {
    const c = check({ id: "a", label: "Questions", kind: "no-open", params: { section: "concept/questions" } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, action: "Add open questions" });
    expect(evaluateCheck(check({ id: "a", label: "Questions", kind: "no-open", params: { section: "concept/questions", allowEmpty: true } }), []).met).toBe(true);
    expect(evaluateCheck(c, [row("concept/questions", "decided")]).met).toBe(true);
    expect(evaluateCheck(c, [row("concept/questions", "open"), row("concept/questions", "blocked")])).toMatchObject({ met: false, detail: "2 open questions still open or blocked." });
    const wrong = check({ id: "b", label: "Wrong", kind: "no-open", params: { section: "research/claims", statuses: ["wrong"] } });
    expect(evaluateCheck(wrong, [row("research/claims", "unverified")]).met).toBe(true);
    expect(evaluateCheck(wrong, [row("research/claims", "wrong")]).met).toBe(false);
  });

  it("claims-verified compares the verified share with the threshold; no claims is not met", () => {
    const c = check({ id: "a", label: "Claims", kind: "claims-verified", params: { share: 0.8 } });
    expect(evaluateCheck(c, [])).toMatchObject({ met: false, detail: "No claims recorded yet.", href: "/s/research/claims" });
    const five = ["verified", "verified", "verified", "unverified", "wrong"].map((s) => row("research/claims", s, s === "verified" ? VERIFIED : {}));
    // a status of verified with no quoted source behind it is not counted
    expect(evaluateCheck(c, [row("research/claims", "verified")])).toMatchObject({ met: false, detail: "0 of 1 claim verified (0%), 80% needed." });
    const r = evaluateCheck(c, five);
    expect(r).toMatchObject({ met: false, detail: "3 of 5 claims verified (60%), 80% needed.", action: `Verify "${five[3].title}" in Research, Ask` });
    // the link is "Verify this" for the first claim not verified: Research, Ask with the claim as the question, attached to it
    expect(r.href).toBe(`/s/research/ask?ask=${encodeURIComponent(five[3].title).replace(/%20/g, "+")}&item=${five[3].id}&claim=${five[3].id}`);
    five[3].status = "verified";
    five[3].data = VERIFIED;
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
    const rows = [pitch(), file(), row("concept/brief", "open"), row("concept/brief", "open"), row("concept/brief", "open"), decision("go", "yes")];
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
    // The story and its sources come first (they are written before anything else)
    expect(nextStep(def, empty, [], { oneLiner: "x" })).toMatchObject({ label: "Write the pitch in the concept story, or draft the story with AI", href: "/story#story-pitch" });
    // a story row that is not the pitch, or a pitch with no words, is still no pitch
    expect(nextStep(def, empty, [row("concept/story", "draft", { part: "origin" })], { oneLiner: "x" }).href).toBe("/story#story-pitch");
    expect(nextStep(def, empty, [pitch()], { oneLiner: "x" })).toMatchObject({ label: "Add a file: a document, note or chat the concept came from", href: "/files#add-file" });
    // a document that is listed but not uploaded is not a file
    expect(nextStep(def, empty, [pitch(), row("concept/files", "not uploaded", { kind: "document", fileName: "PRD.pdf" }, "PRD.pdf")], { oneLiner: "x" }).href).toBe("/files#add-file");
    const rows = [pitch(), file(), row("concept/brief", "open"), row("concept/brief", "open"), row("concept/brief", "open")];
    expect(nextStep(def, empty, rows, { oneLiner: "x" })).toMatchObject({ label: "Add the go/no-go question as the first decision", href: "/s/concept/decisions" });
    expect(nextStep(def, empty, [...rows, decision("go", "yes")], { oneLiner: "x" })).toEqual({
      label: "Advance to Research",
      reason: "Every check of the Concept gate is met.",
      href: "/process#advance",
    });
  });

  it("differs by type in the Prototype stage", () => {
    const state: ProcessState = { stage: "prototype", gates: [] };
    // electronics: parts in hand, then the enclosure printed, then the build sheet
    const printedShell = () => row("design/bom", "in hand", { source: "Own printer" });
    expect(nextStep(processFor("electronics"), state, [printedShell(), wire("to solder")]).href).toBe("/s/prototype/printing#new-print-job");
    expect(nextStep(processFor("electronics"), state, [printedShell(), row("prototype/printing", "done"), wire("to solder")]).href).toBe("/s/prototype/wiring");
    // with nothing to print, the print checks do not apply (U2)
    expect(nextStep(processFor("electronics"), state, [row("design/bom", "in hand"), wire("to solder")]).href).toBe("/s/prototype/wiring");
    // a physical product with a printed part goes to printing too (U2)
    expect(nextStep(processFor("physical"), state, [row("design/bom", "in hand", { source: "Own printer" }), row("prototype/assembly", "open")]).href).toBe("/s/prototype/printing#new-print-job");
    // with no parts at all, "every bought part is in hand" is not met: the first step is the parts (process review 5)
    expect(nextStep(processFor("printed"), state, [])).toMatchObject({ href: "/s/prototype/sourcing", label: "Add the parts in the Bill of materials, then source them" });
    expect(nextStep(processFor("printed"), state, [row("design/bom", "to print")]).href).toBe("/s/prototype/printing#new-print-job");
    expect(nextStep(processFor("physical"), state, [row("design/bom", "in hand"), row("prototype/assembly", "open")]).href).toMatch(/^\/s\/prototype\/assembly\?item=\d+$/);
    // a physical product with no assembly step does not pass assembly
    expect(nextStep(processFor("physical"), state, [row("design/bom", "in hand")])).toMatchObject({ href: "/s/prototype/assembly#add-row", label: "Add the assembly steps, then settle each one" });
  });

  it("an overridden gate counts as passed", () => {
    const state: ProcessState = { stage: "research", gates: [{ stage: "research", status: "go", overridden: true, note: "Checked by phone", decidedBy: "demo", decidedAt: null }] };
    expect(nextStep(processFor("printed"), state, [])).toEqual({ label: "Advance to Design", reason: "The Research gate was passed by override.", href: "/process#advance" });
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

describe("no gate passes on rows that do not exist (process review 5)", () => {
  // Every all-status and no-open check of every product type, evaluated on an empty concept: each must fail
  // unless its definition says allowEmpty (the only one is "no open question", where zero is the good answer).
  const rows: [string, string, boolean][] = [];
  for (const t of PRODUCT_TYPE_KEYS) for (const g of PROCESS_DEFINITIONS[t].stages) for (const c of g.checks) if (c.kind === "all-status" || c.kind === "no-open") rows.push([`${t}/${c.id}`, c.id, !!c.params.allowEmpty]);
  it.each(rows)("%s on an empty concept", (name, id, allowEmpty) => {
    const t = name.split("/")[0];
    const c = PROCESS_DEFINITIONS[t as keyof typeof PROCESS_DEFINITIONS].stages.flatMap((g) => g.checks).find((x) => x.id === id)!;
    // A print check applies only when a part is to be printed (U2): judge it on a concept that prints one.
    const empty = c.onlyIf === "prints-parts" ? [row("design/bom", "to print")] : [];
    expect(evaluateCheck(c, empty).met).toBe(allowEmpty);
  });
  it("only the open-questions check allows an empty section", () => {
    expect(new Set(rows.filter(([, , a]) => a).map(([, id]) => id))).toEqual(new Set(["concept.questions"]));
  });
  it("every empty-section failure says what to add", () => {
    for (const [name, id, allowEmpty] of rows) {
      if (allowEmpty) continue;
      const c = PROCESS_DEFINITIONS[name.split("/")[0] as keyof typeof PROCESS_DEFINITIONS].stages.flatMap((g) => g.checks).find((x) => x.id === id)!;
      const empty = c.onlyIf === "prints-parts" ? [row("design/bom", "to print")] : [];
      expect(evaluateCheck(c, empty).action, name).toMatch(/^(Add|Write|Set up|Draft)/);
    }
  });
});
