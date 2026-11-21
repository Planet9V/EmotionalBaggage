// Safe for the browser: which of the two sendable channels a row's `channel` names.
export type SendChannel = "x" | "instagram";

/** "X", "x", "Instagram", "instagram" and "ig" name the two channels this app can send to. */
export function channelOf(raw: unknown): SendChannel | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "x" || v === "twitter") return "x";
  if (v === "instagram" || v === "ig") return "instagram";
  return null;
}
