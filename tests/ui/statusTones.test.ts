import { describe, expect, it } from "vitest";
import { approvalStatusTone, statusTone, TONE_CLASS } from "@/lib/statusTones";

describe("status tones: one map for every screen", () => {
  it("gives a word its tone, and a word it does not know the neutral tone", () => {
    expect(statusTone("verified")).toBe("success");
    expect(statusTone("queued")).toBe("warning");
    expect(statusTone("approved")).toBe("info");
    expect(statusTone("no such status")).toBe("neutral");
  });

  it("treats approved as finished and draft as waiting on rows that are drafted and approved", () => {
    expect(approvalStatusTone("draft")).toBe("warning");
    expect(approvalStatusTone("approved")).toBe("success");
    expect(approvalStatusTone("scheduled")).toBe("success");
    expect(approvalStatusTone("paused")).toBe(statusTone("paused"));
  });

  it("has colour classes for every tone", () => {
    for (const tone of ["neutral", "info", "success", "warning", "danger"] as const) expect(TONE_CLASS[tone]).toMatch(/bg-/);
  });
});
