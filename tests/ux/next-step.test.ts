// U13: the next step as the page shows it: set-up first when the step's page needs a service that is not set up,
// "Review N waiting drafts" when drafts wait, and "On this page" when the stage's next step is elsewhere.
import { describe, expect, it } from "vitest";
import { pageStep, refineStep, type Services } from "@/lib/process/refine";
import { readFileSync } from "node:fs";

const all: Services = { reasoning: true, perplexity: true, printer: true, x: true, instagram: true, amazonSell: true };
const step = (label: string, href: string) => ({ label, reason: "The gate needs this.", href });

describe("the next step", () => {
  it("asks to connect Perplexity when the step is in Research, Ask and no key is saved", () => {
    const r = refineStep(step('Verify "Fits in a pocket" in Research, Ask', "/s/research/ask?ask=x"), { ...all, perplexity: false }, {});
    expect(r).toMatchObject({ label: "Connect Perplexity in Admin, Credentials", href: "/admin?tab=credentials" });
  });
  it("asks to choose a model for a drafting step with no model", () => {
    expect(refineStep(step("Draft Requirements with AI, or add a row by hand", "/s/design/requirements#draft-with-ai"), { ...all, reasoning: false }, {}).href).toBe("/admin?tab=models");
  });
  it("says to review the drafts already waiting instead of drafting again", () => {
    const r = refineStep(step("Draft Requirements with AI, or add a row by hand", "/s/design/requirements#draft-with-ai"), all, { "design/requirements": 3 });
    expect(r.label).toBe("Review 3 waiting drafts");
    expect(r.href).toBe("/s/design/requirements#draft-with-ai");
  });
  it("asks for a printer before a print job, and for a channel account before posting", () => {
    expect(refineStep(step("Set up a print job: a file, a printer and the settings", "/s/prototype/printing#new-print-job"), { ...all, printer: false }, {}).href).toBe("/admin?tab=printers");
    expect(refineStep(step("Post it", "/s/marketing/posting"), { ...all, x: false, instagram: false }, {}).label).toMatch(/Connect X or Instagram/);
  });
  it("changes nothing while the set-up is unknown", () => {
    const s = step('Verify "x" in Research, Ask', "/s/research/ask");
    expect(refineStep(s, null, null)).toEqual(s);
  });
  it("names the first unmet thing this page can do when the stage's step is elsewhere", () => {
    const next = step("Move 3 parts in Sourcing to in hand", "/s/prototype/sourcing");
    const checks = [
      { met: false, action: "Move 3 parts to in hand", href: "/s/prototype/sourcing", label: "Every bought part is in hand", detail: "" },
      { met: false, action: "Draft Personas with AI, or add a row by hand", href: "/s/marketing/personas#draft-with-ai", label: "At least one persona is approved", detail: "0 personas approved." },
    ];
    expect(pageStep("/s/marketing/personas", next, checks, all, {})).toMatchObject({ label: "Draft Personas with AI, or add a row by hand" });
    expect(pageStep("/s/prototype/sourcing", next, checks, all, {})).toBeNull();
    expect(pageStep("/docs", next, checks, all, {})).toBeNull();
  });
});

describe("which pages carry the strip", () => {
  it("workbench pages (Admin, Integrations, Account, Concepts, Documentation, printers) do not", () => {
    for (const f of ["src/components/admin/AdminView.tsx", "src/components/views/IntegrationsView.tsx", "src/app/account/ChangePassword.tsx", "src/components/concepts/ConceptsView.tsx", "src/app/docs/page.tsx", "src/components/printers/SupportedPrinters.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/eyebrow="Workbench"/);
      expect(s, f).toMatch(/nextStep=\{false\}/);
    }
  });
});
