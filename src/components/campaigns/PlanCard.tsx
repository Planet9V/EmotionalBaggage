"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { useItems } from "@/lib/client";
import { CAMPAIGN_STORE } from "@/lib/campaigns/schemas";
import { DEFAULT_MIN_CLICKS, DEFAULT_MIN_ORDERS, type PlanSettings } from "@/lib/campaigns/read";
import { MoneyField, NumberField, readNumber } from "./fields";
import type { useMoney } from "./hooks";
import { ErrorLine } from "@/components/ui/states";

type Money = ReturnType<typeof useMoney>;

/**
 * The concept's marketing budget and the numbers the campaign rules are worked from. One row of the
 * campaigns section holds them (kind "plan"), so the drafting engine reads the same numbers.
 */
export function PlanCard({ projectId, plan, money }: { projectId: string; plan: PlanSettings; money: Money }) {
  const { add, patch } = useItems(projectId, CAMPAIGN_STORE);
  const [vals, setVals] = useState(() => ({
    total: money.toInput(plan.totalMinor),
    monthly: money.toInput(plan.monthlyMinor),
    share: plan.allowableSharePercent === null ? "" : String(plan.allowableSharePercent),
    after: plan.judgeAfterOrders === null ? "" : String(plan.judgeAfterOrders),
    below: plan.scaleBelowPercent === null ? "" : String(plan.scaleBelowPercent),
    by: plan.scaleByPercent === null ? "" : String(plan.scaleByPercent),
    clicks: String(plan.minClicks),
    orders: String(plan.minOrders),
  }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof vals) => (v: string) => {
    setSaved(false);
    setVals((x) => ({ ...x, [k]: v }));
  };

  const save = async () => {
    setErr("");
    const total = money.fromInput(vals.total);
    const monthly = money.fromInput(vals.monthly);
    const share = readNumber(vals.share);
    const after = readNumber(vals.after);
    const below = readNumber(vals.below);
    const by = readNumber(vals.by);
    const clicks = readNumber(vals.clicks);
    const orders = readNumber(vals.orders);
    const bad = (label: string) => setErr(`${label} must be a number, zero or more.`);
    if (Number.isNaN(total)) return bad("The total marketing budget");
    if (Number.isNaN(monthly)) return bad("The monthly budget");
    if (share !== null && (Number.isNaN(share) || share < 0 || share > 100)) return setErr("The share of the margin must be a number from 0 to 100.");
    if (after !== null && (Number.isNaN(after) || after < 1)) return setErr("Judge after must be at least 1 order.");
    if (below !== null && (Number.isNaN(below) || below < 1 || below > 100)) return setErr("Scale below must be a number from 1 to 100.");
    if (by !== null && (Number.isNaN(by) || by < 0)) return bad("Scale by");
    if (clicks === null || Number.isNaN(clicks) || clicks < 0 || !Number.isInteger(clicks)) return setErr("The minimum clicks must be a whole number, zero or more.");
    if (orders === null || Number.isNaN(orders) || orders < 0 || !Number.isInteger(orders)) return setErr("The minimum orders must be a whole number, zero or more.");
    const data: Record<string, unknown> = { kind: "plan", minClicks: clicks, minOrders: orders };
    // a field cleared is saved as null ("not set"), never as zero
    data.planTotalMinor = total;
    data.planMonthlyMinor = monthly;
    data.allowableSharePercent = share;
    data.judgeAfterOrders = after;
    data.scaleBelowPercent = below;
    data.scaleByPercent = by;
    setBusy(true);
    try {
      if (plan.id === null) await add({ section: CAMPAIGN_STORE, title: "Marketing plan", status: "planned", data });
      else await patch(plan.id, { data });
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-primary">Marketing budget and rules</h2>
        <p className="mt-1 text-sm text-secondary">
          The budget the campaigns below are held to, and the numbers a drafted plan and every stop or scale rule are worked from. Nothing here is guessed: leave a field empty and the plan says it is missing.
        </p>
      </div>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyField label="Total marketing budget" value={vals.total} onChange={set("total")} currency={money.currency} />
          <MoneyField label="Monthly marketing budget" value={vals.monthly} onChange={set("monthly")} currency={money.currency} />
          <NumberField label="Share of the margin an order may cost to win" suffix="%" value={vals.share} onChange={set("share")} hint="Allowable cost per order = margin per unit before ads x this share." />
          <NumberField label="Judge a campaign after" suffix="orders' worth of spend" value={vals.after} onChange={set("after")} hint="Spend this many times the allowable cost per order first." />
          <NumberField label="Scale when cost per order is below" suffix="% of allowable" value={vals.below} onChange={set("below")} />
          <NumberField label="Then raise the daily budget by" suffix="%" value={vals.by} onChange={set("by")} />
          <NumberField label="Too few clicks to judge, below" value={vals.clicks} onChange={set("clicks")} hint={`Default ${DEFAULT_MIN_CLICKS}. A result with fewer clicks and fewer orders than the minimums gets a warning.`} />
          <NumberField label="Too few orders to judge, below" value={vals.orders} onChange={set("orders")} hint={`Default ${DEFAULT_MIN_ORDERS}.`} />
        </div>
        {err && <ErrorLine>{err}</ErrorLine>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save budget and rules"}</Button>
          <span role="status" className="text-xs text-secondary">{saved ? "Saved." : ""}</span>
        </div>
      </form>
    </Card>
  );
}
