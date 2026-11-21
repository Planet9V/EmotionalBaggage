// Production readiness (plan 7.3). A pure function over rows: each check is met or not, with the
// rows that stop it and a link to where to fix them. It is exported on purpose: the stage gates
// (src/lib/process) can call `readiness` and `READINESS_CHECKS` and decide what to do with the answer.
import type { Item } from "@/lib/types";
import { channelResults, fixedCosts, HREF, unitCost } from "./compute";
import { DEFAULT_CURRENCY } from "./money";
import { readBatch, readEconomics, readSupplier, type EconomicsRows } from "./read";
import { plural } from "@/lib/format";

export type ReadinessRows = EconomicsRows & {
  /** acceptance tests (prototype/tests) */
  tests: Item[];
  /** compliance rows (production/compliance) */
  compliance: Item[];
  /** suppliers (production/suppliers) */
  suppliers: Item[];
};

export type CheckKey = "tests" | "compliance" | "parts" | "economics";

export type Check = {
  key: CheckKey;
  label: string;
  met: boolean;
  /** one plain sentence saying where it stands */
  detail: string;
  /** what stops it, one entry per row */
  missing: string[];
  /** where to fix it */
  href: string;
};

/** The checks, in order, with the question each answers. */
export const READINESS_CHECKS: readonly { key: CheckKey; label: string }[] = [
  { key: "tests", label: "Acceptance tests passed for this build" },
  { key: "compliance", label: "Every compliance row is decided" },
  { key: "parts", label: "Every part is priced and has a supplier" },
  { key: "economics", label: "Economics are complete for at least one channel" },
];

export type ReadinessOptions = {
  /** the batch being judged: its build picks the tests, its size sets the price breaks */
  batchId?: number | null;
  currency?: string;
};

const BLOCKING_COMPLIANCE = new Set(["to check", "draft"]);

export function readiness(rows: ReadinessRows, options: ReadinessOptions = {}): Check[] {
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const batchItem = options.batchId == null ? undefined : rows.batches.find((b) => b.id === options.batchId);
  const batch = batchItem ? readBatch(batchItem) : null;
  const size = batch?.units ?? 1;
  const inputs = readEconomics(rows, currency);

  // 1. tests: those named for this build, and those that name no build, must all pass.
  const tests = rows.tests.filter((t) => {
    const b = typeof t.data?.build === "string" ? t.data.build.trim() : "";
    return !batch?.build || b === "" || b === batch.build;
  });
  const failing = tests.filter((t) => t.status !== "pass");
  const testsCheck: Check = {
    key: "tests",
    label: READINESS_CHECKS[0].label,
    met: tests.length > 0 && failing.length === 0,
    detail: tests.length === 0 ? "There are no acceptance tests for this build." : `${tests.length - failing.length} of ${plural(tests.length, "test")} passed${batch?.build ? ` for build "${batch.build}"` : ""}.`,
    missing: failing.map((t) => `${t.title} (${t.status})`),
    href: HREF.tests,
  };

  // 2. compliance
  const open = rows.compliance.filter((c) => BLOCKING_COMPLIANCE.has(c.status));
  const complianceCheck: Check = {
    key: "compliance",
    label: READINESS_CHECKS[1].label,
    met: rows.compliance.length > 0 && open.length === 0,
    detail: rows.compliance.length === 0 ? "There are no compliance rows yet." : `${rows.compliance.length - open.length} of ${plural(rows.compliance.length, "row")} decided.`,
    missing: open.map((c) => `${c.title} (${c.status})`),
    href: HREF.compliance,
  };

  // 3. every part priced and sourced
  const supplierKeys = new Set(rows.suppliers.map(readSupplier).filter((s) => s.code && s.status !== "dropped").map((s) => s.code));
  const unit = unitCost(inputs, size);
  const partMissing: string[] = [];
  for (const line of unit.lines.filter((l) => l.group === "part")) if (line.missing) partMissing.push(line.missing.what);
  for (const p of inputs.parts) {
    if (!p.supplier) partMissing.push(`${p.ref ? `${p.ref} ` : ""}${p.title}: no supplier`);
    else if (!supplierKeys.has(p.supplier)) partMissing.push(`${p.ref ? `${p.ref} ` : ""}${p.title}: supplier "${p.supplier}" is not a current supplier`);
  }
  const partsCheck: Check = {
    key: "parts",
    label: READINESS_CHECKS[2].label,
    met: inputs.parts.length > 0 && partMissing.length === 0,
    detail: inputs.parts.length === 0 ? "There are no parts yet." : partMissing.length === 0 ? `All ${plural(inputs.parts.length, "part")} priced and sourced.` : `${plural(partMissing.length, "problem")} across ${plural(inputs.parts.length, "part")}.`,
    missing: partMissing,
    href: HREF.parts,
  };

  // 4. economics complete for one channel at this batch size
  const results = channelResults(inputs.channels, unit, fixedCosts(inputs));
  const complete = results.filter((r) => r.complete);
  const economicsCheck: Check = {
    key: "economics",
    label: READINESS_CHECKS[3].label,
    met: complete.length > 0,
    detail:
      results.length === 0
        ? "There are no sales channels yet."
        : complete.length > 0
          ? `${plural(complete.length, "channel")} complete: ${complete.map((r) => r.title).join(", ")}.`
          : "No channel has every input and a fully priced unit cost.",
    missing: complete.length > 0 ? [] : results.flatMap((r) => r.missing.map((m) => m.what)).slice(0, 12),
    href: HREF.economics,
  };

  return [testsCheck, complianceCheck, partsCheck, economicsCheck];
}

/** True when every check is met. */
export const isReady = (checks: Check[]) => checks.every((c) => c.met);
