// @vitest-environment jsdom
// Forms inside the larger screens, on react-hook-form with a zod resolver: the problem is shown beside the field,
// nothing is sent while a field is invalid, and what is sent once valid is what the form sent before.
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

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("ask=Is the battery safe on a plane?") }));

import { ResearchView } from "@/components/views/ResearchView";
import { LaunchView } from "@/components/campaigns/LaunchView";
import { PricingView } from "@/components/market/PricingView";
import { MonitorView } from "@/components/views/MonitorView";
import { ReviewsView } from "@/components/channels/ReviewsView";

afterEach(cleanup);

const propsFor = (stage: string, section: string): ViewProps => {
  const f = findSection(stage, section)!;
  return { project: { id: "p1", name: "Acme", oneLiner: "" }, stage: f.stage, section: f.section, store: storeKey(f.stage, f.section) };
};
const mount = (ui: ReactNode) => render(<QueryClientProvider client={freshClient()}>{ui}</QueryClientProvider>);
const posts = (srv: ReturnType<typeof mockServer>) => srv.calls.filter((c) => c.method === "POST");

describe("LaunchView, start a launch", () => {
  it("asks for the launch date beside the field and starts nothing until it is given", async () => {
    const srv = mockServer([]);
    mount(<LaunchView {...propsFor("marketing", "launch")} />);
    const start = await screen.findByRole("button", { name: /^Start the .* launch$/ });
    fireEvent.click(start);
    const message = await screen.findByText("Pick the launch date first. Every step's due date is counted back from it.");
    expect(message.getAttribute("role")).toBe("alert");
    expect(screen.getAllByLabelText("Launch date")[0].getAttribute("aria-invalid")).toBe("true");
    expect(posts(srv)).toHaveLength(0);
  });
});

describe("PricingView, a price to consider", () => {
  it("refuses zero beside the field and adds the price in minor units once valid", async () => {
    const srv = mockServer([row(1, "marketing/pricing", { title: "$25.00", data: { kind: "price", priceMinor: 2500, currency: "USD" }, status: "draft" })]);
    mount(<PricingView {...propsFor("marketing", "pricing")} />);
    const field = await screen.findByLabelText(/A price to consider/);
    fireEvent.change(field, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Add price/ }));
    expect((await screen.findByText("Enter a price above zero, such as 24.95.")).getAttribute("role")).toBe("alert");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(posts(srv)).toHaveLength(0);
    fireEvent.change(field, { target: { value: "24.95" } });
    fireEvent.click(screen.getByRole("button", { name: /Add price/ }));
    await waitFor(() => expect(posts(srv)).toHaveLength(1));
    expect(posts(srv)[0].body).toMatchObject({ data: { kind: "price", priceMinor: 2495 } });
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(""));
  });
});

describe("MonitorView, add a sales row", () => {
  it("says what is wrong beside each field, then adds the row with numbers", async () => {
    const srv = mockServer([]);
    mount(<MonitorView {...propsFor("sales", "monitor")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add row" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Units"), { target: { value: "1.5" } });
    fireEvent.change(within(dialog).getByLabelText("Revenue"), { target: { value: "lots" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add row" }));
    expect(await within(dialog).findByText("Name the channel.")).toBeTruthy();
    expect(within(dialog).getByText("Units must be a whole number.")).toBeTruthy();
    expect(within(dialog).getByText("Revenue must be a number.")).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByLabelText("Channel"));
    expect(posts(srv)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Channel"), { target: { value: " Own site " } });
    fireEvent.change(within(dialog).getByLabelText("Units"), { target: { value: "3" } });
    fireEvent.change(within(dialog).getByLabelText("Revenue"), { target: { value: "45.50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add row" }));
    await waitFor(() => expect(posts(srv)).toHaveLength(1));
    expect(posts(srv)[0].body).toMatchObject({ data: { channel: "Own site", units: 3, revenue: 45.5, source: "hand" } });
  });
});

describe("ReviewsView, add a review", () => {
  it("asks for the text beside the field, then adds the review with the first line as its title", async () => {
    const srv = mockServer([]);
    mount(<ReviewsView {...propsFor("sales", "reviews")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add review or question" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    expect((await within(dialog).findByText("Write or paste what the customer said.")).getAttribute("role")).toBe("alert");
    expect(within(dialog).getByLabelText("What they wrote").getAttribute("aria-invalid")).toBe("true");
    expect(posts(srv)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("What they wrote"), { target: { value: "  Great battery\nbut loud  " } });
    fireEvent.change(within(dialog).getByLabelText("Rating (1 to 5)"), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(posts(srv)).toHaveLength(1));
    expect(posts(srv)[0].body).toMatchObject({ title: "Great battery", body: "Great battery\nbut loud", data: { kind: "review", rating: 4 } });
  });
});

describe("ResearchView, ask a question", () => {
  it("fills the question from the link, sends it trimmed, and clears the box after the answer", async () => {
    const srv = mockServer([]);
    const inner = globalThis.fetch;
    const asked: unknown[] = [];
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://test.local").pathname;
      if (path === "/api/research" && init?.method === "POST") {
        asked.push(JSON.parse(String(init.body)));
        return json({ entry: { id: 1, query: "q", answer: "a", citations: [], model: "m", createdAt: "2026-11-22T00:00:00Z" }, attached: null, effort: null, costUsd: null });
      }
      if (path === "/api/research") return json({ configured: true, model: "fast", entries: [] });
      return inner(input, init);
    }));
    mount(<ResearchView {...propsFor("research", "ask")} />);
    const box = (await screen.findByLabelText("Question")) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("Is the battery safe on a plane?"));
    fireEvent.change(box, { target: { value: "  Is the battery safe on a plane?  " } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toEqual({ projectId: "p1", query: "Is the battery safe on a plane?" });
    await waitFor(() => expect(box.value).toBe(""));
    expect(srv.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });
});
