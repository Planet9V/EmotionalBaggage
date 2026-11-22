// @vitest-environment jsdom
// Plans 3.4, 3.5 and 3.7 in the browser: the History tab, the link picker, the traceability matrix, the activity page and the build cards.
// The API is a stand-in fetch; the real routes are tested in tests/trace.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ProjectContext, type ProjectState } from "@/lib/client";
import { freshClient } from "./mockServer";
import type { Item } from "@/lib/types";
import type { HistoryEntry } from "@/lib/trace/history";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { ItemDrawer } from "@/components/items/ItemDrawer";
import { HistoryPanel } from "@/components/trace/HistoryPanel";
import { LinkPicker } from "@/components/trace/LinkPicker";
import { TraceabilityView } from "@/components/trace/TraceabilityView";
import { ActivityView } from "@/components/trace/ActivityView";
import { BuildsView } from "@/components/builds/BuildsView";
import { ReportProcess } from "@/components/process/ReportProcess";
import { ComplianceView } from "@/components/compliance/ComplianceView";
import { findSection } from "@/lib/menu";

const P = "p1";
const item = (id: number, section: string, title: string, extra: Partial<Item> = {}): Item => ({ id, projectId: P, section, title, body: "", data: {}, status: "open", sort: id, ...extra });

type Call = { method: string; path: string; body: unknown };
let calls: Call[] = [];
let db: Item[] = [];
let history: Record<number, HistoryEntry[]> = {};
let activityPages: HistoryEntry[][] = [];
let refuse: Record<number, string> = {};
let processState: Record<string, unknown> | null = null;

function install() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://test.local");
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, path: url.pathname + url.search, body });
      const reply = (status: number, out: unknown) => new Response(JSON.stringify(out), { status, headers: { "content-type": "application/json" } });
      const one = /^\/api\/items\/(\d+)$/.exec(url.pathname);
      const hist = /^\/api\/items\/(\d+)\/history$/.exec(url.pathname);
      if (hist) return reply(200, { entries: history[Number(hist[1])] ?? [], next: null });
      if (/^\/api\/items\/\d+\/reason$/.test(url.pathname) && method === "POST") return reply(200, { ok: true });
      if (/^\/api\/projects\/p1\/process$/.test(url.pathname)) return reply(200, processState);
      if (/^\/api\/projects\/p1\/production-settings$/.test(url.pathname)) return reply(200, { currency: "USD", regions: ["eu"], productType: "electronics" });
      if (/^\/api\/projects\/p1\/activity$/.test(url.pathname)) {
        const before = Number(url.searchParams.get("before") ?? 0);
        const page = before ? 1 : 0;
        return reply(200, { entries: activityPages[page] ?? [], next: activityPages[page + 1] ? activityPages[page].at(-1)!.id : null });
      }
      if (/^\/api\/projects\/p1\/items$/.test(url.pathname) && method === "GET") {
        const section = url.searchParams.get("section");
        return reply(200, { items: db.filter((r) => !section || r.section === section) });
      }
      if (/^\/api\/projects\/p1\/items$/.test(url.pathname) && method === "POST") {
        const b = body as Item;
        const row = { ...b, id: 900 + db.length, projectId: P, body: b.body ?? "", data: b.data ?? {}, status: b.status ?? "planned", sort: 99 } as Item;
        db.push(row);
        return reply(201, { item: row });
      }
      if (one && method === "PATCH") {
        const row = db.find((r) => r.id === Number(one[1]))!;
        const c = body as Partial<Item>;
        if (refuse[row.id] && c.status === "passed") return reply(400, { error: refuse[row.id] });
        for (const k of ["title", "body", "status", "sort"] as const) if (c[k] != null) (row as Record<string, unknown>)[k] = c[k];
        if (c.data) row.data = { ...row.data, ...c.data };
        return reply(200, { item: structuredClone(row) });
      }
      return reply(404, { error: `No stand-in for ${method} ${url.pathname}` });
    })
  );
}

const project = { id: P, name: "Probe", oneLiner: "" };
function renderWith(ui: ReactNode) {
  const client = freshClient();
  const value: ProjectState = { projects: [project], project, loading: false, error: "", select: vi.fn(), reload: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <ProjectContext.Provider value={value}>{ui}</ProjectContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  db = [];
  history = {};
  activityPages = [];
  refuse = {};
  install();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const entry = (id: number, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id, at: "2026-11-20T10:00:00.000Z", actor: "demo", kind: "item.edited", summary: `Edited "Row" in concept/brief`, itemId: 1, section: "concept/brief", title: "Row", changes: [], reason: "", reasonLater: null, canAddReason: false, ...extra,
});

describe("History panel", () => {
  const row = item(1, "concept/brief", "Row", { body: "two", status: "open" });
  const entries: HistoryEntry[] = [
    entry(3, { kind: "item.status", summary: "\"Row\" moved from open to done", changes: [{ field: "status", label: "Status", before: "open", after: "done", restorable: true }] }),
    entry(2, { actor: "ana", changes: [{ field: "body", label: "Details", before: "one", after: "two", restorable: true }] }),
    entry(1, { kind: "item.added", summary: 'Added "Row" to concept/brief', changes: [{ field: "title", label: "Title", after: "Row", restorable: false }] }),
  ];

  it("lists changes newest first with who and when, each field before and after", async () => {
    history[1] = entries;
    renderWith(<HistoryPanel item={row} onRestore={vi.fn()} />);
    const list = await screen.findByRole("list", { name: /newest first/ });
    const rows = within(list).getAllByRole("listitem", {}).filter((li) => li.parentElement === list);
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("moved");
    expect(rows[1].textContent).toContain("ana");
    expect(within(rows[1]).getByText("one")).toBeTruthy();
    expect(within(rows[1]).getByText("two")).toBeTruthy();
    expect(rows[1].querySelector("time")?.getAttribute("datetime")).toBe("2026-11-20T10:00:00.000Z");
  });

  it("offers Restore this value, which saves the old value; a value that is current or was added has none", async () => {
    history[1] = entries;
    const onRestore = vi.fn(async () => {});
    renderWith(<HistoryPanel item={row} onRestore={onRestore} />);
    await screen.findByRole("list", { name: /newest first/ });
    // status is "open" now and the entry's before is "open": already current; body is "two", before "one": restorable
    expect(screen.queryByRole("button", { name: /Restore this value of Status/ })).toBeNull();
    expect(screen.getByText("This is the current value")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Restore this value of Title/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Restore this value of Details/ }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(1, { body: "one" }));
  });

  it("restores a value inside data as a data patch, and shows the server's refusal", async () => {
    history[1] = [entry(5, { changes: [{ field: "data.qty", label: "Qty", before: 2, after: 3, restorable: true }] })];
    const onRestore = vi.fn(async () => { throw new Error("A number in the request is out of range."); });
    renderWith(<HistoryPanel item={{ ...row, data: { qty: 3 } }} onRestore={onRestore} />);
    fireEvent.click(await screen.findByRole("button", { name: /Restore this value of Qty/ }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(1, { data: { qty: 2 } }));
    expect((await screen.findByRole("alert")).textContent).toContain("out of range");
  });

  it("shows long text side by side as Before and After", async () => {
    const long = "A long paragraph. ".repeat(10);
    history[1] = [entry(5, { changes: [{ field: "body", label: "Details", before: long, after: long + "More.", restorable: false }] })];
    renderWith(<HistoryPanel item={row} onRestore={vi.fn()} />);
    await screen.findByText("Before");
    expect(screen.getByText("After")).toBeTruthy();
  });

  it("says when there is nothing yet, and offers a retry when the load fails", async () => {
    renderWith(<HistoryPanel item={row} onRestore={vi.fn()} />);
    expect(await screen.findByText(/No changes are recorded/)).toBeTruthy();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "The database is down." }), { status: 500 })));
    renderWith(<HistoryPanel item={row} onRestore={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("The database is down.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("the row editor", () => {
  it("has a History tab, and a restore refreshes the form so saving cannot put the old value back", async () => {
    const row = item(1, "concept/brief", "Row", { body: "two" });
    db = [row];
    history[1] = [entry(2, { changes: [{ field: "body", label: "Details", before: "one", after: "two", restorable: true }] })];
    const patch = vi.fn(async (_id: number, c: Record<string, unknown>) => {
      Object.assign(row, c);
    });
    const { rerender } = renderWith(
      <ItemDrawer item={row} onClose={() => {}} sectionLabel="Brief" columns={[]} statuses={["open", "done"]} onSave={async () => {}} onDelete={async () => {}} onRestore={patch} />
    );
    expect((screen.getByLabelText("Details") as HTMLTextAreaElement).value).toBe("two");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    fireEvent.click(await screen.findByRole("button", { name: /Restore this value of Details/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith(1, { body: "one" }));
    rerender(
      <QueryClientProvider client={freshClient()}>
        <ProjectContext.Provider value={{ projects: [project], project, loading: false, error: "", select: vi.fn(), reload: async () => {} }}>
          <ItemDrawer item={{ ...row, body: "one" }} onClose={() => {}} sectionLabel="Brief" columns={[]} statuses={["open", "done"]} onSave={async () => {}} onDelete={async () => {}} onRestore={patch} />
        </ProjectContext.Provider>
      </QueryClientProvider>
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Edit" }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    await waitFor(() => expect((screen.getByLabelText("Details") as HTMLTextAreaElement).value).toBe("one"));
  });

  it("names the rows that link to the one being deleted", async () => {
    const test = item(10, "prototype/tests", "Drop test", { data: { key: "t1" }, status: "not run" });
    db = [test, item(11, "design/requirements", "Survives a drop", { data: { tests: ["t1"] } })];
    renderWith(<ItemDrawer item={test} onClose={() => {}} sectionLabel="Acceptance tests" columns={[]} statuses={["not run", "pass", "fail"]} onSave={async () => {}} onDelete={async () => {}} />);
    await waitFor(() => expect(calls.some((c) => c.path === "/api/projects/p1/items")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByRole("alertdialog").textContent).toContain('It is linked from "Survives a drop"; those links are removed with it.'));
  });
});

describe("link picker", () => {
  const options = [
    { id: 1, key: "t-drop", label: "Drop test", hint: "pass" },
    { id: 2, key: "t-idle", label: "Idle test", hint: "not run" },
    { id: 3, key: null, label: "Keyless test" },
  ];

  it("searches the rows, adds a pick, shows chips and removes one", async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<LinkPicker label="Acceptance tests" noun="test" options={options} selected={["t-drop"]} onAdd={onAdd} onRemove={onRemove} />);
    expect(screen.getByText("Drop test")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: /Add a test/ }));
    const search = await screen.findByRole("combobox", { name: "Search tests" });
    fireEvent.change(search, { target: { value: "idle" } });
    expect(screen.queryByText("Keyless test")).toBeNull();
    fireEvent.click(await screen.findByText("Idle test"));
    expect(onAdd).toHaveBeenCalledWith(options[1]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Drop test" }));
    expect(onRemove).toHaveBeenCalledWith("t-drop");
  });

  it("hands a row with no key to the parent, and picking a chosen row again removes it", async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<LinkPicker label="Tests" noun="test" options={options} selected={["t-drop"]} onAdd={onAdd} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("combobox", { name: /Add a test/ }));
    fireEvent.click(await screen.findByText("Keyless test"));
    expect(onAdd).toHaveBeenCalledWith(options[2]);
    fireEvent.click(await screen.findByText("Drop test", { selector: "[cmdk-item] span span" }));
    expect(onRemove).toHaveBeenCalledWith("t-drop");
  });

  it("shows a key that names no row as such, and the empty text when nothing matches", async () => {
    render(<LinkPicker label="Tests" noun="test" options={[]} selected={["t-gone"]} onAdd={vi.fn()} onRemove={vi.fn()} emptyText="No acceptance test matches." />);
    expect(screen.getByText("(no such row)")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: /Add a test/ }));
    expect(await screen.findByText("No acceptance test matches.")).toBeTruthy();
  });
});

describe("traceability", () => {
  it("shows the matrix with each test's status, coverage per requirement, and the three gap lists", async () => {
    db = [
      item(1, "design/requirements", "Survives a drop", { data: { tests: ["t1"], parts: ["p1"] } }),
      item(2, "design/requirements", "Sleeps at idle"),
      item(3, "prototype/tests", "Drop test", { data: { key: "t1" }, status: "pass" }),
      item(4, "prototype/tests", "Orphan test", { data: { key: "t9" }, status: "not run" }),
      item(5, "design/bom", "MCU", { data: { key: "p1", ref: "U1" } }),
      item(6, "design/bom", "Spare strap", { data: { ref: "S1" } }),
    ];
    renderWith(<TraceabilityView />);
    const matrix = await screen.findByRole("table");
    const head = within(matrix).getAllByRole("columnheader").map((h) => h.textContent);
    expect(head[0]).toBe("Requirement");
    expect(head[1]).toContain("Drop test");
    expect(head[1]).toContain("pass");
    expect(head[2]).toContain("Orphan test");
    expect(head[2]).toContain("not run");
    const rows = within(matrix).getAllByRole("row");
    expect(within(rows[1]).getByRole("img", { name: "Drop test checks Survives a drop" })).toBeTruthy();
    expect(rows[1].textContent).toContain("1 test, 1 part");
    expect(rows[2].textContent).toContain("No test covers this");
    expect(within(rows[2]).queryByRole("img")).toBeNull();

    const none = screen.getByRole("region", { name: /Requirements with no test/ });
    expect(none.textContent).toContain("Sleeps at idle");
    expect(none.textContent).not.toContain("Survives a drop");
    expect(screen.getByRole("region", { name: /Tests that check no requirement/ }).textContent).toContain("Orphan test");
    expect(screen.getByRole("region", { name: /Parts no requirement needs/ }).textContent).toContain("S1 Spare strap");
    expect(screen.getByRole("region", { name: /Parts no requirement needs/ }).textContent).not.toContain("MCU");
  });

  it("links each gap row, and each requirement in the matrix, to its row with ?item=<id>", async () => {
    db = [
      item(1, "design/requirements", "Sleeps at idle"),
      item(2, "prototype/tests", "Orphan test", { data: { key: "t9" } }),
      item(3, "design/bom", "Spare strap", { data: { ref: "S1" } }),
    ];
    renderWith(<TraceabilityView />);
    const hrefOf = async (region: RegExp, name: string) => within(await screen.findByRole("region", { name: region })).getByRole("link", { name }).getAttribute("href");
    expect(await hrefOf(/Requirements with no test/, "Sleeps at idle")).toBe("/s/design/requirements?item=1");
    expect(await hrefOf(/Tests that check no requirement/, "Orphan test")).toBe("/s/prototype/tests?item=2");
    expect(await hrefOf(/Parts no requirement needs/, "S1 Spare strap")).toBe("/s/design/bom?item=3");
    expect(within(screen.getByRole("table")).getByRole("link", { name: "Sleeps at idle" }).getAttribute("href")).toBe("/s/design/requirements?item=1");
  });

  it("says so when every requirement is covered, and when there are no requirements at all", async () => {
    db = [item(1, "design/requirements", "R", { data: { tests: ["t1"], parts: ["p1"] } }), item(2, "prototype/tests", "T", { data: { key: "t1" } }), item(3, "design/bom", "P", { data: { key: "p1" } })];
    renderWith(<TraceabilityView />);
    expect(await screen.findByText("Every requirement has at least one test.")).toBeTruthy();
    expect(screen.getByText("Every test checks a requirement.")).toBeTruthy();
    expect(screen.getByText("Every part is needed by a requirement.")).toBeTruthy();
    cleanup();
    db = [];
    renderWith(<TraceabilityView />);
    expect(await screen.findByText("No requirements yet")).toBeTruthy();
  });
});

describe("process on the report", () => {
  it("shows the current stage, each gate, the override with its reason and who, and each build with its evidence", async () => {
    processState = {
      projectId: P, name: "Probe", oneLiner: "A lamp", productType: "electronics", stage: "research",
      gates: [{ stage: "concept", status: "go", overridden: true, note: "Checked by phone with the buyer", decidedBy: "demo", decidedAt: "2026-11-20T10:00:00.000Z" }],
      history: [], facts: { currency: "USD", erc: null }, skipped: [],
    };
    db = [
      item(1, "prototype/builds", "EVT", { status: "passed", data: { tests: ["t1"], criteria: [{ text: "Dims", met: true }] } }),
      item(2, "prototype/builds", "DVT", { status: "planned", data: {} }),
      item(3, "prototype/tests", "Dark room", { status: "fail", data: { key: "t1" } }),
    ];
    renderWith(<ReportProcess projectId={P} />);
    const root = await screen.findByTestId("report-process");
    await within(root).findByText("EVT");
    expect(root.textContent).toContain("Current stage: Research");
    expect(within(screen.getByTestId("report-gate-concept")).getByText(/Overridden/)).toBeTruthy();
    expect(root.textContent).toContain("Checked by phone with the buyer");
    expect(root.textContent).toContain("by demo");
    const evt = screen.getByTestId("report-build-1");
    expect(evt.textContent).toContain("1 of 1 exit criteria met; 0 of 1 linked tests passed.");
    expect(evt.textContent).toContain("Marked passed, but the evidence no longer supports it.");
    expect(screen.getByTestId("report-build-2").textContent).toContain("Add at least one exit criterion and one test");
  });

  it("says so when nothing was overridden and no build exists", async () => {
    processState = { projectId: P, name: "Probe", oneLiner: "", productType: "electronics", stage: "concept", gates: [], history: [], facts: { currency: "USD", erc: null }, skipped: [] };
    db = [];
    renderWith(<ReportProcess projectId={P} />);
    expect(await screen.findByText("No gate has been overridden.")).toBeTruthy();
    expect(screen.getByText("No builds recorded.")).toBeTruthy();
  });
});

describe("compliance page", () => {
  it("has no second draft button, no confirm step and no 'to confirm' counter; a row at draft is edited like any row", async () => {
    db = [
      item(1, "production/compliance", "Radio rules", { status: "to check" }),
      item(2, "production/compliance", "Batteries", { status: "done" }),
      item(3, "production/compliance", "Older draft row", { status: "draft" }),
    ];
    const found = findSection("production", "compliance")!;
    renderWith(<ComplianceView project={project as never} stage={found.stage} section={found.section} store="production/compliance" />);
    await screen.findByText("Radio rules");
    expect(screen.queryByRole("button", { name: /Draft a checklist/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Confirm/ })).toBeNull();
    expect(screen.queryByText(/to confirm/)).toBeNull();
    expect(screen.getByText(/1 to check, 1 decided, 1 with no decision yet/)).toBeTruthy();
    expect(screen.getByText(/Draft with AI, at the top of this page/)).toBeTruthy();
    const select = screen.getByLabelText("Status of Older draft row") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["to check", "applies", "does not apply", "done", "draft"]);
    fireEvent.change(select, { target: { value: "applies" } });
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && c.path === "/api/items/3" && (c.body as { status: string }).status === "applies")).toBe(true));
  });
});

describe("activity page", () => {
  it("filters by section and kind, and loads more", async () => {
    activityPages = [[entry(30, { title: "Newest" }), entry(29, { title: "Second" })], [entry(20, { title: "Older" })]];
    renderWith(<ActivityView />);
    await screen.findByText(/Newest/);
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "design/bom" } });
    fireEvent.change(screen.getByLabelText("Kind of change"), { target: { value: "item" } });
    await waitFor(() => expect(calls.some((c) => c.path.includes("section=design%2Fbom") && c.path.includes("kind=item"))).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByText(/Older/);
    expect(calls.some((c) => c.path.includes("before=29"))).toBe(true);
  });

  it("says when nothing matches the filters", async () => {
    activityPages = [[]];
    renderWith(<ActivityView />);
    expect(await screen.findByText("Nothing has changed in this concept yet")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Kind of change"), { target: { value: "file" } });
    expect(await screen.findByText("No changes match these filters")).toBeTruthy();
  });
});

describe("builds", () => {
  const found = findSection("prototype", "builds")!;
  const props = { project, stage: found.stage, section: found.section, store: "prototype/builds" };

  it("shows criteria met out of total and the linked tests with their statuses, computed from the rows", async () => {
    db = [
      item(1, "prototype/builds", "EVT", { status: "testing", body: "Prove the electronics", data: { criteria: [{ text: "Boots", met: true }, { text: "Plays a clip", met: false }], tests: ["t1", "t2"], start: "2026-12-01" } }),
      item(2, "prototype/tests", "Drop", { data: { key: "t1" }, status: "pass" }),
      item(3, "prototype/tests", "Idle", { data: { key: "t2" }, status: "fail" }),
    ];
    renderWith(<BuildsView {...props} />);
    const card = await screen.findByRole("listitem", { name: "EVT" });
    expect(within(card).getByText("1 of 2 exit criteria met")).toBeTruthy();
    expect(within(card).getByText("1 of 2 tests passed")).toBeTruthy();
    expect(within(card).getByText("Drop").closest("li")?.textContent).toContain("pass");
    expect(within(card).getByText("Idle").closest("li")?.textContent).toContain("fail");
    expect(within(card).getByText(/cannot be marked passed/).textContent).toContain('"Plays a clip"');
    // a build that cannot pass has its button disabled, with the reason beside it
    expect((within(card).getByRole("button", { name: "Mark passed: EVT" }) as HTMLButtonElement).disabled).toBe(true);
    // ticking a criterion saves the whole list
    fireEvent.click(within(card).getByRole("checkbox", { name: "Plays a clip" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ data: { criteria: [{ text: "Boots", met: true }, { text: "Plays a clip", met: true }] } })
    );
  });

  it("shows the server's reason when Mark passed is refused, on that card", async () => {
    const ready = { criteria: [{ text: "Boots", met: true }], tests: ["t1"] };
    db = [item(1, "prototype/builds", "EVT", { status: "testing", data: ready }), item(2, "prototype/builds", "DVT", { status: "planned", data: ready }), item(3, "prototype/tests", "Drop", { data: { key: "t1" }, status: "pass" })];
    refuse[1] = "This build cannot be marked passed: 1 of 2 exit criteria is not met (for example \"Plays a clip\").";
    renderWith(<BuildsView {...props} />);
    const card = await screen.findByRole("listitem", { name: "EVT" });
    fireEvent.click(within(card).getByRole("button", { name: "Mark passed: EVT" }));
    expect((await within(card).findByRole("alert")).textContent).toContain("1 of 2 exit criteria is not met");
    expect(within(screen.getByRole("listitem", { name: "DVT" })).queryByRole("alert")).toBeNull();
    expect(within(card).queryByText("Passed")).toBeNull();
  });

  it("marks a build passed when the server allows it", async () => {
    db = [item(1, "prototype/builds", "PVT", { status: "testing", data: { criteria: [{ text: "Boots", met: true }], tests: ["t1"] } }), item(2, "prototype/tests", "Drop", { data: { key: "t1" }, status: "pass" })];
    renderWith(<BuildsView {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark passed: PVT" }));
    expect(await screen.findByText("Passed")).toBeTruthy();
  });

  it("disables Mark passed on a build with no criteria or tests, and says why beside it (process review 1)", async () => {
    db = [item(1, "prototype/builds", "Empty", { status: "planned" })];
    renderWith(<BuildsView {...props} />);
    const card = await screen.findByRole("listitem", { name: "Empty" });
    const button = within(card).getByRole("button", { name: "Mark passed: Empty" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(within(card).getByText("Add at least one exit criterion and one test before marking this build passed.")).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("has an empty state that adds the first build", async () => {
    renderWith(<BuildsView {...props} />);
    expect(await screen.findByText("No builds yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Add build/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("the why (process review 3)", () => {
  const row = item(1, "concept/brief", "Row", { body: "two", status: "open" });

  it("shows the reason on a change, and says when it was added later", async () => {
    history[1] = [
      entry(4, { reason: "Decided in the review" }),
      entry(3, { reason: "Added afterwards", reasonLater: { by: "ana", at: "2026-11-21T09:00:00.000Z" } }),
    ];
    renderWith(<HistoryPanel item={row} onRestore={vi.fn()} />);
    expect(await screen.findByText("Decided in the review")).toBeTruthy();
    expect(screen.getByText(/added later by ana/)).toBeTruthy();
  });

  it("offers Add reason only on the line the server marks, and saves it against that line", async () => {
    history[1] = [entry(4, { canAddReason: true }), entry(3)];
    renderWith(<HistoryPanel item={row} onRestore={vi.fn()} />);
    const buttons = await screen.findAllByRole("button", { name: "Add reason" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save reason" }));
    expect((await screen.findByText("Type the reason.")).getAttribute("role")).toBe("alert");
    expect(calls.some((c) => c.path === "/api/items/1/reason")).toBe(false);
    fireEvent.change(screen.getByLabelText("Why (kept in the history)"), { target: { value: "Agreed with the client" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reason" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/items/1/reason")?.body).toEqual({ why: "Agreed with the client", forEvent: 4 }));
  });

  it("sends the optional why with a restore, and nothing when the field is empty", async () => {
    history[1] = [entry(2, { changes: [{ field: "body", label: "Details", before: "one", after: "two", restorable: true }] })];
    const onRestore = vi.fn(async () => {});
    renderWith(<HistoryPanel item={row} onRestore={onRestore} />);
    fireEvent.click(await screen.findByRole("button", { name: /Restore this value of Details/ }));
    await waitFor(() => expect(onRestore).toHaveBeenLastCalledWith(1, { body: "one" }));
    fireEvent.change(screen.getByLabelText(/Why you are restoring/), { target: { value: "The new text was wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /Restore this value of Details/ }));
    await waitFor(() => expect(onRestore).toHaveBeenLastCalledWith(1, { body: "one", why: "The new text was wrong" }));
  });

  it("the row editor asks for a why only when the status changes, and sends it with the save", async () => {
    const onSave = vi.fn(async () => {});
    renderWith(<ItemDrawer item={row} onClose={() => {}} sectionLabel="Brief" columns={[]} statuses={["open", "done"]} onSave={onSave} onDelete={async () => {}} />);
    expect(screen.queryByLabelText("Why (kept in the history)")).toBeNull();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });
    fireEvent.change(screen.getByLabelText("Why (kept in the history)"), { target: { value: "Shipped" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({ status: "done", why: "Shipped" })));
  });

  it("a status change with no reason sends none", async () => {
    const onSave = vi.fn(async () => {});
    renderWith(<ItemDrawer item={row} onClose={() => {}} sectionLabel="Brief" columns={[]} statuses={["open", "done"]} onSave={onSave} onDelete={async () => {}} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect((onSave.mock.calls[0] as unknown[])[1]).not.toHaveProperty("why");
  });
});
