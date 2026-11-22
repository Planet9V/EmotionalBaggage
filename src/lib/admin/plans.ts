// The plan catalogue (Admin, Pricing and tiers), read and saved as ONE validated JSON document in the settings row
// "plans.catalogue". The shape, the rules and the built-in catalogue are in ./planSchema.ts (safe for the browser).
import { getSetting, SETTING } from "@/lib/settings";
import { auditIn, tx } from "@/lib/db";
import { builtInCatalogue, levelsOf, planCatalogue, type PlanCatalogue, type PublicLevels } from "./planSchema";

export { LIMIT_KEYS, LIMIT_LABEL, planCatalogue } from "./planSchema";

export type CatalogueRead = { catalogue: PlanCatalogue; source: "database" | "built-in"; problem?: string };

/**
 * The catalogue in force. Never throws: a missing row is the built-in catalogue; a saved document that no longer
 * validates, or a database that cannot be read, is the built-in catalogue too, with the problem named.
 */
export async function getPlanCatalogue(): Promise<CatalogueRead> {
  let raw: unknown;
  try {
    raw = await getSetting<unknown>(SETTING.plans, null);
  } catch {
    return { catalogue: builtInCatalogue(), source: "built-in", problem: "The saved catalogue could not be read, so the built-in one is shown." };
  }
  if (raw === null) return { catalogue: builtInCatalogue(), source: "built-in" };
  const r = planCatalogue.safeParse(raw);
  if (!r.success) return { catalogue: builtInCatalogue(), source: "built-in", problem: `The saved catalogue is not valid (${r.error.issues[0]?.message ?? "unknown"}), so the built-in one is shown. Save it again in Admin, Pricing and tiers.` };
  return { catalogue: r.data, source: "database" };
}

/** What the public welcome page shows in "Your turn". Never throws (getPlanCatalogue falls back to the built-in one). */
export async function publicLevels(): Promise<PublicLevels> {
  return levelsOf((await getPlanCatalogue()).catalogue);
}

/** Saves the whole catalogue (already validated) and records before and after in the audit log. */
export async function savePlanCatalogue(next: PlanCatalogue): Promise<void> {
  await tx(async (c) => {
    const prev = await c.query<{ value: unknown }>("SELECT value FROM settings WHERE key=$1 FOR UPDATE", [SETTING.plans]);
    const before = prev.rows[0]?.value ?? builtInCatalogue();
    await c.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [SETTING.plans, JSON.stringify(next)]);
    const shown = next.tiers.filter((t) => t.shown).map((t) => t.name).join(", ");
    await auditIn(c, {
      action: "setting.changed",
      summary: `Plan catalogue saved: ${next.tiers.length} tier${next.tiers.length === 1 ? "" : "s"} (${shown} shown), prices ${next.showPrices ? "shown" : "hidden"} on the public page`,
      detail: { key: SETTING.plans, before, after: next },
    });
  });
}

/** Removes the saved catalogue, so the built-in one applies again. */
export async function resetPlanCatalogue(): Promise<boolean> {
  return tx(async (c) => {
    const gone = await c.query<{ value: unknown }>("DELETE FROM settings WHERE key=$1 RETURNING value", [SETTING.plans]);
    if (!gone.rowCount) return false;
    await auditIn(c, { action: "setting.cleared", summary: "Plan catalogue reset to the built-in one", detail: { key: SETTING.plans, before: gone.rows[0].value, after: null } });
    return true;
  });
}
