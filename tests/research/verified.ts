// The evidence a verified claim holds (src/lib/research/status.ts): a supporting source that is named,
// came from a saved research answer, and is quoted. Fixtures that need a claim to count as proof use it,
// so they stay true to the rule instead of leaning on a bare status.
export const SUPPORTING_SOURCE = { url: "https://source.example/report", title: "Source report", quote: "The report says so in these words.", researchId: 1, verdict: "supports" as const, addedAt: "2026-11-21T00:00:00.000Z" };

/** data for a claim row that is verified. */
export const VERIFIED = { evidence: [SUPPORTING_SOURCE] };
