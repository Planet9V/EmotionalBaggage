// Reading, saving and removing credentials for Admin. Nothing returned from here holds a full secret.
import { q, tx } from "@/lib/db";
import { HttpError } from "@/lib/api/route";
import { credentialSource, getCredential, type Provider } from "@/lib/settings";
import { audit, type AuditEntry } from "./audit";
import { lastFour, PROVIDER_DEFS, providerDef, type ProviderDef } from "./providers";
import { invalid } from "./schemas";

export type CredentialFieldView = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  set: boolean;
  source: "admin" | "environment" | null;
  /** secret fields only: the last four characters when the secret is at least 12 long, else null */
  last4: string | null;
  /** non-secret fields only: the whole value */
  value: string | null;
  /** when the saved value was last changed; null for environment values and unset fields */
  updatedAt: string | null;
};

export type ProviderView = {
  id: Provider;
  label: string;
  purpose: string;
  /** every required field has a value (saved or from the environment) */
  configured: boolean;
  fields: CredentialFieldView[];
};

async function viewOf(def: ProviderDef): Promise<ProviderView> {
  const saved = await q<{ field: string; updated_at: Date }>("SELECT field, updated_at FROM credentials WHERE provider=$1", [def.id]);
  const when = new Map(saved.map((r) => [r.field, r.updated_at]));
  const fields: CredentialFieldView[] = [];
  for (const f of def.fields) {
    const [value, source] = await Promise.all([getCredential(def.id, f.name), credentialSource(def.id, f.name)]);
    const at = source === "admin" ? when.get(f.name) : undefined;
    fields.push({
      name: f.name,
      label: f.label,
      secret: f.secret,
      required: f.required,
      set: value !== null,
      source,
      last4: f.secret ? lastFour(value) : null,
      value: f.secret ? null : value,
      updatedAt: at ? new Date(at).toISOString() : null,
    });
  }
  return {
    id: def.id,
    label: def.label,
    purpose: def.purpose,
    configured: fields.every((f) => !f.required || f.set),
    fields,
  };
}

export async function listCredentials(): Promise<ProviderView[]> {
  const out: ProviderView[] = [];
  for (const def of PROVIDER_DEFS) out.push(await viewOf(def));
  return out;
}

export async function providerView(id: Provider): Promise<ProviderView> {
  return viewOf(providerDef(id)!);
}

/** Validates a PUT body against the registry: unknown provider or field, or a whitespace-only value, is a 400. */
export function checkCredentialFields(provider: string, fields: Record<string, string>): { def: ProviderDef; values: [string, string][] } {
  const def = providerDef(provider);
  if (!def) throw new HttpError(400, `"${provider}" is not a provider this app knows. Known: ${PROVIDER_DEFS.map((p) => p.id).join(", ")}.`);
  const values: [string, string][] = [];
  for (const [name, raw] of Object.entries(fields)) {
    if (!def.fields.some((f) => f.name === name)) {
      throw invalid(["fields", name], `is not a field of ${def.label}; its fields are ${def.fields.map((f) => f.name).join(", ")}`);
    }
    if (raw === "") continue; // blank leaves the saved value as it is
    const v = raw.trim();
    if (!v) throw invalid(["fields", name], "is only spaces; leave it empty to keep the saved value");
    values.push([name, v]);
  }
  return { def, values };
}

export async function saveCredentials(def: ProviderDef, values: [string, string][]) {
  const entries: Omit<AuditEntry, "at">[] = [];
  await tx(async (c) => {
    for (const [field, value] of values) {
      const had = await c.query("SELECT 1 FROM credentials WHERE provider=$1 AND field=$2 FOR UPDATE", [def.id, field]);
      await c.query(
        `INSERT INTO credentials (provider, field, value) VALUES ($1,$2,$3)
         ON CONFLICT (provider, field) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [def.id, field, value]
      );
      entries.push({ action: had.rowCount ? "replaced" : "set", provider: def.id, field });
    }
  });
  await audit(entries);
}

/** Removes one saved value. Answers false when nothing was saved. */
export async function removeCredential(provider: Provider, field: string): Promise<boolean> {
  const rows = await q("DELETE FROM credentials WHERE provider=$1 AND field=$2 RETURNING 1", [provider, field]);
  if (!rows.length) return false;
  await audit([{ action: "removed", provider, field }]);
  return true;
}
