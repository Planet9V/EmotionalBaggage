// Money is held as integer minor units (cents) so sums never drift. A concept has one currency and
// nothing here converts between currencies.

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "JPY"] as const;
export const DEFAULT_CURRENCY = "USD";

/** Decimal places of the currency's minor unit (2 for dollars, 0 for yen), from the platform's currency data. */
export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Major units as typed (12.5) to integer minor units (1250). Rounds half up, after removing binary noise (1.005 is 1.005, not 1.00499999). */
export function toMinor(major: number, currency: string): number {
  const f = 10 ** minorDigits(currency);
  return Math.round(Number((major * f).toPrecision(12)));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

/** "$12.50" or "12,50 €" as the browser's English formatting writes the currency. Negative amounts keep their minus sign. */
export function formatMoney(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(toMajor(minor, currency));
}

/** A percentage with at most one decimal: 38.5%, 40%. */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}
