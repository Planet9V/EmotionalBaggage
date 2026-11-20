"use client";

import { Input } from "@/components/ui/input";
import { fmtMm } from "./geom";

/**
 * A number box that commits on Enter or blur. It is uncontrolled and re-keys on the stored value,
 * so typing "-" or "1." is never fought by a re-render. Bad input reverts to the stored value.
 */
export function NumField({
  label, value, onCommit, positive = false, integer = false, min, placeholder, unit = "mm", disabled,
}: {
  label: string;
  value: number | null;
  onCommit: (n: number) => void;
  /** must be greater than zero */
  positive?: boolean;
  integer?: boolean;
  min?: number;
  placeholder?: string;
  unit?: string;
  disabled?: boolean;
}) {
  const shown = value === null ? "" : fmtMm(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        {unit && <span className="font-mono text-[10px]">{unit}</span>}
      </span>
      <Input
        key={shown}
        defaultValue={shown}
        disabled={disabled}
        inputMode="decimal"
        placeholder={placeholder}
        className="h-8 px-2 font-mono text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = shown;
            e.currentTarget.blur();
          }
          e.stopPropagation();
        }}
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim().replace(",", ".");
          if (raw === shown) return;
          const n = Number(raw);
          const bad = raw === "" || !Number.isFinite(n) || (positive && n <= 0) || (integer && !Number.isInteger(n)) || (min !== undefined && n < min);
          if (bad) {
            e.currentTarget.value = shown;
            return;
          }
          onCommit(n);
        }}
      />
    </label>
  );
}
