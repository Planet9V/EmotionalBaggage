// @vitest-environment jsdom
// The printer screens: the status panel (every state: loading, empty, working, not answering, file only), pause and cancel with
// the confirmation that names the printer and the file, and the model picker in Admin, Printers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { PrintersPanel } from "@/components/printers/PrintersPanel";
import { SupportedPrinters } from "@/components/printers/SupportedPrinters";
import { PrintersTab } from "@/components/admin/PrintersTab";
import { PRINTER_FAMILIES } from "@/lib/admin/printerFamilies";
import { FILE_ONLY_STEPS, MODELS, modelsByMaker } from "@/lib/printers/models";
import type { PrinterReading } from "@/lib/printers/client";
import { adminServer, on, renderWithClient, shimBrowser } from "../admin-ui/harness";

beforeEach(shimBrowser);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const caps = (o: Record<string, unknown> = {}) => ({ status: true, upload: true, start: true, pause: true, resume: true, cancel: true, pushedStatus: false, experimental: false, fileTypes: [".gcode"], notes: [], ...o });
const reading = (o: Partial<PrinterReading> = {}): PrinterReading =>
  ({
    printerId: 1, name: "Bench Prusa", family: "prusalink", familyLabel: "Prusa (PrusaLink)", model: "Prusa Research MK4S", experimental: false,
    capabilities: caps(), ok: true, checkedAt: new Date().toISOString(),
    status: { state: "printing", rawState: "PRINTING", file: "bracket.bgcode", progress: 42.5, secondsLeft: 1800, temperatures: { nozzle: { actual: 214.8, target: 215 }, bed: { actual: 59.9, target: 60 } } },
    ...o,
  }) as PrinterReading;
const statusRoute = (printers: PrinterReading[]) => on("GET", "/api/printers/status", () => ({ body: { printers } }));

describe("Printers panel", () => {
  it("shows a printing printer with its file, progress, time left and heat, and a progress bar", async () => {
    adminServer([statusRoute([reading()])]);
    renderWithClient(<PrintersPanel />);
    const card = await screen.findByTestId("printer-card-1");
    expect(within(card).getByText("Printing")).toBeTruthy();
    expect(within(card).getByText("bracket.bgcode")).toBeTruthy();
    expect(within(card).getByText("42.5%")).toBeTruthy();
    expect(within(card).getByText(/about 30 min left/)).toBeTruthy();
    expect(within(card).getByText(/Nozzle 214.8 of 215 °C/)).toBeTruthy();
    expect(within(card).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("43");
  });

  it("says plainly there is no printer yet and links to Admin and to the list", async () => {
    adminServer([statusRoute([]), on("GET", "/api/printer", () => ({ body: { configured: false } }))]);
    renderWithClient(<PrintersPanel />);
    expect(await screen.findByText("No printer yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Admin, Printers" }).getAttribute("href")).toBe("/admin?tab=printers");
    expect(screen.getByRole("link", { name: "list of supported printers" }).getAttribute("href")).toBe("/printers");
  });

  it("a printer that does not answer shows the sentence and when the server asks again, and offers the Test button", async () => {
    adminServer([statusRoute([reading({ ok: false, status: undefined, error: "No answer within 10 s.", retryInSeconds: 20 })])]);
    renderWithClient(<PrintersPanel />);
    const card = await screen.findByTestId("printer-card-1");
    expect(within(card).getByText("Not answering")).toBeTruthy();
    expect(within(card).getByText("No answer within 10 s.")).toBeTruthy();
    expect(within(card).getByText(/asks it again in 20 s/)).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Test the connection" })).toBeTruthy();
  });

  it("a failed read of the list is an error line with a Try again button", async () => {
    adminServer([on("GET", "/api/printers/status", () => ({ status: 500, body: { error: "Something went wrong reading the printers." } }))]);
    renderWithClient(<PrintersPanel />);
    expect(await screen.findByText("Something went wrong reading the printers.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("pause needs no confirmation; cancel asks first, names the printer and the file, and sends the printer and the file as the confirm only after Yes", async () => {
    const server = adminServer([
      statusRoute([reading()]),
      on("POST", "/api/printers/1/actions", (c) => ({ body: { ok: true, message: (c.body as { action: string }).action === "pause" ? "PrusaLink paused the print." : "PrusaLink stopped the print." } })),
    ]);
    renderWithClient(<PrintersPanel />);
    const card = await screen.findByTestId("printer-card-1");
    fireEvent.click(within(card).getByRole("button", { name: /Pause/ }));
    expect(await within(card).findByText("PrusaLink paused the print.")).toBeTruthy();
    expect(server.calls.find((c) => c.method === "POST")!.body).toEqual({ action: "pause" });

    fireEvent.click(within(card).getByRole("button", { name: "Stop print" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Stop the print on Bench Prusa?")).toBeTruthy();
    expect(dialog.textContent).toContain("bracket.bgcode");
    expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(1); // nothing sent while the dialog is open
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })); // "Cancel" here means "do not stop it"
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(1);

    fireEvent.click(within(card).getByRole("button", { name: "Stop print" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Stop the print" }));
    await waitFor(() => expect(server.calls.filter((c) => c.method === "POST")).toHaveLength(2));
    expect(server.calls.filter((c) => c.method === "POST")[1].body).toEqual({ action: "cancel", name: "bracket.bgcode", confirm: { printer: "Bench Prusa", file: "bracket.bgcode" } });
  });

  it("a paused print offers Resume; an idle printer offers neither", async () => {
    adminServer([statusRoute([reading({ status: { state: "paused", rawState: "PAUSED", file: "x.gcode", progress: 10, secondsLeft: null, temperatures: {} } }), reading({ printerId: 2, name: "Idle one", status: { state: "idle", rawState: "IDLE", file: null, progress: null, secondsLeft: null, temperatures: {} } })])]);
    renderWithClient(<PrintersPanel />);
    const paused = await screen.findByTestId("printer-card-1");
    expect(within(paused).getByRole("button", { name: /Resume/ })).toBeTruthy();
    const idle = screen.getByTestId("printer-card-2");
    expect(within(idle).queryByRole("button", { name: /Pause|Resume|Stop print/ })).toBeNull();
    expect(within(idle).getByText("Ready")).toBeTruthy();
  });

  it("a file-only printer says it prints by hand and gives the download steps and the maker's page", async () => {
    const m = MODELS.find((x) => x.adapter === "file-only" && x.kind === "fdm")!;
    adminServer([statusRoute([reading({ printerId: 3, name: "Hand printer", family: "file-only", familyLabel: "File only", model: `${m.maker} ${m.model}`, capabilities: caps({ status: false, upload: false, start: false, pause: false, resume: false, cancel: false }), status: undefined })])]);
    renderWithClient(<PrintersPanel />);
    const card = await screen.findByTestId("printer-card-3");
    expect(within(card).getByText("Prints by hand")).toBeTruthy();
    expect(within(card).getByText("Download the file and how to get it to this printer")).toBeTruthy();
    for (const step of FILE_ONLY_STEPS.value) expect(within(card).getByText(step)).toBeTruthy();
    expect(within(card).getByRole("link", { name: m.source }).getAttribute("href")).toBe(m.source);
    expect(within(card).queryByRole("button", { name: "Test the connection" })).toBeNull();
  });

  it("labels an experimental connection, and states the relaxed certificate check on a Bambu card", async () => {
    const note = "The printer's certificate is self-signed, so the check is skipped for this local connection only.";
    adminServer([
      statusRoute([
        reading({ printerId: 4, name: "Bambu", family: "bambu", familyLabel: "Bambu Lab", model: "", capabilities: caps({ pushedStatus: true, notes: [note] }) }),
        reading({ printerId: 5, name: "Neptune", family: "elegoo", familyLabel: "Elegoo", model: "", experimental: true, capabilities: caps({ experimental: true }) }),
      ]),
    ]);
    renderWithClient(<PrintersPanel />);
    const bambu = await screen.findByTestId("printer-card-4");
    expect(within(bambu).getAllByText(note).length).toBeGreaterThan(0);
    expect(within(bambu).getByText(/pushed by the printer/)).toBeTruthy();
    expect(within(screen.getByTestId("printer-card-5")).getByText("Experimental")).toBeTruthy();
  });

  it("runs the connection test for a card and shows the sentence", async () => {
    const server = adminServer([statusRoute([reading()]), on("POST", "/api/admin/test", () => ({ body: { ok: true, message: "PrusaLink answered: PrusaLink 2.1.2." } }))]);
    renderWithClient(<PrintersPanel />);
    const card = await screen.findByTestId("printer-card-1");
    fireEvent.click(within(card).getByRole("button", { name: "Test the connection" }));
    expect(await within(card).findByText(/PrusaLink answered/)).toBeTruthy();
    expect(server.calls.find((c) => c.path === "/api/admin/test")!.body).toEqual({ kind: "printer", id: 1 });
  });
});

describe("model picker in Admin, Printers", () => {
  it("choosing a model sets the family, shows what to switch on and the sources, and saves that family", async () => {
    const bambuModel = MODELS.find((m) => m.id === "bambu-p2s")!;
    const server = adminServer([
      on("GET", "/api/admin/printers", () => ({ body: { printers: [] } })),
      on("GET", "/api/admin/printer-families", () => ({ body: { families: PRINTER_FAMILIES } })),
      on("GET", "/api/printers/models", () => ({ body: { makers: modelsByMaker(), fileOnlySteps: FILE_ONLY_STEPS, problems: [] } })),
      on("POST", "/api/admin/printers", () => ({ status: 201, body: { printer: {} } })),
    ]);
    renderWithClient(<PrintersTab />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Add printer/ }))[0]);
    const form = await screen.findByRole("form", { name: "Add a printer" });
    const trigger = within(form).getByLabelText(/Model from the supported list/);
    await waitFor(() => expect((trigger as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(trigger, { target: { value: within(trigger).getByRole("option", { name: "P2S" }).getAttribute("value") } });

    const fields = await within(form).findByTestId("family-fields");
    expect(within(fields).getByTestId("model-facts-bambu-p2s")).toBeTruthy();
    expect(within(fields).getAllByText(/LAN Only/).length).toBeGreaterThan(0);
    expect(within(fields).getByTestId("family-notice").textContent).toMatch(/certificate/i);
    const links = within(fields).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toContain(bambuModel.source);
    expect(links).toContain(bambuModel.atPrinter!.source);
    expect((within(form).getByLabelText(/Printer model/) as HTMLInputElement).value).toBe("Bambu Lab P2S");

    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: "Shop P2S" } });
    fireEvent.change(within(fields).getByLabelText(/Address|IP address/), { target: { value: "192.168.1.50" } });
    fireEvent.change(within(fields).getByLabelText(/Access code/), { target: { value: "12345678" } });
    fireEvent.change(within(fields).getByLabelText(/Serial/), { target: { value: "01P00A000000001" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add printer" }));
    await waitFor(() => expect(server.calls.some((c) => c.method === "POST")).toBe(true));
    expect(server.calls.find((c) => c.method === "POST")!.body).toMatchObject({ name: "Shop P2S", family: "bambu", model: "Bambu Lab P2S" });
  });

  it("labels Creality and Elegoo families as experimental in the family list", async () => {
    adminServer([
      on("GET", "/api/admin/printers", () => ({ body: { printers: [] } })),
      on("GET", "/api/admin/printer-families", () => ({ body: { families: PRINTER_FAMILIES } })),
      on("GET", "/api/printers/models", () => ({ body: { makers: modelsByMaker(), fileOnlySteps: FILE_ONLY_STEPS, problems: [] } })),
    ]);
    renderWithClient(<PrintersTab />);
    expect(within(await screen.findByTestId("family-creality")).getByText("Experimental")).toBeTruthy();
    expect(within(screen.getByTestId("family-elegoo")).getByText("Experimental")).toBeTruthy();
    expect(within(screen.getByTestId("family-bambu")).getByText("Testable today")).toBeTruthy();
  });
});

describe("supported printers page", () => {
  it("lists every model with its connection and a source link for each", () => {
    renderWithClient(<SupportedPrinters />);
    for (const m of MODELS) {
      const row = document.getElementById(m.id)!;
      expect(row, m.id).toBeTruthy();
      expect(within(row as HTMLElement).getAllByRole("link").some((a) => a.getAttribute("href") === m.source), m.id).toBe(true);
    }
    expect(screen.getByRole("heading", { level: 1, name: "Supported printers" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("—");
  });
});
