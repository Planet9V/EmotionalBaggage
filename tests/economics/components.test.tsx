// @vitest-environment jsdom
// The build-up table and the chart's table alternative, as a person (or a screen reader) meets them.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { BuildUpTable } from "@/components/economics/BuildUpTable";
import { CostChart } from "@/components/economics/CostChart";
import { ChannelTable } from "@/components/economics/ChannelTable";
import { channelResults, costBySize, fixedCosts, unitCost } from "@/lib/economics/compute";
import type { ChannelRow, CostRow, EconomicsInputs, PartInput } from "@/lib/economics/read";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a> }));

beforeAll(() => {
  // recharts measures its container
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

const part = (id: number, over: Partial<PartInput> = {}): PartInput => ({ id, ref: `P${id}`, title: `Part ${id}`, qty: 1, unit: null, line: null, breaks: [], supplier: "", ...over });
const cost = (id: number, over: Partial<CostRow>): CostRow => ({ id, title: `Row ${id}`, kind: "packaging", amount: null, labourMinutes: null, rate: null, grams: null, pricePerKg: null, printMinutes: null, machineRate: null, percent: null, ...over });
const inputs: EconomicsInputs = {
  currency: "USD",
  parts: [part(1, { title: "Board", qty: 2, unit: 5, breaks: [{ qty: 100, unit: 4 }] }), part(2, { title: "Cable" })],
  costs: [cost(10, { title: "Box", kind: "packaging", amount: 1.5 }), cost(11, { title: "Setup", kind: "setup", amount: 100 })],
  channels: [],
  methods: [],
  batches: [],
};

describe("BuildUpTable", () => {
  it("shows each line, a subtotal per group and the unit cost, in order", () => {
    render(<BuildUpTable unit={unitCost(inputs, 1)} />);
    const table = screen.getByRole("table", { name: /unit cost at 1 units/i });
    expect(within(table).getByText("P1 Board")).toBeTruthy();
    const row = within(table).getByText("P1 Board").closest("tr")!;
    expect(within(row).getByText("$10.00")).toBeTruthy(); // 2 x $5.00
    expect(within(table).getByText("Parts subtotal")).toBeTruthy();
    expect(within(within(table).getByText("Box").closest("tr")!).getByText("$1.50")).toBeTruthy();
    // setup of $100 over 1 unit
    expect(within(table).getByText("Setup spread over the batch subtotal")).toBeTruthy();
    expect(within(table).getByText("Unit cost at 1 unit")).toBeTruthy();
    expect(within(table).getByText("$111.50")).toBeTruthy(); // 10 + 1.50 + 100
  });
  it("lists an unpriced part as not priced, with a link to fix it, and marks the total incomplete", () => {
    render(<BuildUpTable unit={unitCost(inputs, 1)} />);
    expect(screen.getAllByText("Not priced").length).toBeGreaterThan(0);
    const fix = screen.getAllByRole("link", { name: "Fix it" })[0];
    expect(fix.getAttribute("href")).toBe("/s/production/pricing");
    expect(screen.getByText("Incomplete")).toBeTruthy();
  });
  it("follows the batch size: a price break and the setup spread", () => {
    render(<BuildUpTable unit={unitCost(inputs, 100)} />);
    const table = screen.getByRole("table");
    expect(within(within(table).getByText("P1 Board").closest("tr")!).getByText("$8.00")).toBeTruthy(); // 2 x $4.00 at the break
    expect(within(within(table).getByText("Setup").closest("tr")!).getByText("$1.00")).toBeTruthy(); // $100 / 100 units
  });
  it("has a closed 'How this is worked out' that lists the arithmetic", () => {
    const { container } = render(<BuildUpTable unit={unitCost(inputs, 1)} />);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(within(details).getByText("How this is worked out")).toBeTruthy();
    expect(details.textContent).toContain("2 x $5.00 = $10.00");
    expect(details.textContent).toContain("$100.00 per batch / 1 units = $100.00");
  });
  it("offers edit and remove only for cost lines, and calls back with the row", () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(<BuildUpTable unit={unitCost(inputs, 1)} onEdit={onEdit} onRemove={onRemove} />);
    expect(screen.queryByRole("button", { name: "Edit P1 Board" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Box" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Box" }));
    expect(onEdit).toHaveBeenCalledWith(10);
    expect(onRemove).toHaveBeenCalledWith(10);
  });
});

describe("CostChart", () => {
  const points = costBySize(inputs, [1, 10, 100, 1000]);
  it("keeps the numbers as a table for screen readers while the chart is shown", () => {
    const { container } = render(<CostChart points={points} currency="USD" />);
    const table = screen.getByRole("table", { name: "Unit cost at each batch size", hidden: true });
    expect(table.closest(".sr-only")).not.toBeNull();
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(points.length + 1);
    // the drawn chart is hidden from assistive technology
    expect(container.querySelector('[aria-hidden="true"] .recharts-responsive-container, [aria-hidden="true"] [data-chart]')).not.toBeNull();
  });
  it("shows the table to everyone on request, and says how the cost moves", () => {
    render(<CostChart points={points} currency="USD" />);
    expect(screen.getByText(/Unit cost falls from/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show as a table" }));
    const table = screen.getByRole("table", { name: "Unit cost at each batch size" });
    expect(table.closest(".sr-only")).toBeNull();
    expect(within(table).getByText("1,000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show the chart" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("says so when there is only one size", () => {
    render(<CostChart points={points.slice(0, 1)} currency="USD" />);
    expect(screen.getByText(/Add a second batch size/)).toBeTruthy();
  });
});

describe("ChannelTable", () => {
  const channel = (id: number, over: Partial<ChannelRow>): ChannelRow => ({ id, title: `Channel ${id}`, status: "planned", price: null, platformPercent: null, platformFixed: null, paymentPercent: null, paymentFixed: null, fulfilment: null, returnsPercent: null, adCost: null, ...over });
  it("shows margin and break-even, and names what a channel is missing", () => {
    const priced = { ...inputs, parts: [part(1, { unit: 10 })], costs: [cost(1, { kind: "tooling", amount: 1000 })] };
    const unit = unitCost(priced, 1);
    const results = channelResults([channel(1, { title: "Shop", price: 25, platformPercent: 0 }), channel(2, { title: "Wholesale" })], unit, fixedCosts(priced));
    render(<ChannelTable results={results} currency="USD" />);
    const table = screen.getByRole("table", { name: /margin per unit/i });
    expect(within(table).getByText("67 units")).toBeTruthy();
    expect(within(table).getByText("60%")).toBeTruthy();
    expect(screen.getByText("Wholesale: no price.")).toBeTruthy();
  });
});
