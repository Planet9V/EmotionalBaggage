// The gate checks that are worked out by another feature's own code rather than by counting rows
// (plan 3.2 joined with 5.4, 5.9, 7.3 and 8.8 to 8.12). Pure: rows and facts in, a result out. The
// electrical checks need the pins table, so the server works them out (`ercForProject`) and passes
// the summary in `facts.erc`; everything else is read from the rows here, in the browser and on the
// server alike.
import type { Item } from "@/lib/types";
import { readiness, type ReadinessRows } from "@/lib/economics/readiness";
import { readBatch } from "@/lib/economics/read";
import { STORE_BATCHES, STORE_CHANNELS, STORE_COMPLIANCE, STORE_ECONOMICS, STORE_METHODS, STORE_SUPPLIERS } from "@/lib/economics/schemas";
import { buildSpec, enclosureOffered } from "@/lib/enclosure/spec";
import { withDefaults } from "@/lib/enclosure/validate";
import { specFingerprint } from "@/lib/enclosure/fingerprint";
import { evaluate, type ProofRow } from "@/lib/content/claims";
import { claimFields } from "@/lib/content/schemas";
import { positioningFingerprint } from "@/lib/market/critique";
import { effectiveAdRule, ruleComplete } from "@/lib/campaigns/adRule";
import { buildProgress, EMPTY_EVIDENCE, lostEvidence, PASSED } from "@/lib/trace/builds";
import { plural } from "@/lib/format";

/** What the server works out that rows alone cannot give. */
export type GateFacts = {
  /** the concept's currency (projects.currency); the production readiness prices in it */
  currency?: string;
  /** the electrical checks' counts, from ercForProject; undefined when not worked out */
  erc?: { ok: boolean; errors: number; warnings: number } | null;
  /** tracked links and days of campaign results (their own tables); undefined when not counted */
  links?: number;
  results?: number;
};

export type Computed = { met: boolean; detail: string; action: string; href: string };


export const ENCLOSURE_STORE = "design/enclosure";

/** What the generate route stores on the saved choice, per generator. */
export type EnclosureChecked = { fingerprint: string; at: string; checks: { key: string; label: string; ok: boolean; detail?: string }[] };

export function electricalCheck(facts: GateFacts): Computed {
  const href = "/s/design/schematic";
  const e = facts.erc;
  if (!e) return { met: false, detail: "The electrical checks have not been worked out yet.", action: "Open the schematic to run the electrical checks", href };
  return {
    met: e.ok,
    detail: e.ok ? `No errors${e.warnings ? `, ${plural(e.warnings, "warning")} to read` : ""}.` : `${plural(e.errors, "error")}${e.warnings ? ` and ${plural(e.warnings, "warning")}` : ""} in the electrical checks.`,
    action: `Fix ${plural(e.errors, "electrical error")} on the schematic`,
    href,
  };
}

/** The enclosure's checks, as last measured on the saved choice, against today's parts and settings. */
export function enclosureCheck(rows: Item[]): Computed {
  const href = "/s/design/enclosure";
  const bom = rows.filter((r) => r.section === "design/bom");
  if (!enclosureOffered(bom)) return { met: false, detail: "No part has a box, so there is no enclosure to check.", action: "Place the parts in Physical layout", href: "/s/design/layout" };
  const saved = rows.find((r) => r.section === ENCLOSURE_STORE);
  const d = (saved?.data ?? {}) as { enclosureGenerator?: string; params?: Record<string, unknown>; checked?: Record<string, EnclosureChecked> };
  if (!saved || !d.enclosureGenerator) return { met: false, detail: "No enclosure generator is chosen.", action: "Choose an enclosure generator", href };
  const record = d.checked?.[d.enclosureGenerator];
  if (!record) return { met: false, detail: `The chosen generator (${d.enclosureGenerator}) has not been run, so its checks are not measured.`, action: "Generate the enclosure to measure its checks", href };
  const now = specFingerprint(buildSpec({ items: bom, params: withDefaults(d.params) }));
  if (record.fingerprint !== now) return { met: false, detail: "The parts or the settings changed after the checks were measured.", action: "Generate the enclosure again", href };
  const failed = record.checks.filter((c) => !c.ok);
  return {
    met: record.checks.length > 0 && failed.length === 0,
    detail: failed.length ? `${failed.length} of ${plural(record.checks.length, "check")} failed: ${failed.map((c) => c.label).join("; ")}.` : `All ${plural(record.checks.length, "check")} pass on the saved choice.`,
    action: "Fix the failed enclosure checks",
    href,
  };
}

/** The production readiness panel's four checks, for the first planned batch. */
export function productionCheck(rows: Item[], facts: GateFacts): Computed {
  const by = (s: string) => rows.filter((r) => r.section === s);
  const rr: ReadinessRows = {
    parts: by("design/bom"),
    economics: by(STORE_ECONOMICS),
    channels: by(STORE_CHANNELS),
    methods: by(STORE_METHODS),
    batches: by(STORE_BATCHES),
    suppliers: by(STORE_SUPPLIERS),
    tests: by("prototype/tests"),
    compliance: by(STORE_COMPLIANCE),
  };
  const batch = rr.batches.find((b) => readBatch(b).units !== null) ?? null;
  const checks = readiness(rr, { batchId: batch?.id ?? null, currency: facts.currency });
  const unmet = checks.filter((c) => !c.met);
  // The readiness check's own label is a statement; the next step is the thing to do about it.
  const TODO: Record<string, string> = {
    tests: "Pass the acceptance tests for this build",
    compliance: "Decide every compliance row",
    parts: "Price every part and give it a supplier",
    economics: "Complete the economics for one sales channel",
  };
  // When nothing exists yet, say what to make rather than what to decide.
  const NONE: Record<string, string> = {
    tests: "Write the acceptance tests for this build",
    compliance: "Draft the compliance checklist, then decide each row",
  };
  const first = unmet[0];
  return {
    met: unmet.length === 0,
    detail: unmet.length ? `${unmet.length} of 4 readiness checks not met: ${unmet.map((c) => `${c.label.toLowerCase()} (${c.detail})`).join("; ")}` : "All four readiness checks are met.",
    action: first ? (first.missing[0] ? `${TODO[first.key] ?? first.label}, starting with ${first.missing[0]}` : (NONE[first.key] ?? TODO[first.key] ?? first.label)) : "Nothing to do",
    href: unmet[0]?.href ?? "/s/production/batches",
  };
}

/** Statuses at which a content row is released and must carry proof for every number and superlative. */
const RELEASED = new Set(["approved", "running", "scheduled", "posted", "ready", "live"]);

/** Every released content row in the sections has proof linked for its numbers and superlatives. */
export function contentProofCheck(rows: Item[], sections: string[], conceptName = ""): Computed {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bad: Item[] = [];
  let released = 0;
  for (const r of rows) {
    if (!sections.includes(r.section) || !RELEASED.has(r.status)) continue;
    released++;
    const fields = claimFields(r.section, r.title, r.body, r.data ?? {});
    if (!fields.length) continue;
    const ids = (Array.isArray(r.data?.proof) ? r.data.proof : []).map((p) => Number((p as { itemId?: unknown })?.itemId));
    const links: ProofRow[] = ids.flatMap((id) => {
      const x = byId.get(id);
      return x ? [{ id: x.id, section: x.section, title: x.title, body: x.body, status: x.status, data: x.data }] : [];
    });
    if (evaluate(fields, links, conceptName ? [conceptName] : []).length) bad.push(r);
  }
  return {
    met: bad.length === 0,
    detail: released === 0 ? "Nothing is released yet, so nothing needs proof." : bad.length ? `${plural(bad.length, "released row")} without proof: ${bad.slice(0, 5).map((b) => b.title).join("; ")}.` : `All ${plural(released, "released row")} have proof for their claims.`,
    action: `Link proof to ${plural(bad.length, "row")} or move ${bad.length === 1 ? "it" : "them"} back to draft`,
    href: bad[0] ? `/s/${bad[0].section}` : `/s/${sections[0]}`,
  };
}

/** The positioning: drafted, attacked by the reviewer on its current words, then approved (src/lib/market/rules.ts). */
export function positioningCheck(rows: Item[]): Computed {
  const base = "/s/marketing/positioning";
  const xs = rows.filter((r) => r.section === "marketing/positioning");
  if (xs.some((r) => r.status === "approved" || r.status === "done")) return { met: true, detail: "The positioning is approved after the reviewer's attack.", action: "Nothing to do", href: base };
  if (!xs.length) return { met: false, detail: "No positioning yet.", action: "Draft the positioning with AI, from the personas and competitors", href: `${base}#draft-with-ai` };
  const reviewed = (r: Item) => {
    const c = r.data?.critique as { text?: unknown; fingerprint?: unknown } | undefined;
    return !!c && typeof c.text === "string" && c.text.trim() !== "" && (typeof c.fingerprint !== "string" || c.fingerprint === positioningFingerprint(r.data ?? {}));
  };
  const ready = xs.find(reviewed);
  if (ready) return { met: false, detail: "The reviewer has attacked it; it is not approved yet.", action: `Approve the positioning "${ready.title}"`, href: `${base}#positioning-${ready.id}` };
  const first = xs[0];
  return { met: false, detail: "The reviewer has not attacked it on its current words, so it cannot be approved yet.", action: `Ask the reviewer to attack the positioning "${first.title}"`, href: `${base}#positioning-${first.id}` };
}

/** The campaigns section's budget row: a total budget and the share of the margin a campaign may spend per order. */
export function campaignBudgetCheck(rows: Item[]): Computed {
  const href = "/s/marketing/campaigns#campaign-budget";
  const plan = rows.find((r) => r.section === "marketing/campaigns" && r.data?.kind === "plan");
  const d = (plan?.data ?? {}) as { planTotalMinor?: unknown; allowableSharePercent?: unknown };
  const missing = [typeof d.planTotalMinor === "number" ? "" : "the total marketing budget", typeof d.allowableSharePercent === "number" ? "" : "the share of the margin a campaign may spend"].filter(Boolean);
  return {
    met: missing.length === 0,
    detail: missing.length ? `Not set: ${missing.join(" and ")}.` : "The budget and the rule numbers are set.",
    action: `Set ${missing.join(" and ") || "the budget"} in Campaigns`,
    href,
  };
}

/** A count the server keeps in its own table (tracked links, campaign results). */
export function countCheck(n: number | undefined, min: number, w: { one: string; many?: string; where: string; href: string; verb: string }): Computed {
  if (n === undefined) return { met: false, detail: `${w.where} have not been counted yet.`, action: w.verb, href: w.href };
  return { met: n >= min, detail: `${plural(n, w.one, w.many)} recorded${n >= min ? "" : `, ${min} needed`}.`, action: w.verb, href: w.href };
}

/**
 * A content section has a released row (approved or later). Otherwise the first draft is named with what stops it,
 * in the order the server checks (src/lib/content/rules.ts): a line with no proof, then an ad's missing stop rule.
 * The stored flags are only a hint here; the server works them out again when the row is approved.
 */
export function contentApprovedCheck(rows: Item[], section: string, label: string, anchor?: string): Computed {
  const href = `/s/${section}`;
  const xs = rows.filter((r) => r.section === section);
  const released = xs.filter((r) => RELEASED.has(r.status));
  if (released.length) return { met: true, detail: `${plural(released.length, "row")} approved or released.`, action: "Nothing to do", href };
  if (!xs.length) return { met: false, detail: "Nothing written yet.", action: `Draft ${label} with AI, or add a row by hand`, href: anchor ? `${href}#${anchor}` : href };
  const first = xs[0];
  if (first.data?.noProof === true) {
    return { met: false, detail: `"${first.title}" has a line with no proof behind it.`, action: `Link proof to "${first.title}" or take the flagged line out, then approve it`, href };
  }
  if (section === "marketing/ads") {
    const rule = effectiveAdRule(first, rows.filter((r) => r.section === "marketing/campaigns"));
    if (!ruleComplete(rule)) {
      return { met: false, detail: `"${first.title}" has no stop and scale rule yet, so it cannot be approved.`, action: `Write the stop and scale rule for "${first.title}", then approve it`, href };
    }
  }
  return { met: false, detail: `${plural(xs.length, "row")} in draft.`, action: `Approve "${first.title}" in ${label}`, href };
}

/**
 * A build has passed, read live: its stored status is "passed" and its evidence still holds (at least one exit
 * criterion, all met; at least one linked test, all passing). A build marked passed whose evidence went bad does
 * not count, and the sentence names what changed.
 */
export function buildPassedCheck(rows: Item[], anchor = "add-build", todo = "Add a build with its exit criteria and tests"): Computed {
  const section = "prototype/builds";
  const href = "/s/prototype/builds";
  const builds = rows.filter((r) => r.section === section);
  const tests = rows.filter((r) => r.section === "prototype/tests");
  const marked = builds.filter((b) => b.status === PASSED);
  const holding = marked.filter((b) => lostEvidence(b, tests).length === 0);
  if (holding.length) return { met: true, detail: `${plural(holding.length, "build")} passed, with its exit criteria met and its tests passing.`, action: "Nothing to do", href };
  const stale = marked[0];
  if (stale) {
    const why = lostEvidence(stale, tests).join("; ");
    return { met: false, detail: `"${stale.title}" is marked passed, but its evidence no longer holds: ${why}.`, action: `Restore the evidence of the build "${stale.title}", then pass it again`, href };
  }
  if (!builds.length) return { met: false, detail: "No build yet.", action: todo, href: `${href}#${anchor}` };
  const first = builds[0];
  const p = buildProgress(first, tests);
  const detail = `${plural(builds.length, "build")}, none passed.`;
  if (p.blockers[0] === EMPTY_EVIDENCE) return { met: false, detail: `${detail} "${first.title}" has no exit criterion or no linked test.`, action: `Add exit criteria and tests to the build "${first.title}"`, href };
  return { met: false, detail, action: `Pass the build "${first.title}" in Builds`, href };
}
