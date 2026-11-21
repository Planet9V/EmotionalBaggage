// The margin a campaign can spend from. It comes from the unit economics (src/lib/economics), never
// typed: price less unit cost, fees, fulfilment and returns on one sales channel, before any
// advertising. The economics' own margin subtracts an "advertising per order" assumption entered on
// the channel; it is added back here, because the campaign's job is to say what advertising may cost.
import { channelResults, fixedCosts, unitCost, wholeBatch, type ChannelResult } from "@/lib/economics/compute";
import { formatMoney } from "@/lib/economics/money";
import { readEconomics, type EconomicsRows } from "@/lib/economics/read";

export type ChannelMargin = {
  channelId: number;
  title: string;
  /** margin per unit before advertising, minor units; null when the economics cannot work it out */
  marginBeforeAds: number | null;
  price: number | null;
  /** the unit cost the margin used is complete (every part priced) */
  complete: boolean;
  batchSize: number;
  /** the arithmetic, in words and numbers */
  how: string[];
  missing: string[];
};

/** Margin before ads on every sales channel row, at the first planned batch size (or 1 when none is planned). */
export function channelMargins(rows: EconomicsRows, currency: string): ChannelMargin[] {
  const inputs = readEconomics(rows, currency);
  const batchSize = wholeBatch(inputs.batches.find((b) => b.units !== null)?.units ?? 1);
  const unit = unitCost(inputs, batchSize);
  const fixed = fixedCosts(inputs);
  return channelResults(inputs.channels, unit, fixed).map((r: ChannelResult): ChannelMargin => {
    const before = r.margin === null ? null : r.margin + r.adCost;
    const how = r.margin === null ? [] : [...r.how.filter((h) => h.startsWith("Margin =")), `Add back the advertising per order the channel already assumes (${formatMoney(r.adCost, currency)}): margin before ads ${formatMoney(before as number, currency)}`];
    return {
      channelId: r.id,
      title: r.title,
      marginBeforeAds: before,
      price: r.price,
      complete: r.complete,
      batchSize,
      how,
      missing: r.missing.map((m) => `${m.what}: ${m.reason}`),
    };
  });
}

/**
 * The most a campaign may pay for one order: a share of the margin before ads. Whole minor units,
 * rounded down. Null when the margin is unknown or not above zero.
 */
export function allowableCostPerOrder(marginBeforeAds: number | null, sharePercent: number | null): { minor: number | null; how: string } {
  if (marginBeforeAds === null) return { minor: null, how: "The margin per unit cannot be worked out yet." };
  if (sharePercent === null) return { minor: null, how: "No share of the margin is set." };
  if (marginBeforeAds <= 0) return { minor: null, how: "Each unit earns nothing before advertising, so no ad cost can be allowed." };
  return { minor: Math.floor((marginBeforeAds * sharePercent) / 100), how: `${sharePercent}% of the margin per unit before ads` };
}
