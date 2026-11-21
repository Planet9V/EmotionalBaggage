// Shared helpers for the model-layer tests: choose a model by writing the settings and credential
// rows directly (the Admin routes are built elsewhere), and remove them again.
import { createServer } from "node:net";
import { q } from "@/lib/db";
import { SETTING, type ModelChoice } from "@/lib/settings";

export const PROVIDERS = [
  { provider: "ollama", prefix: "/v1", key: undefined },
  { provider: "lmstudio", prefix: "/v1", key: undefined },
  { provider: "openrouter", prefix: "/api/v1", key: "sk-or-test-0123456789abcdef" },
] as const;

export async function chooseReasoning(choice: ModelChoice | null) {
  if (choice === null) await q("DELETE FROM settings WHERE key=$1", [SETTING.reasoningModel]);
  else
    await q("INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [
      SETTING.reasoningModel,
      JSON.stringify(choice),
    ]);
}

export async function chooseEmbedding(choice: ModelChoice | null) {
  if (choice === null) await q("DELETE FROM settings WHERE key=$1", [SETTING.embeddingModel]);
  else
    await q("INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [
      SETTING.embeddingModel,
      JSON.stringify(choice),
    ]);
}

/** Saves a key as one saved before migration 0024 would be: unbound, so its first read binds it to the model address in use. */
export async function saveKey(provider: string, key: string | undefined) {
  if (key === undefined) await q("DELETE FROM credentials WHERE provider=$1 AND field='apiKey'", [provider]);
  else
    await q("INSERT INTO credentials (provider, field, value) VALUES ($1,'apiKey',$2) ON CONFLICT (provider, field) DO UPDATE SET value=EXCLUDED.value, bound_origin=NULL", [
      provider,
      key,
    ]);
}

/** Removes every row these tests may have written. */
export async function clearModelRows() {
  await q("DELETE FROM settings WHERE key = ANY($1)", [[SETTING.reasoningModel, SETTING.embeddingModel]]);
  await q("DELETE FROM credentials WHERE provider = ANY($1) AND field='apiKey'", [["ollama", "lmstudio", "openrouter"]]);
}

/** A port on 127.0.0.1 that nothing listens on (bound, then closed). */
export async function closedPort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });
}
