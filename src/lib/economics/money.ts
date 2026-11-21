import { moneyOrNull } from "@/lib/moneyText";
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

/** "$12.50" or "12,50 €" as the browser's English formatting writes the currency. Negative amounts keep their minus sign. A code the runtime does not know is written after the number. */
export function formatMoney(minor: number, currency: string): string {
  // Never "$NaN" or "$∞" on a screen (U23): an amount that is not a finite number is not worked out.
  if (!Number.isFinite(minor)) return "not worked out";
  const digits = minorDigits(currency);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(toMajor(minor, currency));
  } catch {
    return `${toMajor(minor, currency).toFixed(digits)} ${currency}`;
  }
}

/** An amount held in major units (a part's line cost, an offer's price) as fixed text with the currency's own decimals: "12.50", "1250" for yen, "1.234" for dinar. */
export function majorText(major: number, currency: string): string {
  return major.toFixed(minorDigits(currency));
}

/** A minor amount as the text of an input or a file column, "12.50". */
export function toInputText(minor: number, currency: string): string {
  return majorText(toMajor(minor, currency), currency);
}

/** Reads what a person types ("24.95", "$24.95", "1,200", "12 USD") as minor units of the currency, or null when it is empty, not a number, or negative. */
export function parseMinor(input: string, currency = DEFAULT_CURRENCY): number | null {
  // The one money reader (src/lib/moneyText.ts): "$150", "150 USD", "1,200.50" and "1.200,50" all read (U22).
  const n = moneyOrNull(input);
  if (n === null || n < 0) return null;
  return toMinor(n, currency);
}

/** A percentage with at most one decimal: 38.5%, 40%. */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "not worked out";
  return `${Number(value.toFixed(1))}%`;
}
