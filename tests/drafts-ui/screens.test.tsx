// @vitest-environment jsdom
// The drafting screens (src/components/drafts) against a fetch stand-in: the button says what it will
// read, explains and links to Admin without a model, runs and shows what was kept and left out, asks to
// confirm before superseding, shows the model layer's sentence with Retry, and the review card approves,
// rejects (rolling back on refusal with the server's reason) and shows before and after for a change.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { DraftButton } from "@/components/drafts/DraftButton";
import { DraftCard, changes } from "@/components/drafts/DraftCard";
import { meaningful } from "@/components/drafts/ImpactNotice";
import { verifyHref } from "@/components/drafts/RowAssist";
import type { Draft, GeneratorsReply, RunResult } from "@/lib/ai/drafts/shared";
import type { Item } from "@/lib/types";
import { adminServer, on, renderWithClient, shimBrowser, type Call } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const P = "p1";
const STORE = "design/requirements";

const gens = (o: Partial<GeneratorsReply> = {}, g: Partial<GeneratorsReply["generators"][number]> = {}): GeneratorsReply => ({
  configured: true,
  reason: "",
  model: "qwen-test",
  generators: [
    { id: "requirements", label: "Requirements", action: "Draft requirements", from: ["concept/brief"], to: STORE, kind: "section", counts: { "concept/brief": 2 }, reads: 2, readsText: "from 2 brief lines", blocked: "", pending: 0, ...g },
  ],
  ...o,
});

const draft = (o: Partial<Draft> = {}): Draft => ({
  id: 11,
  projectId: P,
  generator: "requirements",
  targetStore: STORE,
  title: "Dims within 2 minutes",
  body: "Test by leaving the room.",
  data: { key: "req-1" },
  op: { op: "add" },
  sources: [{ kind: "item", id: 5, title: "Who it is for", section: "concept/brief" }],
  model: "qwen-test",
  provider: "ollama",
  status: "draft",
  runId: "11111111-1111-4111-8111-111111111111",
  reason: "",
  createdAt: "2026-11-20T10:00:00.000Z",
  decidedAt: null,
  decidedBy: null,
  itemId: null,
  ...o,
});

const row = (o: Partial<Item> = {}): Item => ({ id: 40, projectId: P, section: STORE, title: "Old title", body: "Old", data: { key: "req-1" }, status: "open", sort: 1, ...o });

const items = on("GET", `/api/projects/${P}/items?section=${encodeURIComponent(STORE)}`, () => ({ body: { items: [row()] } }));
const listOf = (drafts: Draft[]) => on("GET", `/api/drafts?projectId=${P}&status=draft&store=${encodeURIComponent(STORE)}`, () => ({ body: { drafts, pending: { [STORE]: drafts.length } } }));
const genRoute = (r: GeneratorsReply) => on("GET", `/api/drafts/generators?projectId=${P}&kind=section&store=${encodeURIComponent(STORE)}`, () => ({ body: r }));

/** Waits for the button to finish loading (its hint shows), then opens the panel. */
async function openPanel() {
  await screen.findByText("from 2 brief lines");
  fireEvent.click(screen.getByRole("button", { name: /^Draft with AI/ }));
}

describe("Draft with AI", () => {
  it("says what it will read, and counts what is waiting", async () => {
    adminServer([genRoute(gens({}, { pending: 3 }))]);
    renderWithClient(<DraftButton projectId={P} store={STORE} sectionLabel="Requirements" />);
    expect(await screen.findByText("from 2 brief lines")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Draft with AI/ }).textContent).toContain("3 waiting");
  });

  it("is not shown where no generator writes the section", async () => {
    const { calls } = adminServer([genRoute(gens({ generators: [] }))]);
    const { container } = renderWithClient(<DraftButton projectId={P} store={STORE} sectionLabel="Requirements" />);
    await waitFor(() => expect(calls.length).toBe(1));
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("without a model explains and links to Admin, Models, and runs nothing", async () => {
    const { calls } = adminServer([genRoute(gens({ configured: false, reason: "No reasoning model is chosen. Choose one in Admin, Models.", model: "" })), listOf([])]);
    renderWithClient(<DraftButton projectId={P} store={STORE} sectionLabel="Requirements" />);
    expect(await screen.findByText("No reasoning model is chosen")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Draft with AI/ }));
    const link = await screen.findByRole("link", { name: "Choose a model" });
    expect(link.getAttribute("href")).toBe("/admin?tab=models");
    expect(screen.queryByRole("button", { name: "Draft requirements" })).toBeNull();
    expect(calls.some((c) => c.path === "/api/drafts/run")).toBe(false);
  });

  it("runs, shows what was kept and what was left out, and lists the drafts for review", async () => {
    const kept = draft();
    const result: RunResult = { runId: kept.runId, generator: "requirements", targetStore: STORE, drafts: [kept], dropped: [{ title: "(untitled row)", reason: "it has no title" }], superseded: 0, model: "qwen-test", provider: "ollama", path: "structured", notes: [] };
    let ran = false;
    const { calls } = adminServer([
      genRoute(gens()),
      on("POST", "/api/drafts/run", () => ((ran = true), { status: 201, body: result })),
      on("GET", `/api/drafts?projectId=${P}&status=draft&store=${encodeURIComponent(STORE)}`, () => ({ body: { drafts: ran ? [kept] : [], pending: {} } })),
      items,
    ]);
    renderWithClient(<DraftButton projectId={P} store={STORE} sectionLabel="Requirements" />);
    await openPanel();
    expect(await screen.findByText(/No drafts are waiting/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Draft requirements" }));
    expect(await screen.findByText(/1 draft saved for review, 1 left out/)).toBeTruthy();
    expect(screen.getByText(/it has no title/)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Dims within 2 minutes" })).toBeTruthy();
    expect(screen.getByText("Made from 1 row")).toBeTruthy();
    expect(calls.find((c) => c.path === "/api/drafts/run")!.body).toEqual({ projectId: P, generator: "requirements", supersede: false });
  });

  it("asks before superseding earlier drafts, then sends supersede", async () => {
    const runs: Call[] = [];
    adminServer([
      genRoute(gens({}, { pending: 2 })),
      on("POST", "/api/drafts/run", (c) => {
        runs.push(c);
        return (c.body as { supersede?: boolean }).supersede
          ? { status: 201, body: { runId: "r", generator: "requirements", targetStore: STORE, drafts: [], dropped: [], superseded: 2, model: "m", provider: "ollama", path: "structured", notes: [] } }
          : { status: 409, body: { error: "2 drafts are still waiting.", detail: { pending: 2 } } };
      }),
      listOf([]),
      items,
    ]);
    renderWithClient(<DraftButton projectId={P} store={STORE} sectionLabel="Requirements" />);
    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Draft requirements" }));
    const ask = await screen.findByRole("alertdialog", { name: "Earlier drafts are waiting" });
    expect(ask.textContent).toContain("2 drafts from an earlier run are still waiting");
    fireEvent.click(within(ask).getByRole("button", { name: "Run again" }));
    expect(await screen.findByText(/2 earlier drafts superseded/)).toBeTruthy();
    expect(runs.map((r) => (r.body as { supersede?: boolean }).supersede)).toEqual([false, true]);
  });

  it("a model failure shows the model layer's sentence with Retry", async () => {
    let n = 0;
    adminServer([
      genRoute(gens()),
      on("POST", "/api/drafts/run", () => (++n === 1 ? { status: 504, body: { error: "Ollama at http://x/v1 did not answer within 2 min." } } : { status: 201, body: { runId: "r", generator: "requirements", targetStore: STORE, drafts: [], dropped: [], superseded: 0, model: "m", provider: "ollama", path: "structured", notes: [] } })),
      listOf([]),
      items,
    ]);
    renderWithClient(<DraftButton projectId={P} store={STORE} sectionLabel="Requirements" />);
    await openPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Draft requirements" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("did not answer within 2 min");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/0 drafts saved for review/)).toBeTruthy();
  });
});

describe("the review card", () => {
  it("approve sends the approval", async () => {
    const { calls } = adminServer([on("POST", "/api/drafts/11/approve", () => ({ body: { draft: draft({ status: "approved" }), item: row(), before: null } }))]);
    renderWithClient(<DraftCard draft={draft()} />);
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/drafts/11/approve")).toBe(true));
  });

  it("a substitute part that drops a price asks first, names the old price, and keeps it as was (F3)", async () => {
    const { calls } = adminServer([on("POST", "/api/drafts/12/approve", () => ({ body: { draft: draft({ id: 12, status: "approved" }), item: row(), before: null } }))]);
    const part = row({ id: 41, section: "design/bom", title: "Dev board", data: { ref: "U1", line: 12 } });
    const sub = draft({ id: 12, generator: "optimise-cost", targetStore: "design/bom", title: "Bare module", data: { ref: "U1", wasLine: 12 }, op: { op: "replace", reason: "Cheaper" }, itemId: 41 });
    renderWithClient(<DraftCard draft={sub} current={part} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve (removes the price)" }));
    const ask = screen.getByRole("alertdialog", { name: /removes this part's price/ });
    expect(ask.textContent).toContain("(12.00) out of the parts total");
    expect(ask.textContent).toContain('"was 12.00"');
    expect(calls.some((c) => c.path === "/api/drafts/12/approve")).toBe(false);
    fireEvent.click(within(ask).getByRole("button", { name: "Approve and remove the price" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/drafts/12/approve")).toBe(true));
  });

  it("an approved press release is attacked by the server: the browser does not call the reviewer", async () => {
    const press = draft({ targetStore: "concept/press", generator: "press-release", title: "Doorbell" });
    const { calls } = adminServer([
      on("POST", "/api/drafts/11/approve", () => ({ body: { draft: { ...press, status: "approved" }, item: row({ id: 77, section: "concept/press" }), before: null } })),
      on("POST", "/api/challenge", () => ({ body: { reply: "Who pays?", itemId: 77 } })),
    ]);
    renderWithClient(<DraftCard draft={press} />);
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/drafts/11/approve")).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.filter((c) => c.path === "/api/challenge")).toHaveLength(0);
  });

  it("a refused rejection shows the server's reason", async () => {
    adminServer([on("POST", "/api/drafts/11/reject", () => ({ status: 409, body: { error: "This draft was already approved by demo." } }))]);
    renderWithClient(<DraftCard draft={draft()} />);
    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("This draft was already approved by demo.");
  });

  it("edit then save sends the edited fields", async () => {
    const { calls } = adminServer([on("PATCH", "/api/drafts/11", (c) => ({ body: { draft: draft({ title: (c.body as { title: string }).title }) } }))]);
    renderWithClient(<DraftCard draft={draft()} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit the draft/ }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Dims within 90 s" } });
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "req-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ title: "Dims within 90 s", body: "Test by leaving the room.", data: { key: "req-9" } });
  });

  it("a change to a row shows before and after", () => {
    adminServer([]);
    renderWithClient(<DraftCard draft={draft({ op: { op: "replace", reason: "The requirement changed" }, itemId: 40, title: "New title", data: { key: "req-1", pass: "1 s" } })} current={row()} />);
    const table = screen.getByRole("table", { name: "Before and after" });
    expect(within(table).getByText("Old title")).toBeTruthy();
    expect(within(table).getByText("New title")).toBeTruthy();
    expect(within(table).getByText("pass")).toBeTruthy();
    expect(screen.getByText("The requirement changed")).toBeTruthy();
  });

  it("a change to a row that no longer exists cannot be approved", () => {
    adminServer([]);
    renderWithClient(<DraftCard draft={draft({ op: { op: "replace" }, itemId: 40 })} current={null} />);
    expect(screen.getByRole("alert").textContent).toContain("no longer exists");
    expect((screen.getByRole("button", { name: /Approve/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("helpers", () => {
  it("changes lists only the fields that differ", () => {
    expect(changes(row(), draft({ title: "Old title", body: "Old", data: { key: "req-1", extra: 2 } }))).toEqual([{ field: "extra", was: "(empty)", now: "2" }]);
  });

  it("a change worth an impact check: watched sections, and not positions or status alone", () => {
    expect(meaningful({ section: "design/bom" }, { data: { geometry: {} } })).toBe(false);
    expect(meaningful({ section: "design/bom" }, { status: "ordered" })).toBe(false);
    expect(meaningful({ section: "design/bom" }, { data: { line: 3 } })).toBe(true);
    expect(meaningful({ section: "concept/decisions" }, { status: "decided", data: { chosen: "a" } })).toBe(true);
    expect(meaningful({ section: "design/requirements" }, { title: "x" })).toBe(true);
    expect(meaningful({ section: "concept/brief" }, { title: "x" })).toBe(false);
  });

  it("Verify this fills the question and, for a claim, chooses it", () => {
    expect(verifyHref({ id: 3, section: "research/claims", title: "AA cells last 6 months", body: "" })).toBe("/s/research/ask?ask=AA+cells+last+6+months&item=3&claim=3");
    expect(verifyHref({ id: 4, section: "design/requirements", title: "Power", body: "Sleep under 200 µA" })).toBe("/s/research/ask?ask=Power%3A+Sleep+under+200+%C2%B5A&item=4");
  });
});
