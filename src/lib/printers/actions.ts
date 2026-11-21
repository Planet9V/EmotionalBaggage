// Actions on a saved printer, with the rules the plan sets: start and cancel are destructive and need an explicit confirm,
// and every action is recorded in the audit log (what was done, to which printer, which file; never a key or access code).
import { audit } from "@/lib/db";
import { HttpError } from "@/lib/api/route";
import { getPrinterRow } from "@/lib/admin/printers";
import { PrinterError, type ActionResult, type PrinterFile, type StartOptions, type UploadResult } from "./adapter";
import { adapterForRow } from "./factory";
import { printerFamily } from "@/lib/admin/printerFamilies";
import { assertConfirm, followPrinterAction, type Confirm } from "@/lib/slicing/flow";
import { scrub } from "@/lib/secrets/scrub";

export type PrinterActionName = "start" | "pause" | "resume" | "cancel";

const DESTRUCTIVE: PrinterActionName[] = ["start", "cancel"];
const VERB: Record<PrinterActionName, string> = { start: "started", pause: "paused", resume: "resumed", cancel: "cancelled" };
const HTTP: Record<string, number> = { refused: 502, unreachable: 502, timeout: 504, busy: 409, unsupported: 400, "bad-response": 502, "not-found": 502, invalid: 400, failed: 502 };

/** Turns a PrinterError into the HttpError route() answers with. The message is already clean. */
export function httpErrorOf(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof PrinterError) return new HttpError(HTTP[e.kind] ?? 502, e.message);
  throw e;
}

/**
 * Start, pause, resume or cancel on a saved printer (robustness review S9). Start and cancel need the same named
 * confirmation as a print job's Start: `confirm: { printer, file }`, the printer's name and the file exactly as the
 * screen showed them. For cancel the file is the one the printer reports it is printing (else `name`). When a print
 * job sent that file to that printer, the job moves too (printing, or cancelled).
 */
export async function runPrinterAction(
  printerId: number,
  action: PrinterActionName,
  input: { confirm?: Confirm; name?: string; options?: StartOptions } = {}
): Promise<ActionResult> {
  if (action === "start" && !input.name) throw new HttpError(400, "Starting a print needs the file name.");
  const row = await getPrinterRow(printerId);
  if (!row.enabled) throw new HttpError(409, "That printer is switched off in Admin, Printers.");
  const adapter = adapterForRow(row);
  const secretFields = (printerFamily(row.family)?.fields ?? []).filter((f) => f.secret).map((f) => f.name);
  const secrets = secretFields.map((n) => (row.access ?? {})[n]);
  try {
    let file = input.name ?? "";
    if (action === "cancel") {
      // nothing is asked of the printer until the confirm at least names it
      if (!input.confirm || input.confirm.printer !== row.name) assertConfirm(input.confirm, row.name, file, "cancel this print");
      const st = await adapter.status().catch(() => null);
      file = st?.file ?? input.name ?? "";
    }
    if (DESTRUCTIVE.includes(action)) assertConfirm(input.confirm, row.name, file, action === "start" ? "start this print" : "cancel this print");
    const detail = { printerId, family: row.family, action, ...(file ? { file } : {}) };
    try {
      const result = action === "start" ? await adapter.start(file, input.options) : await adapter[action]();
      await audit({ action: `printer.${action}`, summary: `Printer "${row.name}" ${VERB[action]}${file ? `: ${file}` : ""}`, detail });
      if ((action === "start" || action === "cancel") && file) await followPrinterAction(printerId, row.name, file, action);
      return result;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      const clean = e instanceof PrinterError ? e.message : scrub(String((e as Error)?.message ?? e), secrets);
      await audit({ action: `printer.${action}.failed`, summary: `Printer "${row.name}": ${action} did not go through`, detail: { ...detail, reason: clean.slice(0, 200) } });
      throw httpErrorOf(e instanceof PrinterError ? e : new PrinterError("failed", clean));
    }
  } finally {
    await adapter.close().catch(() => undefined);
  }
}

/**
 * Puts a file on a saved printer's own storage. It never starts the print: that is a separate, confirmed `start`.
 * The line in the audit log names the printer and the file, never the contents.
 */
export async function uploadToPrinter(printerId: number, file: PrinterFile, name: string): Promise<UploadResult> {
  const row = await getPrinterRow(printerId);
  if (!row.enabled) throw new HttpError(409, "That printer is switched off in Admin, Printers.");
  const adapter = adapterForRow(row);
  const secretFields = (printerFamily(row.family)?.fields ?? []).filter((f) => f.secret).map((f) => f.name);
  const secrets = secretFields.map((n) => (row.access ?? {})[n]);
  const detail = { printerId, family: row.family, action: "upload", file: name, bytes: file.data.byteLength };
  try {
    const result = await adapter.upload(file, name);
    await audit({ action: "printer.upload", summary: `File ${result.name} sent to printer "${row.name}"`, detail });
    return result;
  } catch (e) {
    const clean = e instanceof PrinterError ? e.message : scrub(String((e as Error)?.message ?? e), secrets);
    await audit({ action: "printer.upload.failed", summary: `Printer "${row.name}": sending ${name} did not go through`, detail: { ...detail, reason: clean.slice(0, 200) } });
    throw httpErrorOf(e instanceof PrinterError ? e : new PrinterError("failed", clean));
  } finally {
    await adapter.close().catch(() => undefined);
  }
}
