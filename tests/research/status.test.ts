import { describe, expect, it } from "vitest";
import { claimStatus, isDisputed } from "@/lib/research/status";
import { claimEvidence, evidenceAdd } from "@/lib/research/schemas";

type V = "supports" | "contradicts" | "unclear";
const ev = (...vs: V[]) => vs.map((verdict) => ({ verdict }));

describe("claimStatus", () => {
  // Every combination of which verdicts are present (none, S, C, U and their unions).
  const cases: [V[], string, boolean][] = [
    [[], "unverified", false],
    [["unclear"], "unverified", false],
    [["supports"], "verified", false],
    [["contradicts"], "wrong", false],
    [["supports", "unclear"], "verified", false],
    [["contradicts", "unclear"], "wrong", false],
    [["supports", "contradicts"], "unverified", true],
    [["supports", "contradicts", "unclear"], "unverified", true],
    [["supports", "supports"], "verified", false],
    [["contradicts", "contradicts", "unclear", "unclear"], "wrong", false],
  ];
  it.each(cases)("%j → %s (disputed %s)", (vs, status, disputed) => {
    expect(claimStatus(ev(...vs))).toBe(status);
    expect(isDisputed(ev(...vs))).toBe(disputed);
  });
});

describe("evidence schemas", () => {
  it("accepts http and https only, and drops blank optional text", () => {
    expect(evidenceAdd.parse({ claimId: 1, url: "https://x.example/a", verdict: "supports", quote: "  ", title: "" })).toEqual({ claimId: 1, url: "https://x.example/a", verdict: "supports" });
    expect(evidenceAdd.safeParse({ claimId: 1, url: "javascript:alert(1)", verdict: "supports" }).success).toBe(false);
    expect(evidenceAdd.safeParse({ claimId: 1, url: "ftp://x.example", verdict: "supports" }).success).toBe(false);
    expect(evidenceAdd.safeParse({ claimId: 1, url: "https://x.example", verdict: "maybe" }).success).toBe(false);
    expect(evidenceAdd.safeParse({ claimId: 0, url: "https://x.example", verdict: "unclear" }).success).toBe(false);
  });

  it("checks a stored evidence list", () => {
    expect(claimEvidence.safeParse([{ url: "https://x.example", verdict: "supports", addedAt: "2026-11-20T00:00:00Z" }]).success).toBe(true);
    expect(claimEvidence.safeParse([{ url: "https://x.example" }]).success).toBe(false);
    expect(claimEvidence.safeParse("nope").success).toBe(false);
  });
});
