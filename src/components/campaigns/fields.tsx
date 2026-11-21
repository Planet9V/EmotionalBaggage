"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { readMoney } from "@/lib/moneyText";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

/** A money field in the concept's currency: typed as an ordinary amount ("12.50"), kept by the form as text. */
export function MoneyField({ label, value, onChange, currency, hint, className }: { label: string; value: string; onChange: (v: string) => void; currency: string; hint?: string; className?: string }) {
  return (
    <Field label={`${label} (${currency})`} hint={hint} className={className}>
      <MoneyInput currency={currency} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** A plain number field kept as text, so a half-typed value is not rewritten under the cursor. */
export function NumberField({ label, value, onChange, hint, className, suffix }: { label: string; value: string; onChange: (v: string) => void; hint?: string; className?: string; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint} className={className}>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Text to a number: null when empty, NaN when it is not a number. */
export function readNumber(text: string): number | null {
  return readMoney(text);
}

export function Section({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-sm font-semibold text-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
