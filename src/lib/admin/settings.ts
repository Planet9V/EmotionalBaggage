// The install-wide settings Admin may read and write: the two models, the planner and slicer addresses, the default concept.
// Only these five keys are writable here; seed.example and audit.* are not.
import { auditIn } from "@/lib/db";
import { q, tx } from "@/lib/db";
import { DEFAULT_BASE_URL, getSetting, SETTING, type ModelChoice } from "@/lib/settings";
import { plannerAddress, type PlannerAddress } from "./planner";
import { slicerAddress, type SlicerAddress } from "@/lib/slicing/config";
import { invalid } from "./schemas";
import { originOf } from "@/lib/secretOrigin";

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

const LABEL: Record<ModelChoice["provider"], string> = { ollama: "Ollama", lmstudio: "LM Studio", openrouter: "OpenRouter" };

/**
 * Writes every key present; null removes the setting so its fallback applies. All or nothing.
 * Answers sentences for the screen when a model address moved to another host (robustness review S1):
 * a provider's saved key is only sent to the host it was saved for, so it is removed when no saved model
 * uses that host any more, and kept (and not sent to the new host) while the other model still does.
 */
export async function writeAdminSettings(change: AdminSettingsChange): Promise<string[]> {
  if (change.defaultConcept) {
    const found = await q("SELECT 1 FROM projects WHERE id=$1", [change.defaultConcept]);
    if (!found.length) throw invalid(["defaultConcept"], "is not a concept that exists");
  }
  const notices: string[] = [];
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

    // Keys bound to a host that a changed model no longer uses.
    const moved = (["reasoningModel", "embeddingModel"] as const).map((n) => change[n]).filter((v): v is ModelChoice => !!v);
    if (!moved.length) return;
    const saved = await c.query<{ key: string; value: ModelChoice }>("SELECT key, value FROM settings WHERE key = ANY($1)", [[SETTING.reasoningModel, SETTING.embeddingModel]]);
    const inUse = saved.rows.map((r) => r.value).filter((v) => v && typeof v === "object");
    for (const provider of new Set(moved.map((m) => m.provider))) {
      const cred = await c.query<{ bound_origin: string | null }>("SELECT bound_origin FROM credentials WHERE provider=$1 AND field='apiKey' FOR UPDATE", [provider]);
      const bound = cred.rows[0]?.bound_origin;
      if (!bound) continue; // nothing saved, or saved before 0024 and bound on its first read
      const newHosts = moved.filter((m) => m.provider === provider).map((m) => originOf(m.baseUrl || DEFAULT_BASE_URL[provider]));
      if (newHosts.every((h) => h === bound)) continue;
      const stillUsed = inUse.some((m) => m.provider === provider && originOf(m.baseUrl || DEFAULT_BASE_URL[provider]) === bound);
      const elsewhere = newHosts.find((h) => h !== bound) ?? "the new address";
      if (stillUsed) {
        notices.push(`The saved ${LABEL[provider]} key stays with ${bound}, which the other model still uses, and is not sent to ${elsewhere}. To use a key there, type it in Credentials with that address.`);
        continue;
      }
      await c.query("DELETE FROM credentials WHERE provider=$1 AND field='apiKey'", [provider]);
      await auditIn(c, {
        action: "credential.removed",
        summary: `Credential ${provider} apiKey removed: the model address moved to another host`,
        detail: { provider, field: "apiKey", boundTo: bound, reason: "model address moved to another host" },
      });
      notices.push(`The saved ${LABEL[provider]} key was removed: it was saved for ${bound}, and the model address now points to ${elsewhere}. A saved key is only sent to the host it was saved for. Type the key again in Credentials.`);
    }
  });
  return notices;
}
