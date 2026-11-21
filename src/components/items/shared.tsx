"use client";

import type { ReactNode } from "react";
import type { Item } from "@/lib/types";

/** Only primitives are shown in cells and labels; objects and arrays from item.data are skipped. */
export function prim(v: unknown): string {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "";
}

export function matches(item: Item, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (item.title.toLowerCase().includes(needle) || item.body.toLowerCase().includes(needle)) return true;
  return Object.values(item.data).some((v) => prim(v).toLowerCase().includes(needle));
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/** Statuses of the section in order, then any status already on an item that the section does not list. */
export function statusList(configured: string[], items: Item[]): string[] {
  const out = [...configured];
  for (const it of items) if (it.status && !out.includes(it.status)) out.push(it.status);
  return out;
}
