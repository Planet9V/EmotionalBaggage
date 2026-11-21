"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** The optional reason that goes with a change: kept on the change and shown in the history. */
export function WhyField({
  id,
  value,
  onChange,
  label = "Why (kept in the history)",
  hint,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <Field label={label} id={id} hint={hint}>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} autoComplete="off" autoFocus={autoFocus} data-autofocus={autoFocus ? "" : undefined} />
    </Field>
  );
}
