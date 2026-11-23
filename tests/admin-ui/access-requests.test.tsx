// @vitest-environment jsdom
// Access requests in the browser: the Admin tab (list, a status change that saves, a refused change that rolls
// back, the refusal under the demo password) and the public form (checks before sending, the truthful
// confirmation, the server's refusal shown in the form).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { AccessRequestsTab } from "@/components/admin/AccessRequestsTab";
import { AccessRequestForm } from "@/components/welcome/AccessRequestForm";
import { Levels } from "@/components/welcome/Levels";
import { builtInCatalogue, levelsOf } from "@/lib/admin/planSchema";
import { outcomeMessage, type AccessRequestRow } from "@/lib/accessRequests/shared";
import { adminServer, on, renderWithClient, shimBrowser } from "./harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ACCESS_CONFIRMATION = outcomeMessage({ kind: "place", place: 1 });

const row = (o: Partial<AccessRequestRow>): AccessRequestRow => ({
  id: 1,
  createdAt: "2026-11-20T10:00:00.000Z",
  name: "Ada Tester",
  email: "ada@example.test",
  building: "A plant sensor.",
  company: "",
  level: "",
  status: "new",
  statusChangedAt: null,
  place: 1,
  waitingPosition: null,
  placement: "",
  ...o,
});

describe("Admin, Access requests", () => {
  it("lists the requests and saves a status change", async () => {
    const list = [row({ id: 2, name: "Bea Newer", email: "bea@example.test", company: "Bea Labs", level: "studio" }), row({ id: 1 })];
    const { calls } = adminServer([
      on("GET", "/api/admin/access-requests", () => ({ body: { requests: list } })),
      on("PATCH", "/api/admin/access-requests/1", (c) => ({ body: { request: row({ id: 1, status: (c.body as { status: AccessRequestRow["status"] }).status }) } })),
    ]);
    renderWithClient(<AccessRequestsTab />);
    expect(await screen.findByText("Bea Newer")).toBeTruthy();
    expect(screen.getByText("Bea Labs")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ada@example.test" }).getAttribute("href")).toBe("mailto:ada@example.test");
    expect(screen.getByText("2 requests.")).toBeTruthy();
    // the level the visitor chose, and plain words when none was
    expect(screen.getByRole("columnheader", { name: "Level" })).toBeTruthy();
    expect(screen.getByTestId("access-level-2").textContent).toBe("Studio");
    expect(screen.getByTestId("access-level-1").textContent).toBe("Not chosen");
    const select = screen.getByLabelText("Status of request 1 from Ada Tester") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "contacted" } });
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && c.path === "/api/admin/access-requests/1")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ status: "contacted" });
    await waitFor(() => expect(select.value).toBe("contacted"));
  });

  it("deletes a request only after the confirmation, and takes it out of the list", async () => {
    let list = [row({ id: 2, name: "Bea Newer", email: "bea@example.test" }), row({ id: 1 })];
    const { calls } = adminServer([
      on("GET", "/api/admin/access-requests", () => ({ body: { requests: list } })),
      on("DELETE", "/api/admin/access-requests/1", () => {
        list = list.filter((r) => r.id !== 1);
        return { body: { ok: true } };
      }),
    ]);
    renderWithClient(<AccessRequestsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete request 1 from Ada Tester" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(screen.getByRole("dialog", { name: "Delete this request?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete request" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/admin/access-requests/1")).toBe(true));
    await waitFor(() => expect(screen.queryByText("Ada Tester")).toBeNull());
    expect(screen.getByText("Bea Newer")).toBeTruthy();
  });

  it("keeps the request and shows the server's reason when the delete is refused", async () => {
    adminServer([
      on("GET", "/api/admin/access-requests", () => ({ body: { requests: [row({ id: 5 })] } })),
      on("DELETE", "/api/admin/access-requests/5", () => ({ status: 404, body: { error: "That access request was not found." } })),
    ]);
    renderWithClient(<AccessRequestsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete request 5 from Ada Tester" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete request" }));
    expect(await screen.findByText("That access request was not found.")).toBeTruthy();
    expect(screen.getByText("Ada Tester")).toBeTruthy();
  });

  it("puts the status back and shows the server's reason when a change is refused", async () => {
    adminServer([
      on("GET", "/api/admin/access-requests", () => ({ body: { requests: [row({ id: 5 })] } })),
      on("PATCH", "/api/admin/access-requests/5", () => ({ status: 404, body: { error: "That access request was not found." } })),
    ]);
    renderWithClient(<AccessRequestsTab />);
    const select = (await screen.findByLabelText("Status of request 5 from Ada Tester")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "declined" } });
    expect(await screen.findByText("That access request was not found.")).toBeTruthy();
    await waitFor(() => expect(select.value).toBe("new"));
  });

  it("explains the refusal while the demo password is in use, and links to Account", async () => {
    adminServer([on("GET", "/api/admin/access-requests", () => ({ status: 403, body: { error: "Change the password in Account, then open this tab again." } }))]);
    renderWithClient(<AccessRequestsTab />);
    expect(await screen.findByText(/Change the password in Account/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Account" }).getAttribute("href")).toBe("/account");
  });

  it("says so when there are no requests yet", async () => {
    adminServer([on("GET", "/api/admin/access-requests", () => ({ body: { requests: [] } }))]);
    renderWithClient(<AccessRequestsTab />);
    expect(await screen.findByText(/No requests yet/)).toBeTruthy();
  });
});

describe("the public request form", () => {
  const fill = (label: string | RegExp, value: string) => fireEvent.input(screen.getByLabelText(label), { target: { value } });

  it("checks the fields before sending anything", async () => {
    const { calls } = adminServer([]);
    renderWithClient(<AccessRequestForm />);
    fireEvent.click(screen.getByRole("button", { name: "Request a workspace" }));
    expect(await screen.findByText("Enter your email address.")).toBeTruthy();
    expect(screen.getByText("Say in a few words what you want to make.")).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("sends the request and shows the truthful confirmation", async () => {
    const { calls } = adminServer([on("POST", "/api/access-requests", () => ({ status: 201, body: { ok: true, message: ACCESS_CONFIRMATION } }))]);
    renderWithClient(<AccessRequestForm />);
    fill(/Your name/, "Ada Tester");
    fill(/^Email/, "ada@example.test");
    fill(/What do you want to build/, "A clip-on plant sensor.");
    fireEvent.click(screen.getByRole("button", { name: "Request a workspace" }));
    expect(await screen.findByText(ACCESS_CONFIRMATION)).toBeTruthy();
    expect(calls[0]!.body).toEqual({ name: "Ada Tester", email: "ada@example.test", building: "A clip-on plant sensor.", company: "", level: "", placement: "", website: "" });
  });

  it("starts on the level it is given, lets the visitor change it, and sends the one shown", async () => {
    const { calls } = adminServer([on("POST", "/api/access-requests", () => ({ status: 201, body: { ok: true, message: ACCESS_CONFIRMATION } }))]);
    const changed: string[] = [];
    renderWithClient(<AccessRequestForm level="maker" onLevelChange={(l) => changed.push(l)} />);
    const level = screen.getByLabelText(/^Level/) as HTMLSelectElement;
    await waitFor(() => expect(level.value).toBe("maker"));
    expect([...level.options].map((o) => o.textContent)).toEqual(["Not sure yet", "Maker", "Studio"]);
    fireEvent.change(level, { target: { value: "studio" } });
    expect(changed).toEqual(["studio"]);
    fill(/Your name/, "Ada Tester");
    fill(/^Email/, "ada@example.test");
    fill(/What do you want to build/, "A clip-on plant sensor.");
    fireEvent.click(screen.getByRole("button", { name: "Request a workspace" }));
    expect(await screen.findByText(ACCESS_CONFIRMATION)).toBeTruthy();
    expect(calls[0]!.body).toMatchObject({ level: "studio" });
  });

  it("carries the level from a card's Request access to the form, where it can be changed, and sends it", async () => {
    const { calls } = adminServer([on("POST", "/api/access-requests", () => ({ status: 201, body: { ok: true, message: ACCESS_CONFIRMATION } }))]);
    renderWithClient(<Levels {...levelsOf(builtInCatalogue())} />);
    const level = screen.getByLabelText(/^Level/) as HTMLSelectElement;
    expect(level.value).toBe("");
    expect(screen.getByRole("heading", { level: 3, name: "Request access" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Request access: Maker" }));
    await waitFor(() => expect(level.value).toBe("maker"));
    expect(screen.getByRole("heading", { level: 3, name: "Request access: Maker" })).toBeTruthy();
    // changing the field renames the heading too, so the page never names one level and sends another
    fireEvent.change(level, { target: { value: "studio" } });
    expect(await screen.findByRole("heading", { level: 3, name: "Request access: Studio" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Request access: Maker" }));
    await waitFor(() => expect(level.value).toBe("maker"));
    fireEvent.click(screen.getByRole("link", { name: "Request access: Studio" }));
    await waitFor(() => expect(level.value).toBe("studio"));
    fill(/Your name/, "Ada Tester");
    fill(/^Email/, "ada@example.test");
    fill(/What do you want to build/, "A clip-on plant sensor.");
    fireEvent.click(screen.getByRole("button", { name: "Request a workspace" }));
    expect(await screen.findByText(ACCESS_CONFIRMATION)).toBeTruthy();
    expect(calls[0]!.body).toMatchObject({ level: "studio" });
  });

  it("keeps what was typed and shows the server's sentence when it refuses", async () => {
    adminServer([on("POST", "/api/access-requests", () => ({ status: 429, body: { error: "Too many requests from here. Try again in 4 seconds." } }))]);
    renderWithClient(<AccessRequestForm />);
    fill(/Your name/, "Ada Tester");
    fill(/^Email/, "ada@example.test");
    fill(/What do you want to build/, "A clip-on plant sensor.");
    fireEvent.click(screen.getByRole("button", { name: "Request a workspace" }));
    expect(await screen.findByText("Too many requests from here. Try again in 4 seconds.")).toBeTruthy();
    expect((screen.getByLabelText(/Your name/) as HTMLInputElement).value).toBe("Ada Tester");
  });

  it("keeps the honeypot out of the tab order and labelled for anyone who reaches it", () => {
    adminServer([]);
    renderWithClient(<AccessRequestForm />);
    const trap = screen.getByLabelText("Leave this field empty") as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden='true']")).toBeTruthy();
  });
});
