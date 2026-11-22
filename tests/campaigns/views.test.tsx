// @vitest-environment jsdom
// The campaign screens in a browser environment against a stand-in API: the board changes a status from
// a select (keyboard), the budget table says in words when a month is over, the results page leads
// with the verdict sentence from the user's rule and has no row of number tiles, a rule-less campaign
// says so, the legacy seeded rows still show, and the QR code is drawn by the library.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { freshClient, mockServer, row } from "../client/mockServer";
import { findSection, storeKey } from "@/lib/menu";
import type { ViewProps } from "@/components/views/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));

import { CampaignsView } from "@/components/campaigns/CampaignsView";
import { ResultsView } from "@/components/campaigns/ResultsView";
import { LinksView } from "@/components/campaigns/LinksView";
import { QrCode } from "@/components/campaigns/QrCode";
import { BudgetTable } from "@/components/campaigns/BudgetTable";
import { toCampaign } from "@/lib/campaigns/read";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const propsFor = (section: string): ViewProps => {
  const f = findSection("marketing", section)!;
  return { project: { id: "p1", name: "Acme", oneLiner: "" }, stage: f.stage, section: f.section, store: storeKey(f.stage, f.section) };
};
const mount = (ui: ReactNode) => render(<QueryClientProvider client={freshClient()}>{ui}</QueryClientProvider>);

/** The item mock plus the campaign routes. */
function install(rows: ReturnType<typeof row>[], extra: { results?: unknown; links?: unknown } = {}) {
  const srv = mockServer(rows);
  const inner = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://test.local").pathname;
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (path.endsWith("/campaigns/summary")) return ok({ currency: "USD", margins: [{ channelId: 7, title: "Shop", marginBeforeAds: 2000, price: 5000, complete: true, batchSize: 1, how: [], missing: [] }] });
    if (path.endsWith("/campaigns/results")) return ok(extra.results ?? { rows: [], linkClicks: [] });
    if (path.endsWith("/campaigns/links")) return ok(extra.links ?? { links: [], convention: ["utm_source: where"] });
    return inner(input, init);
  }));
  return srv;
}

const campaign = (id: number, over: Record<string, unknown> = {}, status = "planned") =>
  row(id, "marketing/campaigns", { title: `Campaign ${id}`, status, data: { kind: "campaign", ...over } });

describe("campaigns view", () => {
  it("shows the board by status, with a select to change a status", async () => {
    const srv = install([campaign(1, { objective: "conversion", channel: "Meta feed", budgetTotalMinor: 30000, startDate: "2026-12-01", endDate: "2026-12-10" })]);
    mount(<CampaignsView {...propsFor("campaigns")} />);
    await screen.findByText("Campaign 1");
    expect(screen.getByText("$300.00 in all")).toBeTruthy();
    const select = screen.getByLabelText("Status of Campaign 1") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["planned", "ready", "running", "paused", "done", "killed"]);
    fireEvent.change(select, { target: { value: "running" } });
    await waitFor(() => expect(srv.calls.some((c) => c.method === "PATCH" && (c.body as { status?: string }).status === "running")).toBe(true));
  });

  it("an empty concept says what to do, and a legacy seeded row with text fields still shows", async () => {
    install([]);
    mount(<CampaignsView {...propsFor("campaigns")} />);
    await screen.findByText("No campaigns yet");
    cleanup();
    install([row(5, "marketing/campaigns", { title: "Launch week", status: "planned", data: { funnel: "Awareness", budget: "$500", kpi: "100 orders" } })]);
    mount(<CampaignsView {...propsFor("campaigns")} />);
    await screen.findByText("Launch week");
    expect(screen.getByText("No budget set")).toBeTruthy();
  });

  it("says a month is over its budget in words, and a campaign without dates is left out with the reason", () => {
    const cs = [
      toCampaign(campaign(1, { budgetTotalMinor: 60000, startDate: "2026-12-01", endDate: "2026-12-30" }) as never),
      toCampaign(campaign(2, { budgetTotalMinor: 5000 }) as never),
    ];
    const plan = { id: 9, totalMinor: 50000, monthlyMinor: 40000, allowableSharePercent: null, judgeAfterOrders: null, scaleBelowPercent: null, scaleByPercent: null, minClicks: 100, minOrders: 10, linkHosts: [] };
    const money = { currency: "USD", format: (m: number) => `$${(m / 100).toFixed(2)}`, toInput: () => "", fromInput: () => null };
    render(<BudgetTable campaigns={cs} plan={plan} money={money} />);
    expect(screen.getByTestId("budget-sentence").textContent).toContain("$100.00 over the total marketing budget of $500.00");
    expect(screen.getByText(/Over by \$200.00/)).toBeTruthy();
    expect(screen.getByText(/no start and end date/)).toBeTruthy();
  });
});

describe("marketing budget and rules", () => {
  it("says what is wrong beside each field, then saves empty fields as not set and numbers as typed", async () => {
    const srv = install([campaign(1, {}, "planned")]);
    mount(<CampaignsView {...propsFor("campaigns")} />);
    const share = await screen.findByLabelText(/Share of the margin/);
    fireEvent.change(share, { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/Too few clicks/), { target: { value: "2.5" } });
    fireEvent.change(screen.getByLabelText("Hosts tracked links may open"), { target: { value: "bad_host!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget and rules" }));
    expect((await screen.findByText("The share of the margin must be a number from 0 to 100.")).getAttribute("role")).toBe("alert");
    expect(share.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("The minimum clicks must be a whole number, zero or more.")).toBeTruthy();
    expect(screen.getByText(/^Not a host name: bad_host!\./)).toBeTruthy();
    expect(srv.calls.some((c) => c.method === "POST")).toBe(false);
    fireEvent.change(share, { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/Too few clicks/), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Hosts tracked links may open"), { target: { value: "shop.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save budget and rules" }));
    await waitFor(() => expect(srv.calls.some((c) => c.method === "POST")).toBe(true));
    const sent = srv.calls.find((c) => c.method === "POST")?.body as { data: Record<string, unknown> };
    expect(sent.data).toMatchObject({ kind: "plan", allowableSharePercent: 30, minClicks: 50, linkHosts: ["shop.example"], planTotalMinor: null, judgeAfterOrders: null });
    expect(await screen.findByText("Saved.")).toBeTruthy();
  });
});

describe("results view", () => {
  const rows = [
    { id: 1, campaignId: 1, creativeId: null, creativeLabel: "", day: "2026-12-01", spend: 15000, impressions: 20000, clicks: 400, orders: 12, revenue: 60000, source: "manual" },
  ];

  it("leads with the verdict sentence from the rule and has no row of number tiles", async () => {
    install([campaign(1, { objective: "conversion", rule: { stopAboveMinor: 1000, scaleBelowMinor: 500, scaleByPercent: 25 }, budgetDailyMinor: 2000 }, "running")], { results: { rows, linkClicks: [] } });
    mount(<ResultsView {...propsFor("results")} />);
    const sentence = await screen.findByTestId("verdict-sentence");
    expect(sentence.textContent).toContain("$12.50");
    expect(sentence.textContent).toContain("$10.00");
    expect(screen.getByText("Stop")).toBeTruthy();
    // the verdict comes before the figures table in the document
    const figures = screen.getByRole("heading", { name: "Figures against the target" });
    expect(sentence.compareDocumentPosition(figures) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll("[data-stat-tile], .stat-tile")).toHaveLength(0);
  });

  it("with no rule it says so instead of guessing, and with no results it says to enter some", async () => {
    install([campaign(1, {}, "running")], { results: { rows, linkClicks: [] } });
    mount(<ResultsView {...propsFor("results")} />);
    expect((await screen.findByTestId("verdict-sentence")).textContent).toMatch(/no rule|rule/i);
    cleanup();
    install([campaign(1, { rule: { stopAboveMinor: 1000 } }, "running")]);
    mount(<ResultsView {...propsFor("results")} />);
    await screen.findByText("No results yet for this campaign");
  });

  it("enters a day: says what is wrong beside each field, then sends the numbers in minor units", async () => {
    const posted: unknown[] = [];
    install([campaign(1, {}, "running")], { results: { rows: [], linkClicks: [] } });
    const inner = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input), "http://test.local").pathname.endsWith("/campaigns/results") && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ replaced: false }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return inner(input, init);
    }));
    mount(<ResultsView {...propsFor("results")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Enter a day" }));
    fireEvent.change(screen.getByLabelText(/Spend/), { target: { value: "lots" } });
    fireEvent.change(screen.getByLabelText("Clicks"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save this day" }));
    expect((await screen.findByText("Spend and revenue must be amounts such as 12.50.")).getAttribute("role")).toBe("alert");
    expect(screen.getByLabelText("Clicks").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Clicks").getAttribute("aria-describedby")).toBe("entry-clicks-error");
    expect(posted).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Spend/), { target: { value: "12.50" } });
    fireEvent.change(screen.getByLabelText("Clicks"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-12-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save this day" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({ campaignId: 1, source: "manual", rows: [{ day: "2026-12-02", creativeId: null, spend: 1250, revenue: 0, impressions: 0, clicks: 40, orders: 0 }] });
  });

  it("asks to add a campaign first when there is none", async () => {
    install([]);
    mount(<ResultsView {...propsFor("results")} />);
    await screen.findByText("No campaign to show results for");
  });
});

describe("links view and the QR code", () => {
  it("lists a link with its counted clicks and offers a QR code", async () => {
    install([campaign(1, {}, "running")], {
      links: { links: [{ id: 3, campaignId: 1, creativeId: null, creativeLabel: "", baseUrl: "https://s.example/", destination: "https://s.example/?utm_source=meta", utm: { source: "meta", medium: "cpc", campaign: "a", content: "", term: "" }, code: "abcd2345", shortPath: "/l/abcd2345", disabled: false, createdAt: "2026-12-01T00:00:00Z", createdBy: "demo", clicks: 7 }], convention: ["utm_source: where"] },
    });
    mount(<LinksView {...propsFor("links")} />);
    await screen.findByText("7 clicks counted");
    fireEvent.click(screen.getByRole("button", { name: "Show a QR code" }));
    await waitFor(() => expect(document.querySelector('[role="img"] svg')).toBeTruthy());
  });

  it("sends the typed values, and keeps them with the server's reason when the link is refused", async () => {
    install([campaign(1, {}, "running")]);
    const inner = globalThis.fetch;
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input), "http://test.local").pathname.endsWith("/campaigns/links") && init?.method === "POST") {
        sent.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ error: "That host is not on the allowed list." }), { status: 400, headers: { "content-type": "application/json" } });
      }
      return inner(input, init);
    }));
    mount(<LinksView {...propsFor("links")} />);
    fireEvent.change(await screen.findByLabelText(/Page it goes to/), { target: { value: "https://nope.example/x" } });
    fireEvent.change(screen.getByLabelText(/Source \(utm_source\)/), { target: { value: "meta" } });
    fireEvent.click(screen.getByRole("button", { name: "Make the link" }));
    expect((await screen.findByText("That host is not on the allowed list.")).getAttribute("role")).toBe("alert");
    expect(sent).toEqual([{ campaignId: 1, creativeId: null, baseUrl: "https://nope.example/x", source: "meta", medium: "cpc", short: true }]);
    expect((screen.getByLabelText(/Page it goes to/) as HTMLInputElement).value).toBe("https://nope.example/x");
  });

  it("QrCode draws an svg for the address it is given", async () => {
    render(<QrCode value="https://example.com/l/abcd2345" label="qr" />);
    await waitFor(() => expect(document.querySelector("svg")).toBeTruthy());
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("https://example.com/l/abcd2345");
  });
});

beforeEach(() => vi.restoreAllMocks());
