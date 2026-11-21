// What a person types into a money field, read as a number: "$150", "150 USD", "1,200.50", "€ 1.200,50",
// "12,5". A currency sign or code and thousands separators are dropped; the last "." or "," is the decimal
// point when both appear. The one reader for every money field (U22). Safe for the browser.

const SIGNS = /[$€£¥₹₩₽¢]|\b[A-Z]{3}\b|\b(?:US|CA|AU|NZ)\$|kr\b/gi;

/** The number in a money text, null when it is empty, NaN when it is not an amount. */
export function readMoney(text: string): number | null {
  let t = String(text ?? "").replace(SIGNS, "").replace(/[\s '’]/g, "");
  if (t === "") return null;
  const neg = /^-|^\(.*\)$/.test(t);
  t = t.replace(/^[-(]|\)$/g, "");
  if (!/^[\d.,]+$/.test(t)) return Number.NaN;
  const lastDot = t.lastIndexOf("."), lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    t = t.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    // "1,200" and "1,200,000" are thousands; "12,5" and "1,25" are a decimal comma.
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.split(",").join("") : t.split(",").length === 2 ? t.replace(",", ".") : Number.NaN.toString();
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.split(".").join("") : Number.NaN.toString();
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return Number.NaN;
  return neg ? -n : n;
}

/** The amount, or null when empty or not an amount. */
export function moneyOrNull(text: string): number | null {
  const n = readMoney(text);
  return n === null || Number.isNaN(n) ? null : n;
}

/** The symbol shown before a money field for a currency code ("$" for USD), or the code itself. */
export function currencySymbol(currency: string, locale = "en-US"): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}
