// What the plain row routes may do to a print job. The action routes (slice, send, start, control, result) are the only way
// to reach slicing, sent, printing, or to write what the slicer and the printer reported.
import { HttpError } from "@/lib/api/route";
import { MANUAL_TARGETS, SERVER_ONLY_KEYS, canMove, normaliseStatus } from "./jobState";

export const PRINTING_SECTION = "prototype/printing";

const SERVER_ONLY = new Set<string>([...SERVER_ONLY_KEYS, "sliceError"]);

function refuseServerKeys(data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const k of Object.keys(data)) {
    if (SERVER_ONLY.has(k)) {
      throw new HttpError(400, `"${k}" on a print job is written by slicing, sending and recording the result, not edited by hand.`);
    }
  }
}

/** A new print job starts as queued with nothing the slicer or printer would have written. */
export function assertNewPrintJob(row: { section: string; status?: string; data?: Record<string, unknown> }) {
  if (row.section !== PRINTING_SECTION) return;
  refuseServerKeys(row.data);
  if (row.status && normaliseStatus(row.status) !== "queued") throw new HttpError(400, "A new print job starts as queued.");
}

/** A change to an existing print job through the plain row route. */
export function assertPrintChange(was: { section: string; status: string; data: Record<string, unknown> }, change: { data?: Record<string, unknown>; status?: string }) {
  if (was.section !== PRINTING_SECTION) return;
  refuseServerKeys(change.data);
  const from = normaliseStatus(was.status);
  if (change.status === undefined || change.status === was.status) {
    // Changing what was sliced invalidates the slice: only a queued job can have its settings edited.
    const touches = change.data && ["fileId", "printerId", "material", "layerHeight", "infill", "supports"].some((k) => k in change.data!);
    if (touches && was.data.slice && from !== "queued") {
      throw new HttpError(409, "This job has been sliced. Move it back to queued before changing the file, printer or print settings, then slice again.");
    }
    return;
  }
  if (!MANUAL_TARGETS.includes(change.status as never)) {
    throw new HttpError(400, `A job cannot be moved to "${change.status}" by hand. Use Slice, Send, Start and Record result so the slicer and the printer are really asked.`);
  }
  if (!canMove(from, change.status)) throw new HttpError(409, `A ${from} job cannot move to ${change.status}.`);
  if (change.status === "queued" && change.data === undefined) return;
}
