// Traceability worked out from the concept's own rows: what each requirement is checked by and needs,
// and what no requirement points at. Pure, so the screens and the tests use the same answers.
import type { Item } from "@/lib/types";
import { STORE } from "@/lib/domain/schemas";
import { keyOf, LINK_FIELDS, listOf, MIRRORED, TEST_DONE } from "./spec";

export type Coverage = { tests: number; parts: number };

/** A requirement's links: test and part keys, read from both ends. A test or part with no key is named "#<id>". */
export type ReqLinks = { tests: string[]; parts: string[] };

const tokenOf = (i: Pick<Item, "id" | "data">) => keyOf(i.data) || `#${i.id}`;

/**
 * The one reading of the requirement links (plan 4.x traceability). A link may have been written at either end:
 * the requirement's `tests`/`parts` list, or a test's or part's `requirements` list (what drafting writes). Both
 * count, so a fully drafted chain shows its coverage even where only one end was written.
 */
export function linksOf(items: Pick<Item, "id" | "section" | "data">[]): (req: Pick<Item, "data">) => ReqLinks {
  const back = new Map<string, ReqLinks>();
  for (const { field, section } of MIRRORED) {
    for (const row of items) {
      if (row.section !== section) continue;
      for (const k of listOf(row.data, "requirements")) {
        const l = back.get(k) ?? { tests: [], parts: [] };
        l[field].push(tokenOf(row));
        back.set(k, l);
      }
    }
  }
  return (req) => {
    const own = keyOf(req.data);
    const theirs = own ? back.get(own) : undefined;
    return {
      tests: [...new Set([...listOf(req.data, "tests"), ...(theirs?.tests ?? [])])],
      parts: [...new Set([...listOf(req.data, "parts"), ...(theirs?.parts ?? [])])],
    };
  };
}

/** How many tests check a requirement and how many parts it needs, read from both ends when the concept's rows are given. */
export function coverageOf(req: Pick<Item, "data">, items?: Pick<Item, "id" | "section" | "data">[]): Coverage {
  const l = items ? linksOf(items)(req) : { tests: listOf(req.data, "tests"), parts: listOf(req.data, "parts") };
  return { tests: l.tests.length, parts: l.parts.length };
}

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
  const links = linksOf(items);
  const testKeys = new Map(tests.map((t) => [tokenOf(t), t]));
  const reqKeys = new Set(requirements.map((r) => keyOf(r.data)).filter(Boolean));
  const checked = new Set(requirements.flatMap((r) => links(r).tests));
  const needed = new Set(requirements.flatMap((r) => links(r).parts));
  // A test or part that names a requirement that exists is linked, whichever end holds the link.
  const namesReq = (i: Item) => listOf(i.data, "requirements").some((k) => reqKeys.has(k));
  return {
    requirements,
    tests,
    parts,
    /** the requirement's links, read from both ends */
    linksOf: links,
    /** a requirement's tests, in the order the requirement lists them, then those that name it; keys that match no row are skipped */
    testsOf: (r: Item) => links(r).tests.flatMap((k) => (testKeys.has(k) ? [testKeys.get(k)!] : [])),
    /** requirements nothing checks */
    untested: requirements.filter((r) => !links(r).tests.some((k) => testKeys.has(k))),
    /** tests that check no requirement */
    orphanTests: tests.filter((t) => !checked.has(tokenOf(t)) && !namesReq(t)),
    /** parts no requirement needs */
    unusedParts: parts.filter((p) => !needed.has(tokenOf(p)) && !namesReq(p)),
    passing: (t: Item) => t.status === TEST_DONE,
  };
}

/** The rows whose link lists name this row's key: what deleting it will unlink. */
export function linkedFrom(items: Item[], row: Pick<Item, "section" | "data">): Item[] {
  const key = keyOf(row.data);
  if (!key) return [];
  const holders: Record<string, string[]> = {};
  for (const [holder, fields] of Object.entries(LINK_FIELDS)) {
    for (const [field, spec] of Object.entries(fields)) if (spec.section === row.section) (holders[holder] ??= []).push(field);
  }
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
