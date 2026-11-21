// @vitest-environment jsdom
// The job card: Send and Start open a dialog that names the printer and the file, and nothing is sent until its button is pressed.
// The API is a stand-in fetch; the real routes are tested in flow.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Item } from "@/lib/types";
import { freshClient } from "../client/mockServer";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...r}>{children}</a> }));

import { JobCard } from "@/components/printing/JobCard";

const slice = { seconds: 1191.2, filamentG: 3.7, filamentMm: 1221.41, supportG: null, layers: 100, orcaVersion: "2.5.0", profile: { machine: "Bambu Lab A1 0.4 nozzle", process: "0.20mm Standard", filament: "Generic PLA" }, warnings: [], slicedAt: "2026-11-21T00:00:00Z", gcodeFileId: 11, projectFileId: 12, gcodeSha256: "x" };
const job = (status: string, data: Record<string, unknown> = {}): Item => ({
  id: 5, projectId: "p", section: "prototype/printing", title: "Lid", body: "", status, sort: 1,
  data: { fileId: 1, fileName: "lid.stl", printerId: 2, printerName: "Shop A1", printerMaker: "Bambu Lab", printerModel: "A1", material: "PLA", layerHeight: 0.2, infill: 15, supports: false, slice, ...data },
});
const fullPlan = { status: "sliced", printer: { id: 2, name: "Shop A1", family: "bambu", familyLabel: "Bambu" }, capabilities: { status: true, upload: true, start: true, pause: true, resume: true, cancel: true, fileTypes: [".gcode"], notes: [] }, fileOnly: false, send: { name: "Lid-5.gcode", fileId: 11, kind: "gcode" }, download: { gcodeFileId: 11, projectFileId: 12 } };
const filePlan = { ...fullPlan, capabilities: { ...fullPlan.capabilities, status: false, upload: false, start: false, pause: false, resume: false, cancel: false }, fileOnly: true };

let plan: unknown;
let posts: { path: string; body: unknown }[] = [];
beforeEach(() => {
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://t.local").pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (method === "POST") { posts.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined }); return reply({ item: {} }); }
    if (path.endsWith("/plan")) return reply(plan);
    if (path.endsWith("/track")) return reply({ job: {}, printer: { state: "printing", progress: 42, secondsLeft: 600 }, message: "" });
    return reply({});
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const show = (j: Item) => render(<QueryClientProvider client={freshClient()}><ul><JobCard projectId="p" job={j} onDelete={() => {}} onRequeue={async () => {}} /></ul></QueryClientProvider>);

describe("a sliced job", () => {
  it("shows the slicer's time and filament, with the version and the profile it used", async () => {
    plan = fullPlan;
    show(job("sliced"));
    const box = screen.getByLabelText("What the slicer says");
    expect(within(box).getByText("20 min")).toBeTruthy();
    expect(within(box).getByText(/3\.7 g, 1\.22 m/)).toBeTruthy();
    expect(within(box).getByText(/OrcaSlicer 2\.5\.0/)).toBeTruthy();
    expect(within(box).getByText(/Bambu Lab A1 0\.4 nozzle/)).toBeTruthy();
  });

  it("opens a dialog naming the printer and the file, and sends nothing until its button is pressed", async () => {
    plan = fullPlan;
    show(job("sliced"));
    fireEvent.click(await screen.findByRole("button", { name: /Send to Shop A1/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Shop A1")).toBeTruthy();
    expect(within(dlg).getByText("Lid-5.gcode")).toBeTruthy();
    expect(posts).toEqual([]);
    fireEvent.click(within(dlg).getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts).toEqual([]);
  });

  it("posts the confirm with exactly the printer and the file the dialog showed", async () => {
    plan = fullPlan;
    show(job("sliced"));
    fireEvent.click(await screen.findByRole("button", { name: /Send to Shop A1/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send to Shop A1" }));
    await waitFor(() => expect(posts.some((p) => p.path === "/api/print-jobs/5/send")).toBe(true));
    expect(posts.find((p) => p.path.endsWith("/send"))?.body).toEqual({ confirm: { printer: "Shop A1", file: "Lid-5.gcode" } });
  });

  it("offers a download and the steps, and no Send, for a printer with no connection", async () => {
    plan = filePlan;
    show(job("sliced"));
    expect(await screen.findByText(/take the file to it/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Download G-code/ }).getAttribute("href")).toBe("/api/files/11");
    expect(screen.queryByRole("button", { name: /Send to/ })).toBeNull();
    expect(screen.getByText(/Start the print at the printer/)).toBeTruthy();
  });
});

describe("a sent job", () => {
  it("starts only through the dialog, naming the file that was sent", async () => {
    plan = { ...fullPlan, status: "sent" };
    show(job("sent", { sentName: "Lid-5.gcode", sentAt: "2026-11-21T00:00:00Z" }));
    fireEvent.click(await screen.findByRole("button", { name: /Start on Shop A1/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("The printer will start moving.")).toBeTruthy();
    expect(posts).toEqual([]);
    fireEvent.click(within(dlg).getByRole("button", { name: "Start on Shop A1" }));
    await waitFor(() => expect(posts.some((p) => p.path.endsWith("/start"))).toBe(true));
    expect(posts.find((p) => p.path.endsWith("/start"))?.body).toEqual({ confirm: { printer: "Shop A1", file: "Lid-5.gcode" } });
  });
});

describe("a printing job", () => {
  it("shows what the printer says, with a progress bar, and asks before cancelling", async () => {
    plan = { ...fullPlan, status: "printing" };
    show(job("printing", { sentName: "Lid-5.gcode" }));
    expect(await screen.findByText(/42%/)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Print progress" }).getAttribute("aria-valuenow")).toBe("42");
    fireEvent.click(screen.getByRole("button", { name: "Cancel print" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("The print stops and cannot be resumed.")).toBeTruthy();
    expect(posts).toEqual([]);
  });
});

describe("a queued job", () => {
  it("can be sliced, and shows the last failure in a live alert", async () => {
    plan = fullPlan;
    show(job("queued", { slice: undefined, sliceError: "No 0.05 mm profile" }));
    expect(screen.getByRole("button", { name: "Slice" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("No 0.05 mm profile");
    expect(screen.queryByRole("button", { name: /Send to/ })).toBeNull();
  });
});
