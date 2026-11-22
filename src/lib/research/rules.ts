// The evidence rule, checked on the server wherever a claim is created or changed outside the
// evidence routes (POST /api/projects/[id]/items, POST /api/projects with items, PATCH /api/items/[id]).
//
// 1. A claim's data.evidence changes only through POST and DELETE /api/research/evidence.
// 2. A claim's status may be set by hand only to a value its evidence does not contradict:
//    - verified needs at least one supporting source that stands behind the claim (a saved answer and
//      a quote from the named source: standsBehind in ./status.ts) and no contradicting source;
//    - wrong is refused while sources support the claim and none contradicts it;
//    - unverified is always allowed (it claims nothing).
//    With no evidence at all, unverified and wrong are allowed and verified is not.
import { HttpError } from "@/lib/api/route";
import { CLAIMS_SECTION } from "./schemas";
import { standsBehind } from "./status";

type HasVerdict = { verdict?: unknown; url?: unknown; quote?: unknown; researchId?: unknown };

export const EVIDENCE_ONLY_THROUGH_ROUTES =
  "A claim's evidence cannot be changed here. Add a source in Research, Ask (Use as evidence beside the source), or remove one on the Claims to verify board; through the API, use POST or DELETE /api/research/evidence.";

const count = (evidence: readonly HasVerdict[], v: string) => evidence.filter((e) => e?.verdict === v).length;
const sources = (n: number) => `${n} source${n === 1 ? "" : "s"}`;

/** Why a claim with this evidence cannot be set to this status by hand, or null when it can. */
export function manualStatusRefusal(status: string, evidence: readonly HasVerdict[]): string | null {
  const s = count(evidence, "supports");
  const c = count(evidence, "contradicts");
  if (status === "verified") {
    if (c > 0) {
      return `This claim cannot be marked verified: ${sources(c)} ${c === 1 ? "contradicts" : "contradict"} it. Remove that evidence first, or mark it wrong or unverified.`;
    }
    if (s === 0) {
      return evidence.length
        ? "This claim cannot be marked verified: no source supports it yet, only unclear ones. Add a supporting source as evidence and the status follows."
        : "This claim cannot be marked verified: no source supports it yet. Add a supporting source as evidence and the status follows.";
    }
    if (!evidence.some(standsBehind)) {
      return `This claim cannot be marked verified: ${sources(s)} ${s === 1 ? "supports" : "support"} it, but none with a saved answer and a quote from the source. In Research, Ask, use a source of a saved answer as evidence and quote what it says; the status follows.`;
    }
  }
  if (status === "wrong" && s > 0 && c === 0) {
    return `This claim cannot be marked wrong: ${sources(s)} ${s === 1 ? "supports" : "support"} it and none contradicts it. Add a contradicting source, or remove the supporting one first.`;
  }
  return null;
}

const hasEvidenceKey = (data: Record<string, unknown> | undefined) => !!data && Object.prototype.hasOwnProperty.call(data, "evidence");

/** For a new row: a claim cannot arrive with evidence, nor with a status its (empty) evidence contradicts. */
export function assertNewClaim(row: { section: string; data?: Record<string, unknown>; status?: string }) {
  if (row.section !== CLAIMS_SECTION) return;
  if (hasEvidenceKey(row.data)) throw new HttpError(400, EVIDENCE_ONLY_THROUGH_ROUTES);
  if (row.status) {
    const why = manualStatusRefusal(row.status, []);
    if (why) throw new HttpError(400, why.replace("This claim cannot be marked", "A new claim cannot start as"));
  }
}

/**
 * For a change to an existing row. `evidence` is what is stored on the claim now.
 * The status is checked only when it changes, so a form that resends the current status still saves.
 */
export function assertClaimChange(was: { section: string; status: string; data: Record<string, unknown> }, change: { data?: Record<string, unknown>; status?: string }) {
  if (was.section !== CLAIMS_SECTION) return;
  if (hasEvidenceKey(change.data)) throw new HttpError(400, EVIDENCE_ONLY_THROUGH_ROUTES);
  if (change.status === undefined || change.status === was.status) return;
  const stored = was.data?.evidence;
  const evidence = Array.isArray(stored) ? (stored as HasVerdict[]) : [];
  const why = manualStatusRefusal(change.status, evidence);
  if (why) throw new HttpError(400, why);
}
