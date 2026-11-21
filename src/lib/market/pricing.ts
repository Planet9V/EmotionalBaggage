// Pricing arithmetic (plan 8.4). Everything here is worked out from numbers the user entered or
// rows of the concept; nothing is typed in as a result. Money is whole minor units (cents).
import { toPart } from "@/lib/domain/part";
import type { Item } from "@/lib/types";

/** What one unit costs to make. `known` is false when the number is incomplete: see `missing`. */
export type UnitCost = { known: boolean; minor: number; currency: string; missing: string[] };

/**
 * LEAD: POINT THIS AT THE REAL MODULE. src/lib/economics/compute.ts (another engineer's, plan 3.6)
 * does not exist on this branch. Until it does, the unit cost is the parts list total for one
 * unit, read through the domain reader: a part with no cost entered is listed in `missing`, never
 * counted as zero. It leaves out labour, packaging, shipping, tooling and anything else the
 * parts list does not hold, and the pricing screen says so. When the real module lands, replace
 * the body of this one function; nothing else in the pricing code reads parts.
 */
export function unitCostForPricing(partItems: Item[], currency: string): UnitCost {
  const parts = partItems.map(toPart);
  const missing = parts.filter((p) => p.line === null).map((p) => p.title);
  const major = parts.reduce((a, p) => a + (p.line ?? 0), 0);
  return { known: parts.length > 0 && missing.length === 0, minor: Math.round(major * 100), currency, missing };
}

export type Channel = { name: string; feePercent: number; fixedFeeMinor: number };

export type Margin = {
  priceMinor: number;
  feeMinor: number;
  marginMinor: number;
  /** margin as a share of the price, or null when the price is zero */
  marginPercent: number | null;
  /** the cost behind it is incomplete or absent */
  partial: boolean;
};

/** Margin per unit for one price in one channel: price less unit cost less the channel's fees. */
export function margin(priceMinor: number, unit: UnitCost, channel: Pick<Channel, "feePercent" | "fixedFeeMinor">): Margin {
  const feeMinor = Math.round((priceMinor * channel.feePercent) / 100) + channel.fixedFeeMinor;
  const marginMinor = priceMinor - unit.minor - feeMinor;
  return {
    priceMinor,
    feeMinor,
    marginMinor,
    marginPercent: priceMinor > 0 ? (marginMinor / priceMinor) * 100 : null,
    partial: !unit.known,
  };
}

/**
 * Cost plus: the price at which the margin, as a share of the price and after the channel's
 * fees, is the target. null when the fees and target leave nothing (they add to 100 percent or more).
 */
export function costPlusPrice(unit: UnitCost, targetMarginPercent: number, channel: Pick<Channel, "feePercent" | "fixedFeeMinor">): number | null {
  const share = 1 - channel.feePercent / 100 - targetMarginPercent / 100;
  if (share <= 0) return null;
  return Math.ceil((unit.minor + channel.fixedFeeMinor) / share);
}

export type Competitor = { name: string; priceMinor: number; currency: string; sourced: boolean };

export type CompetitorRange = { count: number; low: number; median: number; high: number } | null;

/** Low, median and high of competitor prices in one currency. null when none have a price. */
export function competitorRange(list: Competitor[], currency: string): CompetitorRange {
  const prices = list.filter((c) => c.currency.toUpperCase() === currency.toUpperCase()).map((c) => c.priceMinor).sort((a, b) => a - b);
  if (!prices.length) return null;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
  return { count: prices.length, low: prices[0], median, high: prices[prices.length - 1] };
}

/** Where a price sits among competitors: below the lowest, between, or above the highest. */
export function position(priceMinor: number, range: CompetitorRange): "below all" | "within the range" | "above all" | "no competitor prices" {
  if (!range) return "no competitor prices";
  if (priceMinor < range.low) return "below all";
  if (priceMinor > range.high) return "above all";
  return "within the range";
}

/** Whole money as text, in the currency given. Falls back to the code when the currency is not one the runtime knows. */
export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** Reads what a person types ("24.95", "$24.95", "1,200") as minor units, or null. */
export function parseMinor(input: string): number | null {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
