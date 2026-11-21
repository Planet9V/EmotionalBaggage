// Pins in the database, and the electrical checks for a whole concept. Server only.
import type { PoolClient } from "pg";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { STORE } from "@/lib/domain/schemas";
import { ercSummary, type ErcOptions } from "./erc";
import type { PinRow } from "./pins";
import type { PinDef } from "./schema";

type DbPin = {
  id: string;
  item_id: string;
  name: string;
  kind: PinDef["kind"];
  side: PinDef["side"];
  position: PinDef["position"];
  voltage: PinDef["voltage"];
  data: Record<string, unknown>;
  sort: number;
};

const PIN_COLS = "id, item_id, name, kind, side, position, voltage, data, sort";

function toPinRow(r: DbPin): PinRow {
  const d = r.data ?? {};
  const out: PinRow = { id: Number(r.id), itemId: Number(r.item_id), sort: r.sort, name: r.name, kind: r.kind ?? null };
  if (r.side) out.side = r.side;
  if (r.position) out.position = r.position;
  if (r.voltage) out.voltage = r.voltage;
  if (typeof d.number === "string") out.number = d.number;
  if (d.current && typeof d.current === "object") out.current = d.current as PinRow["current"];
  if (d.bus && typeof d.bus === "object") out.bus = d.bus as PinRow["bus"];
  if (d.analog === true) out.analog = true;
  if (d.pullUp === true) out.pullUp = true;
  if (d.optional === true) out.optional = true;
  return out;
}

/** What goes in the `data` column: everything a pin says that has no column of its own. */
function pinDataOf(p: PinDef): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  if (p.number) d.number = p.number;
  if (p.current) d.current = p.current;
  if (p.bus) d.bus = p.bus;
  if (p.analog) d.analog = true;
  if (p.pullUp) d.pullUp = true;
  if (p.optional) d.optional = true;
  return d;
}

export async function pinsOfProject(projectId: string): Promise<PinRow[]> {
  const rows = await q<DbPin>(`SELECT ${PIN_COLS} FROM pins WHERE project_id=$1 ORDER BY item_id, sort, id`, [projectId]);
  return rows.map(toPinRow);
}

export async function pinsOfItem(c: PoolClient, itemId: number): Promise<PinRow[]> {
  const res = await c.query<DbPin>(`SELECT ${PIN_COLS} FROM pins WHERE item_id=$1 ORDER BY sort, id`, [itemId]);
  return res.rows.map(toPinRow);
}

/** Replaces a part's own pins with `pins`, in the caller's transaction. An empty list removes them. */
export async function replacePins(c: PoolClient, projectId: string, itemId: number, pins: PinDef[]): Promise<PinRow[]> {
  await c.query("DELETE FROM pins WHERE item_id=$1", [itemId]);
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i];
    await c.query(
      "INSERT INTO pins (project_id, item_id, name, kind, side, position, voltage, data, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [projectId, itemId, p.name.trim(), p.kind ?? null, p.side ?? null, p.position ? JSON.stringify(p.position) : null, p.voltage ? JSON.stringify(p.voltage) : null, JSON.stringify(pinDataOf(p)), i]
    );
  }
  return pinsOfItem(c, itemId);
}

/**
 * The electrical checks of one concept, read from the database. For the gate system (src/lib/process):
 * `ok` is false while any error stands. Findings link to the schematic with the row selected.
 */
export async function ercForProject(projectId: string, opts: ErcOptions = {}) {
  const items = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [projectId, [STORE.parts, STORE.wiring]]);
  const all = items.map(toItem);
  const pins = await pinsOfProject(projectId);
  return ercSummary({ parts: all.filter((i) => i.section === STORE.parts), wires: all.filter((i) => i.section === STORE.wiring), pins }, { projectId, ...opts });
}
