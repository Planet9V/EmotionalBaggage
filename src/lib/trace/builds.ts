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

/** The sentence for a build that has no exit criterion or no linked test. */
export const EMPTY_EVIDENCE = "Add at least one exit criterion and one test before marking this build passed.";

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
  // Nothing to prove is not proof: a build needs at least one criterion and one linked test before it can pass.
  if (!criteria.length || !linked.length) blockers.push(EMPTY_EVIDENCE);
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
  if (!blockers.length) return null;
  // The missing-evidence sentence leads; any unmet criterion or test follows it.
  const [first, ...rest] = blockers;
  if (first === EMPTY_EVIDENCE) return rest.length ? `${EMPTY_EVIDENCE} Also: ${rest.join("; and ")}.` : EMPTY_EVIDENCE;
  return `This build cannot be marked passed: ${blockers.join("; and ")}.`;
};

/**
 * Why a build's stored "passed" no longer holds, in words a history line can carry ("Drop test no longer passes"),
 * or an empty list when the evidence is intact. `gone` names tests that were just deleted (the title the row had).
 */
export function lostEvidence(build: Row, tests: Row[], gone: Record<string, string> = {}): string[] {
  const p = buildProgress(build, tests);
  const out: string[] = [];
  if (!p.criteria.length && !p.linked.length) out.push("it has no exit criterion and no linked test");
  else if (!p.criteria.length) out.push("it has no exit criterion");
  else if (!p.linked.length) out.push("it has no linked test");
  for (const t of p.linked) {
    if (t.done) continue;
    if (t.title === null) out.push(`${gone[t.key] ?? t.key} was deleted`);
    else out.push(`${t.title} no longer passes${t.status ? ` (${t.status})` : ""}`);
  }
  for (const c of p.criteria) if (!c.met) out.push(`the criterion "${c.text}" is not met`);
  return out;
}

/** What a passed build gave up when its data changed: a linked test unlinked, or an exit criterion removed. */
export function lostByEdit(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const out: string[] = [];
  const tests = new Set(listOf(after, "tests"));
  for (const k of listOf(before, "tests")) if (!tests.has(k)) out.push(`the test ${k} was unlinked`);
  const kept = new Set(criteriaOf(after).map((c) => c.text));
  for (const c of criteriaOf(before)) if (!kept.has(c.text)) out.push(`the criterion "${c.text}" was removed`);
  return out;
}
