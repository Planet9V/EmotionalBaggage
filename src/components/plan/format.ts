"use client";

export { isStep, stepKeys } from "@/lib/domain";

// The store lookups moved to src/lib/menuLookup.ts (one definition; the drafts and chat code use the same).
export { STORE_REFS, statusesFor, storeHref, storeLabel, storeRef, type StoreRef } from "@/lib/menuLookup";

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
