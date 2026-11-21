"use client";

export { isStep, stepKeys } from "@/lib/domain";

import { DEFAULT_STATUSES, STAGES, storeKey, type Section, type Stage } from "@/lib/menu";

/** Every distinct store key in menu order, with the stage and section that owns it first. */
export type StoreRef = { store: string; stage: Stage; section: Section };

export const STORE_REFS: StoreRef[] = (() => {
  const seen = new Set<string>();
  const out: StoreRef[] = [];
  for (const stage of STAGES) {
    for (const section of stage.sections) {
      const store = storeKey(stage, section);
      if (seen.has(store)) continue;
      seen.add(store);
      out.push({ store, stage, section });
    }
  }
  return out;
})();

const BY_STORE = new Map(STORE_REFS.map((r) => [r.store, r]));

export const storeRef = (store: string) => BY_STORE.get(store) ?? null;

/** "prototype/assembly" -> "Prototype / Assembly"; unknown stores are shown as stored. */
export function storeLabel(store: string) {
  const r = BY_STORE.get(store);
  return r ? `${r.stage.label} / ${r.section.label}` : store;
}

export function storeHref(store: string) {
  const r = BY_STORE.get(store);
  return r ? `/s/${r.stage.key}/${r.section.key}` : null;
}

/** The statuses a row in this store can take; the current one is always included. */
export function statusesFor(store: string, current?: string) {
  const list = BY_STORE.get(store)?.section.statuses ?? DEFAULT_STATUSES;
  return current && !list.includes(current) ? [...list, current] : list;
}

/** A short slug from the title, made unique against the keys already in use. */
export function uniqueKey(title: string, used: Set<string>) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 3)
      .join("-")
      .slice(0, 18)
      .replace(/-+$/, "") || "step";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const k = `${base}-${n}`;
    if (!used.has(k)) return k;
  }
}

/** A data value as display text: numbers and strings as they are, other values as JSON. */
export function cellText(v: unknown) {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
