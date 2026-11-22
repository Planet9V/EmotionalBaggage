// @vitest-environment jsdom
// The platform admin sections (WS10a): the Overview's service lines, Payments' mode and webhook address, the
// Pricing editor's checks before anything is sent, and the Email form's write-only password.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { SetupTab } from "@/components/admin/SetupTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { PricingTab } from "@/components/admin/PricingTab";
import { EmailTab } from "@/components/admin/EmailTab";
import { builtInCatalogue } from "@/lib/admin/planSchema";
import type { AdminSettings, ProviderView, ServiceStatus } from "@/lib/admin/client";
import { AdminView } from "@/components/admin/AdminView";
import { adminServer, on, renderWithClient, shimBrowser } from "./harness";

// AdminView reads ?tab= from the address.
const nav = vi.hoisted(() => ({ tab: "payments" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(`tab=${nav.tab}`), useRouter: () => ({ replace: () => undefined }), usePathname: () => "/admin" }));

const NOTICE = "These settings are changed by the platform administrator. That account is created when the new sign-in is switched on.";
const ADMIN = { platformAdmin: true, capabilities: { plans: true, payments: true, email: true, voice: true }, notice: null };
const NOT_ADMIN = { platformAdmin: false, capabilities: { plans: false, payments: false, email: false, voice: false }, notice: NOTICE };
/** The platform administrator (only through the new sign-in), for the tests that save. */
const asPlatformAdmin = on("GET", "/api/admin/access", () => ({ body: ADMIN }));

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const svc = (o: Partial<ServiceStatus>): ServiceStatus => ({ key: "payments", label: "Payments (Stripe)", tab: "payments", state: "not-configured", summary: "No Stripe keys are saved.", source: null, lastCheck: null, without: "Nothing can be bought.", ...o });

describe("Overview", () => {
  it("shows each service's state in words, what is off, and a failing last test", async () => {
    adminServer([
      on("GET", "/api/admin/overview", () => ({
        body: {
          services: [
            svc({}),
            svc({ key: "email", label: "Email", tab: "email", state: "failing", source: "database", summary: "Sends through smtp.example.test:587.", lastCheck: { at: new Date().toISOString(), ok: false, message: "The mail server refused the user name or password." } }),
          ],
        },
      })),
      on("GET", "/api/admin/status", () => ({ body: { complete: false, items: [], defaultPassword: false } })),
    ]);
    const open = vi.fn();
    renderWithClient(<SetupTab onOpenTab={open} />);
    const pay = (await screen.findByText("Payments (Stripe)")).closest("li")!;
    expect(within(pay).getByText("Not configured")).toBeTruthy();
    expect(pay.textContent).toContain("Without it: Nothing can be bought.");
    const email = screen.getByText("Email").closest("li")!;
    expect(within(email).getByText("Configured, but failing")).toBeTruthy();
    expect(email.textContent).toContain("refused the user name or password");
    fireEvent.click(within(email).getByRole("button", { name: /Open Email for Email/ }));
    expect(open).toHaveBeenCalledWith("email");
  });
});

const stripe = (o: Partial<ProviderView> = {}): ProviderView => ({
  id: "stripe",
  label: "Stripe",
  purpose: "Payments.",
  configured: true,
  fields: [
    { name: "publishableKey", label: "Publishable key", secret: false, required: true, set: true, source: "admin", last4: null, value: "pk_test_abc", updatedAt: null },
    { name: "secretKey", label: "Secret key", secret: true, required: true, set: true, source: "admin", last4: "WXYZ", value: null, updatedAt: null },
    { name: "webhookSecret", label: "Webhook signing secret", secret: true, required: false, set: false, source: null, last4: null, value: null, updatedAt: null },
  ],
  ...o,
});

describe("Payments", () => {
  it("shows the mode from the key prefix, the webhook address, and the secret only by its last four", async () => {
    adminServer([
      on("GET", "/api/admin/payments", () => ({ body: { configured: true, mode: "test", webhookSecret: false, webhookPath: "/api/billing/stripe/webhook" } })),
      on("GET", "/api/admin/credentials", () => ({ body: { providers: [stripe()] } })),
      on("GET", "/api/admin/settings", () => ({ body: { settings: {} } })),
    ]);
    renderWithClient(<PaymentsTab />);
    expect((await screen.findByTestId("stripe-mode")).textContent).toBe("Test mode: no real money");
    expect((screen.getByLabelText("Webhook address") as HTMLInputElement).value).toMatch(/\/api\/billing\/stripe\/webhook$/);
    expect((await screen.findByTestId("state-stripe-secretKey")).textContent).toBe("Set, ending in WXYZ.");
    expect((screen.getByLabelText(/Secret key/) as HTMLInputElement).value).toBe("");
  });
});

describe("Pricing and tiers", () => {
  it("names a negative price at its field and sends nothing", async () => {
    const { calls } = adminServer([asPlatformAdmin, on("GET", "/api/admin/plans", () => ({ body: { catalogue: builtInCatalogue(), source: "built-in", limits: [] } }))]);
    renderWithClient(<PricingTab />);
    const price = (await screen.findAllByLabelText("Price a month"))[1] as HTMLInputElement;
    fireEvent.change(price, { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save the catalogue" }));
    await waitFor(() => expect(screen.getByText("cannot be negative")).toBeTruthy());
    expect(price.getAttribute("aria-invalid")).toBe("true");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("sends the whole catalogue with the prices switch on", async () => {
    const { calls } = adminServer([
      asPlatformAdmin,
      on("GET", "/api/admin/plans", () => ({ body: { catalogue: builtInCatalogue(), source: "built-in", limits: [] } })),
      on("PUT", "/api/admin/plans", (c) => ({ body: { catalogue: c.body, source: "database", limits: [] } })),
    ]);
    renderWithClient(<PricingTab />);
    fireEvent.click(await screen.findByRole("switch", { name: "Show prices on the public page" }));
    fireEvent.click(screen.getByRole("button", { name: "Save the catalogue" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")).toBeTruthy());
    const sent = calls.find((c) => c.method === "PUT")!.body as ReturnType<typeof builtInCatalogue>;
    expect(sent.showPrices).toBe(true);
    expect(sent.tiers.map((t) => t.key)).toEqual(["free", "maker", "studio", "self"]);
    expect(sent.tiers[1].priceMonthly).toBe(29);
  });
});

describe("Email", () => {
  const settings = (o: Partial<AdminSettings> = {}) => ({ settings: { mail: { mode: "smtp", fromName: "C2R", fromAddress: "noreply@example.test", host: "smtp.example.test", port: 587, security: "starttls", username: "c2r" }, voice: { provider: "none" }, ...o } });
  it("saves the server, and the password card shows only that a password is set", async () => {
    const { calls } = adminServer([
      asPlatformAdmin,
      on("GET", "/api/admin/settings", () => ({ body: settings() })),
      on("PUT", "/api/admin/settings", () => ({ body: settings() })),
      on("GET", "/api/admin/credentials", () => ({ body: { providers: [{ id: "smtp", label: "Mail server (SMTP)", purpose: "Email.", configured: true, fields: [{ name: "password", label: "SMTP password", secret: true, required: false, set: true, source: "admin", last4: "9876", value: null, updatedAt: null }] }] } })),
    ]);
    renderWithClient(<EmailTab />);
    expect((await screen.findByTestId("state-smtp-password")).textContent).toBe("Set, ending in 9876.");
    fireEvent.change(screen.getByLabelText(/^Port/), { target: { value: "2525" } });
    fireEvent.click(within(screen.getByRole("form", { name: "Mail server" })).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")).toBeTruthy());
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ mail: { mode: "smtp", fromName: "C2R", fromAddress: "noreply@example.test", host: "smtp.example.test", port: 2525, security: "starttls", username: "c2r" } });
  });
});

describe("anyone but the platform administrator", () => {
  const server = () =>
    adminServer([
      on("GET", "/api/admin/access", () => ({ body: NOT_ADMIN })),
      on("GET", "/api/admin/payments", () => ({ body: { configured: true, hidden: true, webhookPath: "/api/billing/stripe/webhook" } })),
      on("GET", "/api/admin/credentials", () => ({ body: { providers: [stripe({ locked: true, fields: stripe().fields.map((f) => ({ ...f, last4: null, value: null, masked: f.set })) })] } })),
      on("GET", "/api/admin/settings", () => ({ body: { settings: { mail: { mode: "smtp", hidden: true }, voice: { provider: "none" } } } })),
      on("GET", "/api/admin/plans", () => ({ body: { catalogue: builtInCatalogue(), source: "built-in", limits: [] } })),
    ]);

  it("sees the one notice on Payments, set or not set only, and Save, Remove and Test are off", async () => {
    server();
    nav.tab = "payments";
    renderWithClient(<AdminView />);
    expect((await screen.findByTestId("platform-admin-notice")).textContent).toBe(NOTICE);
    expect((await screen.findByTestId("stripe-mode")).textContent).toBe("Set up");
    expect((await screen.findByTestId("state-stripe-secretKey")).textContent).toBe("Set.");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Test connection" }) as HTMLButtonElement).disabled).toBe(true);
    for (const b of screen.getAllByRole("button", { name: "Remove" })) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it("cannot save the plan catalogue", async () => {
    server();
    nav.tab = "pricing";
    renderWithClient(<AdminView />);
    expect(await screen.findByTestId("platform-admin-notice")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Save the catalogue" }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("sees that a mail server is set up, without its details", async () => {
    server();
    nav.tab = "email";
    renderWithClient(<AdminView />);
    expect(await screen.findByText("A mail server is set up. Its details are shown to the platform administrator only.")).toBeTruthy();
  });

  it("sees no notice on a section that existed before (Sales channels)", async () => {
    server();
    nav.tab = "channels";
    renderWithClient(<AdminView />);
    await screen.findByRole("link", { name: "Integrations" });
    expect(screen.queryByTestId("platform-admin-notice")).toBeNull();
  });
});
