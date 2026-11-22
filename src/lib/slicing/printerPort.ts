// The one module the print flow uses to reach a printer. It is shaped like the adapter interface in src/lib/printers/adapter.ts
// : test, status, upload, start, pause, resume, cancel. `defaultFactory` below wraps `adapterForRow`; tests swap it with setPortFactory.
import type { PrinterRow } from "@/lib/admin/printers";
import { PrinterError, type PrinterAdapter } from "@/lib/printers/adapter";
import { adapterForRow } from "@/lib/printers/factory";

export type PortState = "idle" | "printing" | "paused" | "finished" | "error" | "busy" | "unknown";

export type PortStatus = {
  state: PortState;
  rawState?: string | null;
  file?: string | null;
  progress?: number | null;
  secondsLeft?: number | null;
  message?: string;
};

export type PortCapabilities = {
  status: boolean;
  upload: boolean;
  start: boolean;
  pause: boolean;
  resume: boolean;
  cancel: boolean;
  experimental?: boolean;
  /** file types the printer takes, with the dot */
  fileTypes: string[];
  notes: string[];
};

type PortFile = { data: Uint8Array; contentType?: string };
type PortResult = { ok: true; message: string };

export interface PrinterPort {
  readonly family: string;
  readonly capabilities: PortCapabilities;
  test(): Promise<{ ok: boolean; message: string }>;
  status(): Promise<PortStatus>;
  /** Puts the file in the printer's storage. Does not start it. */
  upload(file: PortFile, name: string): Promise<{ name: string; message: string }>;
  /** Starts a file already on the printer. Moves hardware. */
  start(name: string, options?: { plate?: number; useAms?: boolean }): Promise<PortResult>;
  pause(): Promise<PortResult>;
  resume(): Promise<PortResult>;
  /** Stops the print. Cannot be undone. */
  cancel(): Promise<PortResult>;
  close?(): Promise<void>;
}

export class PortError extends Error {
  constructor(public kind: "unsupported" | "failed", message: string) {
    super(message);
    this.name = "PortError";
  }
}

/** A printer with no connection: the file is given to the person, who carries it to the printer. */
export class FileOnlyPort implements PrinterPort {
  readonly family = "file-only";
  readonly capabilities: PortCapabilities = {
    status: false, upload: false, start: false, pause: false, resume: false, cancel: false,
    fileTypes: [".gcode", ".3mf"],
    notes: ["This app cannot talk to this printer. Download the file and start the print at the printer."],
  };
  private no(what: string): never {
    throw new PortError("unsupported", `This printer has no connection to ${what} from here. Download the file and start the print at the printer.`);
  }
  async test() { return { ok: false, message: "No connection is set up for this printer." }; }
  async status(): Promise<PortStatus> { return this.no("read its status"); }
  async upload(): Promise<never> { return this.no("send a file"); }
  async start(): Promise<never> { return this.no("start a print"); }
  async pause(): Promise<never> { return this.no("pause"); }
  async resume(): Promise<never> { return this.no("resume"); }
  async cancel(): Promise<never> { return this.no("cancel"); }
}

export type PortFactory = (printer: Pick<PrinterRow, "family" | "address" | "access" | "model" | "name">) => PrinterPort;

/** Calls the adapter and turns its errors into the port's, keeping the adapter's safe sentence. */
async function viaAdapter<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if (e instanceof PrinterError) throw new PortError(e.kind === "unsupported" ? "unsupported" : "failed", e.message);
    throw e;
  }
}

/** A printer saved in Admin, reached through its adapter in src/lib/printers. A family with no connection is file-only. */
const defaultFactory: PortFactory = (printer) => {
  if (printer.family === "file-only") return new FileOnlyPort();
  let a: PrinterAdapter;
  try {
    a = adapterForRow(printer);
  } catch {
    return new FileOnlyPort();
  }
  if (!a.capabilities.upload && !a.capabilities.start) return new FileOnlyPort();
  return {
    family: a.family,
    capabilities: { ...a.capabilities, notes: [...(a.capabilities.notes ?? [])] },
    test: () => a.test(),
    status: () => viaAdapter(() => a.status()),
    upload: (file, name) => viaAdapter(() => a.upload(file, name)),
    start: (name, options) => viaAdapter(() => a.start(name, options)),
    pause: () => viaAdapter(() => a.pause()),
    resume: () => viaAdapter(() => a.resume()),
    cancel: () => viaAdapter(() => a.cancel()),
    close: () => a.close(),
  };
};

let factory: PortFactory = defaultFactory;
/** Tests and the join point. Returns what to call to put the default back. */
export function setPortFactory(f: PortFactory): () => void {
  factory = f;
  return () => { factory = defaultFactory; };
}

export const portFor: PortFactory = (printer) => factory(printer);
