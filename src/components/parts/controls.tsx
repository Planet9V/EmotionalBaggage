"use client";

import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const FIELD_CLS =
  "w-full rounded-md border border-hairline bg-surface px-3 text-sm text-primary placeholder:text-muted focus-visible:border-dutchOrange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:opacity-50";

export const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-secondary">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(FIELD_CLS, "h-9 pr-8", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(FIELD_CLS, "py-2", className)} />;
}

/** An error line that screen readers announce. */
export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-subtle px-6 py-10 text-center">
      <p className="text-sm font-medium text-primary">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-xl text-sm text-secondary">{children}</div> : null}
    </div>
  );
}

/** Statuses to offer in a select: the section's list plus the item's own value if it is not in it. */
export function statusOptions(list: string[] | undefined, current: string): string[] {
  const base = list && list.length ? list : [];
  return current && !base.includes(current) ? [...base, current] : base;
}
