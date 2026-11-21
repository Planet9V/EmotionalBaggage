import type { Item } from "@/lib/types";

/** A stored list of keys: an array now, a comma-separated string in older rows. */
export function keys(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export const isStep = (i: Item) => typeof i.data.key === "string" && i.data.key !== "";

/** Keys already used by steps in the concept. */
export const stepKeys = (items: Item[]) => new Set(items.filter(isStep).map((i) => String(i.data.key)));
