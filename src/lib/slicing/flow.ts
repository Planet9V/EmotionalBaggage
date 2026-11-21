// The print flow on the server: slice, send, start, control, track, record. Each step checks the job's status against the state
// machine in jobState.ts, records what happened with logEventIn, and never moves hardware without a confirm that names the printer
// and the file.
import { createHash } from "node:crypto";
import { ITEM_COLS, logEventIn, q, tx, toItem, type ItemRow } from "@/lib/db";
import { HttpError, notFound } from "@/lib/api/route";
import { PRINTER_COLS, type PrinterRow } from "@/lib/admin/printers";
import { printerFamily } from "@/lib/admin/printerFamilies";
import * as slicer from "./client";
import { PRINTING_SECTION } from "./rules";
import { canMove, normaliseStatus, printerFileName, printJobData, type PrintJobData, type PrintStatus } from "./jobState";
import { FileOnlyPort, PortError, portFor, type PrinterPort, type PortStatus } from "./printerPort";

const MAX_FILE = 100 * 1024 * 1024;

export type Confirm = { printer: string; file: string };

async function loadJob(id: number, forUpdate = false, c?: { query: <T extends object>(t: string, p: unknown[]) => Promise<{ rows: T[] }> }): Promise<ItemRow> {
  const sql = `SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND section=$2${forUpdate ? " FOR UPDATE" : ""}`;
  const rows = c ? (await c.query<ItemRow>(sql, [id, PRINTING_SECTION])).rows : await q<ItemRow>(sql, [id, PRINTING_SECTION]);
  if (!rows[0]) throw notFound("That print job");
  return rows[0];
}

export const jobData = (row: ItemRow): PrintJobData => {
  const parsed = printJobData.safeParse(row.data);
  return (parsed.success ? parsed.data : row.data) as PrintJobData;
};

async function loadPrinter(id: unknown): Promise<PrinterRow> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(409, "Choose a printer for this job first.");
  const rows = await q<PrinterRow>(`SELECT ${PRINTER_COLS} FROM printers WHERE id=$1`, [n]);
  if (!rows[0]) throw new HttpError(409, "The printer chosen for this job is no longer in Admin, Printers. Choose another.");
  if (!rows[0].enabled) throw new HttpError(409, `The printer "${rows[0].name}" is switched off in Admin, Printers.`);
  return rows[0];
}

const stamp = () => new Date().toISOString();

type Move = { from: string; to: PrintStatus; data?: Record<string, unknown>; kind: string; summary: string; detail?: Record<string, unknown> };

/** Moves a job along an allowed edge, merges data, and records it, all inside the caller's transaction. */
async function move(c: Parameters<typeof logEventIn>[0], row: ItemRow, m: Omit<Move, "from">): Promise<ItemRow> {
  const from = normaliseStatus(row.status);
  if (!canMove(from, m.to)) throw new HttpError(409, `A job that is ${from} cannot become ${m.to}.`);
  const res = await c.query<ItemRow>(
    `UPDATE items SET status=$2, data = data || $3::jsonb, updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`,
    [row.id, m.to, JSON.stringify(m.data ?? {})]
  );
  await logEventIn(c, row.project_id, m.kind, m.summary, { itemId: Number(row.id), before: { status: from }, after: { status: m.to }, ...(m.detail ?? {}) });
  return res.rows[0];
}

async function storeFile(c: Parameters<typeof logEventIn>[0], projectId: string, name: string, mime: string, kind: string, bytes: Uint8Array, meta: Record<string, unknown>) {
  if (bytes.length > MAX_FILE) throw new HttpError(422, `${name} is larger than 100 MB, which is more than this app stores.`);
  const buf = Buffer.from(bytes);
  const sha = createHash("sha256").update(buf).digest("hex");
  const res = await c.query<{ id: string }>(
    `INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [projectId, name, mime, kind, buf.length, sha, buf, JSON.stringify(meta)]
  );
  await logEventIn(c, projectId, "file.stored", `Stored ${name} (${kind}, ${buf.length} bytes)`, { fileId: Number(res.rows[0].id), sha256: sha, after: { name, kind, size: buf.length, sha256: sha } });
  return { id: Number(res.rows[0].id), sha };
}

// ---------------------------------------------------------------- slice

export async function sliceJob(id: number) {
  // 1. claim the job: queued or sliced to slicing, under a row lock, so two clicks make one slice
  const claimed = await tx(async (c) => {
    const row = await loadJob(id, true, c);
    const d = jobData(row);
    if (!d.fileId) throw new HttpError(409, "Choose a file to print first.");
    if (!d.printerId) throw new HttpError(409, "Choose a printer first.");
    if (!d.printerMaker || !d.printerModel) throw new HttpError(409, "Choose the printer model the slicer should use.");
    const moved = await move(c, row, { to: "slicing", data: { sliceError: null }, kind: "print.slicing", summary: `Started slicing "${row.title}"`, detail: { fileId: d.fileId, printer: `${d.printerMaker} ${d.printerModel}`, material: d.material, layerHeight: d.layerHeight, infill: d.infill, supports: d.supports } });
    return moved;
  });
  const d = jobData(claimed);
  const fail = async (message: string, status: number): Promise<never> => {
    await tx(async (c) => {
      const row = await loadJob(id, true, c);
      await move(c, row, { to: "queued", data: { sliceError: message }, kind: "print.slice-failed", summary: `Slicing "${row.title}" failed`, detail: { reason: message } });
    });
    throw new HttpError(status, message);
  };

  // 2. read the file
  const files = await q<{ name: string; bytes: Buffer; project_id: string }>("SELECT name, bytes, project_id FROM files WHERE id=$1", [d.fileId]);
  const f = files[0];
  if (!f || f.project_id !== claimed.project_id) return fail("The file chosen for this job is no longer stored. Choose another.", 409);
  if (!/\.(stl|3mf)$/i.test(f.name)) return fail("The slicer takes .stl and .3mf files.", 422);

  // 3. ask the slicer (minutes, no database lock held)
  let out: slicer.SliceResponse;
  try {
    out = await slicer.slice({ file: { data: new Uint8Array(f.bytes), name: f.name }, maker: d.printerMaker!, model: d.printerModel!, material: d.material || "PLA", layerHeight: d.layerHeight ?? 0.2, infill: d.infill ?? 15, supports: !!d.supports });
  } catch (e) {
    return fail(e instanceof HttpError ? e.message : "Slicing failed.", e instanceof HttpError ? e.status : 502);
  }

  // 4. keep what it made
  try {
    const gcode = await slicer.fetchResult(out.files.gcode.url);
    const project = out.files.project ? await slicer.fetchResult(out.files.project.url) : null;
    const base = out.files.gcode.name.replace(/\.gcode$/, "");
    const row = await tx(async (c) => {
      const cur = await loadJob(id, true, c);
      const g = await storeFile(c, cur.project_id, `${base}.gcode`, "text/plain", "gcode", gcode, { jobId: id, slicer: `OrcaSlicer ${out.orca.version}` });
      const p = project ? await storeFile(c, cur.project_id, `${base}.gcode.3mf`, "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", "gcode3mf", project, { jobId: id, slicer: `OrcaSlicer ${out.orca.version}` }) : null;
      const slice = {
        seconds: out.result.seconds, filamentG: out.result.filamentG, filamentMm: out.result.filamentMm, supportG: out.result.supportG, layers: out.result.layers,
        orcaVersion: out.orca.version, profile: { machine: out.profile.machine, process: out.profile.process, filament: out.profile.filament },
        warnings: out.warnings, slicedAt: stamp(), gcodeFileId: g.id, projectFileId: p?.id ?? null, gcodeSha256: g.sha,
      };
      return move(c, cur, { to: "sliced", data: { slice, sliceError: null }, kind: "print.sliced", summary: `Sliced "${cur.title}": ${Math.round(out.result.seconds / 60)} min, ${out.result.filamentG} g`, detail: { slice: { ...slice, warnings: out.warnings.length }, readFrom: out.result.readFrom } });
    });
    await slicer.discard(out.id);
    return toItem(row);
  } catch (e) {
    await slicer.discard(out.id);
    return fail(e instanceof HttpError ? e.message : "The slicer's result could not be kept.", e instanceof HttpError ? e.status : 502);
  }
}

// ---------------------------------------------------------------- send and start

/** The file a printer gets and what it is called there. The same function names it in the confirm and in the upload. */
/**
 * Which sliced file goes to this printer, chosen from the file types its adapter lists
 * (`capabilities.fileTypes`), in the adapter's own order of preference: the first listed type the
 * slice produced wins. A Bambu printer lists the sliced project (.3mf) first, so it gets the project
 * when there is one; a Klipper printer lists G-code only.
 */
export function planSend(row: ItemRow, port: PrinterPort): { name: string; fileId: number; kind: "gcode" | "project" } {
  const d = jobData(row);
  const s = d.slice;
  if (!s) throw new HttpError(409, "Slice the job first.");
  const GCODE = [".gcode", ".gco", ".g", ".bgcode"];
  const PROJECT = [".3mf", ".gcode.3mf"];
  const types = port.capabilities.fileTypes.map((t) => t.toLowerCase());
  for (const t of types) {
    if (PROJECT.includes(t) && s.projectFileId) return { name: printerFileName(row.title, ".gcode.3mf", row.id), fileId: s.projectFileId, kind: "project" };
    if (GCODE.includes(t)) {
      if (s.gcodeFileId == null) throw new HttpError(409, "The sliced file is missing. Slice the job again.");
      return { name: printerFileName(row.title, ".gcode", row.id), fileId: s.gcodeFileId, kind: "gcode" };
    }
  }
  if (types.some((t) => PROJECT.includes(t))) throw new HttpError(409, "This printer takes a sliced project file, and the slice made none. Slice the job again.");
  throw new HttpError(409, "This printer takes neither G-code nor a sliced project file.");
}

export function assertConfirm(confirm: Confirm | undefined, printerName: string, fileName: string, what: string) {
  if (!confirm || confirm.printer !== printerName || confirm.file !== fileName) {
    throw new HttpError(400, `To ${what}, confirm by naming the printer "${printerName}" and the file "${fileName}".`);
  }
}

function portOf(printer: PrinterRow): PrinterPort {
  try {
    return portFor(printer);
  } catch (e) {
    throw new HttpError(409, e instanceof Error ? e.message : "This printer has no connection.");
  }
}

function wrapPort(e: unknown, what: string): never {
  if (e instanceof HttpError) throw e;
  const msg = e instanceof Error ? e.message : String(e);
  throw new HttpError(e instanceof PortError && e.kind === "unsupported" ? 409 : 502, `Could not ${what}: ${msg}`);
}

export async function describePlan(id: number) {
  const row = await loadJob(id);
  const d = jobData(row);
  const status = normaliseStatus(row.status);
  let printer: PrinterRow | null = null;
  try { printer = d.printerId ? await loadPrinter(d.printerId) : null; } catch { printer = null; }
  const port = printer ? portOf(printer) : new FileOnlyPort();
  let send: { name: string; fileId: number; kind: string } | null = null;
  if (d.slice && ["sliced", "sent", "printing", "done"].includes(status)) {
    try { send = planSend(row, port); } catch { send = null; }
  }
  return {
    status,
    printer: printer ? { id: Number(printer.id), name: printer.name, family: printer.family, familyLabel: printerFamily(printer.family)?.label ?? printer.family } : null,
    capabilities: port.capabilities,
    fileOnly: port.capabilities.upload === false || port.capabilities.start === false,
    send,
    download: d.slice?.gcodeFileId != null ? { gcodeFileId: d.slice.gcodeFileId, projectFileId: d.slice.projectFileId ?? null } : null,
  };
}

export async function sendJob(id: number, confirm: Confirm | undefined) {
  const row = await loadJob(id);
  const d = jobData(row);
  if (normaliseStatus(row.status) !== "sliced") throw new HttpError(409, "Only a sliced job can be sent.");
  const printer = await loadPrinter(d.printerId);
  const port = portOf(printer);
  if (!port.capabilities.upload) throw new HttpError(409, `${printer.name} has no connection that takes files from here. Download the file and carry it to the printer.`);
  const plan = planSend(row, port);
  assertConfirm(confirm, printer.name, plan.name, "send this file");
  const file = (await q<{ bytes: Buffer; sha256: string; project_id: string }>("SELECT bytes, sha256, project_id FROM files WHERE id=$1", [plan.fileId]))[0];
  if (!file || file.project_id !== row.project_id) throw new HttpError(409, "The sliced file is missing. Slice the job again.");
  if (plan.kind === "gcode" && d.slice && file.sha256 !== d.slice.gcodeSha256) throw new HttpError(409, "The stored G-code no longer matches what was sliced. Slice the job again.");
  let sent: { name: string; message: string };
  try {
    sent = await port.upload({ data: new Uint8Array(file.bytes) }, plan.name);
  } catch (e) {
    wrapPort(e, `send the file to ${printer.name}`);
  }
  const updated = await tx(async (c) => {
    const cur = await loadJob(id, true, c);
    return move(c, cur, { to: "sent", data: { sentAt: stamp(), sentName: sent.name || plan.name }, kind: "print.sent", summary: `Sent "${cur.title}" to ${printer.name} as ${sent.name || plan.name}`, detail: { printer: printer.name, printerId: Number(printer.id), file: sent.name || plan.name, sha256: file.sha256 } });
  });
  return toItem(updated);
}

export async function startJob(id: number, confirm: Confirm | undefined) {
  const row = await loadJob(id);
  const d = jobData(row);
  if (normaliseStatus(row.status) !== "sent") throw new HttpError(409, "Send the file to the printer first. Only a sent job can be started.");
  const printer = await loadPrinter(d.printerId);
  const port = portOf(printer);
  if (!port.capabilities.start) throw new HttpError(409, `${printer.name} cannot be started from here. Start the print at the printer.`);
  const name = d.sentName || "";
  assertConfirm(confirm, printer.name, name, "start this print");
  try {
    await port.start(name);
  } catch (e) {
    wrapPort(e, `start the print on ${printer.name}`);
  }
  const updated = await tx(async (c) => {
    const cur = await loadJob(id, true, c);
    return move(c, cur, { to: "printing", data: { startedAt: stamp() }, kind: "print.started", summary: `Started "${cur.title}" on ${printer.name}`, detail: { printer: printer.name, printerId: Number(printer.id), file: name } });
  });
  return toItem(updated);
}

export async function controlJob(id: number, action: "pause" | "resume" | "cancel", confirm: Confirm | undefined) {
  const row = await loadJob(id);
  const d = jobData(row);
  const status = normaliseStatus(row.status);
  const printer = d.printerId && status !== "queued" && status !== "sliced" ? await loadPrinter(d.printerId) : null;
  if (action === "cancel" && (status === "queued" || status === "sliced")) {
    const updated = await tx(async (c) => move(c, await loadJob(id, true, c), { to: "cancelled", kind: "print.cancelled", summary: `Cancelled "${row.title}" before it was sent` }));
    return toItem(updated);
  }
  if (status !== "printing" && !(action === "cancel" && status === "sent")) throw new HttpError(409, `A ${status} job cannot be ${action === "cancel" ? "cancelled" : action + "d"} on the printer.`);
  if (!printer) throw new HttpError(409, "Choose a printer first.");
  const port = portOf(printer);
  if (!port.capabilities[action]) throw new HttpError(409, `${printer.name} cannot ${action} from here. Do it at the printer.`);
  if (action === "cancel") assertConfirm(confirm, printer.name, d.sentName || "", "cancel this print");
  try {
    await (action === "pause" ? port.pause() : action === "resume" ? port.resume() : port.cancel());
  } catch (e) {
    wrapPort(e, `${action} the print on ${printer.name}`);
  }
  const updated = await tx(async (c) => {
    const cur = await loadJob(id, true, c);
    if (action === "cancel") return move(c, cur, { to: "cancelled", kind: "print.cancelled", summary: `Cancelled "${cur.title}" on ${printer.name}`, detail: { printer: printer.name, file: d.sentName } });
    await logEventIn(c, cur.project_id, `print.${action}d`, `${action === "pause" ? "Paused" : "Resumed"} "${cur.title}" on ${printer.name}`, { itemId: Number(cur.id), printer: printer.name, file: d.sentName });
    return cur;
  });
  return toItem(updated);
}

// ---------------------------------------------------------------- track

export type Tracking = { job: ReturnType<typeof toItem>; printer: PortStatus | null; message: string };

/** Asks the printer how it is doing. A finished print moves the job to done; nothing else changes by itself. */
export async function trackJob(id: number): Promise<Tracking> {
  const row = await loadJob(id);
  const d = jobData(row);
  const status = normaliseStatus(row.status);
  if (!["sent", "printing"].includes(status) || !d.printerId) return { job: toItem(row), printer: null, message: "" };
  const printer = await loadPrinter(d.printerId).catch(() => null);
  if (!printer) return { job: toItem(row), printer: null, message: "The printer is not available." };
  const port = portOf(printer);
  if (!port.capabilities.status) return { job: toItem(row), printer: null, message: "This printer does not report its status here. Record the result when it finishes." };
  let st: PortStatus;
  try {
    st = await port.status();
  } catch (e) {
    return { job: toItem(row), printer: null, message: e instanceof Error ? e.message : "The printer did not answer." };
  }
  const sameFile = !st.file || !d.sentName || st.file.endsWith(d.sentName) || st.file.includes(d.sentName.replace(/\.gcode(\.3mf)?$/, ""));
  if (status === "sent" && st.state === "printing" && sameFile) {
    const u = await tx(async (c) => move(c, await loadJob(id, true, c), { to: "printing", data: { startedAt: stamp() }, kind: "print.started", summary: `"${row.title}" is printing on ${printer.name}`, detail: { printer: printer.name, noticedBy: "status poll" } }));
    return { job: toItem(u), printer: st, message: "" };
  }
  if (status === "printing" && st.state === "finished" && sameFile) {
    const u = await tx(async (c) => move(c, await loadJob(id, true, c), { to: "done", kind: "print.finished", summary: `${printer.name} reports "${row.title}" finished`, detail: { printer: printer.name, noticedBy: "status poll" } }));
    return { job: toItem(u), printer: st, message: "The printer says the print finished. Record how it came out." };
  }
  return { job: toItem(row), printer: st, message: st.message ?? "" };
}

// ---------------------------------------------------------------- result

export type ResultInput = { outcome: "good" | "flawed" | "failed"; actualSeconds?: number; actualG?: number; notes?: string; photoFileIds: number[] };

export async function recordResult(id: number, r: ResultInput) {
  return tx(async (c) => {
    const row = await loadJob(id, true, c);
    const status = normaliseStatus(row.status);
    let cur0 = row;
    let status0 = status;
    if (status === "sliced") {
      // A printer this app cannot reach: the person carried the file there. Recording the result is how the job learns that.
      const d0 = jobData(row);
      const printer = await loadPrinter(d0.printerId);
      const port = portOf(printer);
      if (port.capabilities.upload) throw new HttpError(409, `Send the file to ${printer.name} first, so the app knows what was printed.`);
      const name = planSend(row, port).name;
      cur0 = await move(c, cur0, { to: "sent", data: { sentAt: stamp(), sentName: name, handedOver: true }, kind: "print.handed-over", summary: `"${row.title}" was taken to ${printer.name} by hand as ${name}`, detail: { printer: printer.name, file: name } });
      cur0 = await move(c, cur0, { to: "printing", data: { startedAt: stamp() }, kind: "print.started", summary: `"${row.title}" was printed on ${printer.name} (started by hand)`, detail: { printer: printer.name, byHand: true } });
      status0 = "printing";
    }
    if (!["sent", "printing", "done", "failed", "cancelled"].includes(status0)) throw new HttpError(409, "Record a result once the print has been sent to the printer.");
    if (r.photoFileIds.length) {
      const ok = await c.query<{ id: string }>("SELECT id FROM files WHERE project_id=$1 AND id = ANY($2::bigint[])", [row.project_id, r.photoFileIds]);
      if (ok.rows.length !== new Set(r.photoFileIds).size) throw new HttpError(400, "A photo named here is not stored in this concept.");
    }
    const d = jobData(cur0);
    const result = { ...r, finishedAt: d.result?.finishedAt ?? stamp() };
    const target: PrintStatus = r.outcome === "failed" ? "failed" : "done";
    let out = cur0;
    if (status0 !== target && status0 !== "cancelled" && canMove(status0, target)) {
      out = await move(c, cur0, { to: target, data: { result }, kind: "print.result", summary: `Recorded the result of "${row.title}": ${r.outcome}`, detail: { result: { ...result, notes: result.notes ? "(written)" : "" }, buildKey: d.buildKey ?? null } });
    } else {
      const res = await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb, updated_at = now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [row.id, JSON.stringify({ result })]);
      out = res.rows[0];
      await logEventIn(c, row.project_id, "print.result", `Recorded the result of "${row.title}": ${r.outcome}`, { itemId: Number(row.id), result: { ...result, notes: result.notes ? "(written)" : "" }, buildKey: d.buildKey ?? null });
    }
    return toItem(out);
  });
}
