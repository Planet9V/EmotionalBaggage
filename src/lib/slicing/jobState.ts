// A print job is a row in prototype/printing. Its status moves only along the edges below.
// Browser-safe: no server imports.
import { z } from "zod";

export const PRINT_STATUSES = ["queued", "slicing", "sliced", "sent", "printing", "done", "failed", "cancelled"] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];

/** Where each status may go. Hardware states (sent, printing) are reached only by the routes that talk to the printer. */
export const TRANSITIONS: Record<PrintStatus, readonly PrintStatus[]> = {
  // queued to sliced: a file sliced in the person's own slicer is attached (attachSlicedFile in flow.ts)
  queued: ["slicing", "sliced", "cancelled"],
  slicing: ["sliced", "failed", "queued"],
  sliced: ["slicing", "sent", "cancelled", "queued"],
  sent: ["printing", "failed", "cancelled"],
  printing: ["done", "failed", "cancelled"],
  done: [],
  failed: ["queued"],
  cancelled: ["queued"],
};

/** Statuses a person may set through the plain row editor. Everything else comes from an action. */
export const MANUAL_TARGETS: readonly PrintStatus[] = ["queued", "cancelled"];

const isPrintStatus = (s: string): s is PrintStatus => (PRINT_STATUSES as readonly string[]).includes(s);

export const canMove = (from: string, to: string): boolean => isPrintStatus(from) && isPrintStatus(to) && TRANSITIONS[from].includes(to);

/** Old rows used these words; migration 0018 renames them, and a row read before it ran is still understood. */
const LEGACY_STATUS: Record<string, PrintStatus> = { "waiting on file": "queued", ready: "queued", printed: "done" };
export const normaliseStatus = (s: string): string => LEGACY_STATUS[s] ?? s;

export const STATUS_WORDS: Record<PrintStatus, string> = {
  queued: "Waiting to be sliced",
  slicing: "The slicer is working",
  sliced: "Sliced, ready to send",
  sent: "On the printer, not started",
  printing: "Printing",
  done: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** What a job's G-code file name looks like on a printer. Letters, digits, dot, dash and underscore only. */
export function printerFileName(title: string, ext: string, id: number | string): string {
  const stem = title.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[_.-]+|[_.-]+$/g, "").slice(0, 60) || "part";
  return `${stem}-${id}${ext}`;
}

const num = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v), z.number().finite());
const day = z.string().max(40);

export const OUTCOMES = ["good", "flawed", "failed"] as const;

export const printJobData = z.looseObject({
  /** the stored file being printed (a files row) and, optionally, the BOM part or enclosure it is */
  fileId: z.union([num, z.null()]).optional(),
  fileName: z.string().max(200).optional(),
  part: z.string().max(80).optional(),
  /** printers.id and its name, kept so history still reads after a printer is renamed or removed */
  printerId: z.union([num, z.null()]).optional(),
  printerName: z.string().max(200).optional(),
  printerMaker: z.string().max(120).optional(),
  printerModel: z.string().max(120).optional(),
  printerFamily: z.string().max(60).optional(),
  material: z.string().max(40).optional(),
  layerHeight: num.optional(),
  infill: num.refine((n) => n >= 0 && n <= 100, "must be 0 to 100").optional(),
  supports: z.boolean().optional(),
  /** the key of a prototype/builds row this print belongs to */
  buildKey: z.string().max(120).optional(),
  /** what the slicer said, written only by the slice route */
  slice: z
    .object({
      seconds: z.number(),
      filamentG: z.number(),
      /** filament length; null when the numbers were entered by hand and none was given */
      filamentMm: z.number().nullable().optional(),
      supportG: z.number().nullable().optional(),
      layers: z.number().nullable().optional(),
      orcaVersion: z.string().max(40).optional(),
      profile: z.object({ machine: z.string(), process: z.string(), filament: z.string() }).optional(),
      /** set when the job was sliced in the user's own slicer and the file attached: time and grams were typed, from that slicer */
      byHand: z.object({ slicer: z.string().max(80) }).optional(),
      warnings: z.array(z.string()).max(50).default([]),
      slicedAt: day,
      /** the G-code and the project file, stored as files */
      gcodeFileId: z.number().nullable(),
      projectFileId: z.number().nullable().optional(),
      /** SHA-256 of the G-code, so what is sent can be matched to what was previewed */
      gcodeSha256: z.string().max(64),
    })
    .optional(),
  /** why the last slice attempt failed, in the slicer's words; cleared by a new attempt */
  sliceError: z.string().max(2000).nullable().optional(),
  /** written only by the send and start routes */
  sentAt: day.optional(),
  sentName: z.string().max(160).optional(),
  startedAt: day.optional(),
  /** written by the record-result route */
  result: z
    .object({
      outcome: z.enum(OUTCOMES),
      actualSeconds: num.optional(),
      actualG: num.optional(),
      notes: z.string().max(4000).optional(),
      photoFileIds: z.array(z.number()).max(20).default([]),
      finishedAt: day.optional(),
    })
    .optional(),
});
export type PrintJobData = z.infer<typeof printJobData>;

/** Keys only an action route may write. The plain row editor refuses them. */
export const SERVER_ONLY_KEYS = ["slice", "sentAt", "sentName", "startedAt", "result"] as const;
