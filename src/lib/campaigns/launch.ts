// The launch plan. A launch is one row (its channel, template and launch date); its steps are rows
// that name the launch by `launch` and say how many days before launch day they are due. Nothing
// stores a step's due date: it is worked out here from the launch date and the step's days, so moving
// the launch date moves every step with one change to one row.
//
// Steps are ordinary keyed rows (`key`, `after`, `minutes`), so the order-of-operations planner
// (src/lib/plan.ts) places them with the rest of the concept's work.
import type { Item } from "@/lib/types";
import { CLOSED } from "@/lib/menu";
import { addDays, daysBetween, isDay } from "./days";
import { LAUNCH_STORE, launchData, type StepRequirement } from "./schemas";
import { CHECK_PROMPT, type LaunchTemplate } from "./templates";
import { slugify } from "./links";

export type NewStepRow = { title: string; body: string; data: Record<string, unknown>; status: string };

export const isLaunchRow = (i: Item) => i.section === LAUNCH_STORE && i.data?.kind === "launch";
export const isStepRow = (i: Item) => i.section === LAUNCH_STORE && i.data?.kind === "step";

/** A launch key no other launch of the concept uses: "kickstarter", then "kickstarter-2". */
export function launchKeyFor(channel: string, existing: Iterable<string>): string {
  const used = new Set(existing);
  const base = slugify(channel, 30) || "launch";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * The rows for a launch from a template: the launch row's data and every step's row. `usedKeys` is
 * every key in the concept (step keys must be unique across all sections), and the step keys are
 * made from the launch key so a second launch of the same channel does not collide.
 */
export function instantiate(t: LaunchTemplate, opts: { launchKey: string; launchDate: string; title?: string; usedKeys: Set<string> }) {
  const keyOf = (local: string) => `${opts.launchKey}-${local}`;
  const taken = [...t.steps].map((s) => keyOf(s.key)).filter((k) => opts.usedKeys.has(k));
  if (taken.length) throw new Error(`These keys are already used in the concept: ${taken.join(", ")}.`);
  const launch: NewStepRow = {
    title: opts.title?.trim() || `${t.label} launch`,
    body: t.blurb,
    status: "open",
    data: { kind: "launch", launchKey: opts.launchKey, template: t.id, channel: t.channel, launchDate: opts.launchDate },
  };
  const steps: NewStepRow[] = t.steps.map((s) => {
    const body = [s.why, s.how && `How: ${s.how}`, s.platformRule && s.check && CHECK_PROMPT].filter(Boolean).join("\n\n");
    const data: Record<string, unknown> = {
      kind: "step",
      key: keyOf(s.key),
      after: (s.after ?? []).map(keyOf),
      minutes: s.minutes,
      launch: opts.launchKey,
      daysBefore: s.daysBefore,
      phase: s.phase,
      why: s.why,
      how: s.how,
      templateStep: s.key,
      ...(s.requires?.length ? { requires: s.requires.map((r) => ({ kind: "gate", ref: r.stage })) } : {}),
      ...(s.source ? { source: s.source } : {}),
      ...(s.platformRule && s.check ? { check: true } : {}),
    };
    return { title: s.title, body, data, status: "open" };
  });
  return { launch, steps };
}

export type LaunchRow = { id: number; title: string; launchKey: string; channel: string; template: string; launchDate: string; status: string };

export function toLaunch(i: Item): LaunchRow {
  const d = (launchData.safeParse(i.data ?? {}).data ?? i.data ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return { id: i.id, title: i.title, launchKey: s(d.launchKey), channel: s(d.channel), template: s(d.template), launchDate: s(d.launchDate), status: i.status };
}

export type StepRow = {
  id: number;
  key: string;
  title: string;
  body: string;
  status: string;
  launch: string;
  daysBefore: number | null;
  phase: string;
  why: string;
  how: string;
  owner: string;
  after: string[];
  minutes: number;
  requires: StepRequirement[];
  source: string;
  check: boolean;
};

export function toStep(i: Item): StepRow {
  const d = (i.data ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const after = Array.isArray(d.after) ? d.after.map(String) : typeof d.after === "string" ? d.after.split(",").map((x) => x.trim()).filter(Boolean) : [];
  return {
    id: i.id,
    key: s(d.key),
    title: i.title,
    body: i.body ?? "",
    status: i.status,
    launch: s(d.launch),
    daysBefore: typeof d.daysBefore === "number" && Number.isFinite(d.daysBefore) ? d.daysBefore : null,
    phase: s(d.phase) || "Steps",
    why: s(d.why),
    how: s(d.how),
    owner: s(d.owner),
    after,
    minutes: typeof d.minutes === "number" ? d.minutes : Number(d.minutes) || 0,
    requires: Array.isArray(d.requires) ? (d.requires as StepRequirement[]) : [],
    source: s(d.source),
    check: d.check === true,
  };
}

/** The day a step is due, from the launch date: null when either is missing. */
export const dueDate = (launchDate: string, daysBefore: number | null) => (isDay(launchDate) && daysBefore !== null ? addDays(launchDate, -daysBefore) : null);

/** What the screen can tell about each requirement: "met", "not met" with a reason, or "unknown". */
export type Context = {
  /** is this stage's gate passed? null when it could not be read */
  gate: (stage: string) => boolean | null;
  /** a build row's status, by its id; null when there is no such build */
  buildStatus: (id: number) => string | null;
  /** the build's name, for the notice */
  buildName: (id: number) => string;
  today: string;
};

export type Blocker = { requirement: StepRequirement; text: string };

export type Scheduled = StepRow & {
  due: string | null;
  /** days from today to the due date: negative is overdue */
  daysAway: number | null;
  overdue: boolean;
  closed: boolean;
  blockers: Blocker[];
  /** keys of prerequisites that are due after this step: the dates cannot both hold */
  conflicts: string[];
};

const STAGE_LABEL: Record<string, string> = { concept: "Concept", research: "Research", design: "Design", prototype: "Prototype", production: "Production", marketing: "Marketing", sales: "Sales" };

/** Every step of a launch with its due date, what blocks it and any date that contradicts a prerequisite. Sorted by due date, then by name. */
export function schedule(launch: LaunchRow, steps: StepRow[], ctx: Context): Scheduled[] {
  const mine = steps.filter((s) => s.launch === launch.launchKey);
  const byKey = new Map(mine.map((s) => [s.key, s]));
  const out = mine.map((s): Scheduled => {
    const due = dueDate(launch.launchDate, s.daysBefore);
    const daysAway = due ? daysBetween(ctx.today, due) : null;
    const closed = CLOSED.has(s.status);
    const blockers: Blocker[] = [];
    if (!closed) {
      for (const r of s.requires) {
        if (r.kind === "gate") {
          const ok = ctx.gate(r.ref);
          if (ok === false) blockers.push({ requirement: r, text: `Cannot be done before the ${STAGE_LABEL[r.ref] ?? r.ref} gate is passed.` });
        } else {
          const id = Number(r.ref);
          const st = Number.isInteger(id) ? ctx.buildStatus(id) : null;
          const name = r.label || (Number.isInteger(id) ? ctx.buildName(id) : r.ref);
          if (st === null) blockers.push({ requirement: r, text: `Cannot be done before the build "${name}" passes, and that build is not in the concept.` });
          else if (st !== "passed") blockers.push({ requirement: r, text: `Cannot be done before the build "${name}" passes (it is ${st}).` });
        }
      }
    }
    const conflicts = s.after.filter((k) => {
      const p = byKey.get(k);
      return !!p && p.daysBefore !== null && s.daysBefore !== null && p.daysBefore < s.daysBefore;
    });
    return { ...s, due, daysAway, overdue: !closed && daysAway !== null && daysAway < 0, closed, blockers, conflicts };
  });
  return out.sort((a, b) => (a.due ?? "9999") < (b.due ?? "9999") ? -1 : (a.due ?? "9999") > (b.due ?? "9999") ? 1 : a.title.localeCompare(b.title));
}

/** Steps grouped by phase in the order their earliest step falls due. */
export function byPhase(list: Scheduled[]): { phase: string; steps: Scheduled[] }[] {
  const m = new Map<string, Scheduled[]>();
  for (const s of list) m.set(s.phase, [...(m.get(s.phase) ?? []), s]);
  return [...m.entries()].map(([phase, steps]) => ({ phase, steps })).sort((a, b) => ((a.steps[0]?.due ?? "9999") < (b.steps[0]?.due ?? "9999") ? -1 : 1));
}

/** How far through the launch is: closed steps over all steps. */
export const progress = (list: Scheduled[]) => ({ done: list.filter((s) => s.closed).length, total: list.length });

/** Template checks used by the tests: returns a list of problems, empty when the template is sound. */
export function checkTemplate(t: LaunchTemplate): string[] {
  const problems: string[] = [];
  const keys = new Map(t.steps.map((s) => [s.key, s]));
  if (keys.size !== t.steps.length) problems.push("a step key is used twice");
  for (const s of t.steps) {
    for (const a of s.after ?? []) {
      const p = keys.get(a);
      if (!p) problems.push(`${s.key} waits on ${a}, which is not a step`);
      else if (p.daysBefore < s.daysBefore) problems.push(`${s.key} is due before ${a}, which it waits on`);
    }
    if (s.platformRule && !s.source && !s.check) problems.push(`${s.key} depends on a platform rule with neither a source nor a prompt to check`);
    if (s.source && !/^https:\/\//.test(s.source)) problems.push(`${s.key} has a source that is not an https address`);
    if (s.minutes < 0 || !Number.isFinite(s.minutes)) problems.push(`${s.key} has no usable minutes`);
  }
  // a loop would hide steps from the planner
  const state = new Map<string, number>();
  const visit = (k: string): boolean => {
    if (state.get(k) === 1) return true;
    if (state.get(k) === 2) return false;
    state.set(k, 1);
    for (const a of keys.get(k)?.after ?? []) if (keys.has(a) && visit(a)) return true;
    state.set(k, 2);
    return false;
  };
  if (t.steps.some((s) => visit(s.key))) problems.push("the steps wait on each other in a loop");
  return problems;
}
