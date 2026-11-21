// @vitest-environment jsdom
// Three marketing screens against a stand-in API: the names checklist never says a name is
// available, the pricing table works its margins out (and marks an incomplete cost), and the brand
// kit warns on a low-contrast colour. The routes themselves are tested in generators.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { freshClient, mockServer, row } from "../client/mockServer";
import { findSection, storeKey } from "@/lib/menu";
import type { ViewProps } from "@/components/views/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));

import { NamesView } from "@/components/market/NamesView";
import { PricingView } from "@/components/market/PricingView";
import { BrandView } from "@/components/market/BrandView";

afterEach(cleanup);

function propsFor(stage: string, section: string): ViewProps {
  const f = findSection(stage, section)!;
  return { project: { id: "p1", name: "Acme", oneLiner: "" }, stage: f.stage, section: f.section, store: storeKey(f.stage, f.section) };
}
const mount = (ui: ReactNode) => render(<QueryClientProvider client={freshClient()}>{ui}</QueryClientProvider>);

describe("names checklist", () => {
  it("links to the user's own searches and never says a name is available or clear", async () => {
    const srv = mockServer([row(1, "concept/names", { title: "Sass Case", data: { kind: "Name" }, status: "shortlist" }), row(2, "concept/names", { title: "Pledge. Pack.", data: { kind: "Tagline" }, status: "candidate" })]);
    mount(<NamesView {...propsFor("concept", "names")} />);
    await screen.findByText("Sass Case");
    const text = document.body.textContent!.toLowerCase();
    expect(text).toContain("not a clearance");
    for (const claim of ["is available", "are available", "is free", "is clear", "is taken", "cleared", "no conflicts", "good to use"]) {
      // the one sentence that denies availability contains "available"; it must be the only place
      if (claim === "is available") continue;
      expect(text, claim).not.toContain(claim);
    }
    const amazon = screen.getAllByRole("link", { name: /Search Amazon/ })[0] as HTMLAnchorElement;
    expect(amazon.href).toBe("https://www.amazon.com/s?k=Sass%20Case");
    expect(amazon.rel).toContain("noopener");
    expect(amazon.target).toBe("_blank");
    // the tagline has no domain or social checks
    const taglineCard = screen.getByText("Pledge. Pack.").closest("li")!;
    expect(within(taglineCard).queryByText(/Namecheap/)).toBeNull();
    expect(within(taglineCard).queryByText(/Instagram/)).toBeNull();

    // ticking saves, and the app does nothing else
    const box = screen.getAllByRole("checkbox", { name: /I checked: Search Amazon/ })[0];
    fireEvent.click(box);
    await waitFor(() => expect(srv.count("PATCH", "/api/items/1")).toBe(1));
    expect(srv.calls.find((c) => c.method === "PATCH")!.body).toEqual({ data: { screening: { amazon: true } } });
    // no outbound request to a search site: only this app's own routes were called
    expect(srv.calls.every((c) => c.path.startsWith("/api/"))).toBe(true);
  });
});

describe("pricing", () => {
  it("works the margin out from the parts list and the channel fee, and marks an incomplete cost", async () => {
    mockServer([
      row(1, "design/bom", { title: "Board", data: { line: 6 } }),
      row(2, "design/bom", { title: "Case", data: { line: 4 } }),
      row(3, "marketing/pricing", { title: "Amazon", data: { kind: "channel", feePercent: 15, fixedFeeMinor: 0 }, status: "draft" }),
      row(4, "marketing/pricing", { title: "$25.00", data: { kind: "price", priceMinor: 2500, currency: "USD", approach: "own" }, status: "draft" }),
    ]);
    mount(<PricingView {...propsFor("marketing", "pricing")} />);
    const table = await screen.findByRole("table", { name: /Margin per unit/ });
    // 25.00 - 10.00 cost - 3.75 fee = 11.25, 45.0 percent
    expect(within(table).getByText("$11.25")).toBeTruthy();
    expect(within(table).getByText("45.0%")).toBeTruthy();
    expect(screen.getByText(/Unit cost at 1 unit/).textContent).toContain("$10.00");
    expect(screen.queryByText(/have no cost entered|has no cost entered/)).toBeNull();
    expect(table.textContent).not.toContain("*");
  });

  it("lists parts with no cost and flags every margin until they are priced", async () => {
    mockServer([
      row(1, "design/bom", { title: "Board", data: { line: 6 } }),
      row(2, "design/bom", { title: "Mystery part", data: {} }),
      row(4, "marketing/pricing", { title: "$25.00", data: { kind: "price", priceMinor: 2500, currency: "USD" }, status: "draft" }),
    ]);
    mount(<PricingView {...propsFor("marketing", "pricing")} />);
    const table = await screen.findByRole("table", { name: /Margin per unit/ });
    expect(screen.getByText(/Mystery part/)).toBeTruthy();
    expect(screen.getByText("incomplete")).toBeTruthy();
    expect(table.textContent).toContain("*");
    // with no channel entered, the margin is shown with no fee, and says so
    expect(within(table).getByText(/No channel fee/)).toBeTruthy();
    expect(within(table).getByText("$19.00")).toBeTruthy();
  });

  it("reads the unit cost and the currency from the unit economics, and has no currency setting of its own", async () => {
    mockServer(
      [
        row(1, "design/bom", { title: "Board", data: { line: 6 } }),
        row(2, "production/economics", { title: "Assembly", data: { kind: "labour", labourMinutes: 10, rate: 24 } }),
        row(3, "marketing/pricing", { title: "Pricing assumptions", data: { kind: "assumptions", currency: "GBP" }, status: "draft" }),
        row(4, "marketing/pricing", { title: "€25.00", data: { kind: "price", priceMinor: 2500, currency: "EUR", approach: "own" }, status: "draft" }),
        row(5, "marketing/pricing", { title: "$30.00", data: { kind: "price", priceMinor: 3000, currency: "USD", approach: "own" }, status: "draft" }),
      ],
      { settings: { currency: "EUR" } },
    );
    mount(<PricingView {...propsFor("marketing", "pricing")} />);
    const table = await screen.findByRole("table", { name: /Margin per unit/ });
    // 6.00 board + 10 min x 24.00 / 60 labour = 10.00: the labour line counts, as on Unit economics
    expect(screen.getByText(/Unit cost at 1 unit/).textContent).toContain("€10.00");
    // 25.00 - 10.00 = 15.00 with no channel fee
    expect(within(table).getByText("€15.00")).toBeTruthy();
    // the old assumptions row's GBP is ignored, and there is no currency field
    expect(screen.queryByLabelText(/Currency code/)).toBeNull();
    expect(document.body.textContent).not.toContain("GBP");
    // the dollar price saved before the currency changed is named, not compared
    expect(table.textContent).not.toContain("30.00");
    expect(screen.getByText(/saved in another currency \(USD\)/)).toBeTruthy();
  });

  it("offers the strip chart and a table of the same prices", async () => {
    mockServer([
      row(1, "design/bom", { title: "Board", data: { line: 6 } }),
      row(4, "marketing/pricing", { title: "$25.00", data: { kind: "price", priceMinor: 2500, currency: "USD" }, status: "draft" }),
      row(5, "marketing/competitors", { title: "Rival", data: { kind: "product", priceMinor: 3000, currency: "USD", basis: "typed" } }),
    ]);
    mount(<PricingView {...propsFor("marketing", "pricing")} />);
    await screen.findByRole("img", { name: /Prices on one line/ });
    fireEvent.click(screen.getByRole("button", { name: "table" }));
    const t = screen.getByRole("table", { name: /same prices as a table/i });
    expect(within(t).getByText("Rival")).toBeTruthy();
    expect(within(t).getByText("$30.00")).toBeTruthy();
  });
});

describe("brand kit", () => {
  it("warns on a colour too light for white and notes one that reads only for large text", async () => {
    mockServer([row(1, "marketing/brand", { title: "Brand kit", status: "draft", data: { kind: "kit", colours: [{ role: "primary", name: "Yellow", hex: "#FFE600" }, { role: "secondary", name: "Orange", hex: "#E05A10" }] } })]);
    mount(<BrandView {...propsFor("marketing", "brand")} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Low contrast on white/);
    expect(screen.getAllByRole("alert")).toHaveLength(1); // the orange is a note, not a warning
    expect(screen.getByText(/fine for large text and buttons/)).toBeTruthy();
    expect(screen.getAllByText(/White text: \d+\.\d\d:1/).length).toBe(2);
  });
});
