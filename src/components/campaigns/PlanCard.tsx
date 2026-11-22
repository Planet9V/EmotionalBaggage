"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { useItems } from "@/lib/client";
import { CAMPAIGN_STORE } from "@/lib/campaigns/schemas";
import { DEFAULT_MIN_CLICKS, DEFAULT_MIN_ORDERS, type PlanSettings } from "@/lib/campaigns/read";
import { MoneyInput } from "@/components/ui/money-input";
import { readNumber } from "./fields";
import { Input } from "@/components/ui/input";
import { describe, Field } from "@/components/ui/field";
import { parseHosts } from "@/lib/campaigns/hosts";
import type { useMoney } from "./hooks";
import { ErrorLine } from "@/components/ui/states";

type Money = ReturnType<typeof useMoney>;

const BAD_TOTAL = "The total marketing budget must be a number, zero or more.";
const BAD_MONTHLY = "The monthly budget must be a number, zero or more.";
const BAD_SHARE = "The share of the margin must be a number from 0 to 100.";
const BAD_AFTER = "Judge after must be at least 1 order.";
const BAD_BELOW = "Scale below must be a number from 1 to 100.";
const BAD_BY = "Scale by must be a number, zero or more.";
const BAD_CLICKS = "The minimum clicks must be a whole number, zero or more.";
const BAD_ORDERS = "The minimum orders must be a whole number, zero or more.";

/** An optional number: empty is "not set"; otherwise it must be a number that `ok` accepts. */
const optionalNumber = (text: string, ok: (n: number) => boolean) => {
  const n = readNumber(text);
  return n === null || (!Number.isNaN(n) && ok(n));
};
const wholeCount = (text: string) => {
  const n = readNumber(text);
  return n !== null && !Number.isNaN(n) && n >= 0 && Number.isInteger(n);
};

const MONEY_FIELDS = [
  { name: "total", label: "Total marketing budget" },
  { name: "monthly", label: "Monthly marketing budget" },
] as const;
const NUMBER_FIELDS = [
  { name: "share", label: "Share of the margin an order may cost to win (%)", hint: "Allowable cost per order = margin per unit before ads x this share." },
  { name: "after", label: "Judge a campaign after (orders' worth of spend)", hint: "Spend this many times the allowable cost per order first." },
  { name: "below", label: "Scale when cost per order is below (% of allowable)" },
  { name: "by", label: "Then raise the daily budget by (%)" },
  { name: "clicks", label: "Too few clicks to judge, below", hint: `Default ${DEFAULT_MIN_CLICKS}. A result with fewer clicks and fewer orders than the minimums gets a warning.` },
  { name: "orders", label: "Too few orders to judge, below", hint: `Default ${DEFAULT_MIN_ORDERS}.` },
] as const;

/**
 * The concept's marketing budget and the numbers the campaign rules are worked from. One row of the
 * campaigns section holds them (kind "plan"), so the drafting engine reads the same numbers.
 */
export function PlanCard({ projectId, plan, money }: { projectId: string; plan: PlanSettings; money: Money }) {
  const { add, patch } = useItems(projectId, CAMPAIGN_STORE);
  const isMoney = (text: string) => !Number.isNaN(money.fromInput(text));
  const planSchema = z.object({
    total: z.string().refine(isMoney, BAD_TOTAL),
    monthly: z.string().refine(isMoney, BAD_MONTHLY),
    share: z.string().refine((t) => optionalNumber(t, (n) => n >= 0 && n <= 100), BAD_SHARE),
    after: z.string().refine((t) => optionalNumber(t, (n) => n >= 1), BAD_AFTER),
    below: z.string().refine((t) => optionalNumber(t, (n) => n >= 1 && n <= 100), BAD_BELOW),
    by: z.string().refine((t) => optionalNumber(t, (n) => n >= 0), BAD_BY),
    clicks: z.string().refine(wholeCount, BAD_CLICKS),
    orders: z.string().refine(wholeCount, BAD_ORDERS),
    hosts: z.string().superRefine((text, ctx) => {
      const { bad } = parseHosts(text);
      if (bad.length) ctx.addIssue({ code: "custom", message: `Not a host name: ${bad.join(", ")}. Write hosts such as shop.example or www.amazon.com, without https:// or a path.` });
    }),
  });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting: busy } } = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      total: money.toInput(plan.totalMinor),
      monthly: money.toInput(plan.monthlyMinor),
      share: plan.allowableSharePercent === null ? "" : String(plan.allowableSharePercent),
      after: plan.judgeAfterOrders === null ? "" : String(plan.judgeAfterOrders),
      below: plan.scaleBelowPercent === null ? "" : String(plan.scaleBelowPercent),
      by: plan.scaleByPercent === null ? "" : String(plan.scaleByPercent),
      clicks: String(plan.minClicks),
      orders: String(plan.minOrders),
      hosts: plan.linkHosts.join(", "),
    },
  });
  const [saved, setSaved] = useState(false);
  const field = (name: keyof z.infer<typeof planSchema>) => register(name, { onChange: () => setSaved(false) });
  const fieldId = (name: string) => `plan-${name}`;

  const save = handleSubmit(async (vals) => {
    const hosts = parseHosts(vals.hosts);
    // a field cleared is saved as null ("not set"), never as zero
    const data: Record<string, unknown> = {
      kind: "plan",
      minClicks: readNumber(vals.clicks),
      minOrders: readNumber(vals.orders),
      linkHosts: hosts.hosts,
      planTotalMinor: money.fromInput(vals.total),
      planMonthlyMinor: money.fromInput(vals.monthly),
      allowableSharePercent: readNumber(vals.share),
      judgeAfterOrders: readNumber(vals.after),
      scaleBelowPercent: readNumber(vals.below),
      scaleByPercent: readNumber(vals.by),
    };
    try {
      if (plan.id === null) await add({ section: CAMPAIGN_STORE, title: "Marketing plan", status: "planned", data });
      else await patch(plan.id, { data });
      setSaved(true);
    } catch (e) {
      setError("root", { message: (e as Error).message });
    }
  });

  return (
    <Card id="campaign-budget" variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold text-primary">Marketing budget and rules</h2>
        <p className="mt-1 text-sm text-secondary">
          The budget the campaigns below are held to, and the numbers a drafted plan and every stop or scale rule are worked from. Nothing here is guessed: leave a field empty and the plan says it is missing.
        </p>
      </div>
      <form className="space-y-3" noValidate onSubmit={(e) => void save(e)}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MONEY_FIELDS.map(({ name, label }) => (
            <Field key={name} id={fieldId(name)} label={`${label} (${money.currency})`} error={errors[name]?.message}>
              <MoneyInput id={fieldId(name)} currency={money.currency} {...describe(fieldId(name), { error: errors[name]?.message })} {...field(name)} />
            </Field>
          ))}
          {NUMBER_FIELDS.map((f) => (
            <Field key={f.name} id={fieldId(f.name)} label={f.label} hint={"hint" in f ? f.hint : undefined} error={errors[f.name]?.message}>
              <Input id={fieldId(f.name)} inputMode="decimal" {...describe(fieldId(f.name), { hint: "hint" in f, error: errors[f.name]?.message })} {...field(f.name)} />
            </Field>
          ))}
        </div>
        <Field
          id={fieldId("hosts")}
          label="Hosts tracked links may open"
          hint="Separate with commas: the landing page's host and your sales channels, for example shop.example, www.amazon.com. A tracked link can only send visitors to these hosts (and their sub-domains), over https."
          error={errors.hosts?.message}
        >
          <Input id={fieldId("hosts")} placeholder="shop.example, www.amazon.com" {...describe(fieldId("hosts"), { hint: true, error: errors.hosts?.message })} {...field("hosts")} />
        </Field>
        {errors.root?.message && <ErrorLine>{errors.root.message}</ErrorLine>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save budget and rules"}</Button>
          <span role="status" className="text-xs text-secondary">{saved ? "Saved." : ""}</span>
        </div>
      </form>
    </Card>
  );
}
