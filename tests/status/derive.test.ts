// The status dashboard's derivation (src/components/status/derive.ts): stage statuses from the true gates, the
// next actions, the key figures and the open decisions, on Baggage Claims MK1 as the seed loads it and on a
// concept with nothing in it.
import { describe, expect, it } from "vitest";
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT } from "@/lib/seed";
import { applySeedContent } from "@/lib/seedContent";
import { SEED_SOURCES, SEED_STORY } from "@/lib/story/seed";
import { SOURCES_STORE, STORY_STORE, storyPart } from "@/lib/story/parts";
import { readManifest } from "@/lib/story/seedFiles";
import { processView } from "@/lib/process/client";
import type { ProcessResponse } from "@/lib/process/state";
import type { Item } from "@/lib/types";
import { keyFigures, nextActions, openDecisions, stageStatus, statusModel } from "@/components/status/derive";

const FACTS = { currency: "USD", erc: { ok: true, errors: 0, warnings: 2 }, links: 0, results: 0, enclosureFiles: 0 };

function state(over: Partial<ProcessResponse> = {}): ProcessResponse {
  return { projectId: "p", name: "New", oneLiner: "", productType: "electronics", stage: "concept", gates: [], history: [], facts: FACTS, skipped: [], ...over };
}

/**
 * Baggage Claims' rows as a fresh install holds them (the seed modules, in the order the seeding writes them). As in
 * the welcome page's exampleData: a document the seed manifest stores is a Files row holding a file ("stored"); one
 * it does not have is only listed ("not uploaded"), and the Concept gate does not count it.
 */
function seedRows(manifest: { title: string; what: string; kind: string }[]): Item[] {
  const stored = new Set(manifest.map((e) => e.title));
  const out: Item[] = [];
  const add = (section: string, title: string, body: string, data: Record<string, unknown>, status: string) =>
    out.push({ id: out.length + 1, projectId: SEED_PROJECT.id, section, title, body, data, status, sort: out.length });
  SEED_SOURCES.forEach((s, i) =>
    stored.has(s.title) ? add(SOURCES_STORE, s.title, s.what, { kind: s.kind, fileName: s.title, fileId: i + 1 }, "stored") : add(SOURCES_STORE, s.title, s.what, { kind: s.kind, fileName: s.title }, "not uploaded"),
  );
  // the files the owner supplied later (addedOn in the manifest) are stored as Files rows of their own
  const listed = new Set(SEED_SOURCES.map((s) => s.title));
  manifest.filter((e) => !listed.has(e.title)).forEach((e, i) => add(SOURCES_STORE, e.title, e.what, { kind: e.kind, fileName: e.title, fileId: 500 + i }, "stored"));
  for (const p of SEED_STORY) add(STORY_STORE, storyPart(p.part)?.heading ?? p.part, p.body, { part: p.part }, p.status);
  for (const s of SEED_ITEMS) add(s.section, s.title, s.body ?? "", s.data ?? {}, s.status ?? "open");
  for (const [section, items] of Object.entries(SEED_ADDITIONS)) for (const s of items) add(section, s.title, s.body ?? "", s.data ?? {}, s.status ?? "open");
  return applySeedContent(out);
}

const bcState = () => state({ projectId: SEED_PROJECT.id, name: SEED_PROJECT.name, oneLiner: SEED_PROJECT.oneLiner });

let id = 1000;
const row = (section: string, status: string, title = `row ${id}`, data: Record<string, unknown> = {}): Item => ({ id: id++, projectId: "p", section, title, body: "", data, status, sort: id });

describe("an empty concept", () => {
  const view = processView(state(), []);
  const m = statusModel(view, []);

  it("has every stage not started, even where a gate check is met on no rows", () => {
    expect(m.stages.map((s) => s.status)).toEqual(Array(7).fill("not-started"));
    // "no open question" holds on an empty section, so the Concept gate has a met check; it is still not started
    expect(m.current.key).toBe("concept");
    expect(m.current.met).toBeGreaterThan(0);
  });

  it("says where it is from the Concept gate's own counts", () => {
    expect(m.headline).toBe(`At Concept: ${m.current.met} of ${m.current.total} checks met`);
    expect(m.passedCount).toBe(0);
  });

  it("leads with the Concept gate's first unmet check, the app's next step, and offers three actions", () => {
    expect(m.actions).toHaveLength(3);
    expect(m.actions[0]!.label).toBe(view.next.label);
    expect(m.actions.every((a) => a.stage === "concept")).toBe(true);
    expect(m.actions[0]!.why).toMatch(/^Clears 1 of the \d+ checks left at the Concept gate\.$/);
  });

  it("shows no figure and no decision: there is nothing to work them out from", () => {
    expect(m.figures).toEqual([]);
    expect(m.decisions).toEqual([]);
  });
});

const manifest = await readManifest();

describe("Baggage Claims MK1 as seeded", () => {
  const rows = seedRows(manifest ?? []);
  const view = processView(bcState(), rows);
  const m = statusModel(view, rows);

  it("is at Concept, with the gate's checks counted as the Process page counts them", () => {
    expect(m.current.key).toBe("concept");
    const unmet = view.current.result.checks.filter((c) => !c.met);
    expect(m.current.total - m.current.met).toBe(unmet.length);
    expect(unmet.map((c) => c.id).sort()).toEqual(["concept.go", "concept.questions"]);
    expect(m.headline).toBe("At Concept: 4 of 6 checks met");
  });

  it("marks Design blocked by its blocked requirement, and the other stages with rows in progress", () => {
    const by = Object.fromEntries(m.stages.map((s) => [s.key, s.status]));
    expect(by.design).toBe("blocked");
    const design = m.stages.find((s) => s.key === "design")!;
    expect(design.blockers[0]!.text).toMatch(/in Requirements is marked blocked\.$/);
    expect(design.blockers[0]!.href).toMatch(/^\/s\/design\/requirements\?item=\d+$/);
    for (const k of ["concept", "research", "prototype", "production", "marketing", "sales"]) expect(by[k]).toBe("in-progress");
  });

  it("puts the go/no-go decision first: it clears a Concept check and opens the three sections the decision names", () => {
    expect(m.actions[0]!.label).toBe('Decide "Spend about $750 on the validation batch?"');
    expect(m.actions[0]!.why).toBe("Clears 1 of the 2 checks left at the Concept gate. Opens 3 sections: Sourcing, 3D printing, Assembly.");
    expect(m.actions[1]!.stage).toBe("concept");
    expect(m.actions).toHaveLength(3);
  });

  it("lists the decisions not yet made, with what each opens", () => {
    const keys = openDecisions(rows).map((d) => d.key);
    expect(keys).not.toContain("channel"); // chosen: amazon
    expect(keys).toContain("go");
    expect(m.decisions.find((d) => d.key === "name")!.opens).toEqual(["Landing page", "Amazon listing"]);
  });

  it("shows the figures the app works out, each linked to its page", () => {
    const f = Object.fromEntries(keyFigures(rows, "USD").map((x) => [x.key, x]));
    expect(f.parts).toMatchObject({ value: "16", href: "/s/design/bom" });
    // 9 claims of the first seed and 30 entered from the documents on 22 Nov (seed/concepts/baggage-claims/content)
    expect(f.claims).toMatchObject({ value: "0 / 39", detail: "39 unverified" });
    expect(f.questions).toMatchObject({ value: "5", detail: "of 5 recorded" });
    expect(f["print-jobs"]).toMatchObject({ value: "2", detail: "0 printed" });
    // every document in the seed manifest is stored on a fresh install (26 on the dev server, 22 Nov)
    expect(manifest?.length).toBeGreaterThan(0);
    expect(f.files).toMatchObject({ value: String(manifest!.length), detail: "stored", href: "/files" });
    expect(f["unit-cost"]!.value).toMatch(/^\$[\d,]+\.\d\d$/);
    expect(f["unit-cost"]!.href).toBe("/s/production/economics");
  });
});

describe("stage status", () => {
  it("is gate passed when the gate passes, also by override, and nothing else then counts", () => {
    const rows = [row("concept/brief", "blocked")];
    const v = processView(state({ gates: [{ stage: "concept", status: "go", overridden: true, note: "why", decidedBy: "demo", decidedAt: null }] }), rows);
    expect(stageStatus(v.stages[0]!, rows).status).toBe("passed");
    const m = statusModel(v, rows);
    expect(m.stages[0]!.byOverride).toBe(true);
    expect(m.headline).toBe("At Concept: gate passed");
    // with the gate passed, advancing is the first action
    expect(m.actions[0]!.label).toBe("Advance to Research");
  });

  it("is blocked for a stage the concept moved past without passing", () => {
    const st = state({ stage: "research" });
    const v = processView(st, []);
    const m = statusModel({ ...v, skipped: v.skipped }, []);
    expect(m.stages[0]!.status).toBe("blocked");
    expect(m.stages[0]!.blockers[0]!.text).toBe("Research was entered without passing the Concept gate.");
    // the skipped gate's checks come before the current one's
    expect(m.actions[0]!.stage).toBe("concept");
  });

  it("is in progress once a row is recorded in one of the stage's own sections", () => {
    const rows = [row("research/claims", "unverified")];
    const v = processView(state(), rows);
    expect(stageStatus(v.stages[1]!, rows).status).toBe("in-progress");
    expect(stageStatus(v.stages[2]!, rows).status).toBe("not-started");
  });

  it("does not count a row of another stage's store shown in this stage (Sourcing shows the parts list)", () => {
    const rows = [row("design/bom", "to buy")];
    const v = processView(state(), rows);
    expect(stageStatus(v.stages[3]!, rows).status).toBe("not-started");
  });
});

describe("next actions", () => {
  it("merges the same action from two checks and ranks the one that passes a gate first", () => {
    const rows = [{ ...row("concept/story", "written", "Pitch", { part: "pitch" }), body: "A tag that heckles." }, row("concept/files", "stored", "notes.md", { fileId: 1 }), row("concept/brief", "done"), row("concept/brief", "done"), row("concept/brief", "done")];
    const v = processView(state({ oneLiner: "x" }), rows);
    const a = nextActions(v, rows);
    // only the go decision is left at Concept: deciding it passes the gate
    expect(a[0]!.label).toBe("Add the go/no-go question as the first decision");
    expect(a[0]!.why).toBe("Passes the Concept gate.");
    expect(new Set(a.map((x) => x.label)).size).toBe(a.length);
  });
});

describe("key figures read the rows as the gates do", () => {
  it("counts a Files row only when it holds a file, and says how many are only listed", () => {
    const rows = [row("concept/files", "stored", "a.md", { fileId: 1 }), row("concept/files", "not uploaded", "b.md", {})];
    expect(keyFigures(rows, "USD").find((f) => f.key === "files")).toMatchObject({ value: "1", detail: "stored; 1 listed, not uploaded" });
  });

  it("counts a claim verified only as the Research gate does, not on its status alone", () => {
    const rows = [row("research/claims", "verified", "Market is big", {})];
    const v = processView(state(), rows);
    const gate = v.stages[1]!.result.checks.find((c) => c.id === "research.verified")!;
    const fig = keyFigures(rows, "USD").find((f) => f.key === "claims")!;
    expect(fig.value).toBe(`${gate.met ? 1 : 0} / 1`);
    expect(gate.detail.startsWith(`${fig.value.split(" / ")[0]} of 1 claim verified`)).toBe(true);
  });
});
