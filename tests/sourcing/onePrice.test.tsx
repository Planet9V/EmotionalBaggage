// @vitest-environment jsdom
// D4: one price per part everywhere. After an offer is chosen in Sourcing, the parts list shows that
// supplier and "unit x qty from <supplier>, checked <date>", its total moves, and the economics read the
// same unit with the same source; a typed line cost is labelled an entered estimate. The shopping list
// does not claim a total of 0.00 when nothing is priced.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Item } from "@/lib/types";
import { STAGES } from "@/lib/menu";
import { partPrice, sumLine, toPart } from "@/lib/domain";
import { readPartInput } from "@/lib/economics/read";
import { partLine } from "@/lib/economics/compute";
import { shoppingCsv, shoppingList } from "@/lib/sourcing/list";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/", useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { BomView } from "@/components/views/BomView";
import { ShoppingList } from "@/components/sourcing/ShoppingList";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const offer = { id: "o1", supplier: "DigiKey", price: 7.5, packSize: 1, checkedAt: "2026-11-20", source: "entered" };
const u1 = (chosen: boolean): Item => ({ id: 1, projectId: "p1", section: "design/bom", title: "MCU dev board", body: "", status: "to buy", sort: 1, data: { ref: "U1", qty: 1, source: "Micro Center", line: 8.99, unit: chosen ? 7.5 : 8.99, supplier: "Micro Center", sourcing: { offers: [offer], chosen: chosen ? "o1" : undefined, alternates: [], drafts: [] } } });
const r1: Item = { id: 2, projectId: "p1", section: "design/bom", title: "Resistor", body: "", status: "to buy", sort: 2, data: { ref: "R1", qty: 2, source: "Amazon", line: 0.1 } };

describe("one price per part", () => {
  it("a chosen offer is the price; otherwise the typed line is an entered estimate", () => {
    expect(partPrice(toPart(u1(true)))).toMatchObject({ basis: "offer", unit: 7.5, qty: 1, line: 7.5, supplier: "DigiKey", checkedAt: "2026-11-20" });
    expect(partPrice(toPart(u1(false)))).toMatchObject({ basis: "estimate", line: 8.99 });
    expect(sumLine([toPart(u1(true)), toPart(r1)])).toBeCloseTo(7.6, 6);
  });

  it("the economics read the chosen offer and say where it came from, even when data.unit is stale", () => {
    const stale = u1(true);
    stale.data.unit = 8.99;
    const p = readPartInput(stale);
    expect(p.unit).toBe(7.5);
    const line = partLine(p, 5, "USD");
    expect(line.amount).toBe(750);
    expect(line.how).toMatch(/from DigiKey, checked 2026-11-20/);
    expect(partLine(readPartInput(r1), 5, "USD").how).toMatch(/^Entered estimate on the parts list/);
  });

  it("the parts list shows the chosen supplier, the arithmetic and the moved total", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://t.local");
      const reply = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
      if (url.pathname === "/api/projects/p1/items") return reply({ items: [u1(true), r1] });
      if (url.pathname === "/api/projects/p1") return reply({ project: { id: "p1", name: "T", productType: "physical", stage: "design" } });
      return reply({});
    }));
    const stage = STAGES.find((s) => s.key === "design")!;
    const section = stage.sections.find((s) => s.key === "bom")!;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BomView project={{ id: "p1", name: "T", oneLiner: "" } as never} stage={stage} section={section} store="design/bom" /></QueryClientProvider>);
    expect((await screen.findByTestId("price-basis-1")).textContent).toBe("7.50 x 1 from DigiKey checked 2026-11-20");
    expect(screen.getByRole("link", { name: "DigiKey" })).toBeTruthy();
    expect(screen.queryByText("Micro Center")).toBeNull();
    expect(screen.queryByText("8.99")).toBeNull();
    expect(screen.getByTestId("price-basis-2").textContent).toBe("entered estimate");
    expect(screen.getAllByText("7.60").length).toBeGreaterThan(0);
  });

  it("the shopping list says nothing is priced instead of a total of 0.00", () => {
    render(<ShoppingList parts={[toPart(u1(false)), toPart(r1)]} currency="USD" projectName="T" />);
    expect(screen.getByTestId("shopping-nothing-priced")).toBeTruthy();
    expect(screen.queryByText(/Total 0\.00/)).toBeNull();
    const csv = shoppingCsv(shoppingList([u1(false), r1].map((i) => ({ id: i.id, ref: String(i.data.ref), title: i.title, qty: Number(i.data.qty), status: i.status, data: i.data }))), "USD");
    expect(csv).toMatch(/Total,Nothing is priced yet/);
  });
});
