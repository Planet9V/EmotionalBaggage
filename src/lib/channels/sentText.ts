// Browser-safe: how a post or reply's sending reads on a screen or in the report.
export function sentText(data: Record<string, unknown>): string {
  const s = data.sent as { byHand?: boolean; recordedByHand?: boolean; at?: string; url?: string } | undefined;
  if (!s) return "";
  const day = s.at ? s.at.slice(0, 10) : "";
  if (s.byHand) return `marked posted by hand${day ? ` on ${day}` : ""}, not sent by the app`;
  if (s.recordedByHand) return `posted, checked on the channel${day ? ` on ${day}` : ""}`;
  return `sent by the app${day ? ` on ${day}` : ""}${s.url ? ` (${s.url})` : ""}`;
}
