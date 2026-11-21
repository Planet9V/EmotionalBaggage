// The adapter for a printer with no connection: nothing is sent anywhere. Every call that would talk to the printer says so
// and points to the download (plan 6.7).
import {
  PrinterError, type ActionResult, type Capabilities, type PrinterAdapter, type PrinterStatus, type TestOutcome, type UploadResult,
} from "./adapter";

const WHY = "This printer is file only: download the file and start the print at the printer.";

export class FileOnlyAdapter implements PrinterAdapter {
  readonly family = "file-only";
  readonly capabilities: Capabilities = {
    status: false, upload: false, start: false, pause: false, resume: false, cancel: false, pushedStatus: false, experimental: false,
    fileTypes: [], notes: [WHY],
  };
  async test(): Promise<TestOutcome> {
    return { ok: true, message: "File-only printers need no connection: you download the file and print it yourself." };
  }
  private no(): never {
    throw new PrinterError("unsupported", WHY);
  }
  async status(): Promise<PrinterStatus> {
    return this.no();
  }
  async upload(): Promise<UploadResult> {
    return this.no();
  }
  async start(): Promise<ActionResult> {
    return this.no();
  }
  async pause(): Promise<ActionResult> {
    return this.no();
  }
  async resume(): Promise<ActionResult> {
    return this.no();
  }
  async cancel(): Promise<ActionResult> {
    return this.no();
  }
  async close(): Promise<void> {}
}
