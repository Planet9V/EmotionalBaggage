// @vitest-environment jsdom
// A drafted row's proposed data reads as the row would: the section's own field labels and plain values, never raw JSON.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { DraftCard, changes } from "@/components/drafts/DraftCard";
import { fieldLabel, readableValue } from "@/lib/fieldLabels";
import type { Draft } from "@/lib/ai/drafts/shared";
import type { Item } from "@/lib/types";
import { adminServer, renderWithClient, shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const draft = (o: Partial<Draft> = {}): Draft => ({
  id: 11, projectId: "p1", generator: "parts", targetStore: "design/bom", title: "Coin cell", body: "", data: {}, op: { op: "add" }, sources: [], model: "m", provider: "ollama",
  status: "draft", runId: "11111111-1111-4111-8111-111111111111", reason: "", createdAt: "2026-11-20T10:00:00.000Z", decidedAt: null, decidedBy: null, itemId: null, ...o,
});
const row = (o: Partial<Item> = {}): Item => ({ id: 40, projectId: "p1", section: "design/bom", title: "Coin cell", body: "", data: {}, status: "to buy", sort: 1, ...o });

describe("field labels", () => {
  it("uses the section's own column labels first, then the shared ones, then a readable form of the key", () => {
    expect(fieldLabel("prototype/tests", "pass")).toBe("Pass condition");
    expect(fieldLabel("production/suppliers", "leadTimeDays")).toBe("Lead time (days)");
    expect(fieldLabel("design/bom", "qty")).toBe("Quantity");
    expect(fieldLabel("design/bom", "someNewField")).toBe("Some new field");
  });
  it("reads nested values as labelled text, not JSON", () => {
    const text = readableValue("design/bom", { shape: "box", size: [40, 20, 10], pos: [0, 1, 2] });
    expect(text).not.toMatch(/[{}"[\]]/);
    expect(text).toContain("Shape: box");
    expect(text).toContain("Size: 40, 20, 10");
    expect(readableValue("design/bom", [{ name: "VCC", role: "power" }, { name: "GND", role: "ground" }])).toBe("Name: VCC; Role: power / Name: GND; Role: ground");
    expect(readableValue("design/bom", true)).toBe("Yes");
  });
});

describe("a draft's proposed data", () => {
  it("shows labels and readable values for a new row", () => {
    adminServer([]);
    renderWithClient(<DraftCard draft={draft({ data: { ref: "U1", qty: 2, geometry: { shape: "box", size: [4, 5, 6], pos: [0, 0, 0] }, options: [{ id: "a", label: "Alpha" }] } })} />);
    expect(screen.getByText("Reference")).toBeTruthy();
    expect(screen.getByText("Quantity")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[{}]|"id"/);
  });

  it("shows a before and after in the section's labels, with nested values readable", () => {
    adminServer([]);
    const d = draft({ op: { op: "replace" }, itemId: 40, data: { qty: 3, geometry: { shape: "box", size: [4, 5, 6] } } });
    renderWithClient(<DraftCard draft={d} current={row({ data: { qty: 2, geometry: { shape: "box", size: [1, 2, 3] } } })} />);
    const table = screen.getByRole("table", { name: "Before and after" });
    expect(within(table).getByText("Quantity")).toBeTruthy();
    expect(within(table).getByText("Shape and place")).toBeTruthy();
    expect(table.textContent).not.toMatch(/[{}"]/);
    expect(changes(row({ data: { qty: 2 } }), d).find((c) => c.field === "Quantity")).toEqual({ field: "Quantity", was: "2", now: "3" });
  });

  it("an unknown field falls back to a readable key and value", () => {
    adminServer([]);
    renderWithClient(<DraftCard draft={draft({ data: { weirdThing: { inner_key: "x", deeper: { n: 1 } } } })} />);
    expect(screen.getByText("Weird thing")).toBeTruthy();
    expect(screen.getByText(/Inner key: x/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[{}"]/);
  });
});
