import type { Item } from "@/lib/types";

/** A stored list of keys: an array now, a comma-separated string in older rows. */
export function keys(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export type Step = {
  id: string;
  itemId: number;
  title: string;
  section: string;
  status: string;
  minutes: number;
  after: string[];
};

export const isStep = (i: Item) => typeof i.data.key === "string" && i.data.key !== "";

/** Keys already used by steps in the concept. */
export const stepKeys = (items: Item[]) => new Set(items.filter(isStep).map((i) => String(i.data.key)));

/** Any row with a key is a step; `after` lists the keys it waits on; `minutes` is its duration. */
export function stepsFromItems(items: Item[]): Step[] {
  const nodes = items.filter(isStep).map((i) => ({
    id: String(i.data.key),
    itemId: i.id,
    title: i.title,
    section: i.section,
    status: i.status,
    minutes: Number(i.data.minutes) || 0,
    after: keys(i.data.after),
  }));
  const ids = new Set(nodes.map((n) => n.id));
  return nodes.map((n) => ({ ...n, after: n.after.filter((a) => ids.has(a) && a !== n.id) }));
}
