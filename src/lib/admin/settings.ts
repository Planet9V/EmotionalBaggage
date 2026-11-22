// The install-wide settings Admin may read and write: the two models, the planner and slicer addresses, the default concept.
// Only these five keys are writable here; seed.example and audit.* are not.
import { auditIn } from "@/lib/db";
import { q, tx } from "@/lib/db";
import { DEFAULT_BASE_URL, getSetting, SETTING, type ModelChoice, type Provider } from "@/lib/settings";
import { plannerAddress, type PlannerAddress } from "./planner";
import { slicerAddress, type SlicerAddress } from "@/lib/slicing/config";
import { invalid, type MailSettings, type VoiceSettings } from "./schemas";
import { originOf, smtpOrigin } from "@/lib/secretOrigin";
import { readMailSettings } from "./mail";
import { readVoiceSettings } from "@/lib/voice/speech";
import { forgetChecks } from "./checks";

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
  /** Admin, Email: mode "none" sends nothing (the password is a credential of "smtp") */
  mail: MailSettings;
  /** Admin, Voice: provider "none" means no narration */
  voice: VoiceSettings;
  /** vectors stored for the saved embedding model; changing its model or width leaves them unused until re-indexed */
  storedVectors: number;
  /** suggested base addresses per provider, for the form */
  defaultBaseUrl: typeof DEFAULT_BASE_URL;
};

export async function readAdminSettings(): Promise<AdminSettings> {
  const [reasoningModel, embeddingModel, plannerUrl, defaultConcept, plannerEffective, slicerUrl, slicerEffective, mail, voice] = await Promise.all([
    getSetting<ModelChoice | null>(SETTING.reasoningModel, null),
    getSetting<ModelChoice | null>(SETTING.embeddingModel, null),
    getSetting<string | null>(SETTING.plannerUrl, null),
    getSetting<string | null>(SETTING.defaultConcept, null),
    plannerAddress(),
    getSetting<string | null>(SETTING.slicerUrl, null),
    slicerAddress(),
    readMailSettings(),
    readVoiceSettings(),
  ]);
  const storedVectors = await vectorsFor(embeddingModel);
  return { reasoningModel, embeddingModel, plannerUrl, plannerEffective, slicerUrl, slicerEffective, defaultConcept, mail, voice, storedVectors, defaultBaseUrl: DEFAULT_BASE_URL };
}

/** How many stored vectors belong to an embedding choice; 0 without pgvector (no embeddings table). */
async function vectorsFor(choice: ModelChoice | null): Promise<number> {
  if (!choice?.dims) return 0;
  try {
    const r = await q<{ n: number }>("SELECT count(*)::int AS n FROM embeddings WHERE model=$1 AND dims=$2", [choice.model, choice.dims]);
    return r[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/** The sentence the embedding form shows, and the confirmation it asks for, when a change leaves vectors behind. */
function embeddingChangeNotice(old: ModelChoice, next: ModelChoice, stored: number): string {
  const what = old.dims !== next.dims ? `the vector width from ${old.dims} to ${next.dims}` : `the embedding model from ${old.model} to ${next.model}`;
  return `Changing ${what} leaves the ${stored.toLocaleString("en")} stored vectors of ${old.model} unused: search by meaning finds nothing until every concept is indexed again with the new model, and each re-index calls the model for every row. Type ${next.dims} to confirm.`;
}

export type AdminSettingsChange = {
  reasoningModel?: ModelChoice | null;
  embeddingModel?: ModelChoice | null;
  plannerUrl?: string | null;
  slicerUrl?: string | null;
  defaultConcept?: string | null;
  mail?: MailSettings;
  voice?: VoiceSettings;
  confirmEmbedding?: string;
};

type Stored = Exclude<keyof AdminSettingsChange, "confirmEmbedding">;

const KEY: Record<Stored, string> = {
  reasoningModel: SETTING.reasoningModel,
  embeddingModel: SETTING.embeddingModel,
  plannerUrl: SETTING.plannerUrl,
  slicerUrl: SETTING.slicerUrl,
  defaultConcept: SETTING.defaultConcept,
  mail: SETTING.mail,
  voice: SETTING.voice,
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
  if (change.embeddingModel) {
    const old = await getSetting<ModelChoice | null>(SETTING.embeddingModel, null);
    if (old && (old.model !== change.embeddingModel.model || old.dims !== change.embeddingModel.dims)) {
      const stored = await vectorsFor(old);
      if (stored > 0 && change.confirmEmbedding?.trim() !== String(change.embeddingModel.dims)) {
        throw invalid(["confirmEmbedding"], embeddingChangeNotice(old, change.embeddingModel, stored));
      }
    }
  }
  const notices: string[] = [];
  await tx(async (c) => {
    // A saved mail password or speech key is only sent to the server it was saved for: when the address moves,
    // the saved value is removed (and the admin told), as for the model keys below.
    const moves: [Provider, string, string | null][] = [];
    if (change.mail) moves.push(["smtp", "password", change.mail.mode === "smtp" ? smtpOrigin(change.mail.host, change.mail.port) : null]);
    if (change.voice) moves.push(["voice-openai", "apiKey", change.voice.provider === "openai" ? originOf(change.voice.baseUrl) : null]);
    for (const [provider, field, next] of moves) {
      const cred = await c.query<{ bound_origin: string | null }>("SELECT bound_origin FROM credentials WHERE provider=$1 AND field=$2 FOR UPDATE", [provider, field]);
      const bound = cred.rows[0]?.bound_origin;
      if (!bound || !next || bound === next) continue; // nothing saved, or switched off (kept for when it comes back), or same host
      await c.query("DELETE FROM credentials WHERE provider=$1 AND field=$2", [provider, field]);
      await auditIn(c, { action: "credential.removed", summary: `Credential ${provider} ${field} removed: the address moved to another host`, detail: { provider, field, boundTo: bound, reason: "address moved to another host" } });
      notices.push(`The saved ${provider === "smtp" ? "mail password" : "speech key"} was removed: it was saved for ${bound}, and the address is now ${next}. Type it again.`);
    }
    for (const name of Object.keys(change).filter((k) => k !== "confirmEmbedding") as Stored[]) {
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
  for (const name of Object.keys(change)) await forgetChecks({ setting: name });
  return notices;
}
