"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const label = "text-sm font-medium text-primary";
const hint = "text-xs text-muted";

export function Field({
  title, hint: h, required, children,
}: { title: string; hint?: string; required?: boolean; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={label}>
        {title}
        {required && <span className="ml-1 text-link" aria-hidden>*</span>}
      </label>
      {children(id)}
      {h && <p className={hint}>{h}</p>}
    </div>
  );
}

export function TextField({
  title, hint: h, required, value, onChange, placeholder, mono, inputMode,
}: {
  title: string; hint?: string; required?: boolean; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <Field title={title} hint={h} required={required}>
      {(id) => (
        <Input id={id} value={value} placeholder={placeholder} inputMode={inputMode} required={required}
          className={mono ? "font-mono" : undefined} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export const areaClass =
  "block w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange disabled:opacity-50";

export function AreaField({
  title, hint: h, value, onChange, placeholder, rows = 3,
}: { title: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <Field title={title} hint={h}>
      {(id) => <textarea id={id} rows={rows} value={value} placeholder={placeholder} className={areaClass} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

export const selectClass = cn(
  "h-9 w-full rounded-md border border-hairline bg-surface px-2 text-sm text-primary",
  "focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
);
