/** The tones a status badge can take (components/ui/StatusBadge), from the status tokens in globals.css. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<string, StatusTone> = {
  done: "success", decided: "success", verified: "success", chosen: "success", pass: "success",
  printed: "success", live: "success", posted: "success", shipped: "success", actual: "success", "in hand": "success",
  "in progress": "info", shortlist: "info", ready: "info", printing: "info", approved: "info",
  running: "info", ordered: "info", quoted: "info", funded: "info", building: "info", drafted: "info",
  blocked: "danger", wrong: "danger", fail: "danger", failed: "danger",
  unverified: "warning", "waiting on file": "warning", "not run": "warning", "to buy": "warning", "to print": "warning",
};

export const statusTone = (s: string): StatusTone => TONES[s] ?? "neutral";
