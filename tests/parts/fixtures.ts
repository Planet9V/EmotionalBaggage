import type { Item } from "@/lib/types";
import type { PinRow } from "@/lib/parts/pins";
import type { PinInput } from "@/lib/parts/schema";
import { pinInput } from "@/lib/parts/schema";
import { SEED_ADDITIONS, SEED_ITEMS } from "@/lib/seed";

let n = 1000;
export const part = (ref: string, data: Record<string, unknown> = {}, title = `Part ${ref}`): Item => ({
  id: ++n, projectId: "t", section: "design/bom", title, body: "", data: { ref, ...data }, status: "to buy", sort: n,
});
export const wire = (from: string, fromPin: string, to: string, toPin: string, extra: Record<string, unknown> = {}): Item => ({
  id: ++n, projectId: "t", section: "design/wiring", title: `${from}.${fromPin} to ${to}.${toPin}`, body: "",
  data: { order: n, from, fromPin, to, toPin, netClass: "signal", ...extra }, status: "to solder", sort: n,
});
export const pinsFor = (item: Item, pins: PinInput[]): PinRow[] =>
  pins.map((p, i) => ({ ...pinInput.parse(p), id: ++n, itemId: item.id, sort: i }));

/** The example concept's parts and wires, as the seed writes them. */
export const seeded = () => {
  const rows = [...SEED_ITEMS, ...Object.values(SEED_ADDITIONS).flat()].map((r, i) => ({
    id: i + 1, projectId: "example", section: r.section, title: r.title, body: r.body ?? "", data: (r.data ?? {}) as Record<string, unknown>, status: r.status ?? "open", sort: i,
  }));
  return { parts: rows.filter((r) => r.section === "design/bom"), wires: rows.filter((r) => r.section === "design/wiring") };
};
