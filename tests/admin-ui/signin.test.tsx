// @vitest-environment jsdom
// Admin, Sign-in (accounts slice 2, integration with the admin area): off, it says how it is first turned on and that
// concepts are shared; on, the platform administrator sees and saves the addresses; anyone else sees only that it is on.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { SignInTab } from "@/components/admin/SignInTab";
import { adminServer, on, renderWithClient, shimBrowser } from "./harness";

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
    const status = { on: true, switchFrom: "database", detail: { baseURL: "http://app.example.test", trustedOrigins: [], platformAdminAddress: "admin@oxot.nl", warnings: ["The sign-in address is http://app.example.test, not https: sign-in cookies are sent unencrypted."], mail: true }, sharedConcepts: SHARED };
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
