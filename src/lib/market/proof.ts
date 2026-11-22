// The proof check for a positioning message (plan 8.3): each supporting message must link to
// something the concept actually holds. A verified claim and a passing test are proof. A
// requirement is linked but is a statement of intent, so it is shown as such. An unverified or
// wrong claim, or a test that has not passed, is a link that proves nothing.
import { isVerifiedClaim } from "@/lib/research/status";
import { positioningData, type ProofRef, type PositioningMessage } from "./schemas";

/** `data` is the row's own: a claim is verified by the evidence it holds, not by its status alone. */
export type ProofRow = { id: number; section: string; title: string; status: string; data: Record<string, unknown>; key?: string };

export type ProofState =
  | "verified claim"
  | "passing test"
  | "requirement"
  | "unverified claim"
  | "test not passing"
  | "missing";

const PROOF: ReadonlySet<ProofState> = new Set(["verified claim", "passing test", "requirement"]);

function proofState(ref: ProofRef, rows: Map<number, ProofRow>): ProofState {
  const row = rows.get(ref.itemId);
  if (!row) return "missing";
  if (row.section === "research/claims") return isVerifiedClaim(row) ? "verified claim" : "unverified claim";
  if (row.section === "prototype/tests") return row.status === "pass" ? "passing test" : "test not passing";
  if (row.section === "design/requirements") return "requirement";
  return "missing";
}

export type MessageProof = {
  message: PositioningMessage;
  links: { ref: ProofRef; state: ProofState }[];
  /** at least one link counts as proof */
  hasProof: boolean;
  /** only a requirement backs it: stated, not yet shown */
  onlyRequirement: boolean;
};

export function checkProof(messages: PositioningMessage[], rows: Map<number, ProofRow>): MessageProof[] {
  return messages.map((message) => {
    const links = message.proof.map((ref) => ({ ref, state: proofState(ref, rows) }));
    const counting = links.filter((l) => PROOF.has(l.state));
    return {
      message,
      links,
      hasProof: counting.length > 0,
      onlyRequirement: counting.length > 0 && counting.every((l) => l.state === "requirement"),
    };
  });
}

/** The sections a proof link may point at. */
export const PROOF_SECTIONS = ["research/claims", "prototype/tests", "design/requirements"] as const;

/**
 * What stops a positioning counting as proven, in a sentence, or null when nothing does: it needs at
 * least one supporting message, and every message needs a link that counts as proof. The approval
 * rule on the server, the Marketing gate and the Approve button all read this.
 */
export function positioningProofGap(data: unknown, rows: Map<number, ProofRow>): string | null {
  // only the messages are read, so an older row whose other fields no longer fit the schema is still judged on them
  const parsed = positioningData.shape.messages.safeParse((data as { messages?: unknown } | null)?.messages);
  const messages = parsed.success ? (parsed.data ?? []) : [];
  if (!messages.length) return "it has no supporting message, so nothing it says is tied to proof.";
  const bad = checkProof(messages, rows).filter((m) => !m.hasProof);
  if (!bad.length) return null;
  return `${bad.length} of ${messages.length} ${messages.length === 1 ? "message" : "messages"} ${bad.length === 1 ? "has" : "have"} no proof: "${bad[0].message.text}"${bad.length > 1 ? ` and ${bad.length - 1} more` : ""}.`;
}

export const PROOF_NEEDED = "Link each message to a verified claim, a passing test or a requirement first.";
