// Rules the server enforces when a marketing row's status changes (called from PATCH /api/items/[id]).
//
// Positioning cannot be approved until the reviewer has attacked it once: the critique is stored
// on the row, and the status follows only after it exists. Nothing else here blocks: a message
// with no proof, or a competitor with no source, is flagged on screen and may still be approved.
import { HttpError } from "@/lib/api/route";
import { positioningFingerprint } from "./critique";
import { MARKET } from "./schemas";

export function assertMarketChange(
  was: { section: string; status: string; data: Record<string, unknown> },
  change: { data?: Record<string, unknown>; status?: string }
) {
  if (was.section !== MARKET.positioning) return;
  // The critique is written by its own route, never by hand: it is the reviewer's, not the author's.
  if (change.data && Object.prototype.hasOwnProperty.call(change.data, "critique")) {
    throw new HttpError(400, "The critique is written by the reviewer and cannot be edited. Ask the reviewer again to replace it.");
  }
  const status = change.status ?? was.status;
  if (status !== "approved") return;
  const c = was.data?.critique as { text?: unknown; fingerprint?: unknown } | undefined;
  if (!c || typeof c.text !== "string" || !c.text.trim()) {
    throw new HttpError(409, "Ask the reviewer to attack this positioning once before approving it. The critique is shown beside it.");
  }
  // The critique must be of these words: an edit after the review needs a new review.
  const now = { ...was.data, ...(change.data ?? {}) };
  if (typeof c.fingerprint === "string" && c.fingerprint !== positioningFingerprint(now)) {
    throw new HttpError(409, "The positioning changed after the reviewer attacked it. Ask the reviewer again before approving.");
  }
}

/** A new positioning row cannot start approved or carry a critique: both come only from the review flow. */
export function assertNewMarket(row: { section: string; data?: Record<string, unknown>; status?: string }) {
  if (row.section !== MARKET.positioning) return;
  if (row.status === "approved") throw new HttpError(409, "A new positioning starts as a draft. Ask the reviewer to attack it, then approve it.");
  if (row.data && Object.prototype.hasOwnProperty.call(row.data, "critique")) {
    throw new HttpError(400, "The critique is written by the reviewer and cannot be set when adding a row.");
  }
}
