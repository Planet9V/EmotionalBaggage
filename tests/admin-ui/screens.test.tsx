// @vitest-environment jsdom
// The Admin screens (src/components/admin): secrets are never shown in full, presets fill the embedding
// form, a refused save keeps the form and shows the server's reason, the audit filters build the right
// query and mark deleted concepts, and the printer form is built from the family definition.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { CredentialsTab } from "@/components/admin/CredentialsTab";
import { ModelsTab } from "@/components/admin/ModelsTab";
import { AuditTab } from "@/components/admin/AuditTab";
import { PrintersTab } from "@/components/admin/PrintersTab";
import { auditQueryString, type AdminSettings, type PrinterFamily, type ProviderView } from "@/lib/admin/client";
import { adminServer, on, renderWithClient, shimBrowser } from "./harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DEFAULTS = { ollama: "http://host.docker.internal:11434/v1", lmstudio: "http://host.docker.internal:1234/v1", openrouter: "https://openrouter.ai/api/v1" };
const settingsOf = (o: Partial<AdminSettings> = {}): AdminSettings => ({
  reasoningModel: null,
  embeddingModel: null,
  plannerUrl: null,
  plannerEffective: { url: null, source: null },
  slicerUrl: null,
  slicerEffective: { url: null, source: null },
  defaultConcept: null,
  defaultBaseUrl: DEFAULTS,
  ...o,
});

const openrouter = (o: Partial<ProviderView["fields"][number]> = {}): ProviderView => ({
  id: "openrouter",
  label: "OpenRouter",
  purpose: "Hosted models.",
  configured: !!o.set,
  fields: [{ name: "apiKey", label: "API key", secret: true, required: true, set: false, source: null, last4: null, value: null, updatedAt: null, ...o }],
});

describe("Credentials", () => {
  it("never renders a key in full: after saving only its last four characters show", async () => {
    const KEY = "sk-or-v1-0123456789abcdefWXYZ";
    let saved = false;
    const server = adminServer([
      on("GET", "/api/admin/credentials", () => ({ body: { providers: [saved ? openrouter({ set: true, source: "admin", last4: "WXYZ" }) : openrouter()] } })),
      on("PUT", "/api/admin/credentials/openrouter", (c) => {
        expect(c.body).toEqual({ fields: { apiKey: KEY } });
        saved = true;
        return { body: { provider: openrouter({ set: true, source: "admin", last4: "WXYZ" }) } };
      }),
      on("GET", "/api/admin/credentials/audit", () => ({ body: { entries: [{ at: new Date().toISOString(), action: "set", provider: "openrouter", field: "apiKey" }] } })),
      on("GET", "/api/admin/settings", () => ({ body: { settings: settingsOf() } })),
    ]);
    renderWithClient(<CredentialsTab />);
    const input = (await screen.findByLabelText(/API key/)) as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.change(input, { target: { value: KEY } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("state-openrouter-apiKey").textContent).toBe("Set, ending in WXYZ."));
    expect(input.value).toBe("");
    expect(document.body.innerHTML).not.toContain(KEY);
    expect(document.body.innerHTML).not.toContain(KEY.slice(0, -4));
    // the key went in the request body only, never in an address
    expect(server.calls.every((c) => !c.path.includes(KEY.slice(4, 12)))).toBe(true);
  });
});

describe("Models", () => {
  it("fills the embedding form from the Qwen3 Ollama preset at 4096, and saves nothing until Save", async () => {
    const server = adminServer([
      on("GET", "/api/admin/settings", () => ({ body: { settings: settingsOf() } })),
      on("GET", "/api/admin/credentials", () => ({ body: { providers: [openrouter()] } })),
    ]);
    renderWithClient(<ModelsTab />);
    const form = await screen.findByRole("form", { name: "Embedding model" });
    const panel = form.closest("section")!;
    fireEvent.keyDown(within(panel).getByRole("button", { name: /Start from/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Qwen3 Embedding 8B on Ollama (4,096)" }));
    await waitFor(() => expect((within(form).getByLabelText(/Vector width/) as HTMLInputElement).value).toBe("4096"));
    expect((within(form).getByLabelText(/Model name/) as HTMLInputElement).value).toBe("qwen3-embedding:8b");
    expect((within(form).getByLabelText(/Address/) as HTMLInputElement).value).toBe("http://host.docker.internal:11434/v1");
    expect(within(form).getByLabelText(/Provider/).textContent).toContain("Ollama");
    expect(within(form).getByText(/ollama pull qwen3-embedding:8b/)).toBeTruthy();
    expect(within(form).getByText(/This width is one of them/)).toBeTruthy();
    expect(server.calls.filter((c) => c.method === "PUT")).toEqual([]);
  });

  it("shows the server's reason for a refused save and keeps what was typed", async () => {
    const REASON = "reasoningModel.model: that model name is refused by the server";
    adminServer([
      on("GET", "/api/admin/settings", () => ({
        body: { settings: settingsOf({ reasoningModel: { provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "qwen3" } }) },
      })),
      on("GET", "/api/admin/credentials", () => ({ body: { providers: [openrouter()] } })),
      on("PUT", "/api/admin/settings", () => ({ status: 400, body: { error: REASON } })),
    ]);
    renderWithClient(<ModelsTab />);
    const form = await screen.findByRole("form", { name: "Reasoning model" });
    const model = within(form).getByLabelText(/Model name/) as HTMLInputElement;
    expect(model.value).toBe("qwen3");
    fireEvent.change(model, { target: { value: "my-new-model" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    const alert = await within(form).findByRole("alert");
    expect(alert.textContent).toBe(REASON);
    expect((within(form).getByLabelText(/Model name/) as HTMLInputElement).value).toBe("my-new-model");
    expect((within(form).getByLabelText(/Address/) as HTMLInputElement).value).toBe("http://localhost:11434/v1");
  });

  it("puts the provider's default address in when the address is empty or still a default", async () => {
    const { addressFor } = await import("@/components/admin/ModelsTab");
    expect(addressFor("openrouter", "", DEFAULTS)).toBe(DEFAULTS.openrouter);
    expect(addressFor("lmstudio", DEFAULTS.ollama, DEFAULTS)).toBe(DEFAULTS.lmstudio);
    expect(addressFor("lmstudio", "http://gpu-box:11434/v1", DEFAULTS)).toBe("http://gpu-box:11434/v1");
  });
});

describe("Audit log", () => {
  it("builds the query string from only the filters that are set", () => {
    expect(auditQueryString({})).toBe("");
    expect(auditQueryString({ project: "p 1", action: "item.", q: "  battery " }, { before: 40, limit: 100 })).toBe("?project=p+1&action=item.&q=battery&before=40&limit=100");
    expect(auditQueryString({ q: "   " })).toBe("");
    expect(auditQueryString({ hide: "session.started", action: "item." })).toBe("?action=item.&hide=session.started");
  });

  it("hides sign-in lines by default, says so, shows them on request, and shows them when the Sign-in kind is chosen", async () => {
    const server = adminServer([on("GET", "/api/admin/audit", () => ({ body: { entries: [{ id: 5, at: "2026-11-20T10:00:00.000Z", actor: "demo", projectId: "", projectName: "", action: "item.added", summary: "line 5", detail: {} }], next: null, concepts: [] } }), true)]);
    renderWithClient(<AuditTab />);
    await screen.findByTestId("audit-5");
    expect(screen.getByText(/Sign-ins hidden\./)).toBeTruthy();
    expect(server.calls.some((c) => c.path === "/api/admin/audit?hide=session.started&limit=100")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    await waitFor(() => expect(server.calls.some((c) => c.path === "/api/admin/audit?limit=100")).toBe(true));
    expect(screen.getByText(/Sign-ins shown\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    // a native select (U27): choose by value, as the keyboard and a touch screen do
    const kind = screen.getByLabelText("Kind of change") as HTMLSelectElement;
    fireEvent.change(kind, { target: { value: within(kind).getByRole("option", { name: "Sign-in" }).getAttribute("value") } });
    await waitFor(() => expect(server.calls.some((c) => c.path === "/api/admin/audit?action=session.&limit=100")).toBe(true));
    expect(screen.queryByText(/Sign-ins hidden\./)).toBeNull();
  });

  it("marks deleted concepts and filters by one with the right query", async () => {
    const concepts = [
      { id: "lamp", name: "Desk lamp", exists: true },
      { id: "gone-1", name: "Old speaker", exists: false },
    ];
    const line = (id: number, projectId: string, projectName: string) => ({
      id, at: "2026-11-20T10:00:00.000Z", actor: "demo", projectId, projectName, action: "item.added", summary: `line ${id}`, detail: { n: id },
    });
    const server = adminServer([
      on("GET", "/api/admin/audit", (c) => {
        const p = new URL(c.path, "http://x").searchParams.get("project");
        const entries = p === "gone-1" ? [line(2, "gone-1", "Old speaker")] : [line(3, "lamp", "Desk lamp"), line(2, "gone-1", "Old speaker")];
        return { body: { entries, next: null, concepts } };
      }, true),
    ]);
    renderWithClient(<AuditTab />);
    const deletedRow = await screen.findByTestId("audit-2");
    expect(within(deletedRow).getByText("deleted")).toBeTruthy();
    expect(within(screen.getByTestId("audit-3")).queryByText("deleted")).toBeNull();

    const conceptSelect = screen.getByLabelText("Concept") as HTMLSelectElement;
    const option = within(conceptSelect).getByRole("option", { name: "Old speaker (deleted)" });
    expect(within(conceptSelect).getByRole("option", { name: "Desk lamp" })).toBeTruthy();
    fireEvent.change(conceptSelect, { target: { value: option.getAttribute("value") } });
    await waitFor(() => expect(server.calls.some((c) => c.path === "/api/admin/audit?project=gone-1&hide=session.started&limit=100")).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("audit-3")).toBeNull());

    fireEvent.click(within(screen.getByTestId("audit-2")).getByRole("button", { name: /Show details/ }));
    expect(document.getElementById("audit-detail-2")!.textContent).toBe(JSON.stringify({ n: 2 }, null, 2));
  });
});

describe("Printers", () => {
  it("builds the form from the family definition and says honestly what the family can do", async () => {
    const families: PrinterFamily[] = [
      {
        id: "testfam",
        label: "Test Family",
        status: "planned",
        fields: [
          { name: "address", label: "Address", secret: false, required: true, kind: "url", hint: "For example http://x.local" },
          { name: "username", label: "User name", secret: false, required: true, kind: "text" },
          { name: "token", label: "Shared token", secret: true, required: false, kind: "text", hint: "Only if set." },
        ],
        atPrinter: "Switch the network on.",
        source: "https://example.com/spec",
      },
      { id: "octoprint", label: "OctoPrint", status: "supported", fields: [], atPrinter: "Running.", source: "x" },
      { id: "creality", label: "Creality", status: "planned", fields: [], atPrinter: "Not known yet.", source: "none found" },
    ];
    const server = adminServer([
      on("GET", "/api/admin/printers", () => ({ body: { printers: [] } })),
      on("GET", "/api/admin/printer-families", () => ({ body: { families } })),
      on("POST", "/api/admin/printers", () => ({ status: 400, body: { error: "access.address: must start with http:// or https://" } })),
    ]);
    renderWithClient(<PrintersTab />);
    expect(within(await screen.findByTestId("family-testfam")).getByText("Saved but not driven")).toBeTruthy();
    expect(within(screen.getByTestId("family-octoprint")).getByText("Testable today")).toBeTruthy();
    expect(within(screen.getByTestId("family-creality")).getByText("No documented fields")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /Add printer/ })[0]);
    const form = await screen.findByRole("form", { name: "Add a printer" });
    const family = within(form).getByLabelText(/Family/) as HTMLSelectElement;
    fireEvent.change(family, { target: { value: within(family).getByRole("option", { name: /Test Family/ }).getAttribute("value") } });

    const fields = await within(form).findByTestId("family-fields");
    const address = within(fields).getByLabelText(/Address/) as HTMLInputElement;
    const user = within(fields).getByLabelText(/User name/) as HTMLInputElement;
    const token = within(fields).getByLabelText(/Shared token/) as HTMLInputElement;
    expect(address.type).toBe("text");
    expect(token.type).toBe("password");
    expect(within(fields).getByText("Address").textContent).toBe("Address (required)");
    expect(within(fields).getByText("Shared token").textContent).toBe("Shared token");
    expect(within(fields).getByText("For example http://x.local")).toBeTruthy();
    expect(within(fields).getByText(/At the printer: Switch the network on/)).toBeTruthy();
    expect(within(fields).getByText("Saved but not driven")).toBeTruthy();

    // required fields are checked before anything is sent
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: "Bench printer" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add printer" }));
    expect(await within(form).findByText("User name is required for Test Family.")).toBeTruthy();
    expect(server.calls.filter((c) => c.method === "POST")).toEqual([]);

    // a refused save keeps the form and shows the server's sentence
    fireEvent.change(address, { target: { value: "http://bench.local" } });
    fireEvent.change(user, { target: { value: "maker" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add printer" }));
    await waitFor(() => expect(within(form).getByText("access.address: must start with http:// or https://")).toBeTruthy());
    expect(server.calls.find((c) => c.method === "POST")!.body).toEqual({ name: "Bench printer", family: "testfam", model: "", access: { address: "http://bench.local", username: "maker" } });
    expect(user.value).toBe("maker");
  });
});
