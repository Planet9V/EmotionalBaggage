// @vitest-environment jsdom
// Admin, Users (owner's ruling of 23 Nov): the list with its states, adding a person by invitation (the link shown
// once when mail is off) or by a typed temporary password, the manage dialog's actions, and axe on each screen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { UsersTab } from "@/components/admin/UsersTab";
import { DEFAULT_RULES } from "@/lib/auth2/rules";
import type { UserState } from "@/lib/auth2/adminOps";
import { adminServer, axeViolations, on, renderWithClient, shimBrowser, type Call } from "./harness";

const ADMIN = { platformAdmin: true, capabilities: { plans: true, payments: true, email: true, voice: true }, notice: null };
const SIGNIN = { on: true, switchFrom: "database", detail: { baseURL: "https://app.example.test", trustedOrigins: [], platformAdminAddress: "jim@example.test", warnings: [], mail: false }, sharedConcepts: "", rules: DEFAULT_RULES };

const user = (over: Partial<UserState>): UserState => ({
  id: "u1", email: "ada@example.test", name: "Ada", confirmed: true, twoFactor: false, twoFactorRequired: false, platformAdmin: false, disabled: false, createdAt: "2026-11-23T08:00:00.000Z",
  workspaces: 1, state: "active", hasPassword: true, lockedUntil: null, mustChangePassword: false, resetRequestedAt: null, invitation: null, sessions: 1, ...over,
});
const USERS = [
  user({ id: "me", email: "jim@example.test", name: "Jim", platformAdmin: true }),
  user({ id: "u1" }),
  user({ id: "u2", email: "bo@example.test", name: "Bo", state: "invited", hasPassword: false, confirmed: false, invitation: { id: "i1", status: "expired", expiresAt: "2026-11-20T08:00:00.000Z", mailed: false } }),
  user({ id: "u3", email: "cy@example.test", name: "Cy", lockedUntil: "until-unlocked", resetRequestedAt: "2026-11-23T07:00:00.000Z" }),
];

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function serve(calls: Call[] = []) {
  return adminServer([
    on("GET", "/api/admin/access", () => ({ body: ADMIN })),
    on("GET", "/api/admin/sign-in", () => ({ body: SIGNIN })),
    on("GET", "/api/admin/users", () => ({ body: { users: USERS, total: USERS.length, page: 1, pageSize: 25, me: "me" } }), true),
    on("GET", "/api/admin/invitations?status=pending", () => ({ body: { invitations: [] } })),
    on("POST", "/api/admin/users", (c) => {
      calls.push(c);
      return { status: 201, body: c.body && (c.body as { how: string }).how === "invite" ? { id: "new", invitation: { invitationId: "i9", mailed: false, link: "https://app.example.test/auth/join?token=tok" } } : { id: "new" } };
    }),
    on("POST", "/api/admin/users/", (c) => {
      calls.push(c);
      return { body: { ok: true } };
    }, true),
  ]);
}

describe("Admin, Users", () => {
  it("lists every account with its state in words, and passes axe", async () => {
    serve();
    const { container } = renderWithClient(<UsersTab />);
    expect(await screen.findByText("Ada")).toBeTruthy();
    const row = (id: string) => within(screen.getByTestId(`user-${id}`));
    expect(row("me").getByText("Platform administrator")).toBeTruthy();
    expect(row("u2").getByText("Invitation expired")).toBeTruthy();
    expect(row("u3").getByText("Locked until unlocked")).toBeTruthy();
    expect(row("u3").getByText(/^Asked for a reset/)).toBeTruthy();
    expect(screen.getByText("4 accounts, page 1 of 1")).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("adds a person by invitation: with no mail the link is shown once, to copy", async () => {
    const calls: Call[] = [];
    serve(calls);
    renderWithClient(<UsersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Dee" } });
    fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: "dee@example.test" } });
    expect(await axeViolations(dialog)).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Send the invitation" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({ name: "Dee", email: "dee@example.test", platformAdmin: false, how: "invite" });
    expect((await screen.findByLabelText("Invitation link")).textContent).toBe("https://app.example.test/auth/join?token=tok");
    expect(screen.getByText(/No email was sent: mail is not set up/)).toBeTruthy();
  });

  it("adds a person with a temporary password the administrator types, ticked off against the rules; nothing is generated", async () => {
    const calls: Call[] = [];
    serve(calls);
    renderWithClient(<UsersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Eve" } });
    fireEvent.change(within(dialog).getByLabelText("Email address"), { target: { value: "eve@example.test" } });
    fireEvent.click(within(dialog).getByLabelText(/Set a temporary password that you type/));
    const pw = within(dialog).getByLabelText("Temporary password") as HTMLInputElement;
    expect(pw.value).toBe("");
    fireEvent.change(pw, { target: { value: "short" } });
    expect(within(dialog).getByText("Not yet: At least 12 characters")).toBeTruthy();
    fireEvent.change(pw, { target: { value: "Typed by admin 9!" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create the account" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.body).toEqual({ name: "Eve", email: "eve@example.test", platformAdmin: false, how: "password", password: "Typed by admin 9!", markVerified: true });
  });

  it("manage: actions post one change each; your own account cannot be disabled or deleted; delete needs the address typed", async () => {
    const calls: Call[] = [];
    serve(calls);
    renderWithClient(<UsersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage cy@example.test" }));
    let dialog = await screen.findByRole("dialog");
    expect(await axeViolations(dialog)).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ path: "/api/admin/users/u3", body: { action: "unlock" } }));
    const del = within(dialog).getByRole("button", { name: "Delete the account" }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Type cy@example.test to confirm"), { target: { value: "cy@example.test" } });
    expect(del.disabled).toBe(false);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Manage jim@example.test" }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Disable the account" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Delete the account" })).toBeNull();
    expect(within(dialog).getByText(/This is your own account/)).toBeTruthy();
  });
});
