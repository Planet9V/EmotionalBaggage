// Reading campaign rows once, through one reader (the guide's rule: never read item.data fields in a view).
import type { Item } from "@/lib/types";
import { CAMPAIGN_STORE, campaignData, TARGET_INFO, type RowRef, type StopScaleRule, type Target } from "./schemas";

export const DEFAULT_MIN_CLICKS = 100;
export const DEFAULT_MIN_ORDERS = 10;

export type Campaign = {
  id: number;
  title: string;
  body: string;
  status: string;
  sort: number;
  objective: string;
  audience: RowRef | null;
  salesChannel: RowRef | null;
  channel: string;
  budgetTotalMinor: number | null;
  budgetDailyMinor: number | null;
  startDate: string;
  endDate: string;
  creative: RowRef[];
  target: Target | null;
  rule: StopScaleRule;
  message: string;
  reasoning: string;
  arithmetic: { label: string; how: string }[];
  /** text fields of the older seeded shape (funnel, budget, kpi): shown as they were typed, never read as numbers */
  legacy: string[];
};

export const isPlanRow = (i: Item) => i.section === CAMPAIGN_STORE && i.data?.kind === "plan";

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** A campaign row as the screens use it. A field that does not fit its schema is dropped, not guessed. */
export function toCampaign(i: Item): Campaign {
  const parsed = campaignData.safeParse(i.data ?? {});
  const d = (parsed.success ? parsed.data : (i.data ?? {})) as Record<string, unknown>;
  const t = d.target as Target | undefined;
  return {
    id: i.id,
    title: i.title,
    body: i.body ?? "",
    status: i.status,
    sort: i.sort,
    objective: s(d.objective),
    audience: (d.audience as RowRef | undefined) ?? null,
    salesChannel: (d.salesChannel as RowRef | undefined) ?? null,
    channel: s(d.channel),
    budgetTotalMinor: n(d.budgetTotalMinor),
    budgetDailyMinor: n(d.budgetDailyMinor),
    startDate: s(d.startDate),
    endDate: s(d.endDate),
    creative: Array.isArray(d.creative) ? (d.creative as RowRef[]) : [],
    target: t && t.metric in TARGET_INFO ? t : null,
    rule: (d.rule as StopScaleRule | undefined) ?? {},
    message: s(d.message),
    reasoning: s(d.reasoning),
    arithmetic: Array.isArray(d.arithmetic) ? (d.arithmetic as { label: string; how: string }[]) : [],
    legacy: ([["Funnel", d.funnel], ["Budget", d.budget], ["Measure", d.kpi]] as const).flatMap(([k, v]) => (typeof v === "string" && v.trim() ? [`${k}: ${v.trim()}`] : [])),
  };
}

/** The campaigns of a concept, not its plan row. */
export const campaignsOf = (items: Item[]) => items.filter((i) => i.section === CAMPAIGN_STORE && !isPlanRow(i)).map(toCampaign);

export type PlanSettings = {
  /** the plan row's id; null until the user first saves a budget */
  id: number | null;
  totalMinor: number | null;
  monthlyMinor: number | null;
  allowableSharePercent: number | null;
  judgeAfterOrders: number | null;
  scaleBelowPercent: number | null;
  scaleByPercent: number | null;
  minClicks: number;
  minOrders: number;
};

export function planOf(items: Item[]): PlanSettings {
  const row = items.find(isPlanRow);
  const d = (row?.data ?? {}) as Record<string, unknown>;
  return {
    id: row?.id ?? null,
    totalMinor: n(d.planTotalMinor),
    monthlyMinor: n(d.planMonthlyMinor),
    allowableSharePercent: n(d.allowableSharePercent),
    judgeAfterOrders: n(d.judgeAfterOrders),
    scaleBelowPercent: n(d.scaleBelowPercent),
    scaleByPercent: n(d.scaleByPercent),
    minClicks: n(d.minClicks) ?? DEFAULT_MIN_CLICKS,
    minOrders: n(d.minOrders) ?? DEFAULT_MIN_ORDERS,
  };
}
