// What the plain row routes may do to a post or a reply that can be sent (robustness review S9).
// Whether, when and how a row was sent is written only by src/lib/channels/send.ts: the markers below are
// server-only, so a plain PATCH cannot clear `sent` and make a posted row sendable again, or clear an
// unknown outcome without the separate, recorded "I checked the channel" action.
import { HttpError } from "@/lib/api/route";
import { CHANNEL } from "./schemas";

export const SEND_SECTIONS = new Set<string>([CHANNEL.social, CHANNEL.replies]);
export const SEND_SERVER_ONLY = ["sent", "sending", "sendError", "sendUnknown"] as const;

function refuseServerKeys(data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const k of SEND_SERVER_ONLY) {
    if (k in data) throw new HttpError(400, `"${k}" is written when the post or reply is sent, not edited by hand.`);
  }
}

/** A new post or reply carries none of the send markers. */
export function assertNewSendRow(row: { section: string; data?: Record<string, unknown> }) {
  if (!SEND_SECTIONS.has(row.section)) return;
  refuseServerKeys(row.data);
}

/** A change through the plain row route: no send marker, and a sent row cannot be made sendable again. */
export function assertSendChange(was: { section: string; status: string; data: Record<string, unknown> }, change: { data?: Record<string, unknown>; status?: string }) {
  if (!SEND_SECTIONS.has(was.section)) return;
  refuseServerKeys(change.data);
  if (change.status && change.status !== was.status && (was.data.sent || was.data.sendUnknown) && ["approved", "scheduled"].includes(change.status)) {
    throw new HttpError(409, was.data.sent ? "This was already sent, so it cannot be approved to send again." : "The last send's outcome is unknown. Check the channel and record what you found before sending again.");
  }
}
