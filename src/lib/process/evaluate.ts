import { DEFAULT_STATUSES, findSection, STAGES } from "@/lib/menu";
import { DECISIONS_STORE, UNLOCK_STORES } from "@/lib/plan";
import { toDecision } from "@/lib/domain/decision";
import { STORE_NOUN } from "@/lib/ai/drafts/shared";
import type { Item } from "@/lib/types";
import { checkSection, OPEN_STATUSES, type Check, type ConceptField, type Gate, type ProcessDefinition } from "./definitions";
import { buildPassedCheck, campaignBudgetCheck, contentApprovedCheck, contentProofCheck, countCheck, electricalCheck, enclosureCheck, positioningCheck, productionCheck, type GateFacts } from "./computed";
import { plural } from "@/lib/format";
import { sectionLabel, stageLabel } from "@/lib/menuLookup";

export type { GateFacts } from "./computed";

// Pure: no I/O. The browser and the server both run these on the same rows, so the gate the
// Process page shows is the gate the stage route enforces.

export type ConceptFields = Partial<Record<ConceptField, string>>;

export type CheckResult = {
  id: string;
  label: string;
  met: boolean;
  /** what was found, in a short sentence */
  detail: string;
  /** what to do about it, as an action ("Add 2 more rows to Brief") */
  action: string;
  /** the page that fixes it */
  href: string;
};

export type GateResult = { met: boolean; checks: CheckResult[] };

/** A gate as stored in the `gates` table. */
export type GateRecord = {
  stage: string;
  status: string;
  overridden: boolean;
  note: string;
  decidedBy: string;
  decidedAt: string | null;
};

export type ProcessState = { stage: string; gates: GateRecord[] };

export type NextStep = { label: string; reason: string; href: string };

const listOr = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// The label lookups are shared (src/lib/menuLookup.ts); re-exported because the gate and stage routes import them from here.
export { sectionLabel, stageLabel } from "@/lib/menuLookup";

/** Rows of the store a section path shows (Sourcing shows the parts list, so its rows are design/bom). */
function rowsOf(rows: Item[], path: string): Item[] {
  const store = UNLOCK_STORES.get(path) ?? path;
  return rows.filter((r) => r.section === store);
}

/** "3 wires", "1 requirement": the rows of a section named as what they are, not as rows (U25). */
function things(path: string, n: number) {
  const [one, many] = STORE_NOUN[UNLOCK_STORES.get(path) ?? path] ?? ["row", "rows"];
  return plural(n, one, many);
}
/** "wires", "requirements": the plural alone. */
function thingsWord(path: string) {
  return (STORE_NOUN[UNLOCK_STORES.get(path) ?? path] ?? ["row", "rows"])[1];
}
/** " in Brief" when a section's rows have no name of their own; "" when the noun already says where (U25). */
function inSection(path: string, label: string) {
  return STORE_NOUN[UNLOCK_STORES.get(path) ?? path] ? "" : ` in ${label}`;
}
/** The statuses that settle a row of a section: every status it has that is not one of `open`. */
function settledStatuses(path: string, open: string[]): string[] {
  const [stageKey, sectionKey] = path.split("/");
  const list = findSection(stageKey, sectionKey)?.section.statuses ?? DEFAULT_STATUSES;
  const out = list.filter((x) => !open.includes(x));
  return out.length ? out : ["done"];
}

const FIELD_NAMES: Record<ConceptField, string> = { name: "a name", oneLiner: "a one-line description" };

/** Whether a section's page opens a row from `?item=<id>` (the generic list does; see ItemsView). */
function opensItem(path: string): boolean {
  const [stageKey, sectionKey] = path.split("/");
  return findSection(stageKey, sectionKey)?.section.view === "items";
}

/**
 * The address of the control that fixes a check: the first row that stops it (`?item=<id>`) when the page opens
 * rows from the address, otherwise the control named by the check's anchor (`#<anchor>`), otherwise the page.
 */
export function fixHref(path: string, opts: { row?: Item; anchor?: string } = {}): string {
  if (opts.row && opensItem(path)) return `/s/${path}?item=${opts.row.id}`;
  if (!opts.row && opts.anchor) return `/s/${path}#${opts.anchor}`;
  return `/s/${path}`;
}

/** The words for moving a row to a status: "Approve", "Choose", or "Move ... to <status>". */
function moveAction(title: string, label: string, statuses: string[]): string {
  const s = statuses[0];
  if (s === "approved") return `Approve "${title}" in ${label}`;
  if (s === "chosen") return `Choose "${title}" in ${label}`;
  if (s === "passed") return `Pass the build "${title}" in ${label}`;
  return `Move "${title}" in ${label} to ${listOr(statuses)}`;
}

/** True when any part in the parts list is to be printed: status "to print", made on your own printer, or printed geometry. */
export function printsParts(rows: Item[]): boolean {
  return rows.some((r) => {
    if (r.section !== "design/bom") return false;
    const g = r.data?.geometry as { print?: unknown } | undefined;
    return r.status === "to print" || /own printer/i.test(String(r.data?.source ?? "")) || g?.print === true;
  });
}

export function evaluateCheck(check: Check, rows: Item[], concept: ConceptFields = {}, facts: GateFacts = {}): CheckResult {
  if (check.onlyIf === "prints-parts" && !printsParts(rows)) {
    const path = checkSection(check);
    return { id: check.id, label: check.label, href: path ? fixHref(path) : "/concepts", met: true, detail: "No part in the parts list is to be printed, so no print job is needed.", action: "Nothing to do" };
  }
  const r = evaluateOne(check, rows, concept, facts);
  // A saved enclosure with no file stored for printing: the step is to send it, not to set up a job from nothing (U12).
  if (!r.met && check.id === "prototype.print-jobs" && facts.enclosureFiles === 0 && rows.some((x) => x.section === "design/enclosure" && (x.data as { enclosureGenerator?: unknown })?.enclosureGenerator)) {
    return { ...r, action: "Send the enclosure to printing", href: "/s/design/enclosure#send-to-printing", detail: `${r.detail} The enclosure is saved but no file of it is stored for printing yet.` };
  }
  const n = check.needs;
  if (r.met || !n || rowsOf(rows, n.section).some((x) => n.statuses.includes(x.status))) return r;
  const waiting = rowsOf(rows, n.section)[0];
  const detail = `${r.detail} It is made from a ${sectionLabel(n.section).toLowerCase()} marked ${listOr(n.statuses)}, and there is none yet.`;
  if (waiting) return { ...r, detail, action: `Mark "${waiting.title}" ${listOr(n.statuses)} in ${sectionLabel(n.section)}`, href: fixHref(n.section, { row: waiting }) };
  return { ...r, detail, action: n.todo, href: fixHref(n.section, { anchor: n.anchor }) };
}

function evaluateOne(check: Check, rows: Item[], concept: ConceptFields, facts: GateFacts): CheckResult {
  const path = checkSection(check);
  const href = path ? fixHref(path, { anchor: check.anchor }) : "/concepts";
  const base = { id: check.id, label: check.label, href };
  switch (check.kind) {
    case "min-rows": {
      const p = check.params;
      const ex = p.except;
      const all = rowsOf(rows, p.section).filter((r) => !ex || String(r.data?.[ex.field] ?? "") !== ex.value);
      const counted = p.statuses ? all.filter((r) => p.statuses!.includes(r.status)) : all;
      const n = counted.length;
      const met = n >= p.min;
      const label = sectionLabel(p.section);
      // Rows exist but none is at the status asked for: name the first one and open it.
      const waiting = p.statuses && !met ? all.find((r) => !p.statuses!.includes(r.status)) : undefined;
      if (waiting) {
        return {
          ...base,
          href: fixHref(p.section, { row: waiting }),
          met,
          detail: `${things(p.section, n)} ${listOr(p.statuses!)}, ${p.min} needed; ${things(p.section, all.length - n)} waiting.`,
          action: moveAction(waiting.title, label, p.statuses!),
        };
      }
      return {
        ...base,
        met,
        detail: met ? `${things(p.section, n)} ${p.statuses ? listOr(p.statuses) : "recorded"}.` : `${things(p.section, n)} ${p.statuses ? listOr(p.statuses) : "recorded"}, ${p.min} needed.`,
        action:
          n === 0 && check.todo
            ? check.todo
            : n === 0 && check.anchor === "draft-with-ai"
              ? `Draft ${label} with AI, or add a row by hand`
              : p.min - n > 0
                ? `Add ${p.min - n} more ${p.min - n === 1 ? (STORE_NOUN[UNLOCK_STORES.get(p.section) ?? p.section]?.[0] ?? "row") : thingsWord(p.section)}${inSection(p.section, label)}`
                : `Add ${thingsWord(p.section)}${inSection(p.section, label)}`,
      };
    }
    case "all-status": {
      const xs = rowsOf(rows, check.params.section);
      const allowed = new Set(check.params.statuses);
      const badRows = xs.filter((r) => !allowed.has(r.status));
      const bad = badRows.length;
      const want = listOr(check.params.statuses);
      const label = sectionLabel(check.params.section);
      // True of zero rows is not proof: an empty section fails unless the definition allows it.
      if (xs.length === 0 && !check.params.allowEmpty) {
        return { ...base, met: false, detail: `No ${thingsWord(check.params.section)}${inSection(check.params.section, label)} yet, so nothing shows this is ${want}.`, action: check.todo ?? `Add ${thingsWord(check.params.section)}${inSection(check.params.section, label)}` };
      }
      return {
        ...base,
        href: badRows[0] ? fixHref(check.params.section, { row: badRows[0] }) : base.href,
        met: bad === 0,
        detail: xs.length === 0 ? `No ${thingsWord(check.params.section)} yet, so nothing is left to move.` : bad === 0 ? `All ${things(check.params.section, xs.length)} are ${want}.` : `${bad} of ${things(check.params.section, xs.length)} not yet ${want}.`,
        action: bad === 1 ? `Move "${badRows[0].title}" in ${label} to ${want}` : `Move ${things(check.params.section, bad)}${inSection(check.params.section, label)} to ${want}, starting with "${badRows[0]?.title ?? ""}"`,
      };
    }
    case "no-open": {
      const statuses = check.params.statuses ?? OPEN_STATUSES;
      const set = new Set(statuses);
      const all = rowsOf(rows, check.params.section);
      const open = all.filter((r) => set.has(r.status));
      const n = open.length;
      const label = sectionLabel(check.params.section);
      if (all.length === 0 && !check.params.allowEmpty) {
        return { ...base, met: false, detail: `No ${thingsWord(check.params.section)}${inSection(check.params.section, label)} yet, so nothing shows none is ${listOr(statuses)}.`, action: check.todo ?? `Add ${thingsWord(check.params.section)}${inSection(check.params.section, label)}` };
      }
      return {
        ...base,
        href: open[0] ? fixHref(check.params.section, { row: open[0] }) : base.href,
        met: n === 0,
        detail: n === 0 ? `Nothing is ${listOr(statuses)}.` : `${things(check.params.section, n)} still ${listOr(statuses)}.`,
        // "Settle" said nothing about what to do: name the statuses that settle a row (U25).
        action:
          n === 1
            ? `Mark "${open[0].title}" in ${label} as ${listOr(settledStatuses(check.params.section, statuses))}`
            : `Mark ${things(check.params.section, n)}${inSection(check.params.section, label)} as ${listOr(settledStatuses(check.params.section, statuses))}, starting with "${open[0]?.title ?? ""}"`,
      };
    }
    case "claims-verified": {
      const xs = rowsOf(rows, check.params.section ?? "research/claims");
      const verified = xs.filter((r) => r.status === "verified").length;
      const share = check.params.share;
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      if (xs.length === 0) {
        return { ...base, met: false, detail: "No claims recorded yet.", action: "Record the claims the plan depends on" };
      }
      const met = verified / xs.length >= share;
      const needed = Math.max(0, Math.ceil(share * xs.length - 1e-9) - verified);
      // The control that verifies a claim is Research, Ask with the claim as the question ("Verify this"):
      // the answer is attached to the claim and each source is judged there.
      const first = xs.find((r) => r.status !== "verified");
      const ask = first ? `/s/research/ask?${new URLSearchParams({ ask: [first.title, first.body].filter(Boolean).join(": ").slice(0, 600), item: String(first.id), claim: String(first.id) }).toString()}` : base.href;
      return {
        ...base,
        href: met ? base.href : ask,
        met,
        detail: `${verified} of ${plural(xs.length, "claim")} verified (${pct(verified / xs.length)}), ${pct(share)} needed.`,
        action: needed === 1 && first ? `Verify "${first.title}" in Research, Ask` : `Verify ${plural(needed, "more claim")}, starting with "${first?.title ?? ""}"`,
      };
    }
    case "decision-made": {
      const key = check.params.key;
      const all = rows
        .filter((r) => r.section === DECISIONS_STORE)
        .map(toDecision)
        .filter((x): x is NonNullable<typeof x> => !!x);
      let d = all.find((x) => x.key === key);
      let via = "";
      if (!d && check.params.fallback === "root") {
        d = all.find((x) => x.parent === "");
        if (d) via = " The first decision in the tree is read as this one.";
      }
      if (!d) {
        return check.params.fallback === "root"
          ? { ...base, met: false, detail: "The decision tree is empty.", action: "Add the go/no-go question as the first decision" }
          : { ...base, met: false, detail: "This decision is not in the decision tree yet.", action: "Add the decision to the decision tree" };
      }
      const chosen = d.options.find((o) => o.id === d.chosen);
      return {
        ...base,
        met: d.chosen !== "",
        detail: (d.chosen ? `Chosen: ${chosen?.label ?? d.chosen}.` : `"${d.question}" is not decided yet.`) + via,
        action: `Decide "${d.question}"`,
      };
    }
    case "field-set": {
      const f = check.params.field;
      const met = (concept[f] ?? "").trim() !== "";
      return { ...base, met, detail: met ? "Set." : "Not set.", action: `Give the concept ${FIELD_NAMES[f]}` };
    }
    case "electrical":
      return { ...base, ...electricalCheck(facts, rows) };
    case "enclosure":
      return { ...base, ...enclosureCheck(rows) };
    case "production-ready":
      return { ...base, ...productionCheck(rows, facts) };
    case "content-proof":
      return { ...base, ...contentProofCheck(rows, check.params.sections, concept.name ?? "") };
    case "positioning":
      return { ...base, ...positioningCheck(rows) };
    case "campaign-budget":
      return { ...base, ...campaignBudgetCheck(rows) };
    case "tracked-links":
      return { ...base, ...countCheck(facts.links, check.params.min, { one: "tracked link", where: "Tracked links", href: base.href, verb: "Make a tracked link for a campaign" }) };
    case "content-approved":
      return { ...base, ...contentApprovedCheck(rows, check.params.section, sectionLabel(check.params.section), check.anchor) };
    case "build-passed":
      return { ...base, ...buildPassedCheck(rows, check.anchor, check.todo) };
    case "campaign-results":
      return { ...base, ...countCheck(facts.results, check.params.min, { one: "day of results", many: "days of results", where: "Campaign results", href: base.href, verb: "Enter a campaign's results by hand, by paste or from a CSV" }) };
  }
}

/** Every check of one gate against the concept's rows. The gate is met when every check is. */
export function evaluateGate(gate: Gate, rows: Item[], concept: ConceptFields = {}, facts: GateFacts = {}): GateResult {
  const checks = gate.checks.map((c) => evaluateCheck(c, rows, concept, facts));
  return { met: checks.every((c) => c.met), checks };
}

export function gateOf(definition: ProcessDefinition, stage: string): Gate {
  return definition.stages.find((g) => g.stage === stage) ?? { stage, checks: [] };
}

export function recordOf(state: ProcessState, stage: string): GateRecord | undefined {
  return state.gates.find((g) => g.stage === stage);
}

/** A stage's gate is passed when every check is met, or when it was overridden with a reason. */
export function gatePassed(definition: ProcessDefinition, state: ProcessState, stage: string, rows: Item[], concept: ConceptFields = {}, facts: GateFacts = {}) {
  const result = evaluateGate(gateOf(definition, stage), rows, concept, facts);
  const overridden = !!recordOf(state, stage)?.overridden;
  return { passed: result.met || overridden, met: result.met, overridden, result };
}

/** The stage after `stage`, or null for the last one. */
export function stageAfter(stage: string): string | null {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].key : null;
}

/**
 * The one thing to do next: the first unmet check of the current stage's gate; once the gate is
 * passed, advancing to the next stage; at the last stage with its gate passed, nothing more.
 */
export function nextStep(definition: ProcessDefinition, state: ProcessState, rows: Item[], concept: ConceptFields = {}, facts: GateFacts = {}): NextStep {
  const stage = STAGES.some((s) => s.key === state.stage) ? state.stage : STAGES[0].key;
  const label = stageLabel(stage);
  const { passed, overridden, result } = gatePassed(definition, { ...state, stage }, stage, rows, concept, facts);
  if (!passed) {
    const first = result.checks.find((c) => !c.met)!;
    return { label: first.action, reason: `The ${label} gate needs this: ${lowerFirst(first.label)}. ${first.detail}`, href: first.href };
  }
  const after = stageAfter(stage);
  if (!after) {
    return { label: "Every gate is passed", reason: `${label} is the last stage and its gate is ${overridden && !result.met ? "passed by override" : "met"}.`, href: "/process" };
  }
  return {
    label: `Advance to ${stageLabel(after)}`,
    reason: overridden && !result.met ? `The ${label} gate was passed by override.` : `Every check of the ${label} gate is met.`,
    href: "/process#advance",
  };
}

/**
 * A stage before the current one whose gate is neither passed nor overridden: the concept is further on than its
 * gates allow (an override was withdrawn after it advanced, or evidence went bad since). Warns; never stops anything.
 */
export type SkippedGate = {
  /** the gate that is not passed */
  stage: string;
  label: string;
  /** the stage that was entered behind it */
  enteredStage: string;
  enteredLabel: string;
  /** true when the gate was passed on its checks once and no longer is; false when it was never passed */
  regressed: boolean;
  unmet: { id: string; label: string; detail: string; action: string; href: string }[];
};

export function skippedGates(definition: ProcessDefinition, state: ProcessState, rows: Item[], concept: ConceptFields = {}, facts: GateFacts = {}): SkippedGate[] {
  const ci = Math.max(0, STAGES.findIndex((s) => s.key === state.stage));
  const out: SkippedGate[] = [];
  for (let i = 0; i < ci; i++) {
    const key = STAGES[i].key;
    const g = gatePassed(definition, state, key, rows, concept, facts);
    if (g.passed) continue;
    const rec = recordOf(state, key);
    out.push({
      stage: key,
      label: STAGES[i].label,
      enteredStage: STAGES[i + 1].key,
      enteredLabel: STAGES[i + 1].label,
      regressed: rec?.status === "go" && !rec.overridden,
      unmet: g.result.checks.filter((c) => !c.met).map((c) => ({ id: c.id, label: c.label, detail: c.detail, action: c.action, href: c.href })),
    });
  }
  return out;
}

/** The sentence for a skipped gate. */
export const skippedSentence = (s: Pick<SkippedGate, "label" | "enteredLabel" | "regressed">) =>
  s.regressed ? `The ${s.label} gate no longer passes, and the concept is already in ${s.enteredLabel} or later.` : `${s.enteredLabel} was entered without passing the ${s.label} gate.`;
