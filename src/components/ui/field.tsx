"use client";

// The one labelled form control wrapper. Three ways to use it:
//   <Field label="Name"><Input /></Field>                    the label wraps the control
//   <Field label="Name">{(id) => <Input id={id} />}</Field>   a generated id, for controls that need one
//   <Field id="x" label="Name" error="..." hint="...">         the caller's id; hint and error are linked by describe("x", ...)
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

const LABEL = "mb-1 block text-xs font-medium text-secondary";
const HINT = "mt-1 block text-[11px] leading-snug text-muted";

/** aria attributes for a control whose Field was given an `id`. */
export const describe = (id: string, o: { hint?: boolean; error?: string }) => ({
  "aria-invalid": o.error ? true : undefined,
  "aria-describedby": [o.hint ? `${id}-hint` : "", o.error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
});

type FieldProps = {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  error?: string;
  /** The caller's id for the control; hint and error get `${id}-hint` and `${id}-error`. */
  id?: string;
  className?: string;
  children: ReactNode | ((id: string) => ReactNode);
};

export function Field({ label, hint, required, error, id, className, children }: FieldProps) {
  const generated = useId();
  const star = required ? <span className="font-normal text-muted"> (required)</span> : null;
  const note = hint ? (
    <span id={id ? `${id}-hint` : undefined} className={HINT}>
      {hint}
    </span>
  ) : null;
  const problem = error ? (
    <p id={id ? `${id}-error` : undefined} role="alert" className="mt-1 text-xs text-danger">
      {error}
    </p>
  ) : null;
  if (id || typeof children === "function") {
    const cid = id ?? generated;
    return (
      <div className={cn("block", className)}>
        <label htmlFor={cid} className={LABEL}>
          {label}
          {star}
        </label>
        {typeof children === "function" ? children(cid) : children}
        {note}
        {problem}
      </div>
    );
  }
  return (
    <label className={cn("block", className)}>
      <span className={LABEL}>
        {label}
        {star}
      </span>
      {children}
      {note}
      {problem}
    </label>
  );
}
