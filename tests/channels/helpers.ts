// Shared helpers for the channel tests: credentials saved straight into the table, a fake clock for
// the rate limits, and a scan of every place a secret must never appear.
import { expect } from "vitest";
import { q } from "@/lib/db";
import { setChannelClock } from "@/lib/channels/rateLimit";

export async function saveCreds(provider: string, fields: Record<string, string>) {
  for (const [field, value] of Object.entries(fields)) {
    await q("INSERT INTO credentials (provider, field, value) VALUES ($1,$2,$3) ON CONFLICT (provider, field) DO UPDATE SET value=EXCLUDED.value", [provider, field, value]);
  }
}

export async function clearChannelRows() {
  await q("DELETE FROM credentials WHERE provider IN ('amazon-sp','x','instagram')");
  await q("DELETE FROM settings WHERE key LIKE 'channels.%'");
}

/** A clock that never waits: sleep moves time on and is recorded. */
export function fakeClock(start = Date.parse("2026-11-21T12:00:00Z")) {
  const c = { t: start, sleeps: [] as number[], now: () => c.t, sleep: async (ms: number) => { c.sleeps.push(ms); c.t += ms; } };
  setChannelClock(c);
  return c;
}

/** Fails if any secret appears in the responses given, the audit log, the activity list or the settings. */
export async function expectNoSecrets(secrets: string[], responses: unknown[] = []) {
  const audit = await q<{ t: string }>("SELECT concat_ws(' ', action, summary, detail::text) AS t FROM audit_log");
  const events = await q<{ t: string }>("SELECT concat_ws(' ', kind, summary, data::text) AS t FROM events");
  const settings = await q<{ t: string }>("SELECT concat_ws(' ', key, value::text) AS t FROM settings");
  const items = await q<{ t: string }>("SELECT concat_ws(' ', title, body, data::text) AS t FROM items");
  const haystacks = [...audit, ...events, ...settings, ...items].map((r) => r.t).concat(responses.map((r) => (typeof r === "string" ? r : JSON.stringify(r))));
  for (const s of secrets) for (const h of haystacks) expect(h.includes(s), `a secret leaked into: ${h.slice(0, 200)}`).toBe(false);
}
