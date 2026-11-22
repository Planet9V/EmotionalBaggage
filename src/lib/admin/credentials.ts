// Reading, saving and removing credentials for Admin. Nothing returned from here holds a full secret.
import { q, tx } from "@/lib/db";
import { HttpError } from "@/lib/api/route";
import { credentialSource, getCredential, type Provider } from "@/lib/settings";
import { audit, type AuditEntry } from "./audit";
import { lastFour, PROVIDER_DEFS, providerDef, type ProviderDef } from "./providers";
import { invalid } from "./schemas";
import { forgetChecks } from "./checks";
import { platformAdminOnly } from "./guard";
import { boundOrigin, currentOrigin, originOf } from "@/lib/secretOrigin";

type CredentialFieldView = {
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
  /** true when the value is withheld on purpose (a password, or a new power read by someone else): the screen says only "Set" */
  masked?: boolean;
  /** secret fields only: the origin the value is sent to (it is never sent anywhere else); null when unset */
  boundTo?: string | null;
};

export type ProviderView = {
  id: Provider;
  label: string;
  purpose: string;
  /** every required field has a value (saved or from the environment) */
  configured: boolean;
  /** a new power (src/lib/admin/guard.ts) this reader may not change: only the platform administrator may */
  locked?: boolean;
  fields: CredentialFieldView[];
};

/** Who is reading: the new providers show only set or not set to anyone but the platform administrator. */
type Viewer = { platformAdmin: boolean };

async function viewOf(def: ProviderDef, viewer: Viewer): Promise<ProviderView> {
  const full = viewer.platformAdmin || !platformAdminOnly.provider(def.id);
  const saved = await q<{ field: string; updated_at: Date }>("SELECT field, updated_at FROM credentials WHERE provider=$1", [def.id]);
  const when = new Map(saved.map((r) => [r.field, r.updated_at]));
  const fields: CredentialFieldView[] = [];
  for (const f of def.fields) {
    const [value, source] = await Promise.all([getCredential(def.id, f.name), credentialSource(def.id, f.name)]);
    const at = full && source === "admin" ? when.get(f.name) : undefined;
    fields.push({
      name: f.name,
      label: f.label,
      secret: f.secret,
      required: f.required,
      set: value !== null,
      source,
      last4: full && f.secret && !f.noLast4 ? lastFour(value) : null,
      value: full && !f.secret ? value : null,
      updatedAt: at ? new Date(at).toISOString() : null,
      boundTo: full && f.secret && value !== null ? await boundOrigin(def.id, f.name) : null,
      ...(value !== null && (!full || (f.secret && f.noLast4)) ? { masked: true } : {}),
    });
  }
  return {
    id: def.id,
    label: def.label,
    purpose: def.purpose,
    configured: fields.every((f) => !f.required || f.set),
    locked: !viewer.platformAdmin && platformAdminOnly.provider(def.id),
    fields,
  };
}

export async function listCredentials(viewer: Viewer): Promise<ProviderView[]> {
  const out: ProviderView[] = [];
  for (const def of PROVIDER_DEFS) out.push(await viewOf(def, viewer));
  return out;
}

export async function providerView(id: Provider, viewer: Viewer): Promise<ProviderView> {
  return viewOf(providerDef(id)!, viewer);
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
    const pattern = def.fields.find((f) => f.name === name)?.pattern;
    if (pattern && !pattern.re.test(v)) throw invalid(["fields", name], pattern.problem);
    values.push([name, v]);
  }
  return { def, values };
}

/** Providers whose secret goes to an address the admin sets: the address must be saved first. */
const ADDRESS_FIRST: Partial<Record<string, string>> = {
  smtp: "cannot be saved yet: save the mail server in Admin, Email first, because the password is only ever sent to the server it was saved for",
  kokoro: "cannot be saved yet: choose Kokoro and save its address in Admin, Voice first, because the key is only ever sent to the address it was saved for",
};

/**
 * Saves values, each bound to the origin it may be sent to (src/lib/secretOrigin.ts): `address` when
 * given (a model host typed with the key), else the address the install uses for that provider now.
 */
export async function saveCredentials(def: ProviderDef, values: [string, string][], address?: string) {
  const entries: Omit<AuditEntry, "at">[] = [];
  const origin = (address ? originOf(address) : null) ?? (await currentOrigin(def.id));
  // A mail password or speech key is bound to the server it is for; saved before that server is set, it would be bound
  // to whatever address is saved later (review F1). So the address comes first.
  if (ADDRESS_FIRST[def.id] && !origin) throw invalid(["fields"], ADDRESS_FIRST[def.id]!);
  await tx(async (c) => {
    for (const [field, value] of values) {
      const had = await c.query("SELECT 1 FROM credentials WHERE provider=$1 AND field=$2 FOR UPDATE", [def.id, field]);
      await c.query(
        `INSERT INTO credentials (provider, field, value, bound_origin) VALUES ($1,$2,$3,$4)
         ON CONFLICT (provider, field) DO UPDATE SET value = EXCLUDED.value, bound_origin = EXCLUDED.bound_origin, updated_at = now()`,
        [def.id, field, value, origin]
      );
      entries.push({ action: had.rowCount ? "replaced" : "set", provider: def.id, field, ...(origin ? { boundTo: origin } : {}) });
    }
  });
  await audit(entries);
  await forgetChecks({ provider: def.id });
}

/** Removes one saved value. Answers false when nothing was saved. */
export async function removeCredential(provider: Provider, field: string): Promise<boolean> {
  const rows = await q("DELETE FROM credentials WHERE provider=$1 AND field=$2 RETURNING 1", [provider, field]);
  if (!rows.length) return false;
  await audit([{ action: "removed", provider, field }]);
  await forgetChecks({ provider });
  return true;
}
