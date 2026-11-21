// @vitest-environment jsdom
// The Enclosure section: the states a person sees, with the server answered by a stand-in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { EnclosureView } from "@/components/enclosure/EnclosureView";
import { SEED_ITEMS } from "@/lib/seed";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";
import type { ViewProps } from "@/components/views/types";
import { part } from "./helpers";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const project = { id: "p1", name: "Test concept", oneLiner: "" };
const props = { project, stage: { key: "design" }, section: { key: "enclosure" }, store: "design/enclosure" } as unknown as ViewProps;
const row = (i: { section: string; title: string; data?: unknown }, n: number) => ({ id: n + 1, projectId: "p1", section: i.section, title: i.title, body: "", data: i.data ?? {}, status: "to buy", sort: n });
const example = SEED_ITEMS.filter((i) => i.section === "design/bom").map(row);

const items = (bom: unknown[], saved: unknown[] = []) => [
  on("GET", "/api/projects/p1/items?section=design%2Fbom", () => ({ body: { items: bom } })),
  on("GET", "/api/projects/p1/items?section=design%2Fenclosure", () => ({ body: { items: saved } })),
];
const status = (yapp: unknown) => on("GET", "/api/projects/p1/enclosure/status", () => ({ body: { casemaker: { available: true }, yapp } }));

describe("Enclosure section", () => {
  it("is not offered for a concept with no part that has a box", async () => {
    adminServer([...items([row(part(1, "S", "Sign-up form", null), 0)]), status({ available: false })]);
    renderWithClient(<EnclosureView {...props} />);
    expect(await screen.findByText("No part has a box yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Generate/ })).toBeNull();
  });

  it("shows an error with a retry when the parts cannot be loaded", async () => {
    let fail = true;
    adminServer([
      on("GET", "/api/projects/p1/items?section=design%2Fbom", () => (fail ? { status: 500, body: { error: "database down" } } : { body: { items: example } })),
      on("GET", "/api/projects/p1/items?section=design%2Fenclosure", () => ({ body: { items: [] } })),
      status({ available: true }),
    ]);
    renderWithClient(<EnclosureView {...props} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/database down/);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("radiogroup", { name: "Enclosure generator" })).toBeTruthy();
  });

  it("offers both generators, states the defaults and lists the openings the example needs", async () => {
    adminServer([...items(example), status({ available: true })]);
    renderWithClient(<EnclosureView {...props} />);
    expect(await screen.findByRole("radio", { name: /CaseMaker/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /YAPP_Box/ })).toBeTruthy();
    expect(screen.getByLabelText(/Wall thickness/)).toHaveProperty("value", "2");
    expect(screen.getAllByText(/Default 2\./).length).toBeGreaterThan(0);
    for (const ref of ["S1", "S2", "SPK1"]) expect(screen.getAllByText(ref).length).toBeGreaterThan(0);
    expect(screen.getByText("Nothing generated yet")).toBeTruthy();
  });

  it("says when the planner cannot run YAPP_Box and keeps CaseMaker usable", async () => {
    adminServer([...items(example), status({ available: false, code: "unreachable", reason: "The planner service is not reachable (ECONNREFUSED)." })]);
    renderWithClient(<EnclosureView {...props} />);
    expect(await screen.findByText(/Not available: The planner service is not reachable/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate with CaseMaker" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: /YAPP_Box/ }));
    expect(screen.getByRole("button", { name: "Generate with YAPP_Box" }).hasAttribute("disabled")).toBe(true);
  });

  it("validates as you type and blocks Generate while a value is out of range", async () => {
    adminServer([...items(example), status({ available: true })]);
    renderWithClient(<EnclosureView {...props} />);
    const wall = (await screen.findByLabelText(/Wall thickness/)) as HTMLInputElement;
    fireEvent.change(wall, { target: { value: "0.5" } });
    await waitFor(() => expect(screen.getAllByText(/Wall thickness must be at least 1.2/).length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "Generate with CaseMaker" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    fireEvent.change(wall, { target: { value: "" } });
    await waitFor(() => expect(screen.getAllByText(/Wall thickness must be a number/).length).toBeGreaterThan(0));
  });

  it("says a part is taller than the inside", async () => {
    const tall = [row(part(1, "E", "Shell", { shape: "shell", size: [60, 30, 40], pos: [0, 15, 0] }), 0), row(part(2, "T", "Tall thing", { shape: "box", size: [10, 40, 10], pos: [0, 15, 0] }), 1)];
    adminServer([...items(tall), status({ available: true })]);
    renderWithClient(<EnclosureView {...props} />);
    await screen.findByRole("radiogroup");
    await waitFor(() => expect(screen.getAllByRole("alert").some((a) => /is 40 mm tall/i.test(a.textContent ?? ""))).toBe(true), { timeout: 3000 });
  });
});
