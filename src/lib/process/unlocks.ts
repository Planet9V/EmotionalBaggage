import { DECISIONS_STORE, UNLOCK_STORES } from "@/lib/plan";
import { toDecision, type Decision } from "@/lib/domain/decision";
import { findSection, storeKey } from "@/lib/menu";
import type { Item } from "@/lib/types";

/**
 * Decisions not yet decided that unlock this section (plan 3.3). A decision's `unlocks` names
 * sections or stores; it unlocks every section showing the same store, the rule the planner uses
 * (src/lib/plan.ts), so a decision that unlocks Sourcing also warns on the parts list and Layout.
 */
export function lockingDecisions(rows: Item[], stageKey: string, sectionKey: string): Decision[] {
  const found = findSection(stageKey, sectionKey);
  if (!found) return [];
  const store = storeKey(found.stage, found.section);
  return rows
    .filter((r) => r.section === DECISIONS_STORE)
    .map(toDecision)
    .filter((d): d is Decision => !!d && d.chosen === "" && d.unlocks.some((u) => UNLOCK_STORES.get(u) === store));
}
