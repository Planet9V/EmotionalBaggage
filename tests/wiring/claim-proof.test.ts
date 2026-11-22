// Wiring check 3: a claim counts as verified only with a saved answer and a quote from a named
// source, and only then counts as proof for positioning or the landing page. One rule
// (src/lib/research/status.ts) read by the status, the hand-set status, both proof checks and the gate.
import { describe, expect, it } from "vitest";
import { claimStatus, isVerifiedClaim, statusReason } from "@/lib/research/status";
import { manualStatusRefusal } from "@/lib/research/rules";
import { checkProof } from "@/lib/market/proof";
import { evaluate as copyFlags, proofStateOf } from "@/lib/content/claims";
import { evaluateCheck } from "@/lib/process/evaluate";
import type { Item } from "@/lib/types";

const named = { url: "https://www.faa.gov/hazmat/packsafe", title: "FAA PackSafe", addedAt: "2026-11-21T00:00:00Z" };
/** A source judged to support the claim, with nothing behind the judgement. */
const bare = { ...named, verdict: "supports" as const };
/** The same source, from a saved research answer, with the words it says. */
const full = { ...bare, researchId: 12, quote: "Devices containing lithium batteries must be completely powered off in checked baggage." };

const claim = (id: number, status: string, evidence: unknown[]): Item => ({ id, projectId: "p", section: "research/claims", title: "FAA requires lithium devices fully off in checked bags", body: "", data: { evidence }, status, sort: id });

describe("when a claim is verified", () => {
  it("a supporting verdict alone verifies nothing", () => {
    expect(claimStatus([bare])).toBe("unverified");
    expect(claimStatus([{ ...bare, quote: full.quote }])).toBe("unverified"); // a quote typed with no saved answer
    expect(claimStatus([{ ...bare, researchId: 12 }])).toBe("unverified"); // a saved answer with no quote
    expect(claimStatus([{ ...full, quote: "   " }])).toBe("unverified");
    expect(claimStatus([full])).toBe("verified");
    expect(claimStatus([bare, full])).toBe("verified");
    expect(claimStatus([full, { ...named, url: "https://other.example", verdict: "contradicts" as const }])).toBe("unverified");
  });

  it("the reason says what is missing", () => {
    expect(statusReason("unverified", [bare])).toBe("Unverified: 1 source supports it, but none with a saved answer and a quote from the source");
  });

  it("cannot be set by hand without that evidence", () => {
    expect(manualStatusRefusal("verified", [bare])).toMatch(/saved answer and a quote/);
    expect(manualStatusRefusal("verified", [full])).toBeNull();
  });

  it("a stored status of verified is not trusted without the evidence", () => {
    expect(isVerifiedClaim(claim(1, "verified", [bare]))).toBe(false);
    expect(isVerifiedClaim(claim(1, "verified", []))).toBe(false);
    expect(isVerifiedClaim(claim(1, "verified", [full]))).toBe(true);
    expect(isVerifiedClaim(claim(1, "unverified", [full]))).toBe(false);
  });
});

describe("only then is it proof", () => {
  const weak = claim(1, "verified", [bare]);
  const strong = claim(2, "verified", [full]);
  const rows = new Map([weak, strong].map((i) => [i.id, i]));
  const message = (id: number) => ({ id: "m", text: "Works in a checked bag", proof: [{ itemId: id, section: "research/claims" }] });

  it("for positioning", () => {
    expect(checkProof([message(1)], rows)[0]).toMatchObject({ hasProof: false, links: [{ state: "unverified claim" }] });
    expect(checkProof([message(2)], rows)[0]).toMatchObject({ hasProof: true, links: [{ state: "verified claim" }] });
  });

  it("for the landing page and every other piece of copy", () => {
    expect(proofStateOf(weak)).toBe("not proof");
    expect(proofStateOf(strong)).toBe("verified claim");
    expect(copyFlags([{ field: "headline", text: "The only talking tag" }], [weak])).toHaveLength(1);
    expect(copyFlags([{ field: "headline", text: "The only talking tag" }], [strong])).toHaveLength(0);
  });

  it("for the Research gate", () => {
    const check = { id: "research.verified", label: "Claims verified", kind: "claims-verified" as const, params: { share: 0.8 } };
    expect(evaluateCheck(check, [weak])).toMatchObject({ met: false, detail: "0 of 1 claim verified (0%), 80% needed." });
    expect(evaluateCheck(check, [strong]).met).toBe(true);
  });
});
