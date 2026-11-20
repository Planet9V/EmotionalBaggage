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
