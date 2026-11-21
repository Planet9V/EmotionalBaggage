// Budget by month, worked out from the campaigns' totals and dates, compared with the concept's
// marketing budget. Pure.
//
// Rules, which the screen shows:
//  - A campaign with a total budget and both dates spends it evenly, one share per day, whole minor
//    units; the month shares are whole numbers and add back to the total exactly (the rounding
//    remainder goes to the last month).
//  - A campaign with a daily budget and both dates, and no total, spends the daily budget on every
//    day of the dates (inclusive).
//  - When a campaign has both, the total is what it may spend and the dates decide the months.
//  - A campaign with no dates, or no budget, is listed as left out, with the reason.
//  - Killed campaigns are left out. Done campaigns count at their planned budget.
import { daysInMonth, inclusiveDays, monthKey, monthsBetween } from "./days";
import type { Campaign } from "./read";

type MonthShare = { campaignId: number; title: string; amount: number };
type MonthRow = { month: string; planned: number; limit: number | null; over: number; shares: MonthShare[] };
type LeftOut = { campaignId: number; title: string; reason: string };
export type BudgetRollup = {
  months: MonthRow[];
  plannedTotal: number;
  /** the concept's overall marketing budget, when set */
  totalLimit: number | null;
  /** planned - limit when above, else 0 */
  totalOver: number;
  leftOut: LeftOut[];
};

/** Splits `total` over days start..end by month, exactly. Null when the dates are unusable. */
export function spread(total: number, start: string, end: string): Record<string, number> | null {
  const days = inclusiveDays(start, end);
  if (days === null || days < 1) return null;
  const months = monthsBetween(start, end);
  const daysIn: Record<string, number> = {};
  for (const m of months) {
    const first = m === monthKey(start) ? Number(start.slice(8)) : 1;
    const last = m === monthKey(end) ? Number(end.slice(8)) : daysInMonth(m);
    daysIn[m] = last - first + 1;
  }
  const out: Record<string, number> = {};
  let given = 0;
  months.forEach((m, k) => {
    out[m] = k === months.length - 1 ? total - given : Math.floor((total * daysIn[m]) / days);
    given += out[m];
  });
  return out;
}

export function budgetRollup(campaigns: Campaign[], limits: { monthlyMinor: number | null; totalMinor: number | null }): BudgetRollup {
  const byMonth = new Map<string, MonthShare[]>();
  const leftOut: LeftOut[] = [];
  for (const c of campaigns) {
    if (c.status === "killed") continue;
    const out = (reason: string) => leftOut.push({ campaignId: c.id, title: c.title, reason });
    if (c.budgetTotalMinor === null && c.budgetDailyMinor === null) {
      out("no budget entered");
      continue;
    }
    if (!c.startDate || !c.endDate) {
      out("no start and end date, so its months cannot be worked out");
      continue;
    }
    const days = inclusiveDays(c.startDate, c.endDate);
    if (days === null) {
      out("the end date is before the start date");
      continue;
    }
    const total = c.budgetTotalMinor ?? (c.budgetDailyMinor as number) * days;
    const parts = spread(total, c.startDate, c.endDate);
    if (!parts) {
      out("its dates are not usable");
      continue;
    }
    for (const [m, amount] of Object.entries(parts)) byMonth.set(m, [...(byMonth.get(m) ?? []), { campaignId: c.id, title: c.title, amount }]);
  }
  const months = [...byMonth.keys()].sort().map((month): MonthRow => {
    const shares = byMonth.get(month)!;
    const planned = shares.reduce((a, x) => a + x.amount, 0);
    const limit = limits.monthlyMinor;
    return { month, planned, limit, over: limit !== null && planned > limit ? planned - limit : 0, shares };
  });
  const plannedTotal = months.reduce((a, m) => a + m.planned, 0);
  const totalLimit = limits.totalMinor;
  return { months, plannedTotal, totalLimit, totalOver: totalLimit !== null && plannedTotal > totalLimit ? plannedTotal - totalLimit : 0, leftOut };
}
