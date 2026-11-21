// @vitest-environment jsdom
// The schematic's view toggle, the highlight shared by both views, the electrical checks panel,
// and the parts list's kind and pins column (shown only for a product with electronics).
// The API is a stand-in fetch; the real routes are tested in tests/api/pins.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Item } from "@/lib/types";
import { STAGES } from "@/lib/menu";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/", useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { SchematicView } from "@/components/views/SchematicView";
import { BomView } from "@/components/views/BomView";

let n = 0;
const row = (section: string, title: string, data: Record<string, unknown>): Item => ({ id: ++n, projectId: "p1", section, title, body: "", data, status: section === "design/bom" ? "to buy" : "to solder", sort: n });

const PARTS = [
  row("design/bom", "Pico", { ref: "U1", library: "raspberry-pi-pico" }),
  row("design/bom", "IMU", { ref: "U2", library: "gy-521-mpu6050" }),
  row("design/bom", "Pull-up", { ref: "R1", library: "resistor-axial" }),
];
const WIRES = [
  row("design/wiring", "Data", { order: 1, from: "U1", fromPin: "GP4", to: "U2", toPin: "SDA", net: "SDA", netClass: "signal" }),
  row("design/wiring", "Clock", { order: 2, from: "U1", fromPin: "GP5", to: "U2", toPin: "SCL", net: "SCL", netClass: "signal" }),
  row("design/wiring", "Supply", { order: 3, from: "U1", fromPin: "3V3", to: "U2", toPin: "VCC", net: "3V3", netClass: "power" }),
  row("design/wiring", "Ground", { order: 4, from: "U1", fromPin: "GND", to: "U2", toPin: "GND", net: "GND", netClass: "ground" }),
];
const dataWire = WIRES[0];

function serve(productType = "electronics") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://test.local");
      const method = (init?.method ?? "GET").toUpperCase();
      const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      const section = url.searchParams.get("section");
      if (method === "GET" && url.pathname === "/api/projects/p1/items") return reply({ items: section === "design/bom" ? PARTS : section === "design/wiring" ? WIRES : [] });
      if (method === "GET" && url.pathname === "/api/projects/p1/pins") return reply({ pins: [] });
      if (method === "GET" && url.pathname === "/api/projects/p1") return reply({ project: { id: "p1", name: "Test concept", oneLiner: "", productType, stage: "design", archivedAt: null, createdAt: "", updatedAt: "", lastActivityAt: null, rowCount: 0, rowsByStage: {} } });
      if (method === "GET" && url.pathname.startsWith("/api/projects/p1/files")) return reply({ files: [] });
      return reply({ error: `No stand-in for ${method} ${url.pathname}` }, 404);
    })
  );
}

function mount(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const design = STAGES.find((s) => s.key === "design")!;
const schematicSection = design.sections.find((s) => s.key === "schematic")!;
const bomSection = design.sections.find((s) => s.key === "bom")!;
const project = { id: "p1", name: "Test concept", oneLiner: "" };

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly ??= class { m22 = 1; constructor() {} };
  window.localStorage.clear();
  window.history.replaceState(null, "", "/s/design/schematic");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("schematic views", () => {
  it("opens on the symbol view, toggles to pins and wires and back, and remembers the choice", async () => {
    serve();
    mount(<SchematicView project={project} stage={design} section={schematicSection} store="design/wiring" />);
    const symbols = await screen.findByRole("button", { name: "Symbols" });
    expect(symbols.getAttribute("aria-pressed")).toBe("true");
    expect(await screen.findByTestId("symbol-canvas")).toBeTruthy();
    expect(screen.getByTestId("title-block").textContent).toContain("Test concept");
    fireEvent.click(screen.getByRole("button", { name: "Pins and wires" }));
    expect(await screen.findByTestId("pins-canvas")).toBeTruthy();
    expect(screen.queryByTestId("symbol-canvas")).toBeNull();
    expect(window.localStorage.getItem("c2r.schematic.view")).toBe("pins");
    fireEvent.click(screen.getByRole("button", { name: "Symbols" }));
    expect(await screen.findByTestId("symbol-canvas")).toBeTruthy();
  });

  it("a wire selected from the address lights its pins in the symbol view and in the pins and wires view", async () => {
    serve();
    window.history.replaceState(null, "", `/s/design/schematic?select=wire:${dataWire.id}`);
    mount(<SchematicView project={project} stage={design} section={schematicSection} store="design/wiring" />);
    // the side panel shows the wire
    expect(await screen.findByText("Wire 1")).toBeTruthy();
    // symbol view: the two pin handles of the wire are lit
    await waitFor(() => {
      const handle = screen.getByLabelText(/^Pin U2\.SDA\./);
      expect((handle as HTMLElement).style.borderColor).toMatch(/rgb\(224, 90, 16\)|#E05A10/i);
    });
    expect((screen.getByLabelText(/^Pin U2\.SCL\./) as HTMLElement).style.borderColor).not.toMatch(/rgb\(224, 90, 16\)|#E05A10/i);
    // pins and wires view: the same two pins carry the highlight
    fireEvent.click(screen.getByRole("button", { name: "Pins and wires" }));
    await screen.findByTestId("pins-canvas");
    await waitFor(() => {
      const sda = screen.getByText("SDA", { selector: "span.truncate" }).closest("div")!;
      expect(sda.className).toContain("bg-dutchOrange/10");
    });
    const scl = screen.getByText("SCL", { selector: "span.truncate" }).closest("div")!;
    expect(scl.className).not.toContain("bg-dutchOrange/10");
  });

  it("pressing a pin in the pins and wires view selects it and keeps it selected in the symbol view", async () => {
    serve();
    mount(<SchematicView project={project} stage={design} section={schematicSection} store="design/wiring" />);
    fireEvent.click(await screen.findByRole("button", { name: "Pins and wires" }));
    await screen.findByTestId("pins-canvas");
    fireEvent.click(screen.getByText("SCL", { selector: "span.truncate" }));
    expect(await screen.findByText("U2.SCL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Symbols" }));
    await waitFor(() => expect((screen.getByLabelText(/^Pin U2\.SCL\./) as HTMLElement).style.borderColor).toMatch(/rgb\(224, 90, 16\)|#E05A10/i));
  });

  it("one checks panel, with the wiring rows and the electrical checks, and the undescribed parts named (D12)", async () => {
    serve();
    mount(<SchematicView project={project} stage={design} section={schematicSection} store="design/wiring" />);
    const panel = await screen.findByTestId("erc-panel");
    expect(within(panel).getByText("Wiring rows")).toBeTruthy();
    expect(within(panel).getByText("Electrical")).toBeTruthy();
    expect(screen.getAllByTestId("erc-panel")).toHaveLength(1);
  });

  it("shows the electrical checks and selects a finding's rows when pressed", async () => {
    serve();
    mount(<SchematicView project={project} stage={design} section={schematicSection} store="design/wiring" />);
    const panel = await screen.findByTestId("erc-panel");
    await waitFor(() => expect(within(panel).getAllByText(/I2C line/).length).toBe(2));
    fireEvent.click(within(panel).getAllByText(/I2C line SDA/)[0]);
    expect(await screen.findByText("Wire 1")).toBeTruthy();
  });
});

describe("parts list: kind and pins", () => {
  it("shows the kind and pins column for a product with electronics, and opens the editor", async () => {
    serve("electronics");
    mount(<BomView project={project} stage={design} section={bomSection} store="design/bom" />);
    expect(await screen.findByRole("columnheader", { name: "Kind and pins" })).toBeTruthy();
    const btn = await screen.findByRole("button", { name: /Kind and pins of Pico: Raspberry Pi Pico, 34 pins/ });
    await act(async () => fireEvent.click(btn));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/The pins come from the library entry Raspberry Pi Pico/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Raspberry Pi Pico datasheet/ }).getAttribute("href")).toMatch(/^https:\/\/datasheets\.raspberrypi\.com/);
  });

  it("a product with no electronics shows none of it", async () => {
    serve("physical");
    mount(<BomView project={project} stage={design} section={bomSection} store="design/bom" />);
    expect(await screen.findByText("Pico")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("columnheader", { name: "Kind and pins" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Kind and pins of/ })).toBeNull();
  });
});
