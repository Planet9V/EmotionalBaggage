// @vitest-environment jsdom
// The ad and listing screens against a stand-in API: a live count, red over a limit from the platform
// and amber over a guide, the source link beside a limit, and the empty state. The routes are tested in
// api.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { freshClient, mockServer, row } from "../client/mockServer";
import { findSection, storeKey } from "@/lib/menu";
import type { ViewProps } from "@/components/views/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));

import { AdsView } from "@/components/content/AdsView";
import { LandingView } from "@/components/content/LandingView";

afterEach(cleanup);

function propsFor(stage: string, section: string): ViewProps {
  const f = findSection(stage, section)!;
  return { project: { id: "p1", name: "Acme", oneLiner: "" }, stage: f.stage, section: f.section, store: storeKey(f.stage, f.section) };
}
const mount = (ui: ReactNode) => render(<QueryClientProvider client={freshClient()}>{ui}</QueryClientProvider>);

describe("ads screen", () => {
  it("shows an empty state and the channel's limits with their sources", async () => {
    mockServer([]);
    mount(<AdsView {...propsFor("marketing", "ads")} />);
    expect(await screen.findByText(/No Amazon Sponsored Products ads yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Google Search/i }));
    const table = await screen.findByRole("table", { name: /Fields and limits for Google/i });
    expect(within(table).getAllByRole("link", { name: /platform page/i }).length).toBeGreaterThan(0);
  });

  it("counts live: red over a limit from the platform's page", async () => {
    mockServer([row(1, "marketing/ads", { title: "RSA", status: "draft", data: { channel: "google-search-rsa", fields: { headlines: ["x".repeat(35), "b", "c"], descriptions: ["d", "e"] } } })]);
    mount(<AdsView {...propsFor("marketing", "ads")} />);
    fireEvent.click(await screen.findByRole("button", { name: /Google Search/i }));
    const over = await screen.findByText(/35 \/ 30 over the platform limit by 5/);
    expect(over.className).toMatch(/danger/);
    const input = screen.getByLabelText("Headlines 1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "short" } });
    expect(screen.queryByText(/over the platform limit/)).toBeNull();
    expect(screen.getByText("5 / 30")).toBeTruthy();
  });

  it("amber over a soft guide, and disables export until an ad is approved", async () => {
    mockServer([row(1, "marketing/ads", { title: "Meta", status: "draft", data: { channel: "meta-facebook-feed", fields: { primaryText: "x".repeat(160), headline: "ok" } } })]);
    mount(<AdsView {...propsFor("marketing", "ads")} />);
    fireEvent.click(await screen.findByRole("button", { name: /^Meta, Facebook feed/i }));
    const over = await screen.findByText(/160 \/ 150 over the guide by 10/);
    expect(over.className).toMatch(/warning/);
    expect(screen.queryByRole("link", { name: /Export CSV/i })).toBeNull();
  });

  it("shows the no-proof reason on a flagged ad", async () => {
    mockServer([row(1, "marketing/ads", { title: "RSA", status: "draft", data: { channel: "google-search-rsa", fields: {}, noProof: true, flags: [{ field: "headline", text: "Lasts 7 days", kind: "number", reason: "Lasts 7 days has a number and no linked proof." }] } })]);
    mount(<AdsView {...propsFor("marketing", "ads")} />);
    fireEvent.click(await screen.findByRole("button", { name: /Google Search/i }));
    expect(await screen.findByText(/cannot be approved yet/i)).toBeTruthy();
    expect(screen.getByText(/has a number and no linked proof/)).toBeTruthy();
  });
});

describe("landing screen", () => {
  it("says the preview is not published and lists sections with move buttons", async () => {
    mockServer([
      row(1, "marketing/landing", { title: "Hero", status: "draft", data: { kind: "hero", order: 0, content: { headline: "H" } } }),
      row(2, "marketing/landing", { title: "FAQ", status: "draft", data: { kind: "faq", order: 1, content: { heading: "Q", items: [{ q: "a", a: "b" }] } } }),
    ]);
    mount(<LandingView {...propsFor("marketing", "landing")} />);
    expect(await screen.findByText(/Public preview, not published/)).toBeTruthy();
    const up = await screen.findByRole("button", { name: "Move Hero up" });
    expect((up as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move Hero down" }) as HTMLButtonElement).disabled).toBe(false);
    // the zip needs every section approved
    expect(screen.queryByRole("link", { name: /Export zip/i })).toBeNull();
  });
});
