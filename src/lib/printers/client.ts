// What the browser uses to talk to the printer routes. Types only come from the server modules (they are erased at build), so no
// server code, database or secret reaches the browser bundle.
import { api } from "@/lib/client";
import type { PrinterReading } from "./readings";
import type { PrinterModel, Fact } from "./models";

export type { PrinterReading, PrinterModel, Fact };

export type PrinterModelList = {
  makers: { maker: string; models: PrinterModel[] }[];
  fileOnlySteps: Fact<string[]>;
  problems: string[];
};

export const printerKeys = {
  statuses: () => ["printers", "status"] as const,
  models: () => ["printers", "models"] as const,
};

export const printerFetchers = {
  statuses: ({ signal }: { signal?: AbortSignal } = {}) => api<{ printers: PrinterReading[] }>("/api/printers/status", { signal }).then((r) => r.printers),
  models: ({ signal }: { signal?: AbortSignal } = {}) => api<PrinterModelList>("/api/printers/models", { signal }),
};

/** pause or resume a print. No confirm is needed for these. */
export const controlPrinter = (id: number, action: "pause" | "resume") =>
  api<{ ok: boolean; message: string }>(`/api/printers/${id}/actions`, { method: "POST", body: JSON.stringify({ action }) });

/** Cancel the running print. The caller must have shown its own confirmation first: the route refuses without `confirm: true`. */
export const cancelPrint = (id: number) =>
  api<{ ok: boolean; message: string }>(`/api/printers/${id}/actions`, { method: "POST", body: JSON.stringify({ action: "cancel", confirm: true }) });

/**
 * Start a file that is already on the printer. The caller must have shown its own confirmation that names the printer and the
 * file: this sends `confirm: true`, and the server writes the audit line.
 */
export const startPrint = (id: number, name: string, options: { plate?: number; useAms?: boolean; amsMapping?: number[]; timelapse?: boolean } = {}) =>
  api<{ ok: boolean; message: string }>(`/api/printers/${id}/actions`, { method: "POST", body: JSON.stringify({ action: "start", name, confirm: true, ...options }) });

/** Send a file to the printer's own storage. It does not start the print. */
export async function sendToPrinter(id: number, file: File, name?: string) {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  return api<{ ok: boolean; name: string; message: string }>(`/api/printers/${id}/upload`, { method: "POST", body: form });
}
