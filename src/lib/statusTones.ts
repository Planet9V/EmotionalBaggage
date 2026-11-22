// The one place a status is given a colour. A status word maps to a tone here, and a tone maps to its
// colour classes here (from the status tokens in globals.css). StatusBadge, and every pill, chip or
// control that shows a row, gate, claim or print-job status in colour, reads these two maps; no screen
// defines its own.

/** The tones a status can take. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/** A tone's colour classes: background, text and border colour. Layout and size stay with the caller. */
export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-hairline bg-subtle text-secondary",
  info: "border-transparent bg-info-soft text-info",
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning",
  danger: "border-transparent bg-danger-soft text-danger",
};

const TONES: Record<string, StatusTone> = {
  done: "success", decided: "success", verified: "success", chosen: "success", pass: "success",
  printed: "success", live: "success", posted: "success", shipped: "success", actual: "success", "in hand": "success",
  "in progress": "info", shortlist: "info", ready: "info", printing: "info", approved: "info",
  running: "info", ordered: "info", quoted: "info", funded: "info", building: "info", drafted: "info",
  planned: "info", estimate: "info",
  soldered: "info", tested: "success", "to solder": "warning",
  blocked: "danger", wrong: "danger", fail: "danger", failed: "danger", killed: "danger", paused: "warning",
  written: "info", final: "success", stored: "success", "not uploaded": "warning", unreadable: "danger",
  unverified: "warning", "waiting on file": "warning", queued: "warning", slicing: "info", sliced: "info", sent: "info", cancelled: "neutral", "not run": "warning", "to buy": "warning", "to print": "warning",
  waiting: "warning",
};

/**
 * Rows that pass through draft to approved (positioning, names, ads, listing, landing pages, posts): a
 * draft waits on the user, and approved, ready or scheduled is the finished state.
 */
const APPROVAL_TONES: Record<string, StatusTone> = {
  draft: "warning", approved: "success", ready: "success", scheduled: "success",
};

/** The tone of a status word; a word with no tone is neutral. */
export const statusTone = (s: string): StatusTone => TONES[s] ?? "neutral";

/** The tone of a status on a row that is drafted and then approved; any other word as statusTone. */
export const approvalStatusTone = (s: string): StatusTone => APPROVAL_TONES[s] ?? statusTone(s);
