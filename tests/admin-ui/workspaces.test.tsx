// @vitest-environment jsdom
// Admin, Workspaces: the list, the manage dialog (rename, members, delete by typing the name), and axe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { WorkspacesTab } from "@/components/admin/WorkspacesTab";
import { adminServer, axeViolations, on, renderWithClient, shimBrowser, type Call } from "./harness";

const ROW = { id: "w1", name: "Bag Lab", createdAt: "2026-11-23T08:00:00.000Z", members: 2, owners: ["ada@example.test"], personal: false, twoFactorRequired: false };
const DETAIL = { workspace: ROW, members: [
  { memberId: "m1", userId: "u1", email: "ada@example.test", name: "Ada", role: "owner", platformAdmin: false, joinedAt: ROW.createdAt },
  { memberId: "m2", userId: "u2", email: "bo@example.test", name: "Bo", role: "member", platformAdmin: false, joinedAt: ROW.createdAt },
] };

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Admin, Workspaces", () => {
  it("lists, opens one, changes a role, and deletes only after the name is typed; axe passes", async () => {
    const calls: Call[] = [];
    adminServer([
      on("GET", "/api/admin/workspaces", () => ({ body: { workspaces: [ROW] } })),
      on("GET", "/api/admin/workspaces/w1", () => ({ body: DETAIL })),
      on("GET", "/api/admin/users", () => ({ body: { users: [], total: 0, page: 1, pageSize: 25, me: "x" } }), true),
      on("POST", "/api/admin/workspaces/w1", (c) => {
        calls.push(c);
        return { body: { ok: true } };
      }),
    ]);
    const { container } = renderWithClient(<WorkspacesTab />);
    expect(await screen.findByText("ada@example.test")).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Manage the workspace Bag Lab" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Bo")).toBeTruthy();
    expect(await axeViolations(dialog)).toEqual([]);
    fireEvent.change(within(dialog).getByLabelText("Role of bo@example.test"), { target: { value: "admin" } });
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ action: "role", memberId: "m2", role: "admin" }));
    const del = within(dialog).getByRole("button", { name: "Delete the workspace" }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Type Bag Lab to confirm"), { target: { value: "Bag Lab" } });
    fireEvent.click(del);
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ action: "delete", confirmName: "Bag Lab" }));
  });
});
