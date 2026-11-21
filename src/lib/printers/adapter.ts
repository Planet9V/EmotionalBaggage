// The one interface every printer connection implements (plan 6.2, 6.3, 6.4).
//
// Rules every adapter keeps:
//   - every outbound call has a time limit (AdapterOptions.timeoutMs, default 10 seconds);
//   - every failure is a PrinterError whose message is a plain sentence and never contains a key, password or access code;
//   - test() never throws: it answers { ok, message };
//   - start() and cancel() are destructive. The adapter does not ask for confirmation; the API route refuses them without
//     `confirm: true` and records them in the audit log (src/lib/printers/actions.ts).
//
// Nothing here was run against a real printer. Each adapter is built to its maker's documentation and tested against a
// stand-in in tests/standins/; the Test button in Admin, Printers is how a person confirms it on their own machine.

export type PrinterValues = Record<string, string>;

export type AdapterOptions = {
  /** time limit for every outbound call, in milliseconds */
  timeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 10_000;

export type PrinterState = "idle" | "printing" | "paused" | "finished" | "error" | "busy" | "unknown";

export type Temperature = { actual: number; target: number | null };

export type PrinterStatus = {
  /** a small shared vocabulary; rawState keeps the printer's own word */
  state: PrinterState;
  rawState: string | null;
  /** the file being printed or last selected */
  file: string | null;
  /** 0 to 100, or null when the printer does not say */
  progress: number | null;
  secondsLeft: number | null;
  /** true when secondsLeft is worked out here from elapsed time and progress, not reported by the printer */
  secondsLeftEstimated?: boolean;
  temperatures: { nozzle?: Temperature; bed?: Temperature; chamber?: Temperature };
  /** a sentence the printer gave about its state (an error, a warning), cleaned of secrets */
  message?: string;
};

export type Capabilities = {
  status: boolean;
  upload: boolean;
  start: boolean;
  pause: boolean;
  resume: boolean;
  cancel: boolean;
  /** the printer pushes its state to us (Bambu MQTT) instead of us asking */
  pushedStatus: boolean;
  /** built to documentation we could not confirm on hardware; shown with an "experimental" label */
  experimental: boolean;
  /** file types the printer takes, with the dot */
  fileTypes: string[];
  /** plain sentences about limits, shown to the person */
  notes: string[];
};

export type TestOutcome = { ok: boolean; message: string; detail?: Record<string, unknown> };

export type PrinterFile = { data: Uint8Array; contentType?: string };

/** Options only some printers use (Bambu: which plate of a .3mf, whether to feed from the AMS). Others ignore them. */
export type StartOptions = { plate?: number; useAms?: boolean; amsMapping?: number[]; timelapse?: boolean };

export type UploadResult = { name: string; message: string };
export type ActionResult = { ok: true; message: string };

export type PrinterErrorKind = "unreachable" | "timeout" | "refused" | "busy" | "unsupported" | "bad-response" | "not-found" | "invalid" | "failed";

/** A failure with a sentence that is safe to show. */
export class PrinterError extends Error {
  constructor(
    public kind: PrinterErrorKind,
    message: string,
    public httpStatus?: number
  ) {
    super(message);
    this.name = "PrinterError";
  }
}

export interface PrinterAdapter {
  readonly family: string;
  readonly capabilities: Capabilities;
  /** One cheap, read-only call. Never throws. */
  test(): Promise<TestOutcome>;
  status(): Promise<PrinterStatus>;
  /** Puts the file in the printer's own storage. Does not start it. */
  upload(file: PrinterFile, name: string): Promise<UploadResult>;
  /** Starts a file already on the printer. Destructive: it moves hardware. */
  start(name: string, options?: StartOptions): Promise<ActionResult>;
  pause(): Promise<ActionResult>;
  resume(): Promise<ActionResult>;
  /** Stops the print and cannot be undone. Destructive. */
  cancel(): Promise<ActionResult>;
  /** Releases any connection the adapter holds. */
  close(): Promise<void>;
}

export const GCODE_TYPES = [".gcode", ".gco", ".g", ".bgcode"];

/**
 * A file name safe to send to a printer: no folders, no control characters, a length limit, and one of the allowed
 * extensions. Throws PrinterError("invalid") with a sentence otherwise.
 */
export function safeFileName(name: string, allowed: string[]): string {
  const n = name.trim();
  if (!n) throw new PrinterError("invalid", "The file needs a name.");
  if (n.length > 120) throw new PrinterError("invalid", "The file name is longer than 120 characters.");
  if (/[\\/\u0000-\u001f"]/.test(n) || n === "." || n === ".." || n.startsWith("..")) {
    throw new PrinterError("invalid", "The file name may not contain folders, quotes or control characters.");
  }
  const lower = n.toLowerCase();
  if (!allowed.some((ext) => lower.endsWith(ext))) {
    throw new PrinterError("invalid", `This printer takes ${allowed.join(", ")} files, and "${n}" is none of those.`);
  }
  return n;
}

export const NO_PUSH: Pick<Capabilities, "pushedStatus"> = { pushedStatus: false };
