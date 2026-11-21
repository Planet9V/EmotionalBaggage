// A build's progress, worked out from its own criteria and the tests it names. Pure: the screen and the server
// run the same function, so "Mark passed" is refused for the same reasons the card shows.
import { keyOf, listOf, TEST_DONE } from "./spec";

type Row = { title: string; status: string; data: Record<string, unknown> };

export type Criterion = { text: string; met: boolean };
export type BuildTest = { key: string; title: string | null; status: string | null; done: boolean };

export function criteriaOf(data: Record<string, unknown>): Criterion[] {
  const v = data.criteria;
  if (!Array.isArray(v)) return [];
  return v.flatMap((c) => {
    const o = c as { text?: unknown; met?: unknown } | null;
    return o && typeof o.text === "string" ? [{ text: o.text, met: o.met === true }] : [];
  });
}

export function buildProgress(build: Row, tests: Row[]) {
  const byKey = new Map(tests.map((t) => [keyOf(t.data), t]));
  const criteria = criteriaOf(build.data);
  const linked: BuildTest[] = listOf(build.data, "tests").map((key) => {
    const t = byKey.get(key);
    return { key, title: t?.title ?? null, status: t?.status ?? null, done: t?.status === TEST_DONE };
  });
  const unmet = criteria.filter((c) => !c.met);
  const notDone = linked.filter((t) => !t.done);
  /** why this build cannot be marked passed yet; empty when it can */
  const blockers: string[] = [];
  if (unmet.length) blockers.push(`${unmet.length} of ${criteria.length} exit criteria ${unmet.length === 1 ? "is" : "are"} not met (for example "${unmet[0].text}")`);
  if (notDone.length) {
    const t = notDone[0];
    blockers.push(
      `${notDone.length} of ${linked.length} tests ${notDone.length === 1 ? "has" : "have"} not passed (for example ${t.title ? `"${t.title}", ${t.status}` : `"${t.key}", which no longer exists`})`
    );
  }
  return { criteria, met: criteria.length - unmet.length, linked, testsDone: linked.length - notDone.length, blockers };
}

export const PASSED = "passed";

/** The sentence for a refused "Mark passed", or null when the build may pass. */
export const passRefusal = (build: Row, tests: Row[]): string | null => {
  const { blockers } = buildProgress(build, tests);
  return blockers.length ? `This build cannot be marked passed: ${blockers.join("; and ")}.` : null;
};
