// The proof check for a positioning message (plan 8.3): each supporting message must link to
// something the concept actually holds. A verified claim and a passing test are proof. A
// requirement is linked but is a statement of intent, so it is shown as such. An unverified or
// wrong claim, or a test that has not passed, is a link that proves nothing.
import type { ProofRef, PositioningMessage } from "./schemas";

export type ProofRow = { id: number; section: string; title: string; status: string; key?: string };

export type ProofState =
  | "verified claim"
  | "passing test"
  | "requirement"
  | "unverified claim"
  | "test not passing"
  | "missing";

const PROOF: ReadonlySet<ProofState> = new Set(["verified claim", "passing test", "requirement"]);

export function proofState(ref: ProofRef, rows: Map<number, ProofRow>): ProofState {
  const row = rows.get(ref.itemId);
  if (!row) return "missing";
  if (row.section === "research/claims") return row.status === "verified" ? "verified claim" : "unverified claim";
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
