// @vitest-environment jsdom
// The process screens: the stepper's stage states, Advance held back until the gate is passed,
// Override needing a reason and showing the server's refusal, the next-step strip, and the
// section banner for decisions not yet made. The API is a stand-in fetch; the routes are tested in tests/api/process.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { ProcessContext } from "./processContext";
import { ProcessStepper } from "@/components/process/ProcessStepper";
import { NextStepStrip } from "@/components/process/NextStepStrip";
import { SectionLockBanner } from "@/components/process/SectionLockBanner";
import { processView } from "@/lib/process/client";
import type { ProcessResponse } from "@/lib/process/state";
import type { Item } from "@/lib/types";
import { VERIFIED } from "../research/verified";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const base = (o: Partial<ProcessResponse> = {}): ProcessResponse => ({
  projectId: "toy", name: "Wooden toy", oneLiner: "A pull-along duck", productType: "physical", stage: "research", gates: [], history: [], facts: { currency: "USD", erc: null }, skipped: [], ...o,
});
let id = 1;
const row = (section: string, status: string, data: Record<string, unknown> = {}, title = `row ${id}`): Item => ({ id: id++, projectId: "toy", section, title, body: "", data, status, sort: id });

describe("ProcessStepper", () => {
  it("marks stages before the current one done, the current one current, the rest upcoming", () => {
    const view = processView(base({ stage: "design" }), []);
    renderWithClient(<ProcessStepper projectId="toy" view={view} />);
    expect(screen.getByTestId("stage-concept").dataset.position).toBe("done");
    expect(screen.getByTestId("stage-research").dataset.position).toBe("done");
    const design = screen.getByTestId("stage-design");
    expect(design.dataset.position).toBe("current");
    expect(design.getAttribute("aria-current")).toBe("step");
    expect(screen.getByTestId("stage-sales").dataset.position).toBe("upcoming");
    // Only the current stage is open; it lists its checks with what fixes them.
    expect(within(design).getByText("At least one requirement is written")).toBeTruthy();
    expect(within(design).getByRole("link", { name: "Draft Requirements with AI, or add a row by hand" }).getAttribute("href")).toBe("/s/design/requirements#draft-with-ai");
    expect(within(screen.getByTestId("stage-sales")).queryByText("At least one sales channel is set")).toBeNull();
    // A done stage can be moved back to.
    expect(within(screen.getByTestId("stage-concept")).getByRole("button", { name: /Move back to Concept/ })).toBeTruthy();
  });

  it("holds Advance back until the gate is passed, and says why", () => {
    const view = processView(base(), []);
    renderWithClient(<ProcessStepper projectId="toy" view={view} />);
    const advance = screen.getByRole("button", { name: /Advance to Design/ }) as HTMLButtonElement;
    expect(advance.disabled).toBe(true);
    expect(screen.getByText("Meet every check, or override the gate with a reason, to advance.")).toBeTruthy();
    expect(within(screen.getByTestId("stage-research")).getByText("2 checks to meet")).toBeTruthy();
  });

  it("an overridden gate shows who, when and why, and Advance posts the next stage", async () => {
    const state = base({ gates: [{ stage: "research", status: "go", overridden: true, note: "Checked with the supplier", decidedBy: "demo", decidedAt: "2026-11-20T10:00:00.000Z" }] });
    const { calls } = adminServer([on("POST", "/api/projects/toy/stage", () => ({ body: { ...state, stage: "design" } }))]);
    renderWithClient(<ProcessStepper projectId="toy" view={processView(state, [])} />);
    const research = screen.getByTestId("stage-research");
    expect(within(research).getByText("Passed by override")).toBeTruthy();
    expect(within(research).getByText(/Overridden by demo on .*Reason: Checked with the supplier/)).toBeTruthy();
    expect(within(research).queryByRole("button", { name: "Override with a reason" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Advance to Design/ }));
    await waitFor(() => expect(calls).toContainEqual({ method: "POST", path: "/api/projects/toy/stage", body: { stage: "design" } }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Moved to Design."));
  });

  it("a met gate needs no override", () => {
    const rows = [row("research/claims", "verified", VERIFIED)];
    renderWithClient(<ProcessStepper projectId="toy" view={processView(base(), rows)} />);
    expect(within(screen.getByTestId("stage-research")).getByText("Met")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Override with a reason" })).toBeNull();
    expect((screen.getByRole("button", { name: /Advance to Design/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Override asks for a reason, sends it, and shows the server's refusal in the dialog", async () => {
    const { calls } = adminServer([on("POST", "/api/projects/toy/gates", () => ({ status: 409, body: { error: "Every check of the Research gate is met, so there is nothing to override." } }))]);
    renderWithClient(<ProcessStepper projectId="toy" view={processView(base(), [])} />);
    fireEvent.click(screen.getByRole("button", { name: "Override with a reason" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/At least one claim is recorded/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Override gate" }));
    // The form checks the reason before it sends anything (react-hook-form validates asynchronously).
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Type the reason for passing this gate without its checks.");
    expect(within(dialog).getByLabelText("Reason").getAttribute("aria-invalid")).toBe("true");
    expect(calls).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No outside claims in this plan" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Override gate" }));
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toContain("nothing to override"));
    expect(calls).toEqual([{ method: "POST", path: "/api/projects/toy/gates", body: { stage: "research", reason: "No outside claims in this plan" } }]);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("the optional why on moving back and withdrawing an override (process review 3)", () => {
  it("Move back asks for an optional reason, sends it, and sends none when left empty", async () => {
    const state = base({ stage: "design" });
    const { calls } = adminServer([on("POST", "/api/projects/toy/stage", () => ({ body: { ...state, stage: "concept" } }))]);
    renderWithClient(<ProcessStepper projectId="toy" view={processView(state, [])} />);
    fireEvent.click(within(screen.getByTestId("stage-concept")).getByRole("button", { name: /Move back to Concept/ }));
    let dialog = await screen.findByRole("dialog");
    expect(calls).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Why (kept in the history)"), { target: { value: "The brief changed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move back" }));
    await waitFor(() => expect(calls).toEqual([{ method: "POST", path: "/api/projects/toy/stage", body: { stage: "concept", why: "The brief changed" } }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Moved back to Concept."));
    cleanup();
    calls.length = 0;
    renderWithClient(<ProcessStepper projectId="toy" view={processView(state, [])} />);
    fireEvent.click(within(screen.getByTestId("stage-concept")).getByRole("button", { name: /Move back to Concept/ }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Move back" }));
    await waitFor(() => expect(calls).toEqual([{ method: "POST", path: "/api/projects/toy/stage", body: { stage: "concept" } }]));
  });

  it("Withdraw override asks for an optional reason first", async () => {
    const state = base({ gates: [{ stage: "research", status: "go", overridden: true, note: "Checked", decidedBy: "demo", decidedAt: "2026-11-20T10:00:00.000Z" }] });
    const { calls } = adminServer([on("DELETE", "/api/projects/toy/gates", () => ({ body: base() }))]);
    renderWithClient(<ProcessStepper projectId="toy" view={processView(state, [])} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw override" }));
    const dialog = await screen.findByRole("dialog");
    expect(calls).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText("Why (kept in the history)"), { target: { value: "Evidence arrived" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw override" }));
    await waitFor(() => expect(calls).toEqual([{ method: "DELETE", path: "/api/projects/toy/gates", body: { stage: "research", why: "Evidence arrived" } }]));
  });
});

describe("NextStepStrip", () => {
  it("shows the next step and why for the open concept", async () => {
    adminServer([
      on("GET", "/api/projects/toy/process", () => ({ body: base({ stage: "concept" }) })),
      on("GET", "/api/projects/toy/items", () => ({ body: { items: [{ ...row("concept/story", "draft", { part: "pitch" }), body: "A toy that teaches knots." }, row("concept/files", "stored", { fileId: 1 }), row("concept/brief", "open")] } })),
    ]);
    renderWithClient(<ProcessContext projectId="toy"><NextStepStrip /></ProcessContext>);
    const strip = await screen.findByTestId("next-step-strip");
    expect(within(strip).getByRole("link", { name: "Add 2 more brief lines" }).getAttribute("href")).toBe("/s/concept/brief#add-row");
    expect(strip.textContent).toContain("Why: The Concept gate needs this: the brief has at least three lines. 1 brief line recorded, 3 needed.");
  });

  it("says when the next step cannot be worked out, with a retry", async () => {
    adminServer([on("GET", "/api/projects/toy/process", () => ({ status: 500, body: { error: "The server could not complete the request." } }))]);
    renderWithClient(<ProcessContext projectId="toy"><NextStepStrip /></ProcessContext>);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be worked out");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("renders nothing with no concept open", () => {
    const { container } = renderWithClient(<NextStepStrip />);
    expect(container.textContent).toBe("");
  });
});

describe("a stage entered behind an unpassed gate (process review 4)", () => {
  it("the next-step strip says so, with Show what is missing and Move back to Concept", async () => {
    const { calls } = adminServer([
      on("GET", "/api/projects/toy/process", () => ({ body: base({ stage: "research" }) })),
      on("GET", "/api/projects/toy/items", () => ({ body: { items: [] } })),
      on("POST", "/api/projects/toy/stage", () => ({ body: base({ stage: "concept" }) })),
    ]);
    renderWithClient(<ProcessContext projectId="toy"><NextStepStrip /></ProcessContext>);
    const note = await screen.findByTestId("skipped-concept");
    expect(note.textContent).toContain("Research was entered without passing the Concept gate.");
    expect(within(note).getByRole("link", { name: "Show what is missing" }).getAttribute("href")).toBe("/process#gate-concept");
    fireEvent.click(within(note).getByRole("button", { name: "Move back to Concept" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Move back" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/projects/toy/stage")).toBe(true));
  });

  it("shows nothing when the earlier gates pass or are overridden", async () => {
    const state = base({ stage: "research", gates: [{ stage: "concept", status: "go", overridden: true, note: "ok", decidedBy: "demo", decidedAt: "2026-11-20T10:00:00.000Z" }] });
    adminServer([on("GET", "/api/projects/toy/process", () => ({ body: state })), on("GET", "/api/projects/toy/items", () => ({ body: { items: [] } }))]);
    renderWithClient(<ProcessContext projectId="toy"><NextStepStrip /></ProcessContext>);
    await screen.findByTestId("next-step-strip");
    expect(screen.queryByTestId("skipped-concept")).toBeNull();
  });

  it("Show what is missing opens the earlier stage's checks on the Process page", async () => {
    renderWithClient(<ProcessStepper projectId="toy" view={processView(base({ stage: "research" }), [])} />);
    const concept = screen.getByTestId("stage-concept");
    expect(within(concept).queryByText("The concept has a one-line description")).toBeNull();
    act(() => window.dispatchEvent(new CustomEvent("process:reveal", { detail: "concept" })));
    expect(await within(concept).findByText("The concept has a one-line description")).toBeTruthy();
  });
});

describe("SectionLockBanner", () => {
  const decision = (key: string, chosen: string, unlocks: string[], title: string) => row("concept/decisions", chosen ? "decided" : "open", { key, chosen, unlocks, options: [] }, title);

  it("names each undecided decision that unlocks the section and links to the decision tree", async () => {
    adminServer([on("GET", "/api/projects/toy/items?section=concept%2Fdecisions", () => ({
      body: { items: [decision("go", "", ["prototype/sourcing"], "Build the first batch?"), decision("finish", "oil", ["design/bom"], "Which finish?")] },
    }))]);
    renderWithClient(<SectionLockBanner projectId="toy" stageKey="design" sectionKey="bom" />);
    const banner = await screen.findByTestId("section-lock-banner");
    expect(banner.textContent).toContain("A decision that opens this section is not made yet.");
    expect(banner.textContent).toContain("Build the first batch?");
    expect(banner.textContent).not.toContain("Which finish?");
    expect(within(banner).getByRole("link", { name: "Open the decision tree" }).getAttribute("href")).toBe("/s/concept/decisions");
  });

  it("shows nothing when every unlocking decision is made", async () => {
    const { calls } = adminServer([on("GET", "/api/projects/toy/items?section=concept%2Fdecisions", () => ({ body: { items: [decision("go", "yes", ["design/bom"], "Build?")] } }))]);
    renderWithClient(<SectionLockBanner projectId="toy" stageKey="design" sectionKey="bom" />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByTestId("section-lock-banner")).toBeNull();
  });
});
