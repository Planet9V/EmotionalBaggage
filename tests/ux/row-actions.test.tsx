// @vitest-environment jsdom
// U5: "Challenge this" and "Verify this" on every dedicated view's row or card, from one shared menu that
// the keyboard reaches and whose name carries the row's title.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { RowActions } from "@/components/drafts/RowActions";
import { ItemsTable } from "@/components/items/ItemsTable";
import { Kanban } from "@/components/items/Kanban";
import type { Item } from "@/lib/types";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const row = { id: 7, projectId: "p1", section: "marketing/personas", title: "Weekend fixer", body: "Owns a garage" };

describe("RowActions", () => {
  it("opens by keyboard, verifies through Research and challenges through the reviewer", async () => {
    const { calls } = adminServer([on("POST", "/api/challenge", () => ({ body: { reply: "The weakest part is the price.", itemId: 7 } }))]);
    renderWithClient(<RowActions item={row} />);
    const trigger = screen.getByRole("button", { name: "Ask the assistant about Weekend fixer" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const verify = await screen.findByRole("menuitem", { name: /Verify this/ });
    expect(verify.getAttribute("href")).toContain("/s/research/ask?ask=Weekend+fixer");
    fireEvent.click(screen.getByRole("menuitem", { name: /Challenge this/ }));
    expect(await screen.findByText("The weakest part is the price.")).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.path === "/api/challenge" && (c.body as { itemId: number }).itemId === 7)).toBe(true));
  });

  it("without a model says so and links to Admin, Models", async () => {
    adminServer([on("POST", "/api/challenge", () => ({ status: 503, body: { error: "No reasoning model is chosen. Choose one in Admin, Models." } }))]);
    renderWithClient(<RowActions item={row} />);
    const trigger = screen.getByRole("button", { name: /Weekend fixer/ });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Challenge this/ }));
    expect((await screen.findByRole("link", { name: "Open Admin, Models" })).getAttribute("href")).toBe("/admin?tab=models");
  });
});

describe("every dedicated view has the menu", () => {
  const VIEWS: Record<string, string> = {
    "parts list": "src/components/views/BomView.tsx",
    sourcing: "src/components/sourcing/PartCard.tsx",
    decisions: "src/components/decisions/DecisionDetail.tsx",
    "schematic wires": "src/components/schematic/SidePanel.tsx",
    wiring: "src/components/buildsheet/StepCard.tsx",
    builds: "src/components/builds/BuildsView.tsx",
    personas: "src/components/market/PersonasView.tsx",
    competitors: "src/components/market/CompetitorsView.tsx",
    positioning: "src/components/market/PositioningView.tsx",
    pricing: "src/components/market/PricingView.tsx",
    names: "src/components/market/NamesView.tsx",
    brand: "src/components/market/BrandView.tsx",
    imagery: "src/components/market/ImageryView.tsx",
    "landing sections": "src/components/content/LandingView.tsx",
    ads: "src/components/content/AdsView.tsx",
    "social posts": "src/components/views/SocialView.tsx",
    campaigns: "src/components/campaigns/CampaignBoard.tsx",
    "launch steps": "src/components/campaigns/LaunchView.tsx",
    listing: "src/components/content/ListingView.tsx",
    announce: "src/components/content/LaunchView.tsx",
    reviews: "src/components/channels/ReviewsView.tsx",
    batches: "src/components/production/BatchesView.tsx",
    compliance: "src/components/compliance/ComplianceView.tsx",
    // wherever a row can be opened: the generic list and board, and the rows and cards of the other views
    "list rows": "src/components/items/ItemsTable.tsx",
    "board cards": "src/components/items/Kanban.tsx",
    "print jobs": "src/components/printing/JobCard.tsx",
    "mentions and comments": "src/components/channels/InboxView.tsx",
    replies: "src/components/channels/RepliesView.tsx",
    "plan step": "src/components/plan/StepDetail.tsx",
    "file entry": "src/components/story/FilesView.tsx",
    "cost lines": "src/components/economics/BuildUpTable.tsx",
  };
  for (const [what, file] of Object.entries(VIEWS))
    it(what, () => {
      expect(readFileSync(file, "utf8")).toMatch(/<RowActions\b/);
    });
});

describe("the menu is on the generic list and board, where any row can be opened", () => {
  const item = (id: number, title: string): Item => ({ id, projectId: "p1", section: "concept/questions", title, body: "", data: {}, status: "open", sort: id });
  const props = { items: [item(1, "Which name ships?"), item(2, "Primary channel")], statuses: ["open", "decided"], columns: [], onOpen: () => {} };

  it("every table row has it, named with the row's title", () => {
    adminServer([]);
    renderWithClient(<ItemsTable {...props} onStatus={() => {}} />);
    for (const t of ["Which name ships?", "Primary channel"]) expect(screen.getByRole("button", { name: `Ask the assistant about ${t}` })).toBeTruthy();
  });

  it("every board card has it, named with the card's title", () => {
    adminServer([]);
    renderWithClient(<Kanban {...props} onMove={() => {}} />);
    for (const t of ["Which name ships?", "Primary channel"]) expect(screen.getByRole("button", { name: `Ask the assistant about ${t}` })).toBeTruthy();
  });
});
