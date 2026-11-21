// @vitest-environment jsdom
// The Concepts page: delete confirmation, a refused edit, search and sort, the archived group,
// and ?concept= on any page. The API is a stand-in fetch; the real routes are tested in tests/api.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ProjectContext, type ProjectState } from "@/lib/client";
import type { Concept } from "@/lib/conceptsClient";
import { freshClient } from "./mockServer";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), pathname: "/", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.params,
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { ConceptsView } from "@/components/concepts/ConceptsView";
import { DeleteConceptDialog } from "@/components/concepts/DeleteConceptDialog";
import { EditConceptDialog } from "@/components/concepts/EditConceptDialog";
import { ConceptFromUrl, withoutConcept } from "@/components/concepts/ConceptFromUrl";

const concept = (id: string, extra: Partial<Concept> = {}): Concept => ({
  id,
  name: id,
  oneLiner: "",
  productType: "electronics",
  stage: "concept",
  archivedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  lastActivityAt: null,
  rowCount: 0,
  rowsByStage: {},
  ...extra,
});

type Reply = { status?: number; body: unknown };
type Handler = (method: string, path: string, body: unknown) => Reply | undefined;
let calls: { method: string; path: string; body: unknown }[] = [];

function serve(handler: Handler) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://test.local");
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      const path = url.pathname + url.search;
      calls.push({ method, path, body });
      const r = handler(method, path, body) ?? { status: 404, body: { error: `No stand-in for ${method} ${path}` } };
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
    })
  );
}

function renderWith(ui: ReactNode, project: Partial<ProjectState> = {}) {
  const client = freshClient();
  const value: ProjectState = { projects: [], project: null, loading: false, error: "", select: vi.fn(), reload: async () => {}, ...project };
  const utils = render(
    <QueryClientProvider client={client}>
      <ProjectContext.Provider value={value}>{ui}</ProjectContext.Provider>
    </QueryClientProvider>
  );
  return { ...utils, client, value };
}

beforeEach(() => {
  // Radix popper and focus code reach for these; jsdom has none of them.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  nav.params = new URLSearchParams();
  nav.pathname = "/";
  nav.replace.mockReset();
  nav.push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("delete dialog", () => {
  it("stays disabled until the exact name is typed, says what goes, and sends the name", async () => {
    const c = concept("lamp", { name: "Desk Lamp", rowCount: 12 });
    serve((method, path) => {
      if (path === "/api/projects/lamp/files") return { body: { files: [{ id: 1 }, { id: 2 }] } };
      if (path === "/api/research?projectId=lamp") return { body: { configured: false, model: "", entries: [{ id: 1 }] } };
      if (path === "/api/challenge?projectId=lamp") return { body: { configured: false, model: "", messages: [{ id: 1 }, { id: 2 }, { id: 3 }] } };
      if (method === "DELETE" && path === "/api/projects/lamp")
        return { body: { deleted: { concept: "lamp", name: "Desk Lamp", items: 12, files: 2, events: 4, messages: 3, research: 1, gates: 0, defaultCleared: false } } };
    });
    const onDone = vi.fn();
    renderWith(<DeleteConceptDialog concept={c} onDone={onDone} onClosed={() => {}} />);

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("2 files");
    expect(within(dialog).getByText("12 rows")).toBeTruthy();
    expect(within(dialog).getByText("1 research answer")).toBeTruthy();
    expect(within(dialog).getByText("3 challenge messages")).toBeTruthy();
    expect(within(dialog).getByText(/recorded in the audit log, which is kept/)).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: /Download everything as JSON first/ }).getAttribute("href")).toBe("/api/projects/lamp/export");

    const button = within(dialog).getByRole("button", { name: "Delete concept" }) as HTMLButtonElement;
    const input = within(dialog).getByLabelText("Type the name to confirm");
    expect(button.disabled).toBe(true);
    for (const wrong of ["desk lamp", "Desk Lam", "Desk Lamp ", "lamp"]) {
      fireEvent.change(input, { target: { value: wrong } });
      expect(button.disabled).toBe(true);
    }
    // Enter in the field does nothing while the name is wrong.
    fireEvent.submit(input.closest("form")!);
    expect(calls.some((x) => x.method === "DELETE")).toBe(false);

    fireEvent.change(input, { target: { value: "Desk Lamp" } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((x) => x.method === "DELETE")?.body).toEqual({ confirm: "Desk Lamp" });
  });

  it("shows the server's reason when the delete is refused and keeps the dialog", async () => {
    const c = concept("lamp", { name: "Desk Lamp" });
    serve((method, path) => {
      if (method === "DELETE") return { status: 409, body: { error: "Someone else is changing this concept. Try again." } };
      if (path.includes("files")) return { body: { files: [] } };
      if (path.includes("research")) return { body: { entries: [] } };
      if (path.includes("challenge")) return { body: { messages: [] } };
    });
    renderWith(<DeleteConceptDialog concept={c} onDone={() => {}} onClosed={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Type the name to confirm"), { target: { value: "Desk Lamp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete concept" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Someone else is changing this concept. Try again.");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("edit dialog", () => {
  it("shows the server's reason for a refused save and keeps what was typed", async () => {
    const c = concept("lamp", { name: "Desk Lamp", oneLiner: "A lamp" });
    serve((method) => (method === "PATCH" ? { status: 400, body: { error: "name: A concept needs a name." } } : undefined));
    const onDone = vi.fn();
    renderWith(<EditConceptDialog concept={c} onDone={onDone} onClosed={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("name: A concept needs a name.");
    expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe("   ");
    expect(onDone).not.toHaveBeenCalled();
    expect(calls.find((x) => x.method === "PATCH")?.body).toEqual({ name: "   " });
  });

  it("warns which sections a new product type hides, and sends only what changed", async () => {
    const c = concept("lamp", { name: "Desk Lamp" });
    serve((method, _path, body) => (method === "PATCH" ? { body: { project: { ...c, ...(body as object) } } } : undefined));
    const onDone = vi.fn();
    renderWith(<EditConceptDialog concept={c} onDone={onDone} onClosed={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/will hide/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("radio", { name: /Printed part/ }));
    expect(within(dialog).getByText(/will hide "Schematic" \(Design\) and "Wiring and soldering" \(Prototype\)\. Their rows are kept, not deleted\./)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((x) => x.method === "PATCH")?.body).toEqual({ productType: "printed" });
  });
});

describe("concepts list", () => {
  const list = [
    concept("bravo", { name: "Bravo bottle", oneLiner: "Keeps water cold", updatedAt: "2026-11-10T10:00:00.000Z" }),
    concept("alpha", { name: "alpha lamp", oneLiner: "Light for a desk", updatedAt: "2026-11-05T10:00:00.000Z", lastActivityAt: "2026-11-15T10:00:00.000Z" }),
    concept("charlie", { name: "Charlie clock", oneLiner: "Tells the time", updatedAt: "2026-11-12T10:00:00.000Z" }),
    concept("old", { name: "Old radio", oneLiner: "Retired", archivedAt: "2026-11-02T10:00:00.000Z" }),
  ];
  const names = (table: HTMLElement) => within(table).getAllByRole("row").slice(1).map((r) => r.getAttribute("data-concept"));

  async function shown() {
    serve((method, path) => (method === "GET" && path === "/api/projects?archived=all" ? { body: { projects: list } } : undefined));
    const r = renderWith(<ConceptsView />, { projects: list.filter((c) => !c.archivedAt), project: list[0] });
    const active = await screen.findByRole("table", { name: "Active concepts" });
    return { ...r, active };
  }

  it("shows a skeleton while loading, then sorts by last changed (latest event counts) and by name", async () => {
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    serve(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await held;
        return new Response(JSON.stringify({ projects: list }), { status: 200 });
      })
    );
    renderWith(<ConceptsView />);
    expect(screen.getByLabelText("Loading concepts")).toBeTruthy();
    await act(async () => release());
    const active = await screen.findByRole("table", { name: "Active concepts" });
    expect(names(active)).toEqual(["alpha", "charlie", "bravo"]);
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "name" } });
    expect(names(screen.getByRole("table", { name: "Active concepts" }))).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("searches name and description, ignoring case, across both groups", async () => {
    const { active } = await shown();
    expect(names(active)).toHaveLength(3);
    const search = screen.getByLabelText("Search concepts");
    fireEvent.change(search, { target: { value: "WATER" } });
    expect(names(screen.getByRole("table", { name: "Active concepts" }))).toEqual(["bravo"]);
    fireEvent.change(search, { target: { value: "clock" } });
    expect(names(screen.getByRole("table", { name: "Active concepts" }))).toEqual(["charlie"]);
    fireEvent.change(search, { target: { value: "radio" } });
    expect(screen.getByText('No active concept matches "radio".')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Archived/ }).textContent).toContain("1");
  });

  it("keeps archived concepts in their own group, collapsed by default, with Restore instead of Open", async () => {
    await shown();
    const toggle = screen.getByRole("button", { name: /Archived/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table", { name: "Archived concepts" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const archived = screen.getByRole("table", { name: "Archived concepts" });
    expect(names(archived)).toEqual(["old"]);
    expect(within(archived).getByRole("button", { name: "Restore" })).toBeTruthy();
    expect(within(archived).queryByRole("link", { name: /Open/ })).toBeNull();
    expect(names(screen.getByRole("table", { name: "Active concepts" }))).not.toContain("old");
  });

  it("marks the open concept and links Open to ?concept=", async () => {
    const { active } = await shown();
    const row = within(active).getAllByRole("row").find((r) => r.getAttribute("data-concept") === "bravo")!;
    expect(within(row).getByText("Open now")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Open Bravo bottle" }).getAttribute("href")).toBe("/?concept=bravo");
  });

  it("works from the keyboard: the row menu opens a dialog, and Escape puts focus back on the row's menu", async () => {
    const { active } = await shown();
    const trigger = within(active).getByRole("button", { name: "More actions for Charlie clock" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    const del = within(menu).getByRole("menuitem", { name: /Delete/ });
    expect(within(menu).getByRole("menuitem", { name: /Export as JSON/ }).getAttribute("href")).toBe("/api/projects/charlie/export");
    fireEvent.keyDown(del, { key: "Enter" });
    const dialog = await screen.findByRole("dialog", { name: 'Delete "Charlie clock"?' });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(within(screen.getByRole("table", { name: "Active concepts" })).getByRole("button", { name: "More actions for Charlie clock" })));
  });

  it("shows the empty state with the wizard when there are no concepts", async () => {
    serve(() => ({ body: { projects: [] } }));
    renderWith(<ConceptsView />);
    expect(await screen.findByText(/There are no concepts yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start a concept/ }).getAttribute("href")).toBe("/new");
  });

  it("shows a load error with a retry that works", async () => {
    let fail = true;
    serve(() => (fail ? { status: 500, body: { error: "The database could not be reached." } } : { body: { projects: list } }));
    renderWith(<ConceptsView />);
    expect((await screen.findByRole("alert")).textContent).toContain("The database could not be reached.");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table", { name: "Active concepts" })).toBeTruthy();
  });
});

describe("?concept= on any page", () => {
  const active = [concept("lamp", { name: "Desk Lamp" }), concept("clock", { name: "Clock" })];

  it("makes a known concept current and takes the parameter off the address, keeping the others", async () => {
    nav.pathname = "/s/design/bom";
    nav.params = new URLSearchParams("concept=clock&view=board");
    const select = vi.fn();
    serve(() => undefined);
    renderWith(<ConceptFromUrl />, { projects: active, project: active[0], select });
    await waitFor(() => expect(select).toHaveBeenCalledWith("clock"));
    expect(nav.replace).toHaveBeenCalledWith("/s/design/bom?view=board", { scroll: false });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("waits for the concept list before deciding", async () => {
    nav.params = new URLSearchParams("concept=clock");
    const select = vi.fn();
    serve(() => undefined);
    renderWith(<ConceptFromUrl />, { projects: [], loading: true, select });
    await new Promise((r) => setTimeout(r, 20));
    expect(select).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaves the current concept alone for an unknown id and links to the Concepts page", async () => {
    nav.params = new URLSearchParams("concept=gone-concept");
    const select = vi.fn();
    serve((_m, path) => (path === "/api/projects?archived=all" ? { body: { projects: active } } : undefined));
    renderWith(<ConceptFromUrl />, { projects: active, project: active[0], select });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("gone-concept");
    expect(alert.textContent).toContain("It may have been deleted.");
    expect(within(alert).getByRole("link", { name: "Go to the Concepts page" }).getAttribute("href")).toBe("/concepts");
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Dismiss" }));
    expect(nav.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("says when the concept is archived instead of opening it", async () => {
    nav.params = new URLSearchParams("concept=old");
    const select = vi.fn();
    const old = concept("old", { name: "Old radio", archivedAt: "2026-11-02T10:00:00.000Z" });
    serve(() => ({ body: { projects: [...active, old] } }));
    renderWith(<ConceptFromUrl />, { projects: active, project: active[0], select });
    expect((await screen.findByRole("alert")).textContent).toContain('"Old radio", which is archived');
    expect(select).not.toHaveBeenCalled();
  });

  it("withoutConcept keeps every other parameter", () => {
    expect(withoutConcept("/plan", new URLSearchParams("concept=a"))).toBe("/plan");
    expect(withoutConcept("/plan", new URLSearchParams("a=1&concept=x&b=2"))).toBe("/plan?a=1&b=2");
  });
});
