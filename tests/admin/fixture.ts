// Shared set-up for the Admin tests: the database is shared with other test files, so everything Admin can change
// (credentials, the Admin settings keys, printers, the credentials audit) is recorded first and put back afterwards,
// and the environment variables Admin falls back to are cleared for the run and restored at the end.
import { q } from "@/lib/db";

const SETTING_KEYS = ["models.reasoning", "models.embedding", "planner.url", "concepts.default", "audit.credentials"];

const FALLBACK_ENV = [
  "OPENROUTER_API_KEY",
  "PERPLEXITY_API_KEY",
  "AMAZON_SP_REFRESH_TOKEN",
  "AMAZON_SP_CLIENT_ID",
  "AMAZON_SP_CLIENT_SECRET",
  "X_ACCESS_TOKEN",
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_ACCOUNT_ID",
  "PRINTER_KIND",
  "PRINTER_URL",
  "PRINTER_API_KEY",
  "PLANNER_URL",
];

type Snapshot = {
  credentials: { provider: string; field: string; value: string }[];
  settings: { key: string; value: unknown }[];
  printerIds: string[];
  enabledPrinterIds: string[];
  env: Record<string, string | undefined>;
};

export async function snapshot(): Promise<Snapshot> {
  const env: Record<string, string | undefined> = {};
  for (const k of FALLBACK_ENV) {
    env[k] = process.env[k];
    delete process.env[k];
  }
  return {
    credentials: await q("SELECT provider, field, value FROM credentials"),
    settings: await q("SELECT key, value FROM settings WHERE key = ANY($1)", [SETTING_KEYS]),
    printerIds: (await q<{ id: string }>("SELECT id FROM printers")).map((r) => r.id),
    enabledPrinterIds: (await q<{ id: string }>("SELECT id FROM printers WHERE enabled")).map((r) => r.id),
    env,
  };
}

/** Starts a test from nothing configured: no credentials, no Admin settings, other printers switched off. */
export async function clearAdmin() {
  await q("DELETE FROM credentials");
  await q("DELETE FROM settings WHERE key = ANY($1)", [SETTING_KEYS]);
  await q("UPDATE printers SET enabled=false");
}

export async function restore(s: Snapshot) {
  await q("DELETE FROM credentials");
  for (const c of s.credentials) await q("INSERT INTO credentials (provider, field, value) VALUES ($1,$2,$3)", [c.provider, c.field, c.value]);
  await q("DELETE FROM settings WHERE key = ANY($1)", [SETTING_KEYS]);
  for (const r of s.settings) await q("INSERT INTO settings (key, value) VALUES ($1,$2)", [r.key, JSON.stringify(r.value)]);
  await q("DELETE FROM printers WHERE NOT (id = ANY($1::bigint[]))", [s.printerIds]);
  await q("UPDATE printers SET enabled = (id = ANY($1::bigint[]))", [s.enabledPrinterIds]);
  for (const k of FALLBACK_ENV) {
    if (s.env[k] === undefined) delete process.env[k];
    else process.env[k] = s.env[k];
  }
}
