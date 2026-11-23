// @vitest-environment jsdom
// Admin, Sign-in (accounts slice 2, integration with the admin area): off, it says how it is first turned on and that
// concepts are shared; on, the platform administrator sees and saves the addresses; anyone else sees only that it is on.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { SignInTab } from "@/components/admin/SignInTab";
import { DEFAULT_RULES } from "@/lib/auth2/rules";
import { adminServer, axeViolations, on, renderWithClient, shimBrowser } from "./harness";

const ADMIN = { platformAdmin: true, capabilities: { plans: true, payments: true, email: true, voice: true }, notice: null };
const NOT_ADMIN = { platformAdmin: false, capabilities: { plans: false, payments: false, email: false, voice: false }, notice: "x" };
const SHARED = "Concepts are not yet kept apart per workspace: until that is built, every signed-in account sees and changes the same concepts, as today. Workspaces, members and invitations already work.";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Admin, Sign-in", () => {
  it("off, for the demo account: says how to turn it on from inside the container, and nothing else (review F1)", async () => {
    adminServer([
      on("GET", "/api/admin/access", () => ({ body: NOT_ADMIN })),
      on("GET", "/api/admin/sign-in", () => ({ body: { enabled: false } })),
    ]);
    renderWithClient(<SignInTab />);
    expect(await screen.findByText("docker compose exec web node scripts/sign-in.mjs on")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
    expect(screen.queryByText("admin@oxot.nl")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save the addresses" })).toBeNull();
  });

  it("on, for the platform administrator: the warning, the addresses, mail, saving and turning off", async () => {
    const puts: unknown[] = [];
    const status = { on: true, switchFrom: "database", detail: { baseURL: "http://app.example.test", trustedOrigins: [], platformAdminAddress: "admin@oxot.nl", warnings: ["The sign-in address is http://app.example.test, not https: sign-in cookies are sent unencrypted."], mail: true }, sharedConcepts: SHARED, rules: DEFAULT_RULES };
    adminServer([
      on("GET", "/api/admin/access", () => ({ body: ADMIN })),
      on("GET", "/api/admin/sign-in", () => ({ body: status })),
      on("PUT", "/api/admin/sign-in", (r) => {
        puts.push(r.body);
        return { body: status };
      }),
    ]);
    renderWithClient(<SignInTab />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/not https/);
    expect(screen.getByText(/Set up \(Admin, Email\)/)).toBeTruthy();
    expect(screen.getByRole("note").textContent).toBe(SHARED);
    fireEvent.change(screen.getByLabelText("Address of this installation"), { target: { value: "https://app.example.test" } });
    fireEvent.change(screen.getByLabelText("Other addresses it is opened at"), { target: { value: "https://other.example.test" } });
    fireEvent.click(await screen.findByRole("button", { name: "Save the addresses" }));
    await waitFor(() => expect(puts).toEqual([{ baseURL: "https://app.example.test", trustedOrigins: ["https://other.example.test"] }]));
    expect(screen.getByRole("button", { name: "Turn the new sign-in off" })).toBeTruthy();
  });

  it("the account rules: defaults shown, saved as numbers and flags, 'until unlocked' sends 0, and the panel passes axe", async () => {
    const puts: unknown[] = [];
    const status = { on: true, switchFrom: "database", detail: { baseURL: "https://app.example.test", trustedOrigins: [], platformAdminAddress: null, warnings: [], mail: false }, sharedConcepts: SHARED, rules: DEFAULT_RULES };
    adminServer([
      on("GET", "/api/admin/access", () => ({ body: ADMIN })),
      on("GET", "/api/admin/sign-in", () => ({ body: status })),
      on("PUT", "/api/admin/sign-in", (r) => {
        puts.push(r.body);
        return { body: status };
      }),
    ]);
    const { container } = renderWithClient(<SignInTab />);
    expect(((await screen.findByLabelText("Days an invitation works")) as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Failed sign-ins in a row before the lock") as HTMLInputElement).value).toBe("7");
    expect((screen.getByLabelText("Minutes the lock lasts") as HTMLInputElement).value).toBe("15");
    expect((screen.getByLabelText("Shortest password") as HTMLInputElement).value).toBe("12");
    expect((screen.getByLabelText("Anyone may create an account themselves") as HTMLInputElement).checked).toBe(false);
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.change(screen.getByLabelText("Days an invitation works"), { target: { value: "10" } });
    fireEvent.click(screen.getByLabelText(/Until an administrator unlocks it/));
    fireEvent.click(screen.getByLabelText("A symbol"));
    fireEvent.click(screen.getByRole("button", { name: "Save the account rules" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ rules: { inviteExpiryDays: 10, maxFailures: 7, lockMinutes: 0, password: { minLength: 12, upper: true, lower: true, digit: true, symbol: false, notEmailOrName: true, notCommon: true }, signUpOpen: false } });
  });

  it("on, for anyone else: only that it is on", async () => {
    adminServer([
      on("GET", "/api/admin/access", () => ({ body: NOT_ADMIN })),
      on("GET", "/api/admin/sign-in", () => ({ body: { enabled: true } })),
    ]);
    renderWithClient(<SignInTab />);
    expect(await screen.findByText("The addresses are shown to the platform administrator only.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn the new sign-in off" })).toBeNull();
  });
});
