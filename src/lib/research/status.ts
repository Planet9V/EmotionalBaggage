// A claim's status follows from its evidence, and from nothing else.
export type ClaimStatus = "verified" | "wrong" | "unverified";

type HasVerdict = { verdict: "supports" | "contradicts" | "unclear" };

/**
 * verified: at least one source supports it and none contradicts it.
 * wrong: at least one source contradicts it and none supports it.
 * unverified: anything else, including no evidence, only unclear sources, and mixed evidence.
 */
export function claimStatus(evidence: readonly HasVerdict[]): ClaimStatus {
  const supports = evidence.some((e) => e.verdict === "supports");
  const contradicts = evidence.some((e) => e.verdict === "contradicts");
  if (supports && !contradicts) return "verified";
  if (contradicts && !supports) return "wrong";
  return "unverified";
}

/** Sources disagree: at least one supports and at least one contradicts. Shown as "Disputed". */
export function isDisputed(evidence: readonly HasVerdict[]): boolean {
  return evidence.some((e) => e.verdict === "supports") && evidence.some((e) => e.verdict === "contradicts");
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
