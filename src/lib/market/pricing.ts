// Pricing arithmetic (plan 8.4). Everything here is worked out from numbers the user entered or
// rows of the concept; nothing is typed in as a result. Money is whole minor units (cents).
//
// The unit cost and the currency are not this module's: both come from the unit economics
// (src/lib/economics), so pricing, campaigns, content and the report quote one figure.
import { channelFeeMinor, channelFeeRates, type ChannelFees, type UnitCost as EconomicsUnitCost } from "@/lib/economics/compute";

/**
 * What one unit costs to make, as pricing reads it. `known` is false when the number is
 * incomplete: `missing` names every line that is not priced. An unpriced line is left out of
 * `minor` and named; it is never counted as zero.
 */
export type UnitCost = { known: boolean; minor: number; currency: string; missing: string[]; batchSize?: number };

/** The economics' unit cost (parts with price breaks plus cost lines) in the shape pricing reads. */
export function pricingUnitCost(u: EconomicsUnitCost): UnitCost {
  return { known: u.complete, minor: u.total, currency: u.currency, missing: u.missing.map((m) => m.what), batchSize: u.batchSize };
}

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
export function margin(priceMinor: number, unit: UnitCost, channel: ChannelFees): Margin {
  // The fee arithmetic is the economics' own (sales/channels rows), so both screens show the same fee.
  const feeMinor = channelFeeMinor(channel, priceMinor, unit.currency).total;
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
export function costPlusPrice(unit: UnitCost, targetMarginPercent: number, channel: ChannelFees): number | null {
  const fees = channelFeeRates(channel, unit.currency);
  const share = 1 - fees.percent / 100 - targetMarginPercent / 100;
  if (share <= 0) return null;
  return Math.ceil((unit.minor + fees.fixedMinor) / share);
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

