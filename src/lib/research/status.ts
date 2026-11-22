// A claim's status follows from its evidence, and from nothing else.
export type ClaimStatus = "verified" | "wrong" | "unverified";

type HasVerdict = { verdict?: unknown; url?: unknown; quote?: unknown; researchId?: unknown };

const supportsIt = (e: HasVerdict) => e?.verdict === "supports";
const contradictsIt = (e: HasVerdict) => e?.verdict === "contradicts";

/**
 * A supporting source that can carry a claim: it is named (its address), it came from a saved
 * research answer, and the words it says are quoted. A verdict with none of that behind it is an
 * opinion about a source, not evidence anyone can check.
 */
export function standsBehind(e: HasVerdict): boolean {
  return supportsIt(e) && typeof e.url === "string" && e.url.trim() !== "" && typeof e.researchId === "number" && typeof e.quote === "string" && e.quote.trim() !== "";
}

/**
 * verified: at least one supporting source stands behind it (saved answer, quote, named source) and none contradicts it.
 * wrong: at least one source contradicts it and none supports it.
 * unverified: anything else, including no evidence, only unclear sources, a supporting verdict
 * with no quote or no saved answer, and mixed evidence.
 */
export function claimStatus(evidence: readonly HasVerdict[]): ClaimStatus {
  const supports = evidence.some(supportsIt);
  const contradicts = evidence.some(contradictsIt);
  if (!contradicts && evidence.some(standsBehind)) return "verified";
  if (contradicts && !supports) return "wrong";
  return "unverified";
}

/**
 * Whether a claim row is verified, for everything that treats a claim as proof (positioning, copy,
 * the landing page, the Research gate, the drafting prompts). The stored status is a copy: it
 * counts only while the evidence on the row still gives it.
 */
export function isVerifiedClaim(row: { status: string; data?: Record<string, unknown> | null }): boolean {
  const stored = row.data?.evidence;
  return row.status === "verified" && claimStatus(Array.isArray(stored) ? (stored as HasVerdict[]) : []) === "verified";
}

/** Sources disagree: at least one supports and at least one contradicts. Shown as "Disputed". */
export function isDisputed(evidence: readonly HasVerdict[]): boolean {
  return evidence.some(supportsIt) && evidence.some(contradictsIt);
}

const sources = (n: number) => `${n} source${n === 1 ? "" : "s"}`;
const verb = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** What the evidence alone says, as one plain phrase: "1 source supports it, none contradicts". */
function evidenceSummary(evidence: readonly HasVerdict[]): string {
  const s = evidence.filter((e) => e.verdict === "supports").length;
  const c = evidence.filter((e) => e.verdict === "contradicts").length;
  const u = evidence.filter((e) => e.verdict === "unclear").length;
  if (!evidence.length) return "no source judged yet";
  if (s && c) return `sources disagree (${s} ${verb(s, "supports", "support")}, ${c} ${verb(c, "contradicts", "contradict")})`;
  if (s && !evidence.some(standsBehind)) return `${sources(s)} ${verb(s, "supports", "support")} it, but none with a saved answer and a quote from the source`;
  if (s) return `${sources(s)} ${verb(s, "supports", "support")} it, none contradicts`;
  if (c) return `${sources(c)} ${verb(c, "contradicts", "contradict")} it, none supports`;
  return `${sources(u)} judged, ${verb(u, "it is", "all")} unclear`;
}

const LABEL: Record<string, string> = { verified: "Verified", wrong: "Wrong", unverified: "Unverified" };

/**
 * A claim's status with the reason in words, for the board and the Ask screen.
 * "Verified: 1 source supports it, none contradicts", "Disputed: sources disagree",
 * "Unverified: no source judged yet". When the stored status is not the one the evidence gives
 * (set by hand, or saved before the rule), it says so: "Wrong: set by hand; no source judged yet".
 */
export function statusReason(status: string, evidence: readonly HasVerdict[]): string {
  const label = LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  if (status === claimStatus(evidence)) {
    if (isDisputed(evidence) && status === "unverified") return "Disputed: sources disagree";
    return `${label}: ${evidenceSummary(evidence)}`;
  }
  return `${label}: set by hand; ${evidenceSummary(evidence)}`;
}
