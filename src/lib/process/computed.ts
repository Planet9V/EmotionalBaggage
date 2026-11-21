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

/** What the server works out that rows alone cannot give. */
export type GateFacts = {
  /** the concept's currency (projects.currency); the production readiness prices in it */
  currency?: string;
  /** the electrical checks' counts, from ercForProject; undefined when not worked out */
  erc?: { ok: boolean; errors: number; warnings: number } | null;
};

export type Computed = { met: boolean; detail: string; action: string; href: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
  return {
    met: unmet.length === 0,
    detail: unmet.length ? `${unmet.length} of 4 readiness checks not met: ${unmet.map((c) => `${c.label.toLowerCase()} (${c.detail})`).join("; ")}` : "All four readiness checks are met.",
    action: unmet[0] ? unmet[0].label : "Nothing to do",
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
