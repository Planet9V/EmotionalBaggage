// Traceability worked out from the concept's own rows: what each requirement is checked by and needs,
// and what no requirement points at. Pure, so the screens and the tests use the same answers.
import type { Item } from "@/lib/types";
import { STORE } from "@/lib/domain/schemas";
import { keyOf, listOf, TEST_DONE } from "./spec";

export type Coverage = { tests: number; parts: number };

export const coverageOf = (req: Pick<Item, "data">): Coverage => ({ tests: listOf(req.data, "tests").length, parts: listOf(req.data, "parts").length });

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** "2 tests, 1 part"; with no test, the sentence that says so. */
export function coverageText(c: Coverage): string {
  if (!c.tests) return c.parts ? `No test covers this, ${plural(c.parts, "part")}` : "No test covers this";
  return `${plural(c.tests, "test")}, ${plural(c.parts, "part")}`;
}

export type Trace = ReturnType<typeof traceOf>;

export function traceOf(items: Item[]) {
  const inSection = (s: string) => items.filter((i) => i.section === s).sort((a, b) => a.sort - b.sort || a.id - b.id);
  const requirements = inSection(STORE.requirements);
  const tests = inSection(STORE.tests);
  const parts = inSection(STORE.parts);
  const testKeys = new Map(tests.map((t) => [keyOf(t.data), t]));
  const checked = new Set(requirements.flatMap((r) => listOf(r.data, "tests")));
  const needed = new Set(requirements.flatMap((r) => listOf(r.data, "parts")));
  return {
    requirements,
    tests,
    parts,
    /** a requirement's tests, in the order the requirement lists them, skipping keys that match no row */
    testsOf: (r: Item) => listOf(r.data, "tests").flatMap((k) => (testKeys.has(k) ? [testKeys.get(k)!] : [])),
    /** requirements nothing checks */
    untested: requirements.filter((r) => !listOf(r.data, "tests").length),
    /** tests that check no requirement */
    orphanTests: tests.filter((t) => !checked.has(keyOf(t.data))),
    /** parts no requirement needs */
    unusedParts: parts.filter((p) => !needed.has(keyOf(p.data))),
    passing: (t: Item) => t.status === TEST_DONE,
  };
}

/** The rows whose link lists name this row's key: what deleting it will unlink. */
export function linkedFrom(items: Item[], row: Pick<Item, "section" | "data">): Item[] {
  const key = keyOf(row.data);
  if (!key) return [];
  const holders: Record<string, string[]> =
    row.section === STORE.tests ? { [STORE.requirements]: ["tests"], [STORE.builds]: ["tests"] } : row.section === STORE.parts ? { [STORE.requirements]: ["parts"] } : {};
  return items.filter((i) => (holders[i.section] ?? []).some((f) => listOf(i.data, f).includes(key)));
}

/** A key for a row that has none, from its reference or title, that no other row uses. */
export function freshKey(items: Item[], row: Pick<Item, "title" | "section" | "data">): string {
  const prefix = row.section === STORE.tests ? "test" : row.section === STORE.parts ? "part" : "row";
  const ref = typeof row.data.ref === "string" ? row.data.ref : "";
  const slug = (ref || row.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || prefix;
  const used = new Set(items.map((i) => keyOf(i.data)));
  const base = ref ? slug : `${prefix}-${slug}`;
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
  return key;
}
