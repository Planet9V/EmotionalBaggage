// One reader for a stored list of keys: the step reader, the trace links reader and the zod schema agree.
import { describe, expect, it } from "vitest";
import { keys } from "@/lib/domain/step";
import { keyList } from "@/lib/domain/schemas";
import { listOf } from "@/lib/trace/spec";

describe("a list of keys", () => {
  const cases: [unknown, string[]][] = [
    [["a", " b ", "", "c"], ["a", "b", "c"]],
    ["a, b ,, c", ["a", "b", "c"]],
    ["", []],
    [null, []],
    [undefined, []],
    [5, []],
  ];
  it("is read the same way by keys(), listOf and keyList", () => {
    for (const [input, want] of cases) {
      expect(keys(input)).toEqual(want);
      expect(listOf({ f: input }, "f")).toEqual(want);
      // the schema reads a string with the same reader; an array is validated as given, not cleaned
      if (typeof input === "string") expect(keyList.parse(input)).toEqual(want);
    }
    expect(listOf(undefined, "f")).toEqual([]);
  });
});
