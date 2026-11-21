/** Escapes a value for HTML text and for a double- or single-quoted attribute: & < > " and '. The one HTML escape in the app. */
export const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
