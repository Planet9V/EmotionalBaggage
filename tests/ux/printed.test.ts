// U2: a printed product without electronics reaches printing. The print-job checks apply whenever a part is to be
// printed, for every product type; the wizard's printed part for a non-electronics product is the product's body,
// not an enclosure shell.
import { describe, expect, it } from "vitest";
import { evaluateGate, gateOf, printsParts } from "@/lib/process/evaluate";
import { processFor } from "@/lib/process/definitions";
import { buildItems, emptyAnswers } from "@/components/wizard/model";
import type { Item } from "@/lib/types";

const row = (section: string, status: string, data: Record<string, unknown> = {}, id = Math.floor(Math.random() * 1e6)): Item => ({ id, projectId: "p", section, title: `${section} ${id}`, body: "", data, status, sort: id });

describe("print checks follow the parts", () => {
  for (const type of ["electronics", "printed", "physical"]) {
    it(`${type}: the gate asks for a print job when a part is to be printed, and not otherwise`, () => {
      const gate = gateOf(processFor(type), "prototype");
      const withPrint = evaluateGate(gate, [row("design/bom", "to print", { source: "Own printer" })]);
      const job = withPrint.checks.find((c) => c.id === "prototype.print-jobs");
      expect(job, type).toBeTruthy();
      expect(job!.met).toBe(false);
      const none = evaluateGate(gate, [row("design/bom", "to buy", { source: "Amazon" })]);
      expect(none.checks.find((c) => c.id === "prototype.print-jobs")!.met).toBe(true);
      expect(none.checks.find((c) => c.id === "prototype.printed")!.detail).toMatch(/no print job is needed/);
    });
  }
  it("a part made on your own printer counts even after it is marked in hand", () => {
    expect(printsParts([row("design/bom", "in hand", { source: "Own printer" })])).toBe(true);
    expect(printsParts([row("design/bom", "in hand", { geometry: { print: true } })])).toBe(true);
  });
});

describe("the wizard's printed part", () => {
  const answers = (productType: "electronics" | "physical" | "printed") => ({ ...emptyAnswers(), productType, name: "cable comb", oneLiner: "x", printed: "yes" as const, w: "60", h: "10", d: "20" });
  it("is the product's body for a product without electronics", () => {
    const part = buildItems(answers("physical")).find((i) => i.section === "design/bom")!;
    expect(part.title).toBe("Cable comb body");
    expect((part.data as { geometry: { shape: string } }).geometry.shape).toBe("box");
    expect(part.status).toBe("to print");
  });
  it("is the enclosure shell for electronics", () => {
    const part = buildItems(answers("electronics")).find((i) => i.section === "design/bom")!;
    expect(part.title).toBe("Enclosure");
    expect((part.data as { geometry: { shape: string } }).geometry.shape).toBe("shell");
  });
});

describe("U12: the print-job step names sending the enclosure", () => {
  it("says Send the enclosure to printing when a saved enclosure has no stored file", async () => {
    const { evaluateCheck } = await import("@/lib/process/evaluate");
    const c = gateOf(processFor("electronics"), "prototype").checks.find((x) => x.id === "prototype.print-jobs")!;
    const rows = [row("design/bom", "to print", { source: "Own printer" }), row("design/enclosure", "open", { enclosureGenerator: "casemaker" })];
    expect(evaluateCheck(c, rows, {}, { enclosureFiles: 0 })).toMatchObject({ met: false, action: "Send the enclosure to printing", href: "/s/design/enclosure#send-to-printing" });
    expect(evaluateCheck(c, rows, {}, { enclosureFiles: 2 }).action).toMatch(/^Set up a print job/);
  });
});
