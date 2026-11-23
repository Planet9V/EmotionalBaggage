// @vitest-environment jsdom
// Access requests in the browser: the Admin tab (list, a status change that saves, a refused change that rolls
// back, the refusal under the demo password). The public form is the early-access form (tests/welcome/early-access.test.tsx).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { AccessRequestsTab } from "@/components/admin/AccessRequestsTab";
import type { AccessRequestRow } from "@/lib/accessRequests/shared";
import { adminServer, on, renderWithClient, shimBrowser } from "./harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
