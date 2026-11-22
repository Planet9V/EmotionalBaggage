// @vitest-environment jsdom
// A part saved before the quantity rule, with 250,000 pieces, still loads in the parts list and says what is wrong; typing a bad quantity is refused with the same sentence.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Item } from "@/lib/types";
import { STAGES } from "@/lib/menu";
import { QTY_MESSAGE } from "@/lib/parts/quantity";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a> }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/", useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { BomView } from "@/components/views/BomView";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const row = (id: number, qty: number): Item => ({ id, projectId: "p1", section: "design/bom", title: `Part ${id}`, body: "", status: "to buy", sort: id, data: { ref: `P${id}`, qty, source: "Amazon", line: 1 } });

function mount(rows: Item[]) {
  const writes: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://t.local");
    const reply = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if ((init?.method ?? "GET") !== "GET") { writes.push(init?.body); return reply({ item: rows[0] }); }
    if (url.pathname === "/api/projects/p1/items") return reply({ items: rows });
    if (url.pathname === "/api/projects/p1") return reply({ project: { id: "p1", name: "T", productType: "physical", stage: "design" } });
    return reply({});
  }));
  const stage = STAGES.find((s) => s.key === "design")!;
  const section = stage.sections.find((s) => s.key === "bom")!;
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BomView project={{ id: "p1", name: "T", oneLiner: "" } as never} stage={stage} section={section} store="design/bom" /></QueryClientProvider>);
  return writes;
}

describe("part quantity in the parts list", () => {
  it("a saved row above the bound loads and says what is wrong; a row inside it says nothing", async () => {
    mount([row(1, 250_000), row(2, 4)]);
    expect((await screen.findByTestId("qty-problem-1")).textContent).toBe(QTY_MESSAGE);
    expect(screen.queryByTestId("qty-problem-2")).toBeNull();
  });

  it("refuses a typed quantity above 100,000 and writes nothing", async () => {
    const writes = mount([row(2, 4)]);
    fireEvent.click(await screen.findByRole("button", { name: /quantity of Part 2/ }));
    const input = await screen.findByRole("textbox", { name: /quantity of Part 2/ });
    fireEvent.change(input, { target: { value: "100001" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText(QTY_MESSAGE)).toBeTruthy();
    await waitFor(() => expect(writes).toHaveLength(0));
  });
});
