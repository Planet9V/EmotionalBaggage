// The last connection test of each service, kept in the settings row "admin.checks" so the Overview can say
// "configured but failing" and "last checked". Holds the plain result sentence only, never a value.
import { getSetting, SETTING } from "@/lib/settings";
import { q } from "@/lib/db";
import type { ConnectionTest } from "./schemas";

export type ServiceKey =
  | "payments" | "email" | "reasoningModel" | "embeddingModel" | "research" | "voice"
  | "amazon" | "x" | "instagram" | "printers" | "planner" | "slicer" | "database";

export type LastCheck = { at: string; ok: boolean; message: string };

/** The service a connection test is about. */
export function serviceOfTest(t: ConnectionTest): ServiceKey {
  switch (t.kind) {
    case "model": return "reasoningModel";
    case "embedding": return "embeddingModel";
    case "perplexity": return "research";
    case "amazon-sp": return "amazon";
    case "x": return "x";
    case "instagram": return "instagram";
    case "printer": return "printers";
    case "planner": return "planner";
    case "slicer": return "slicer";
    case "database": return "database";
    case "stripe": return "payments";
    case "smtp":
    case "mail-message": return "email";
    case "voice": return "voice";
  }
}

/** Records one result; one statement, so two tests at once cannot lose each other. */
export async function recordCheck(service: ServiceKey, result: { ok: boolean; message: string }) {
  const entry = { [service]: { at: new Date().toISOString(), ok: result.ok, message: result.message.slice(0, 400) } };
  await q(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = (CASE WHEN jsonb_typeof(settings.value) = 'object' THEN settings.value ELSE '{}'::jsonb END) || EXCLUDED.value, updated_at = now()`,
    [SETTING.checks, JSON.stringify(entry)]
  );
}

export async function readChecks(): Promise<Partial<Record<ServiceKey, LastCheck>>> {
  const v = await getSetting<unknown>(SETTING.checks, {});
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<Record<ServiceKey, LastCheck>>) : {};
}

const OF_PROVIDER: Partial<Record<string, ServiceKey[]>> = {
  stripe: ["payments"], smtp: ["email"], kokoro: ["voice"], perplexity: ["research"],
  "amazon-sp": ["amazon"], x: ["x"], instagram: ["instagram"],
  ollama: ["reasoningModel", "embeddingModel"], lmstudio: ["reasoningModel", "embeddingModel"], openrouter: ["reasoningModel", "embeddingModel"],
};
const OF_SETTING: Record<string, ServiceKey[]> = {
  reasoningModel: ["reasoningModel"], embeddingModel: ["embeddingModel"], plannerUrl: ["planner"], slicerUrl: ["slicer"], mail: ["email"], voice: ["voice"],
};

/** Forgets the last test of the services a change touches, so a fixed setting no longer shows as failing. */
export async function forgetChecks(what: { provider?: string; setting?: string }) {
  const keys = [...(what.provider ? (OF_PROVIDER[what.provider] ?? []) : []), ...(what.setting ? (OF_SETTING[what.setting] ?? []) : [])];
  if (!keys.length) return;
  await q("UPDATE settings SET value = value - $2::text[], updated_at = now() WHERE key=$1 AND jsonb_typeof(value) = 'object'", [SETTING.checks, keys]);
}
