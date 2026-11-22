// The status dashboard's facts, worked out from the concept's rows. Pure: no I/O, no React.
//
// Nothing here has a rule of its own where the app already has one. The gates are the Process page's gates
// (processView, which runs evaluateGate and gatePassed); the decisions are the decision tree's (toDecision,
// lockingDecisions); the unit cost and margins are the economics' own build-up (readEconomics, referenceUnitCost,
// channelResults); the open-question test is the Concept gate's (OPEN_STATUSES). This file only lays those
// results out for one page, and words them. A figure that cannot be derived from the rows is left out, never
// shown as zero.
import type { ProcessView, StageView } from "@/lib/process/client";
import type { CheckResult } from "@/lib/process/evaluate";
import { skippedSentence } from "@/lib/process/evaluate";
import { OPEN_STATUSES } from "@/lib/process/definitions";
import { lockingDecisions } from "@/lib/process/unlocks";
import { DECISIONS_STORE } from "@/lib/plan";
import { decisionReady, toDecision, type Decision } from "@/lib/domain/decision";
import { readEconomics } from "@/lib/economics/read";
import { channelResults, fixedCosts, HREF, referenceUnitCost } from "@/lib/economics/compute";
import { formatMoney } from "@/lib/economics/money";
import { STORE_BATCHES, STORE_CHANNELS, STORE_ECONOMICS, STORE_METHODS } from "@/lib/economics/schemas";
import { sectionLabel } from "@/lib/menuLookup";
import { sectionsFor } from "@/lib/productTypes";
import { plural } from "@/lib/format";
import type { Item } from "@/lib/types";

/** The four states a stage can be in on the dashboard. */
export type StageStatus = "not-started" | "in-progress" | "passed" | "blocked";

export const STATUS_WORD: Record<StageStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  passed: "Gate passed",
  blocked: "Blocked",
};

/** A row status that says the work is stuck: the same set the overview lists under "Blocked". */
const TROUBLE = new Set(["blocked", "wrong", "fail", "failed"]);

export type Blocker = { text: string; href: string };

export type StageCard = {
  key: string;
  n: number;
  label: string;
  goal: string;
  position: StageView["position"];
  status: StageStatus;
  /** the gate was passed on an override with a reason, not on its checks */
  byOverride: boolean;
  met: number;
  total: number;
  checks: CheckResult[];
  /** why the stage is blocked; empty unless the status is "blocked" */
  blockers: Blocker[];
  /** decisions not yet made that open one of this stage's sections (a warning; the sections stay usable) */
  waitsOn: Decision[];
  /** rows recorded in this stage's own sections */
  rows: number;
};

export type Action = {
  label: string;
  href: string;
  /** what doing it unblocks, in one sentence */
  why: string;
  stage: string;
};

export type Figure = { key: string; label: string; value: string; detail: string; href: string };

export type OpenDecision = { key: string; question: string; href: string; opens: string[]; ready: boolean; waitsFor: string[] };

export type StatusModel = {
  stages: StageCard[];
  current: StageCard;
  /** "At Prototype: 3 of 5 checks met" */
  headline: string;
  /** the sentence under the headline */
  subline: string;
  passedCount: number;
  actions: Action[];
  figures: Figure[];
  decisions: OpenDecision[];
};

const stageOfPath = (path: string) => path.split("/")[0] ?? "";

/** The status of one stage, from its gate and the concept's rows. */
export function stageStatus(s: StageView, rows: Item[], ctx: { /** the sentence for a gate the concept moved past without passing */ skipped?: string } = {}): { status: StageStatus; blockers: Blocker[] } {
  if (s.passed) return { status: "passed", blockers: [] };
  const blockers: Blocker[] = [];
  if (ctx.skipped) blockers.push({ text: ctx.skipped, href: `/process#gate-${s.key}` });
  for (const r of rows) {
    if (stageOfPath(r.section) !== s.key || !TROUBLE.has(r.status)) continue;
    blockers.push({ text: `"${r.title}" in ${sectionLabel(r.section)} is marked ${r.status}.`, href: `/s/${r.section}?item=${r.id}` });
  }
  if (blockers.length) return { status: "blocked", blockers };
  const started = rows.some((r) => stageOfPath(r.section) === s.key);
  return { status: started ? "in-progress" : "not-started", blockers: [] };
}

type Candidate = { label: string; href: string; tier: number; order: number; checks: { stage: string; id: string }[]; opens: string[]; stage: string };

const TIER: Record<StageView["position"], number> = { done: 0, current: 1, upcoming: 2 };

/**
 * The next actions, at most `limit`. Every unmet check of every gate not yet passed is a candidate, and so is
 * every decision not yet made that opens a section. Candidates with the same action are one action (deciding the
 * go/no-go question is both a Concept check and a decision that opens Sourcing).
 *
 * Order: gates behind the concept first (they were skipped), then the current gate, then later ones: nothing at
 * a later stage moves the concept on while the current gate stands. Within that, the action that unblocks the most
 * comes first: one that passes a gate outright, then the one that clears the most checks and opens the most
 * sections. Ties keep the gate's own order, so the first action is the app's next step whenever nothing outranks it.
 */
export function nextActions(view: ProcessView, rows: Item[], limit = 3): Action[] {
  const byLabel = new Map<string, Candidate>();
  let order = 0;
  const add = (c: Omit<Candidate, "order">) => {
    const had = byLabel.get(c.label);
    if (had) {
      had.checks.push(...c.checks);
      had.opens.push(...c.opens.filter((o) => !had.opens.includes(o)));
      if (c.tier < had.tier) Object.assign(had, { tier: c.tier, stage: c.stage });
      return;
    }
    byLabel.set(c.label, { ...c, order: order++ });
  };

  const cur = view.current;
  if (cur.passed && cur.position === "current") {
    const i = view.stages.indexOf(cur);
    const after = view.stages[i + 1];
    if (after) add({ label: view.next.label, href: view.next.href, tier: 1, checks: [], opens: [], stage: cur.key });
  }
  for (const s of view.stages) {
    if (s.passed) continue;
    for (const c of s.result.checks) if (!c.met) add({ label: c.action, href: c.href, tier: TIER[s.position], checks: [{ stage: s.key, id: c.id }], opens: [], stage: s.key });
  }
  const visible = sectionsFor(view.state.productType);
  for (const d of decisionsOf(rows)) {
    if (d.chosen) continue;
    // the sections it opens, as the section banners name them (a decision that opens Sourcing opens the parts list too)
    const opens: string[] = [];
    let tier = 3;
    let stage = "";
    for (const st of visible) {
      const sv = view.stages.find((x) => x.key === st.key);
      for (const sec of st.sections) {
        if (!lockingDecisions(rows, st.key, sec.key).some((x) => x.key === d.key)) continue;
        opens.push(sec.label);
        if (sv && TIER[sv.position] < tier) [tier, stage] = [TIER[sv.position], st.key];
      }
    }
    if (!opens.length) continue;
    add({ label: `Decide "${d.question}"`, href: "/s/concept/decisions", tier, checks: [], opens, stage });
  }

  const unmet = new Map(view.stages.filter((s) => !s.passed).map((s) => [s.key, s.result.checks.filter((c) => !c.met).map((c) => c.id)]));
  const passes = (c: Candidate) =>
    [...unmet].filter(([stage, ids]) => ids.length > 0 && ids.every((id) => c.checks.some((x) => x.stage === stage && x.id === id))).map(([stage]) => stage);
  const advance = (c: Candidate) => c.checks.length === 0 && c.opens.length === 0;
  const score = (c: Candidate) => c.checks.length + c.opens.length;

  const ranked = [...byLabel.values()].sort(
    (a, b) => a.tier - b.tier || Number(advance(b)) - Number(advance(a)) || passes(b).length - passes(a).length || score(b) - score(a) || a.order - b.order
  );
  const label = (key: string) => view.stages.find((s) => s.key === key)?.label ?? key;
  return ranked.slice(0, limit).map((c) => {
    const parts: string[] = [];
    if (advance(c)) {
      parts.push(view.next.reason);
    } else {
      const gates = passes(c);
      if (gates.length) parts.push(`Passes the ${gates.map(label).join(" and ")} gate${gates.length > 1 ? "s" : ""}.`);
      else if (c.checks.length) {
        const where = [...new Set(c.checks.map((x) => label(x.stage)))];
        const left = unmet.get(c.checks[0]!.stage)?.length ?? 0;
        parts.push(
          c.checks.length === 1
            ? `Clears 1 of the ${plural(left, "check")} left at the ${where[0]} gate.`
            : `Clears ${c.checks.length} checks, at the ${where.join(" and ")} gate${where.length > 1 ? "s" : ""}.`
        );
      }
      if (c.opens.length) parts.push(`Opens ${plural(c.opens.length, "section")}: ${c.opens.join(", ")}.`);
    }
    return { label: c.label, href: c.href, why: parts.join(" "), stage: c.stage };
  });
}

function decisionsOf(rows: Item[]): Decision[] {
  return rows.filter((r) => r.section === DECISIONS_STORE).map(toDecision).filter((d): d is Decision => !!d);
}

/** Decisions not made yet, each with what it opens and what it waits for. */
export function openDecisions(rows: Item[]): OpenDecision[] {
  const all = decisionsOf(rows);
  const byKey = new Map(all.map((d) => [d.key, d]));
  return all
    .filter((d) => !d.chosen)
    .map((d) => ({
      key: d.key,
      question: d.question,
      href: `/s/concept/decisions?item=${d.item.id}`,
      opens: d.unlocks.map((u) => (u.includes("/") ? sectionLabel(u) : u)),
      ready: decisionReady(d, all),
      waitsFor: d.dependsOn.filter((k) => !byKey.get(k)?.chosen).map((k) => byKey.get(k)?.question ?? k),
    }));
}

/** The key figures the app already works out, each with the page it comes from. Left out when there is nothing to work from. */
export function keyFigures(rows: Item[], currency: string): Figure[] {
  const of = (s: string) => rows.filter((r) => r.section === s);
  const out: Figure[] = [];
  const parts = of("design/bom");
  const econ = { parts, economics: of(STORE_ECONOMICS), channels: of(STORE_CHANNELS), methods: of(STORE_METHODS), batches: of(STORE_BATCHES), printJobs: of("prototype/printing") };

  if (parts.length || econ.economics.length) {
    const inputs = readEconomics(econ, currency);
    const u = referenceUnitCost(inputs);
    out.push({
      key: "unit-cost",
      label: "Unit cost",
      value: formatMoney(u.total, currency),
      detail: `At ${plural(u.batchSize, "unit")}${u.complete ? "" : `; incomplete, ${plural(u.missing.length, "line")} not priced`}`,
      href: HREF.economics,
    });
    const priced = channelResults(inputs.channels, u, fixedCosts(inputs)).filter((c) => c.price !== null);
    const first = priced[0];
    if (first && first.price !== null) {
      out.push({
        key: "price",
        label: "Price and margin",
        value: formatMoney(first.price, currency),
        detail:
          first.margin === null
            ? `${first.title}; margin not worked out`
            : `${first.title}; margin ${formatMoney(first.margin, currency)}${first.marginPercent === null ? "" : ` (${first.marginPercent.toFixed(1)}%)`}${first.complete ? "" : ", incomplete"}${priced.length > 1 ? `; ${plural(priced.length - 1, "more channel")}` : ""}`,
        href: HREF.channels,
      });
    }
  }
  if (parts.length) {
    const inHand = parts.filter((p) => p.status === "in hand").length;
    out.push({ key: "parts", label: "Parts", value: String(parts.length), detail: `${inHand} in hand`, href: "/s/design/bom" });
  }
  const questions = of("concept/questions");
  if (questions.length) {
    const open = questions.filter((q) => OPEN_STATUSES.includes(q.status)).length;
    out.push({ key: "questions", label: "Open questions", value: String(open), detail: `of ${questions.length} recorded`, href: "/s/concept/questions" });
  }
  const claims = of("research/claims");
  if (claims.length) {
    const verified = claims.filter((c) => c.status === "verified").length;
    out.push({ key: "claims", label: "Claims verified", value: `${verified} / ${claims.length}`, detail: `${claims.length - verified} unverified`, href: "/s/research/claims" });
  }
  const jobs = of("prototype/printing");
  if (jobs.length) {
    const done = jobs.filter((j) => j.status === "done").length;
    out.push({ key: "print-jobs", label: "Print jobs", value: String(jobs.length), detail: `${done} printed`, href: "/s/prototype/printing" });
  }
  const files = of("concept/files");
  if (files.length) out.push({ key: "files", label: "Files", value: String(files.length), detail: "source documents", href: "/files" });
  return out;
}

/** Everything the dashboard shows, from the process view (the Process page's) and the concept's rows. */
export function statusModel(view: ProcessView, rows: Item[]): StatusModel {
  const visible = sectionsFor(view.state.productType);
  const stages: StageCard[] = view.stages.map((s) => {
    const skip = view.skipped.find((x) => x.stage === s.key);
    const { status, blockers } = stageStatus(s, rows, { skipped: skip ? skippedSentence(skip) : undefined });
    const sections = visible.find((v) => v.key === s.key)?.sections ?? [];
    const waits = new Map<string, Decision>();
    if (!s.passed) for (const sec of sections) for (const d of lockingDecisions(rows, s.key, sec.key)) waits.set(d.key, d);
    return {
      key: s.key,
      n: s.n,
      label: s.label,
      goal: s.goal,
      position: s.position,
      status,
      byOverride: s.passed && s.overridden && !s.result.met,
      met: s.result.checks.filter((c) => c.met).length,
      total: s.result.checks.length,
      checks: s.result.checks,
      blockers,
      waitsOn: [...waits.values()],
      rows: rows.filter((r) => stageOfPath(r.section) === s.key).length,
    };
  });
  const current = stages.find((s) => s.position === "current") ?? stages[0]!;
  const passedCount = stages.filter((s) => s.status === "passed").length;
  const last = current === stages[stages.length - 1];
  const headline = current.status === "passed" ? `At ${current.label}: gate passed` : `At ${current.label}: ${current.met} of ${plural(current.total, "check")} met`;
  const subline =
    current.status === "passed"
      ? last
        ? "Every check of the last gate is met: the concept has reached sale."
        : `${current.label} is done${current.byOverride ? " by override" : ""}; the concept can move on to ${stages[stages.indexOf(current) + 1]!.label}.`
      : `${plural(current.total - current.met, "check")} stand${current.total - current.met === 1 ? "s" : ""} between ${current.label} and ${last ? "sale" : stages[stages.indexOf(current) + 1]!.label}.`;
  return {
    stages,
    current,
    headline,
    subline,
    passedCount,
    actions: nextActions(view, rows),
    figures: keyFigures(rows, view.state.facts?.currency ?? "USD"),
    decisions: openDecisions(rows),
  };
}
