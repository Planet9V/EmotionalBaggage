// Printers saved in Admin. The "address" field lives in printers.address; every other field in printers.access.
// Views never carry a full secret.
import { q } from "@/lib/db";
import { notFound } from "@/lib/api/route";
import { lastFour } from "./providers";
import { printerFamily, FAMILY_IDS, type PrinterFamily } from "./printerFamilies";
import { hostName, httpUrlProblem, invalid } from "./schemas";

export type PrinterRow = {
  id: string;
  name: string;
  family: string;
  model: string;
  address: string;
  access: Record<string, string>;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export const PRINTER_COLS = "id, name, family, model, address, access, enabled, created_at, updated_at";

export type PrinterAccessView = { set: boolean; secret: boolean; value: string | null; last4: string | null };

export type PrinterView = {
  id: number;
  name: string;
  family: string;
  familyLabel: string;
  status: "supported" | "planned";
  model: string;
  address: string;
  enabled: boolean;
  /** one entry per field of the family: non-secret fields show their value, secret fields at most their last four */
  access: Record<string, PrinterAccessView>;
  createdAt: string;
  updatedAt: string;
};

/** The values a printer's fields hold, address included. Internal only: secrets in full. */
export function valuesOf(row: Pick<PrinterRow, "address" | "access">): Record<string, string> {
  const out: Record<string, string> = { ...(row.access ?? {}) };
  if (row.address) out.address = row.address;
  return out;
}

export function toPrinterView(row: PrinterRow): PrinterView {
  const fam = printerFamily(row.family);
  const values = valuesOf(row);
  const access: Record<string, PrinterAccessView> = {};
  for (const f of fam?.fields ?? []) {
    const v = values[f.name] ?? null;
    access[f.name] = { set: v !== null, secret: f.secret, value: f.secret ? null : v, last4: f.secret ? lastFour(v) : null };
  }
  return {
    id: Number(row.id),
    name: row.name,
    family: row.family,
    familyLabel: fam?.label ?? row.family,
    status: fam?.status ?? "planned",
    model: row.model,
    address: row.address,
    enabled: row.enabled,
    access,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function requireFamily(id: string, path: string = "family"): PrinterFamily {
  const fam = printerFamily(id);
  if (!fam) throw invalid([path], `must be one of: ${FAMILY_IDS.join(", ")}`);
  return fam;
}

/**
 * Merges submitted access values into the saved ones for a family. Blank leaves a value unchanged, null removes it,
 * fields the family does not take are a 400, and every required field must end up with a value.
 * Returns the address (for the column) and the rest (for the access object).
 */
export function resolveAccess(
  fam: PrinterFamily,
  input: Record<string, string | null> | undefined,
  saved: Record<string, string> = {}
): { address: string; access: Record<string, string>; values: Record<string, string> } {
  const merged: Record<string, string> = {};
  for (const f of fam.fields) if (saved[f.name] !== undefined) merged[f.name] = saved[f.name];
  for (const [name, raw] of Object.entries(input ?? {})) {
    const f = fam.fields.find((x) => x.name === name);
    if (!f) {
      const known = fam.fields.map((x) => x.name);
      throw invalid(["access", name], known.length ? `is not a field of ${fam.label}; its fields are ${known.join(", ")}` : `${fam.label} takes no fields`);
    }
    if (raw === null) {
      delete merged[name];
      continue;
    }
    if (raw === "") continue;
    const v = raw.trim();
    if (!v) throw invalid(["access", name], "is only spaces; leave it empty to keep the saved value");
    if (f.kind === "url") {
      const p = httpUrlProblem(v);
      if (p) throw invalid(["access", name], p);
      merged[name] = v.replace(/\/+$/, "");
    } else if (f.kind === "host") {
      const r = hostName.safeParse(v);
      if (!r.success) throw invalid(["access", name], r.error.issues[0].message);
      merged[name] = v;
    } else {
      merged[name] = v;
    }
  }
  for (const f of fam.fields) {
    if (f.required && merged[f.name] === undefined) throw invalid(["access", f.name], `is required for ${fam.label}`);
  }
  const { address = "", ...access } = merged;
  return { address, access, values: merged };
}

export async function getPrinterRow(id: number): Promise<PrinterRow> {
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers WHERE id=$1`, [id]);
  if (!rows.length) throw notFound("That printer");
  return rows[0];
}

/** The first enabled printer by the order they were added, secrets included, or null when there is none. */
export async function firstEnabledPrinter(): Promise<PrinterRow | null> {
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers WHERE enabled ORDER BY id LIMIT 1`);
  return rows[0] ?? null;
}
