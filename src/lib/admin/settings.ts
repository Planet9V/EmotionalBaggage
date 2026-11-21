// The install-wide settings Admin may read and write: the two models, the planner and slicer addresses, the default concept.
// Only these five keys are writable here; seed.example and audit.* are not.
import { auditIn } from "@/lib/db";
import { q, tx } from "@/lib/db";
import { DEFAULT_BASE_URL, getSetting, SETTING, type ModelChoice } from "@/lib/settings";
import { plannerAddress, type PlannerAddress } from "./planner";
import { slicerAddress, type SlicerAddress } from "@/lib/slicing/config";
import { invalid } from "./schemas";

export type AdminSettings = {
  reasoningModel: ModelChoice | null;
  embeddingModel: ModelChoice | null;
  /** the saved planner address; null means the PLANNER_URL environment variable applies */
  plannerUrl: string | null;
  /** what the app actually uses, and where it comes from */
  plannerEffective: PlannerAddress;
  /** the saved slicer address; null means the SLICER_URL environment variable applies */
  slicerUrl: string | null;
  slicerEffective: SlicerAddress;
  defaultConcept: string | null;
  /** suggested base addresses per provider, for the form */
  defaultBaseUrl: typeof DEFAULT_BASE_URL;
};

export async function readAdminSettings(): Promise<AdminSettings> {
  const [reasoningModel, embeddingModel, plannerUrl, defaultConcept, plannerEffective, slicerUrl, slicerEffective] = await Promise.all([
    getSetting<ModelChoice | null>(SETTING.reasoningModel, null),
    getSetting<ModelChoice | null>(SETTING.embeddingModel, null),
    getSetting<string | null>(SETTING.plannerUrl, null),
    getSetting<string | null>(SETTING.defaultConcept, null),
    plannerAddress(),
    getSetting<string | null>(SETTING.slicerUrl, null),
    slicerAddress(),
  ]);
  return { reasoningModel, embeddingModel, plannerUrl, plannerEffective, slicerUrl, slicerEffective, defaultConcept, defaultBaseUrl: DEFAULT_BASE_URL };
}

export type AdminSettingsChange = {
  reasoningModel?: ModelChoice | null;
  embeddingModel?: ModelChoice | null;
  plannerUrl?: string | null;
  slicerUrl?: string | null;
  defaultConcept?: string | null;
};

const KEY: Record<keyof AdminSettingsChange, string> = {
  reasoningModel: SETTING.reasoningModel,
  embeddingModel: SETTING.embeddingModel,
  plannerUrl: SETTING.plannerUrl,
  slicerUrl: SETTING.slicerUrl,
  defaultConcept: SETTING.defaultConcept,
};

/** Writes every key present; null removes the setting so its fallback applies. All or nothing. */
export async function writeAdminSettings(change: AdminSettingsChange) {
  if (change.defaultConcept) {
    const found = await q("SELECT 1 FROM projects WHERE id=$1", [change.defaultConcept]);
    if (!found.length) throw invalid(["defaultConcept"], "is not a concept that exists");
  }
  await tx(async (c) => {
    for (const name of Object.keys(change) as (keyof AdminSettingsChange)[]) {
      const value = change[name];
      if (value === undefined) continue;
      if (value === null) {
        await c.query("DELETE FROM settings WHERE key=$1", [KEY[name]]);
      } else {
        await c.query(
          "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
          [KEY[name], JSON.stringify(value)]
        );
      }
      // Settings hold model names and addresses, never keys, so the new value is recorded.
      await auditIn(c, { action: value === null ? "setting.cleared" : "setting.changed", summary: `Setting ${KEY[name]} ${value === null ? "cleared" : "changed"}`, detail: { key: KEY[name], value } });
    }
  });
}
