// Install-wide configuration chosen in Admin: settings and credentials.
// Everything that talks to an outside service reads its address, model and key from here,
// never from process.env directly, so what Admin saves is what the app uses.
import { q } from "@/lib/db";

/** Outside services that can hold credentials. */
export const PROVIDERS = ["ollama", "lmstudio", "openrouter", "perplexity", "amazon-sp", "x", "instagram", "stripe", "smtp", "voice-openai", "elevenlabs"] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * Environment variables still honoured when Admin has no value saved, so an install
 * configured through .env keeps working. Admin always wins.
 */
export const ENV_FALLBACK: Record<string, string> = {
  "openrouter.apiKey": "OPENROUTER_API_KEY",
  "perplexity.apiKey": "PERPLEXITY_API_KEY",
  "amazon-sp.refreshToken": "AMAZON_SP_REFRESH_TOKEN",
  "amazon-sp.clientId": "AMAZON_SP_CLIENT_ID",
  "amazon-sp.clientSecret": "AMAZON_SP_CLIENT_SECRET",
  "x.accessToken": "X_ACCESS_TOKEN",
  "instagram.accessToken": "INSTAGRAM_ACCESS_TOKEN",
  "instagram.accountId": "INSTAGRAM_ACCOUNT_ID",
};

/** A saved credential, or the matching environment variable, or null. Never returned to the browser. */
export async function getCredential(provider: Provider, field: string): Promise<string | null> {
  const rows = await q<{ value: string }>("SELECT value FROM credentials WHERE provider=$1 AND field=$2", [provider, field]);
  if (rows.length) return rows[0].value;
  const env = ENV_FALLBACK[`${provider}.${field}`];
  const fromEnv = env ? process.env[env]?.trim() : "";
  return fromEnv ? fromEnv : null;
}

/** Where a credential comes from, without revealing it. */
export async function credentialSource(provider: Provider, field: string): Promise<"admin" | "environment" | null> {
  const rows = await q("SELECT 1 FROM credentials WHERE provider=$1 AND field=$2", [provider, field]);
  if (rows.length) return "admin";
  const env = ENV_FALLBACK[`${provider}.${field}`];
  return env && process.env[env]?.trim() ? "environment" : null;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await q<{ value: T }>("SELECT value FROM settings WHERE key=$1", [key]);
  return rows.length ? rows[0].value : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await q(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [key, JSON.stringify(value)]
  );
}

/** Which model answers, and where. Chosen in Admin (decision D7). */
export type ModelChoice = {
  provider: "ollama" | "lmstudio" | "openrouter";
  /** Base address of the provider's OpenAI-compatible interface, for example http://host.docker.internal:11434/v1 */
  baseUrl: string;
  model: string;
  /** Embedding models only: the width of the vectors the model returns. */
  dims?: number;
};

export const SETTING = {
  reasoningModel: "models.reasoning",
  embeddingModel: "models.embedding",
  plannerUrl: "planner.url",
  slicerUrl: "slicer.url",
  defaultConcept: "concepts.default",
  /** mail server: sender, host, port, security, user name (the password is a credential of "smtp") */
  mail: "mail.smtp",
  /** narration: provider, address, model, voice, speed (keys are credentials of "voice-openai" and "elevenlabs") */
  voice: "voice.tts",
  /** the plan catalogue: one validated JSON document (src/lib/admin/plans.ts) */
  plans: "plans.catalogue",
  /** the last result of each service's connection test, for the Overview */
  checks: "admin.checks",
} as const;

export const DEFAULT_BASE_URL: Record<ModelChoice["provider"], string> = {
  ollama: "http://host.docker.internal:11434/v1",
  lmstudio: "http://host.docker.internal:1234/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

export const reasoningModel = () => getSetting<ModelChoice | null>(SETTING.reasoningModel, null);
export const embeddingModel = () => getSetting<ModelChoice | null>(SETTING.embeddingModel, null);
