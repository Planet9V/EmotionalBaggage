import { describe, expect, it } from "vitest";
import { changesOf, restoreBody, valueText } from "@/lib/trace/history";

describe("reading an event's before and after", () => {
  it("lists only the fields that differ, in the order title, details, status, position, then the rest", () => {
    const c = changesOf({ before: { "data.qty": 1, status: "a", title: "x", same: 1 }, after: { "data.qty": 2, status: "b", title: "y", same: 1 } }, "item.edited");
    expect(c.map((x) => x.field)).toEqual(["title", "status", "data.qty"]);
    expect(c[2]).toMatchObject({ label: "Qty", before: 1, after: 2, restorable: true });
  });
  it("marks a value that never existed as not restorable, and an added or removed row as having nothing to restore", () => {
    expect(changesOf({ before: {}, after: { "data.x": 1 } }, "item.edited")[0].restorable).toBe(false);
    expect(changesOf({ after: { title: "t" } }, "item.added")[0]).toEqual({ field: "title", label: "Title", after: "t", restorable: false });
    expect(changesOf({ before: { title: "t" } }, "item.removed")[0].restorable).toBe(false);
  });
  it("reads the older evidence event shape and hides the computed flag", () => {
    const c = changesOf({ before: { status: "unverified", evidence: [] }, after: { status: "verified", evidence: [{ url: "https://a.example", verdict: "supports" }], disputed: false } }, "claim.evidence.added");
    expect(c.map((x) => x.field)).toEqual(["status", "data.evidence"]);
    expect(c.every((x) => !x.restorable)).toBe(true);
  });
  it("gives nothing for an event without before and after", () => {
    expect(changesOf({ itemId: 1 })).toEqual([]);
    expect(changesOf(null)).toEqual([]);
  });
});

describe("showing values", () => {
  it("shows exit criteria as a checklist and evidence as verdicts", () => {
    expect(valueText([{ text: "Boots", met: true }, { text: "Plays", met: false }])).toBe("[x] Boots\n[ ] Plays");
    expect(valueText([{ url: "https://a.example", verdict: "supports" }])).toBe("supports: https://a.example");
    expect(valueText([])).toBe("empty");
    expect(valueText("")).toBe("empty");
    expect(valueText(["a", "b"])).toBe("a, b");
  });
  it("puts a value back with the patch the row editor itself would send", () => {
    expect(restoreBody("title", "x")).toEqual({ title: "x" });
    expect(restoreBody("data.tests", ["t1"])).toEqual({ data: { tests: ["t1"] } });
  });
});
