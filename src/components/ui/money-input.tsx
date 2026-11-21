"use client";

import { forwardRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { currencySymbol } from "@/lib/moneyText";
import { cn } from "@/lib/utils";

/**
 * The one money field: the currency shown before the box, a decimal keyboard on phones, and text kept as
 * typed. Read it with readMoney or moneyOrNull (src/lib/moneyText.ts), which accept "$150", "1,200.50" and
 * a currency code, so nothing a person naturally types is refused (U22). Works with react-hook-form's register.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<ComponentProps<typeof Input>, "inputMode"> & { currency?: string }>(function MoneyInput(
  { currency = "USD", className, ...props },
  ref,
) {
  const sign = currencySymbol(currency);
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
        {sign}
      </span>
      <Input ref={ref} inputMode="decimal" autoComplete="off" className={cn("font-mono", sign.length > 1 ? "pl-10" : "pl-6", className)} {...props} />
    </div>
  );
});
