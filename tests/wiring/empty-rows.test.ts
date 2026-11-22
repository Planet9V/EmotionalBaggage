// Wiring check 6: every gate check in every product type fails on an empty row. A row with nothing in
// it is not evidence, whatever status it carries: the story with no pitch, Files with no file, an
// approved persona with no words. One rule (hasSubstance, src/lib/process/substance.ts) is read by every check.
import { describe, expect, it } from "vitest";
import { DEFAULT_STATUSES, findSection } from "@/lib/menu";
import { UNLOCK_STORES } from "@/lib/plan";
import { PRODUCT_TYPE_KEYS } from "@/lib/productTypes";
import { checkSection, processFor, type Check } from "@/lib/process/definitions";
import { evaluateCheck } from "@/lib/process/evaluate";
import type { Item } from "@/lib/types";

let id = 1;
const row = (section: string, status: string, over: Partial<Item> = {}): Item => ({ id: id++, projectId: "p", section, title: "", body: "", data: {}, status, sort: id, ...over });

/** Every section a check reads its rows from. */
function sectionsOf(c: Check): string[] {
  const own = c.kind === "content-proof" ? c.params.sections : [checkSection(c)].filter((s): s is string => !!s);
  // the electrical check reads the wires; production readiness reads every production store
  const more = c.kind === "electrical" ? ["design/wiring"] : c.kind === "production-ready" ? ["production/economics", "production/batches", "production/compliance", "sales/channels", "prototype/tests", "design/bom", "prototype/builds"] : c.kind === "enclosure" ? ["design/bom"] : [];
  return [...new Set([...own, ...more].map((s) => UNLOCK_STORES.get(s) ?? s))];
}

/** Every status a row of the section can carry, plus the ones the check asks for. */
function statusesOf(c: Check, section: string): string[] {
  const [stage, key] = section.split("/");
  const menu = findSection(stage, key)?.section.statuses ?? DEFAULT_STATUSES;
  const asked = "statuses" in c.params && Array.isArray(c.params.statuses) ? c.params.statuses : [];
  return [...new Set([...menu, ...DEFAULT_STATUSES, ...asked, "approved", "done", "pass", "passed", "final", "decided", "stored", "tested", "ready", "live", "chosen", "in hand"])];
}

// What a check may be told from outside the rows, at its most favourable: the electrical checks found nothing,
// links and results exist. The rows are still empty.
const FACTS = { currency: "USD", erc: { ok: true, errors: 0, warnings: 0 }, links: 0, results: 0, enclosureFiles: 0 };
/** A part to print, so the print checks apply (they are skipped when nothing is printed). */
const printedPart = () => row("design/bom", "to print", { title: "Shell", data: { ref: "ENC1", qty: 1 } });

describe("no gate check is met by an empty row", () => {
  for (const type of PRODUCT_TYPE_KEYS) {
    for (const gate of processFor(type).stages) {
      for (const check of gate.checks) {
        if (check.kind === "field-set" || check.kind === "tracked-links" || check.kind === "campaign-results") continue; // not read from rows
        it(`${type}: ${check.id}`, () => {
          const sections = sectionsOf(check);
          const statuses = [...new Set(sections.flatMap((s) => statusesOf(check, s)))];
          for (const status of statuses) {
            const rows = sections.map((s) => row(s, status));
            if (check.onlyIf === "prints-parts") rows.push(printedPart());
            const r = evaluateCheck(check, rows, {}, FACTS);
            expect(r.met, `an empty row with status "${status}" met the check: ${r.detail}`).toBe(false);
          }
        });
      }
    }
  }
});

describe("the two reported cases", () => {
  const story = processFor("electronics").stages[0].checks.find((c) => c.id === "concept.story")!;
  const files = processFor("electronics").stages[0].checks.find((c) => c.id === "concept.files")!;

  it("the story with no pitch: another part, or a pitch with no words, does not meet it", () => {
    expect(evaluateCheck(story, [row("concept/story", "written", { title: "Where the idea came from", body: "A joke at a baggage carousel.", data: { part: "origin" } })])).toMatchObject({ met: false, detail: "The concept story has no pitch yet." });
    expect(evaluateCheck(story, [row("concept/story", "draft", { title: "The pitch", body: "  ", data: { part: "pitch" } })]).met).toBe(false);
    expect(evaluateCheck(story, [row("concept/story", "draft", { title: "The pitch", body: "A luggage tag that complains.", data: { part: "pitch" } })]).met).toBe(true);
  });

  it("Files with no file: a listed document that was never uploaded does not meet it", () => {
    const listed = row("concept/files", "not uploaded", { title: "PRD Rev A.pdf", body: "The product requirements", data: { kind: "document", fileName: "PRD Rev A.pdf", fileId: null } });
    expect(evaluateCheck(files, [listed])).toMatchObject({ met: false, detail: "1 file is listed, but none is uploaded yet." });
    expect(evaluateCheck(files, [{ ...listed, status: "stored", data: { ...listed.data, fileId: 12 } }]).met).toBe(true);
  });
});
