// @vitest-environment jsdom
// The new sign-in's screens: with AUTH2 off none exists (404); with it on, the forms check before sending, show the
// server's refusals as plain sentences that take the focus, and move on to the right next screen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { plainError } from "@/lib/auth2/errors";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push, replace: vi.fn(), refresh }) }));
// The pages call connection() to read AUTH2 per request; outside a request it would throw.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => undefined }));

const assign = vi.fn();
type Reply = { status: number; body: unknown };
let replies: Reply[] = [];
// Typed with the arguments the tests read back from mock.calls.
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const r = replies.shift() ?? { status: 200, body: {} };
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
});

beforeEach(() => {
  replies = [];
  push.mockReset();
  assign.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.AUTH2;
});

type Page = { default: (a: typeof params) => Promise<unknown> };
const PAGES: [string, () => Promise<Page>][] = [
  ["sign-up", () => import("@/app/(account)/auth/sign-up/page")],
  ["check-email", () => import("@/app/(account)/auth/check-email/page")],
  ["confirm", () => import("@/app/(account)/auth/confirm/page")],
  ["sign-in", () => import("@/app/(account)/auth/sign-in/page")],
  ["two-factor", () => import("@/app/(account)/auth/two-factor/page")],
  ["two-factor/setup", () => import("@/app/(account)/auth/two-factor/setup/page") as Promise<Page>],
  ["account", () => import("@/app/(account)/auth/account/page") as Promise<Page>],
  ["reset", () => import("@/app/(account)/auth/reset/page") as Promise<Page>],
  ["reset/new", () => import("@/app/(account)/auth/reset/new/page")],
  ["password", () => import("@/app/(account)/auth/password/page") as Promise<Page>],
  ["workspaces", () => import("@/app/(account)/auth/workspaces/page") as Promise<Page>],
  ["invite", () => import("@/app/(account)/auth/invite/page") as Promise<Page>],
  ["workspace", () => import("@/app/(account)/auth/workspace/page") as Promise<Page>],
];
const params = { searchParams: Promise.resolve({}) };

describe("with AUTH2 off", () => {
  it.each(PAGES)("/auth/%s is not found", async (_p, load) => {
    delete process.env.AUTH2;
    const mod = await load();
    await expect(mod.default(params)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("the layout is not found either", async () => {
    const mod = await import("@/app/(account)/auth/layout");
    await expect(mod.default({ children: null })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});

describe("plain sentences for Better Auth's refusals", () => {
  it("maps codes and statuses, never showing Better Auth's own wording", () => {
    expect(plainError(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" })).toBe("That email address and password do not match an account. Check both and try again.");
    expect(plainError(401, { code: "CODE_ALREADY_USED" })).toMatch(/already been used/);
    expect(plainError(429, {})).toMatch(/Too many tries/);
    expect(plainError(400, { error: "The request is larger than 0.1 MB, the most this address takes." })).toMatch(/larger than/);
    expect(plainError(500, null)).toMatch(/could not complete/);
  });
});

describe("with AUTH2 on", () => {
  beforeEach(() => {
    process.env.AUTH2 = "1";
  });

  it("sign-up checks the fields before sending, with each problem tied to its field", async () => {
    const { SignUpForm } = await import("@/app/(account)/auth/sign-up/SignUpForm");
    render(<SignUpForm />);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your name.")).toBeTruthy();
    const email = screen.getByLabelText("Email address");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(email.getAttribute("aria-describedby")!)?.textContent).toBe("Enter your email address.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sign-up sends and moves to 'check your email'", async () => {
    const { SignUpForm } = await import("@/app/(account)/auth/sign-up/SignUpForm");
    render(<SignUpForm />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long enough" } });
    fireEvent.change(screen.getByLabelText("Password again"), { target: { value: "long enough" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/check-email?email=ada%40example.test"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth2/sign-up/email");
  });

  it("sign-in shows a refusal as a plain sentence that takes the focus, and offers the link again when unconfirmed", async () => {
    const { SignInForm } = await import("@/app/(account)/auth/sign-in/SignInForm");
    render(<SignInForm next="/auth/account" />);
    replies.push({ status: 403, body: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "bea@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "whatever1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/^Confirm your email address first/);
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(screen.getByRole("link", { name: "Send the confirmation link again" }).getAttribute("href")).toBe("/auth/check-email?email=bea%40example.test");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });

  it("sign-in goes to the code prompt when the account has an authenticator app", async () => {
    const { SignInForm } = await import("@/app/(account)/auth/sign-in/SignInForm");
    render(<SignInForm next="/auth/password" />);
    replies.push({ status: 200, body: { twoFactorRedirect: true } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "c@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "whatever1" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/two-factor?next=%2Fauth%2Fpassword"));
  });

  it("the code prompt takes six digits, says when a code was used already, and switches to a recovery code", async () => {
    const { CodeForm } = await import("@/app/(account)/auth/two-factor/CodeForm");
    render(<CodeForm next="/auth/account" />);
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "12a" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter the six digits your authenticator app shows.")).toBeTruthy();
    replies.push({ status: 401, body: { code: "CODE_ALREADY_USED" } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "123 456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/already been used/)).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ code: "123456" });
    fireEvent.click(screen.getByRole("button", { name: /Use a recovery code/ }));
    expect(screen.getByRole("heading", { name: "Use a recovery code" })).toBeTruthy();
    replies.push({ status: 200, body: {} });
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "abcde-fghij" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/auth/account"));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth2/two-factor/verify-backup-code");
  });

  it("reset asks for the address and answers the same whether or not it has an account", async () => {
    const { ResetRequest } = await import("@/app/(account)/auth/reset/ResetRequest");
    render(<ResetRequest />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "d@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send the link" }));
    expect((await screen.findByRole("status")).textContent).toBe("If d@example.test has an account here, a link is on its way. It works once, for one hour.");
  });

  it("a used reset link says so in plain words", async () => {
    const { NewPassword } = await import("@/app/(account)/auth/reset/new/NewPassword");
    render(<NewPassword token="t0k3n" />);
    replies.push({ status: 400, body: { code: "INVALID_TOKEN", message: "Invalid token" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new password 1" } });
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "new password 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the new password" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/^This link is not valid/);
  });

  it("change password puts a wrong current password on that field", async () => {
    const { ChangePassword } = await import("@/app/(account)/auth/password/ChangePassword");
    render(<ChangePassword />);
    replies.push({ status: 400, body: { code: "INVALID_PASSWORD" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong one" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new password 1" } });
    fireEvent.change(screen.getByLabelText("New password again"), { target: { value: "new password 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("That is not your current password.")).toBeTruthy();
    expect(screen.getByLabelText("Current password").getAttribute("aria-invalid")).toBe("true");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ currentPassword: "wrong one", newPassword: "new password 1", revokeOtherSessions: true });
  });

  it("in 'no mail' mode, sign-up says an administrator confirms the account, and reset says whom to ask", async () => {
    const { SignUpForm } = await import("@/app/(account)/auth/sign-up/SignUpForm");
    render(<SignUpForm mail={false} />);
    expect(screen.getByText(/An administrator confirms new accounts/)).toBeTruthy();
    cleanup();
    const { CheckEmail } = await import("@/app/(account)/auth/check-email/CheckEmail");
    render(<CheckEmail email="e@example.test" mail={false} />);
    expect(screen.getByRole("heading", { name: "Account created" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send the link again/ })).toBeNull();
    cleanup();
    const { ResetRequest } = await import("@/app/(account)/auth/reset/ResetRequest");
    render(<ResetRequest mail={false} />);
    expect(screen.getByText(/Ask an administrator/)).toBeTruthy();
    expect(screen.queryByLabelText("Email address")).toBeNull();
  });

  it("sign-up from an invitation fills the address and comes back to the invitation", async () => {
    const { SignUpForm } = await import("@/app/(account)/auth/sign-up/SignUpForm");
    render(<SignUpForm email="inv@example.test" next="/auth/invite?token=abc" />);
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("inv@example.test");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ivy" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long enough" } });
    fireEvent.change(screen.getByLabelText("Password again"), { target: { value: "long enough" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/check-email?email=inv%40example.test&next=%2Fauth%2Finvite%3Ftoken%3Dabc"));
  });

  it("the invitation page: signed out it offers sign-in and sign-up; for another account it says so; for the invitee it joins", async () => {
    const { InviteView } = await import("@/app/(account)/auth/invite/InviteView");
    const inv = { workspace: "Bag Lab", inviter: "Ada", email: "ivy@example.test", role: "member" as const, state: "open" as const };
    render(<InviteView token="tok" invitation={inv} signedInAs={null} />);
    expect(screen.getByRole("link", { name: "Sign in to accept" }).getAttribute("href")).toBe("/auth/sign-in?next=%2Fauth%2Finvite%3Ftoken%3Dtok");
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toContain("email=ivy%40example.test");
    cleanup();
    render(<InviteView token="tok" invitation={inv} signedInAs="someone@example.test" />);
    expect(screen.getByText(/This invitation is for another address/)).toBeTruthy();
    cleanup();
    render(<InviteView token="tok" invitation={inv} signedInAs="Ivy@example.test" />);
    replies.push({ status: 200, body: { workspaceId: "w", role: "member" } });
    fireEvent.click(screen.getByRole("button", { name: "Join Bag Lab" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/auth/workspaces"));
    cleanup();
    render(<InviteView token="tok" invitation={{ ...inv, state: "used" }} signedInAs={null} />);
    expect(screen.getByText(/accepted already/)).toBeTruthy();
  });

  it("while a workspace requires two-step sign-in, the set-up page says so and offers no way to turn it off", async () => {
    const { TwoFactorSetup } = await import("@/app/(account)/auth/two-factor/setup/TwoFactorSetup");
    render(<TwoFactorSetup enabled={false} email="r@example.test" required />);
    expect(screen.getByRole("status").textContent).toMatch(/requires two-step sign-in/);
    expect(screen.queryByRole("link", { name: "Back to your account" })).toBeNull();
    cleanup();
    render(<TwoFactorSetup enabled email="r@example.test" required />);
    expect(screen.queryByRole("button", { name: "Turn off two-step sign-in" })).toBeNull();
    expect(screen.getByText(/cannot be turned off/)).toBeTruthy();
  });

  const view = (role: "owner" | "admin" | "member") => ({
    workspace: { id: "w1", name: "Bag Lab", role },
    members: [
      { memberId: "m1", name: "Olive", email: "o@example.test", role: "owner" as const, joinedAt: "2026-11-01T00:00:00Z", you: role === "owner", ...(role !== "member" ? { twoFactor: true, required: false, manageable: false } : {}) },
      { memberId: "m2", name: "Max", email: "m@example.test", role: "member" as const, joinedAt: "2026-11-02T00:00:00Z", you: role === "member", ...(role !== "member" ? { twoFactor: false, required: true, manageable: true } : {}) },
    ],
    ...(role !== "member" ? { admin: { twoFactorRequired: false, invitations: [{ id: "i1", email: "new@example.test", role: "admin" as const, expiresAt: "2026-11-24T00:00:00Z", invitedBy: "Olive", sentAt: null, sends: 1 }] } } : {}),
  });

  it("the members screen: an owner sees two-step state, invitations, the policy and delete; a member only the list", async () => {
    const { MembersScreen } = await import("@/app/(account)/auth/workspace/MembersScreen");
    render(<MembersScreen view={view("owner")} mail />);
    expect(screen.getByRole("heading", { name: "Bag Lab" })).toBeTruthy();
    expect(screen.getByText("Not set up")).toBeTruthy();
    expect(screen.getByText("Required of them")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Role of Max" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke the invitation to new@example.test" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete the workspace" })).toBeTruthy();
    expect(screen.getByLabelText("Two-step sign-in")).toBeTruthy();
    cleanup();
    render(<MembersScreen view={view("member")} mail />);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText("Two-step sign-in")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Invite someone" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("inviting in 'no mail' mode shows the link to hand over", async () => {
    const { MembersScreen } = await import("@/app/(account)/auth/workspace/MembersScreen");
    render(<MembersScreen view={view("admin")} mail={false} />);
    // An admin cannot give the owner role.
    expect([...(screen.getByLabelText("Role") as HTMLSelectElement).options].map((o) => o.value)).toEqual(["admin", "member"]);
    replies.push({ status: 200, body: { invitationId: "i2", email: "x@example.test", role: "member", mailed: false, link: "http://localhost:3322/auth/invite?token=abc" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "x@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect((await screen.findByText("http://localhost:3322/auth/invite?token=abc")).getAttribute("data-invite-link")).not.toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ workspaceId: "w1", email: "x@example.test", role: "member" });
  });
});
