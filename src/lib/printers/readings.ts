// What the status panel shows: the live status of every enabled printer, with a short cache and a backoff for a printer that does
// not answer, so many open tabs and a dead printer cannot make the server hammer anything.
//   success: reused for 2 seconds
//   failure: 5 s, then 10, 20, 40, 60 s between tries; the answer says when the next try is
// For Bambu the status comes from the held MQTT connection (see bambu.ts), so the poll reads what the printer pushed.
import { q } from "@/lib/db";
import { printerFamily } from "@/lib/admin/printerFamilies";
import { PRINTER_COLS, type PrinterRow } from "@/lib/admin/printers";
import { PrinterError, type Capabilities, type PrinterStatus } from "./adapter";
import { adapterForRow } from "./factory";
import { findModelFor } from "./modelLookup";
import { scrub } from "@/lib/secrets/scrub";

export type PrinterReading = {
  printerId: number;
  name: string;
  family: string;
  familyLabel: string;
  model: string;
  experimental: boolean;
  capabilities: Capabilities;
  ok: boolean;
  status?: PrinterStatus;
  error?: string;
  /** seconds until the server asks this printer again, when it is backing off */
  retryInSeconds?: number;
  checkedAt: string;
};

type Memo = { key: string; at: number; reading: PrinterReading; fails: number; nextTry: number };
const KEY = Symbol.for("c2r.printer.readings");
const memo = ((globalThis as Record<symbol, unknown>)[KEY] ??= new Map<number, Memo>()) as Map<number, Memo>;

const OK_REUSE_MS = 2_000;
const backoffMs = (fails: number) => Math.min(60_000, 5_000 * 2 ** Math.max(0, fails - 1));

/** Forgets what was cached. For tests. */
export function resetReadings() {
  memo.clear();
}

async function read(row: PrinterRow): Promise<PrinterReading> {
  const id = Number(row.id);
  const fam = printerFamily(row.family);
  const adapter = adapterForRow(row);
  const base = {
    printerId: id, name: row.name, family: row.family, familyLabel: fam?.label ?? row.family, model: findModelFor(row.model)?.model ?? row.model,
    experimental: adapter.capabilities.experimental, capabilities: adapter.capabilities,
  };
  const key = `${row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)}|${row.enabled}`;
  const now = Date.now();
  const m = memo.get(id);
  if (m && m.key === key) {
    if (m.fails === 0 && now - m.at < OK_REUSE_MS) return m.reading;
    if (m.fails > 0 && now < m.nextTry) return { ...m.reading, retryInSeconds: Math.ceil((m.nextTry - now) / 1000) };
  }
  if (!adapter.capabilities.status) {
    const reading = { ...base, ok: true, checkedAt: new Date().toISOString() };
    memo.set(id, { key, at: now, reading, fails: 0, nextTry: 0 });
    return reading;
  }
  const secrets = (fam?.fields ?? []).filter((f) => f.secret).map((f) => (row.access ?? {})[f.name]);
  try {
    const status = await adapter.status();
    const reading: PrinterReading = { ...base, ok: true, status, checkedAt: new Date().toISOString() };
    memo.set(id, { key, at: now, reading, fails: 0, nextTry: 0 });
    return reading;
  } catch (e) {
    const fails = (m && m.key === key ? m.fails : 0) + 1;
    const error = e instanceof PrinterError ? e.message : `The printer could not be read: ${scrub(String((e as Error)?.message ?? e), secrets).slice(0, 200)}`;
    const wait = backoffMs(fails);
    const reading: PrinterReading = { ...base, ok: false, error, retryInSeconds: Math.ceil(wait / 1000), checkedAt: new Date().toISOString() };
    memo.set(id, { key, at: now, reading, fails, nextTry: now + wait });
    return reading;
  } finally {
    // Bambu keeps its own held connection; the others hold nothing.
    if (row.family !== "bambu") await adapter.close().catch(() => undefined);
  }
}

/** One reading per enabled printer, in the order they were added. */
export async function printerStatuses(): Promise<PrinterReading[]> {
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers WHERE enabled ORDER BY id`);
  return Promise.all(rows.map(read));
}

export async function printerStatusFor(id: number): Promise<PrinterReading | null> {
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers WHERE id=$1 AND enabled`, [id]);
  return rows[0] ? read(rows[0]) : null;
}
