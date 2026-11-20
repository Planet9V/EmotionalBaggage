import { describe, expect, it } from "vitest";
import { SEED_ADDITIONS, SEED_ITEMS } from "@/lib/seed";
import { dataSchemaFor, geometry, keyList, partData, STORE, wireData } from "@/lib/domain";
import { STORE_STATUSES } from "@/lib/api/schemas";

const rows = [...SEED_ITEMS, ...Object.values(SEED_ADDITIONS).flat()];

describe("the seeded concept", () => {
  it("has rows to check", () => {
    expect(rows.length).toBeGreaterThan(100);
  });

  it("uses only sections and statuses the menu defines", () => {
    const bad = rows.filter((r) => !STORE_STATUSES[r.section] || !STORE_STATUSES[r.section].includes(r.status ?? "open"));
    expect(bad.map((r) => `${r.section} / ${r.status} / ${r.title}`)).toEqual([]);
  });

  it("satisfies its section's data schema, row by row", () => {
    const problems: string[] = [];
    for (const r of rows) {
      const res = dataSchemaFor(r.section).safeParse(r.data ?? {});
      if (!res.success) problems.push(`${r.section} "${r.title}": ${res.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }
    expect(problems).toEqual([]);
  });

  it("stores every key list as an array", () => {
    const strings = rows.filter((r) => ["after", "dependsOn", "unlocks"].some((k) => typeof (r.data as Record<string, unknown> | undefined)?.[k] === "string"));
    expect(strings.map((r) => r.title)).toEqual([]);
  });
});

describe("key lists", () => {
  it("reads an older comma string as an array", () => {
    expect(keyList.parse("a, b ,, c")).toEqual(["a", "b", "c"]);
    expect(keyList.parse("")).toEqual([]);
    expect(keyList.parse(["x"])).toEqual(["x"]);
  });
  it("rejects anything that is not a list of text", () => {
    expect(keyList.safeParse(3).success).toBe(false);
    expect(keyList.safeParse([1, 2]).success).toBe(false);
  });
});

describe("geometry", () => {
  const box = { shape: "box", size: [10, 20, 30] };
  it("fills in position, explode direction and basis", () => {
    expect(geometry.parse(box)).toEqual({ shape: "box", size: [10, 20, 30], pos: [0, 0, 0], explode: [0, 0, 0], basis: "typical" });
  });
  it("accepts numbers typed as text and keeps a cylinder to two sizes", () => {
    expect(geometry.parse({ shape: "cylinder", size: ["14.5", "50", "9"], pos: ["1", 2, 3] })).toMatchObject({ size: [14.5, 50], pos: [1, 2, 3] });
  });
  it.each([
    ["an unknown shape", { shape: "sphere", size: [1, 1, 1] }],
    ["a zero size", { shape: "box", size: [10, 0, 30] }],
    ["a box with two sizes", { shape: "box", size: [10, 20] }],
    ["text that is not a number", { shape: "box", size: [10, "wide", 30] }],
    ["a two-number position", { ...box, pos: [1, 2] }],
  ])("rejects %s", (_n, g) => {
    expect(geometry.safeParse(g).success).toBe(false);
  });
  it("keeps count only above one, rounded", () => {
    expect(geometry.parse({ ...box, count: 3.4 }).count).toBe(3);
    expect(geometry.parse({ ...box, count: 1 }).count).toBeUndefined();
  });
});

describe("parts and wires", () => {
  it("keeps columns the schema does not name", () => {
    expect(partData.parse({ ref: "U1", colour: "blue" })).toEqual({ ref: "U1", colour: "blue" });
  });
  it("turns numeric text into numbers and rejects the rest", () => {
    expect(partData.parse({ qty: "2", line: " 9.99 " })).toEqual({ qty: 2, line: 9.99 });
    expect(partData.safeParse({ qty: "12abc" }).success).toBe(false);
    expect(partData.safeParse({ qty: -1 }).success).toBe(false);
    expect(partData.safeParse({ line: "" }).success).toBe(false);
  });
  it("allows only the four net classes", () => {
    expect(wireData.safeParse({ netClass: "audio" }).success).toBe(true);
    expect(wireData.safeParse({ netClass: "data" }).success).toBe(false);
  });
  it("gives every other section the step fields only", () => {
    expect(dataSchemaFor("prototype/assembly").parse({ key: "p1", after: "p0", minutes: "15", time: "15 min" })).toEqual({
      key: "p1", after: ["p0"], minutes: 15, time: "15 min",
    });
    expect(dataSchemaFor(STORE.parts)).toBe(partData);
  });
});
