// The one module the print flow uses to reach a printer. It is shaped like the adapter interface in src/lib/printers/adapter.ts
// (another branch): test, status, upload, start, pause, resume, cancel. The lead repoints `defaultFactory` below to
// `adapterForRow` from "@/lib/printers" when the branches are joined; nothing else in the print flow changes.
import type { PrinterRow } from "@/lib/admin/printers";

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

export type PortFile = { data: Uint8Array; contentType?: string };
export type PortResult = { ok: true; message: string };

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

/** Until the printers branch is joined, every printer is file-only. The lead replaces this with adapterForRow. */
const defaultFactory: PortFactory = () => new FileOnlyPort();

let factory: PortFactory = defaultFactory;
/** Tests and the join point. Returns what to call to put the default back. */
export function setPortFactory(f: PortFactory): () => void {
  factory = f;
  return () => { factory = defaultFactory; };
}

export const portFor: PortFactory = (printer) => factory(printer);

/** The steps for a printer with no connection. A generic list; the model list's own steps replace it when that branch is joined. */
export const FILE_ONLY_STEPS = [
  "Download the file below.",
  "Copy it to the printer: a USB stick or SD card, or the maker's own app or web page.",
  "Check the printer shows the same material and nozzle as the slice used.",
  "Start the print at the printer.",
  "Come back and record the result here.",
] as const;
