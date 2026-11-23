// @vitest-environment jsdom
// The Enclosure section when the concept's enclosure is an authored design (the example's Rev D tag): its renders
// and files from Files, its own checks, no generator controls, and the way back to the generators.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { EnclosureView } from "@/components/enclosure/EnclosureView";
import { applyBatches, seededRows } from "@/lib/seedContent";
import { authoredFiles, authoredOf } from "@/lib/enclosure/authored";
import { enclosureCheck } from "@/lib/process/computed";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";
import type { ViewProps } from "@/components/views/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/s/design/enclosure", useSearchParams: () => new URLSearchParams() }));

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const project = { id: "p1", name: "Baggage Claims MK1", oneLiner: "" };
const props = { project, stage: { key: "design" }, section: { key: "enclosure" }, store: "design/enclosure" } as unknown as ViewProps;
const after = applyBatches(seededRows()).map((r, i) => ({ id: i + 1, projectId: "p1", sort: i, ...r }));
const bom = after.filter((r) => r.section === "design/bom");
const saved = after.filter((r) => r.section === "design/enclosure");
const design = authoredOf(saved[0]?.data)!;
// every file the design names is in Files but the last document
const names = authoredFiles(design);
const files = names.slice(0, -1).map((title, i) => ({ id: 900 + i, projectId: "p1", section: "concept/files", title, body: "", data: { fileId: 50 + i, size: 1000 * (i + 1) }, status: "stored", sort: i }));

describe("an authored enclosure", () => {
  it("is the example's enclosure after the Rev D batch, and its gate says who measured its checks", () => {
    expect(saved).toHaveLength(1);
    expect(design.name).toContain("A1 Saddle");
    expect(design.checks).toHaveLength(20);
    const g = enclosureCheck(after);
    expect(g.met).toBe(true);
    expect(g.detail).toContain("not measured by this app");
  });

  it("shows the renders and the files from Files, the checks, and no generator", async () => {
    let patched: unknown = null;
    adminServer([
      on("GET", "/api/projects/p1/items?section=design%2Fbom", () => ({ body: { items: bom } })),
      on("GET", "/api/projects/p1/items?section=design%2Fenclosure", () => ({ body: { items: saved } })),
      on("GET", "/api/projects/p1/items?section=concept%2Ffiles", () => ({ body: { items: files } })),
      on("GET", "/api/projects/p1/enclosure/status", () => ({ body: { casemaker: { available: true }, yapp: { available: false } } })),
      on("PATCH", `/api/items/${saved[0].id}`, (c) => {
        patched = c.body;
        return { body: { item: { ...saved[0], data: { ...saved[0].data, enclosureSource: "generated" } } } };
      }),
    ]);
    renderWithClient(<EnclosureView {...props} />);
    expect(await screen.findByRole("heading", { name: "Authored design" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Enclosure generator" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate/ })).toBeNull();
    const hero = await screen.findByRole("img", { name: "A1 Saddle, the front" });
    expect(hero.getAttribute("src")).toBe(`/api/files/${files.find((f) => f.title === design.renders[0].file)!.data.fileId}?inline=1`);
    expect(screen.getAllByRole("link", { name: /Download/ }).length).toBe(1 + design.printFiles.length + design.documents.length - 1);
    expect(screen.getByText(new RegExp(`Not in Files: ${names.at(-1)!.replace(".", "\\.")}`))).toBeTruthy();
    expect(screen.getByText(/20 of 20 pass/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use a generator instead" }));
    await waitFor(() => expect(patched).toMatchObject({ data: { enclosureSource: "generated" } }));
  });
});
