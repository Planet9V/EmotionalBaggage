// The positioning critique: one focus instruction added to the shared reviewer (src/lib/ai/reviewer.ts),
// and the fingerprint that ties a critique to the exact words it attacked.

/** The one focus instruction added to the shared reviewer for a positioning (plan 8.3). */
export const POSITIONING_FOCUS = `This time, attack the positioning below once. Do not rewrite it.
- Name the weakest claim in the line and the weakest supporting message.
- Say which message has no proof behind it, or only a requirement or an unverified claim, and what would count as proof.
- Say where an alternative, including doing nothing, would beat it with the audience named.
- Say who it is not for, and any words a buyer would not understand.
- At most five bullets, each one sentence. No praise.`;

const FIELDS = ["forWhom", "need", "productIs", "thatDoes", "unlike", "difference"] as const;

/** A stable string of what the reviewer was shown: the line's parts and each message with its proof links. */
export function positioningFingerprint(data: Record<string, unknown>): string {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  return JSON.stringify([
    FIELDS.map((f) => (typeof data[f] === "string" ? (data[f] as string).trim() : "")),
    messages.map((m) => {
      const x = (m ?? {}) as { text?: unknown; proof?: unknown };
      const proof = Array.isArray(x.proof) ? x.proof.map((p) => (p as { itemId?: unknown })?.itemId ?? null) : [];
      return [typeof x.text === "string" ? x.text.trim() : "", proof];
    }),
  ]);
}
