// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Item } from "@/lib/types";
import { toPart } from "@/lib/domain";
import { PartCard } from "@/components/sourcing/PartCard";
import { ShoppingList } from "@/components/sourcing/ShoppingList";
import { QueryClientProvider } from "@tanstack/react-query";
import { freshClient } from "../client/mockServer";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The drafts the engine holds for the concept, as GET /api/drafts answers; other calls are recorded. */
function draftsApi(drafts: unknown[] = []) {
  const calls: { method: string; path: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://t");
    calls.push({ method: (init?.method ?? "GET").toUpperCase(), path: url.pathname });
    const body = url.pathname === "/api/drafts" ? { drafts, pending: {} } : { draft: {}, item: null, before: null };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}

const PAGE = "https://www.mouser.com/ProductDetail/ABC-1/";
const offer = { id: "o1", supplier: "Mouser", price: 12, packSize: 100, checkedAt: "2026-11-21", source: "entered" };
const item = (sourcing: unknown, status = "to buy", extra: Record<string, unknown> = {}): Item => ({ id: 9, projectId: "p", section: "design/bom", title: "Buck converter", body: "", status, sort: 1, data: { ref: "U1", qty: 4, ...(sourcing ? { sourcing } : {}), ...extra } });
const draft = { id: "d1", kind: "offer", createdAt: "2026-11-21", researchId: 3, model: "stub/model", citation: PAGE, offer: { id: "x", supplier: "Mouser", price: 1.25, packSize: 10, checkedAt: "2026-11-21", source: "research", citation: PAGE } };

function open(it: Item, onSave = vi.fn(async () => undefined), onResearch = vi.fn()) {
  if (!vi.isMockFunction(globalThis.fetch)) draftsApi();
  render(<QueryClientProvider client={freshClient()}><ul><PartCard part={toPart(it)} currency="USD" onSave={onSave} onResearch={onResearch} /></ul></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Open/ }));
  return { onSave, onResearch };
}

describe("a part's sourcing", () => {
  it("shows a research draft from the drafting engine with its page; accepting approves the draft, never edits the part", async () => {
    const calls = draftsApi([
      { id: 77, projectId: "p", generator: "sourcing.prices", targetStore: "design/bom", title: "Offer: Mouser, 1.25 USD per 10", body: "In stock", data: { value: {} }, op: { op: "append", field: "sourcing.offers" }, sources: [{ kind: "research", id: 3, title: PAGE }], model: "sonar", provider: "perplexity", status: "draft", runId: "r", reason: "", createdAt: "", decidedAt: null, decidedBy: null, itemId: 9 },
      { id: 78, projectId: "p", generator: "sourcing.prices", targetStore: "design/bom", title: "Offer for another part", body: "", data: { value: {} }, op: { op: "append", field: "sourcing.offers" }, sources: [], model: "", provider: "", status: "draft", runId: "r", reason: "", createdAt: "", decidedAt: null, decidedBy: null, itemId: 10 },
    ]);
    const { onSave } = open(item({ offers: [], alternates: [], drafts: [] }));
    const li = (await screen.findByText("Offer: Mouser, 1.25 USD per 10")).closest("li")!;
    expect(within(li).getByRole("link", { name: "www.mouser.com" }).getAttribute("href")).toBe(PAGE);
    expect(screen.queryByText("Offer for another part")).toBeNull();
    fireEvent.click(within(li).getByRole("button", { name: "Accept as offer" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/drafts/77/approve")).toBe(true));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("opens to the distributor links, which open in a new tab and say the app never buys", () => {
    open(item(undefined));
    const links = screen.getAllByRole("link").filter((a) => /Digi-Key|Mouser|LCSC|Adafruit|SparkFun|Amazon|AliExpress|McMaster/.test(a.textContent ?? ""));
    expect(links).toHaveLength(8);
    for (const a of links) { expect(a.getAttribute("target")).toBe("_blank"); expect(a.getAttribute("rel")).toContain("noopener"); }
    expect(screen.getByText(/never buys/)).toBeTruthy();
  });

  it("shows a draft with its source page and counts it as nothing until accepted", () => {
    open(item({ offers: [], alternates: [], drafts: [draft] }));
    const li = screen.getByText("draft").closest("li")!;
    expect(within(li).getByText(/Mouser: 1\.25 USD per 10/)).toBeTruthy();
    expect(within(li).getByRole("link", { name: "www.mouser.com" }).getAttribute("href")).toBe(PAGE);
    expect(screen.getByText(/No offer yet/)).toBeTruthy();
  });

  it("accepting a draft makes it an offer that keeps its citation, and removes the draft", async () => {
    const { onSave } = open(item({ offers: [], alternates: [], drafts: [draft] }));
    fireEvent.click(screen.getByRole("button", { name: "Accept as offer" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = (onSave.mock.calls[0] as unknown as [{ data: { sourcing: { offers: Record<string, unknown>[]; drafts: unknown[]; chosen?: string } } }])[0].data.sourcing;
    expect(saved.drafts).toEqual([]);
    expect(saved.offers).toHaveLength(1);
    expect(saved.offers[0]).toMatchObject({ supplier: "Mouser", source: "research", citation: PAGE });
    expect(saved.chosen).toBeUndefined();
  });

  it("discarding a draft saves nothing but the removal", async () => {
    const { onSave } = open(item({ offers: [], alternates: [], drafts: [draft] }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = (onSave.mock.calls[0] as unknown as [{ data: { sourcing: { offers: unknown[]; drafts: unknown[] } } }])[0].data.sourcing;
    expect(saved).toMatchObject({ offers: [], drafts: [] });
  });

  it("choosing an offer sets the part's unit price to the price of one piece", async () => {
    const { onSave } = open(item({ offers: [offer, { ...offer, id: "o2", supplier: "Adafruit", price: 5, packSize: 1 }], alternates: [], drafts: [] }));
    fireEvent.click(screen.getByRole("radio", { name: /Mouser/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const call = (onSave.mock.calls[0] as unknown as [{ data: { unit: number; supplier: string; sourcing: { chosen: string } } }])[0];
    expect(call.data).toMatchObject({ unit: 0.12, supplier: "Mouser", sourcing: { chosen: "o1" } });
  });

  it("adds an offer the user typed, and refuses one with no supplier or a bad price", async () => {
    const { onSave } = open(item(undefined));
    const form = screen.getByRole("form", { name: /Add an offer for Buck converter/ });
    fireEvent.click(within(form).getByRole("button", { name: "Add offer" }));
    expect((await within(form).findByRole("alert")).textContent).toMatch(/supplier/);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText("Supplier"), { target: { value: "LCSC" } });
    fireEvent.change(within(form).getByLabelText("Price of one pack"), { target: { value: "-3" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add offer" }));
    expect((await within(form).findByRole("alert")).textContent).toMatch(/negative/);
    fireEvent.change(within(form).getByLabelText("Price of one pack"), { target: { value: "0.8" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add offer" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect((onSave.mock.calls[0] as unknown as [{ data: { sourcing: { offers: { supplier: string; price: number; source: string }[] } } }])[0].data.sourcing.offers[0]).toMatchObject({ supplier: "LCSC", price: 0.8, source: "entered" });
  });

  it("saves an order status and moves the part's own status with it", async () => {
    const { onSave } = open(item({ offers: [offer], chosen: "o1", alternates: [], drafts: [] }));
    const form = screen.getByRole("form", { name: /Order status of Buck converter/ });
    fireEvent.change(within(form).getByLabelText("Status"), { target: { value: "received" } });
    fireEvent.change(within(form).getByLabelText("Quantity ordered"), { target: { value: "4" } });
    fireEvent.change(within(form).getByLabelText("Quantity received"), { target: { value: "3" } });
    expect(within(form).getByText(/Fewer arrived/)).toBeTruthy();
    fireEvent.click(within(form).getByRole("button", { name: "Save order status" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const c = onSave.mock.calls[0] as unknown as [{ status: string; data: { sourcing: { order: { status: string; qtyReceived: number } } } }];
    expect(c[0].status).toBe("in hand");
    expect(c[0].data.sourcing.order).toMatchObject({ status: "received", qtyReceived: 3 });
  });

  it("asks before research, through the parent, for both kinds", () => {
    const { onResearch } = open(item(undefined));
    fireEvent.click(screen.getByRole("button", { name: /Check prices/ }));
    fireEvent.click(screen.getByRole("button", { name: /Find alternates/ }));
    expect(onResearch.mock.calls.map((c) => c[0])).toEqual(["prices", "alternates"]);
  });

  it("shows a failed save in a live alert", async () => {
    const { onSave } = open(item({ offers: [offer], alternates: [], drafts: [] }), vi.fn(async () => { throw new Error("The change was not saved."); }));
    fireEvent.click(screen.getByRole("radio", { name: /Mouser/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("not saved");
    expect(onSave).toHaveBeenCalled();
  });
});

describe("the shopping list", () => {
  const parts = [
    toPart(item({ offers: [offer], chosen: "o1", alternates: [], drafts: [] }, "to buy", { qty: 250 })),
    toPart({ ...item(undefined), id: 10, title: "Wire", data: { ref: "W1", qty: 2 } }),
  ];

  it("groups by supplier with whole packs, spares and a total, and names what has no supplier", () => {
    render(<ShoppingList parts={parts} currency="USD" projectName="Baggage Claims" />);
    expect(screen.getByText(/Mouser/)).toBeTruthy();
    const row = screen.getByText("Buck converter").closest("tr")!;
    expect(within(row).getAllByText("3").length).toBeGreaterThan(0);
    expect(within(row).getByText("50")).toBeTruthy();
    expect(within(row).getByText("36.00")).toBeTruthy();
    expect(screen.getByText(/Wire \(need 2\)/)).toBeTruthy();
    expect(screen.getByText("Total 36.00 USD")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Download CSV/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("is an empty state with the download off when there is nothing to buy", () => {
    render(<ShoppingList parts={[]} currency="USD" projectName="x" />);
    expect(screen.getByText("Nothing to buy yet")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Download CSV/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
