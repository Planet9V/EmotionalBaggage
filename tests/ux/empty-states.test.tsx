// @vitest-environment jsdom
// U3: one empty state everywhere. The kit's EmptyState carries an icon, a title, a sentence and the
// actions; SectionEmpty adds "Draft with AI" where a generator writes the section and a model is chosen,
// "Set a model in Admin" where none is, and counts waiting drafts. No view keeps a pattern of its own.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { EmptyState } from "@/components/ui/states";
import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import { sectionWhy } from "@/lib/sectionWhy";
import { STAGES } from "@/lib/menu";
import type { GeneratorsReply } from "@/lib/ai/drafts/shared";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const P = "p1";
const STORE = "marketing/personas";
const gens = (o: Partial<GeneratorsReply> = {}, pending = 0): GeneratorsReply => ({
  configured: true,
  reason: "",
  model: "m",
  generators: [{ id: "market.personas", label: "Personas", action: "Draft personas", from: ["concept/brief"], to: STORE, kind: "section", counts: {}, reads: 2, readsText: "from 2 brief lines", blocked: "", pending }],
  ...o,
});
const route = (r: GeneratorsReply) => on("GET", `/api/drafts/generators?projectId=${P}&kind=section&store=${encodeURIComponent(STORE)}`, () => ({ body: r }));

describe("EmptyState", () => {
  it("shows the title, the sentence and the action", () => {
    renderWithClient(<EmptyState title="No rows yet" action={<button type="button">Add row</button>}>Why rows matter.</EmptyState>);
    expect(screen.getByText("No rows yet")).toBeTruthy();
    expect(screen.getByText("Why rows matter.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add row" })).toBeTruthy();
  });
});

describe("SectionEmpty", () => {
  it("offers Draft with AI when a model is chosen", async () => {
    adminServer([route(gens())]);
    renderWithClient(<SectionEmpty projectId={P} store={STORE} sectionLabel="Personas" title="No personas yet">Why.</SectionEmpty>);
    expect(await screen.findByRole("button", { name: /Draft with AI/ })).toBeTruthy();
  });

  it("links to Admin, Models when no model is chosen", async () => {
    adminServer([route(gens({ configured: false, reason: "No reasoning model is chosen." }))]);
    renderWithClient(<SectionEmpty projectId={P} store={STORE} sectionLabel="Personas" title="No personas yet">Why.</SectionEmpty>);
    const link = await screen.findByRole("link", { name: "Set a model in Admin" });
    expect(link.getAttribute("href")).toBe("/admin?tab=models");
  });

  it("counts drafts waiting for review", async () => {
    adminServer([route(gens({}, 2))]);
    renderWithClient(<SectionEmpty projectId={P} store={STORE} sectionLabel="Personas" title="No personas yet">Why.</SectionEmpty>);
    expect(await screen.findByText(/2 drafts waiting for review/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Review 2 waiting drafts/ })).toBeTruthy();
  });

  it("shows no AI action where no generator writes the section", async () => {
    const { calls } = adminServer([route(gens({ generators: [] }))]);
    renderWithClient(<SectionEmpty projectId={P} store={STORE} sectionLabel="Personas" title="No personas yet">Why.</SectionEmpty>);
    await waitFor(() => expect(calls.length).toBe(1));
    expect(screen.queryByRole("button", { name: /Draft with AI/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Set a model/ })).toBeNull();
  });
});

describe("the why sentence of list sections", () => {
  it("never repeats the header blurb", () => {
    for (const st of STAGES)
      for (const s of st.sections) {
        const why = sectionWhy(s.store ?? `${st.key}/${s.key}`, st.label, st.goal);
        expect(why).not.toContain(s.blurb);
        expect(why.length).toBeGreaterThan(20);
      }
  });
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("no empty-state pattern of a view's own", () => {
  it("has no dashed centred panel, 'Nothing here yet' or 'This section holds' outside the kit", () => {
    // Two dashed centred boxes are not empty states: a drop zone for a file and an empty board column.
    const allowed = ["src/components/ui/states.tsx", "src/components/three/PrintPanel.tsx", "src/components/items/Kanban.tsx", "src/components/ui/chart.tsx"];
    const offenders: string[] = [];
    for (const f of files("src/components")) {
      if (allowed.some((a) => f.endsWith(a.replace("src/components/", "")))) continue;
      const s = readFileSync(f, "utf8");
      if (/Nothing here yet|This section holds:/.test(s)) offenders.push(`${f}: copy`);
      for (const line of s.split("\n")) if (/border-dashed/.test(line) && /text-center/.test(line)) offenders.push(`${f}: ${line.trim().slice(0, 80)}`);
    }
    expect(offenders).toEqual([]);
  });
});
