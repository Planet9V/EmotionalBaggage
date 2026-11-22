// The credentials audit: the most recent 200 saves, removals and connection tests, newest first.
// Kept in the settings row "audit.credentials" (there is no install-wide event table). Never holds a value.
import { audit as auditLine, q } from "@/lib/db";
import { platformAdminOnly } from "./guard";

const AUDIT_KEY = "audit.credentials";
export const AUDIT_LIMIT = 200;

export type AuditEntry = {
  at: string;
  action: "set" | "replaced" | "removed" | "tested";
  /** a provider id, "printer:<family>", "planner", "slicer" or "database" */
  provider: string;
  /** the field, or null when the entry is about the whole provider */
  field: string | null;
  result?: { ok: boolean; message: string };
  /** the origin a saved value is bound to (an address, never a value) */
  boundTo?: string;
  /** why a value was removed by the app rather than by a person */
  reason?: string;
};

/** Prepends entries and trims to the limit in one statement, so two saves at once cannot lose each other. */
/**
 * `shortList: false` writes the install-wide audit log only: a connection test by anyone but the platform
 * administrator must not push the owner's lines out of the short list (review B5).
 */
export async function audit(entries: Omit<AuditEntry, "at">[], opts: { shortList?: boolean } = {}) {
  if (!entries.length) return;
  const at = new Date().toISOString();
  // The install-wide audit log gets the same lines; this short list is what the Credentials screen shows.
  for (const e of entries) {
    const what = e.field ? `${e.provider} ${e.field}` : e.provider;
    await auditLine({
      action: `credential.${e.action}`,
      summary: e.action === "tested" ? `Connection to ${what} tested: ${e.result?.ok ? "it works" : "it failed"}` : `Credential ${what} ${e.action}`,
      detail: { provider: e.provider, field: e.field, ...(e.result ? { result: e.result } : {}), ...(e.boundTo ? { boundTo: e.boundTo } : {}), ...(e.reason ? { reason: e.reason } : {}) },
    });
  }
  if (opts.shortList === false) return;
  // newest first: the last entry of a batch goes on top
  const rows = entries.map((e) => ({ at, ...e })).reverse();
  await q(
    `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET
       value = (SELECT COALESCE(jsonb_agg(x.e ORDER BY x.i), '[]'::jsonb)
                FROM jsonb_array_elements($2::jsonb || settings.value) WITH ORDINALITY AS x(e, i)
                WHERE x.i <= $3),
       updated_at = now()`,
    [AUDIT_KEY, JSON.stringify(rows), AUDIT_LIMIT]
  );
}

/** The short list. The addresses the new providers' secrets are bound to are left out for anyone but the platform administrator. */
export async function readAudit(viewer: { platformAdmin: boolean } = { platformAdmin: false }): Promise<AuditEntry[]> {
  const rows = await q<{ value: AuditEntry[] }>("SELECT value FROM settings WHERE key=$1", [AUDIT_KEY]);
  const list = Array.isArray(rows[0]?.value) ? rows[0].value : [];
  if (viewer.platformAdmin) return list;
  return list.map((e) => {
    if (!platformAdminOnly.provider(e.provider)) return e;
    const { boundTo: _b, result: _r, ...rest } = e;
    void _b;
    void _r;
    return rest;
  });
}
