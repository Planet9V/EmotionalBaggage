"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItems } from "@/lib/client";
import { isDay } from "@/lib/campaigns/days";
import { allowableCostPerOrder } from "@/lib/campaigns/margin";
import type { Campaign, PlanSettings } from "@/lib/campaigns/read";
import { CAMPAIGN_STORE, OBJECTIVES, OBJECTIVE_LABEL, TARGET_INFO, TARGET_METRICS, type RowRef, type TargetMetric } from "@/lib/campaigns/schemas";
import type { Item } from "@/lib/types";
import { MoneyField, NumberField, readNumber } from "./fields";
import type { Summary, useMoney } from "./hooks";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/Card";

type Money = ReturnType<typeof useMoney>;

const ref = (it: Item): RowRef => ({ section: it.section, itemId: it.id, title: it.title });

const targetText = (metric: TargetMetric, v: number | null, money: Money): string => {
  if (v === null) return "";
  const k = TARGET_INFO[metric].kind;
  return k === "money" ? money.toInput(v) : k === "fraction" ? String(Number((v * 100).toFixed(4))) : String(v);
};

/** Add or edit one campaign. Every number is typed; the one worked out (allowable cost per order) is shown with its arithmetic and never saved here. */
export function CampaignDialog({ projectId, campaign, plan, summary, money, statuses, onClose }: {
  projectId: string;
  campaign: Campaign | null;
  plan: PlanSettings;
  summary: Summary | undefined;
  money: Money;
  statuses: string[];
  onClose: () => void;
}) {
  const store = useItems(projectId, CAMPAIGN_STORE);
  const personas = useItems(projectId, "marketing/personas").items;
  const channels = useItems(projectId, "sales/channels").items;
  const ads = useItems(projectId, "marketing/ads").items;
  const posts = useItems(projectId, "marketing/social").items;
  const c = campaign;
  const [title, setTitle] = useState(c?.title ?? "");
  const [objective, setObjective] = useState(c?.objective ?? "");
  const [channel, setChannel] = useState(c?.channel ?? "");
  const [audience, setAudience] = useState(c?.audience ? String(c.audience.itemId) : "");
  const [salesChannel, setSalesChannel] = useState(c?.salesChannel ? String(c.salesChannel.itemId) : "");
  const [total, setTotal] = useState(money.toInput(c?.budgetTotalMinor));
  const [daily, setDaily] = useState(money.toInput(c?.budgetDailyMinor));
  const [start, setStart] = useState(c?.startDate ?? "");
  const [end, setEnd] = useState(c?.endDate ?? "");
  const [creative, setCreative] = useState<Set<number>>(new Set((c?.creative ?? []).map((r) => r.itemId)));
  const [metric, setMetric] = useState<TargetMetric | "">(c?.target?.metric ?? "");
  const [targetVal, setTargetVal] = useState(c?.target ? targetText(c.target.metric, c.target.value, money) : "");
  const [stop, setStop] = useState(money.toInput(c?.rule.stopAboveMinor));
  const [scale, setScale] = useState(money.toInput(c?.rule.scaleBelowMinor));
  const [scaleBy, setScaleBy] = useState(c?.rule.scaleByPercent === undefined ? "" : String(c.rule.scaleByPercent));
  const [after, setAfter] = useState(money.toInput(c?.rule.afterSpendMinor));
  const [message, setMessage] = useState(c?.message ?? "");
  const [notes, setNotes] = useState(c?.body ?? "");
  const [status, setStatus] = useState(c?.status ?? statuses[0] ?? "planned");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const margin = useMemo(() => summary?.margins.find((m) => String(m.channelId) === salesChannel) ?? null, [summary, salesChannel]);
  const allowable = margin ? allowableCostPerOrder(margin.marginBeforeAds, plan.allowableSharePercent) : null;
  const creatives = [...ads.map((a) => ({ it: a, kind: "Ad" })), ...posts.map((p) => ({ it: p, kind: "Post" }))];
  const toggle = (id: number) => setCreative((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    setErr("");
    if (!title.trim()) return setErr("Give the campaign a name.");
    const t = money.fromInput(total);
    const d = money.fromInput(daily);
    if (Number.isNaN(t) || Number.isNaN(d)) return setErr("Budgets must be amounts such as 250 or 12.50.");
    if (start && !isDay(start)) return setErr("The start date is not a real date.");
    if (end && !isDay(end)) return setErr("The end date is not a real date.");
    if (start && end && end < start) return setErr("The end date is before the start date.");
    const data: Record<string, unknown> = {
      kind: "campaign",
      // a cleared field is sent as null or empty so the merge on the server clears it too
      objective: objective || null,
      channel: channel.trim(),
      budgetTotalMinor: t,
      budgetDailyMinor: d,
      startDate: start,
      endDate: end,
      message: message.trim(),
    };
    const pick = (list: Item[], v: string): RowRef | undefined => {
      const it = list.find((x) => String(x.id) === v);
      return it ? ref(it) : undefined;
    };
    data.audience = pick(personas, audience) ?? null;
    data.salesChannel = pick(channels, salesChannel) ?? null;
    data.creative = creatives.filter((x) => creative.has(x.it.id)).map((x) => ref(x.it));
    if (metric) {
      const v = readNumber(targetVal);
      if (v === null || Number.isNaN(v) || v < 0) return setErr("The target needs a number, zero or more.");
      const k = TARGET_INFO[metric].kind;
      const value = k === "money" ? money.fromInput(targetVal) : k === "fraction" ? v / 100 : v;
      if (value === null || Number.isNaN(value)) return setErr("The target is not a usable amount.");
      data.target = { metric, value };
    } else data.target = null;
    const rule: Record<string, number> = {};
    for (const [k, text] of [["stopAboveMinor", stop], ["scaleBelowMinor", scale], ["afterSpendMinor", after]] as const) {
      const v = money.fromInput(text);
      if (Number.isNaN(v)) return setErr("The stop and scale lines must be amounts such as 8 or 12.50.");
      if (v !== null) rule[k] = v;
    }
    const by = readNumber(scaleBy);
    if (by !== null) {
      if (Number.isNaN(by) || by < 0) return setErr("Scale by must be a percentage, zero or more.");
      rule.scaleByPercent = by;
    }
    data.rule = rule;
    setBusy(true);
    try {
      if (c) await store.patch(c.id, { title: title.trim(), body: notes, status, data });
      else await store.add({ section: CAMPAIGN_STORE, title: title.trim(), body: notes, status, data });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} wide title={c ? "Edit campaign" : "Add campaign"} description="Every number here is yours. The only figure worked out for you is the allowable cost per order, and it shows how.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Objective">
            <NativeSelect value={objective} onChange={(e) => setObjective(e.target.value)}>
              <option value="">Not set</option>
              {OBJECTIVES.map((o) => <option key={o} value={o}>{OBJECTIVE_LABEL[o]}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Where it runs" hint="For example Amazon Sponsored Products, or Meta feed."><Input value={channel} onChange={(e) => setChannel(e.target.value)} /></Field>
          <Field label="Audience persona">
            <NativeSelect value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">Not set</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Sales channel (for the margin)" hint="The campaign's allowable cost comes from this channel's margin.">
            <NativeSelect value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)}>
              <option value="">Not set</option>
              {channels.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </NativeSelect>
          </Field>
          <MoneyField label="Total budget" value={total} onChange={setTotal} currency={money.currency} />
          <MoneyField label="Daily budget" value={daily} onChange={setDaily} currency={money.currency} hint="With no total, the total is the daily budget times the days." />
          <Field label="Start date"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End date"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>

        {salesChannel && (
          <Card variant="well" className="rounded-lg p-3 text-sm" data-testid="allowable">
            <p className="font-medium text-primary">
              {allowable?.minor != null ? `Allowable cost per order: ${money.format(allowable.minor)}` : "Allowable cost per order: not worked out"}
            </p>
            <p className="mt-1 text-secondary">
              {margin ? (margin.marginBeforeAds === null ? `The margin on ${margin.title} is not worked out yet. ${margin.missing.join(" ")}` : `Margin per unit before ads on ${margin.title}: ${money.format(margin.marginBeforeAds)}. ${allowable?.how ?? ""}${allowable?.minor != null ? `: ${money.format(allowable.minor)}.` : ""}`) : "Loading the margin."}
            </p>
            {plan.allowableSharePercent === null && <p className="mt-1 text-secondary">Set the share of the margin in Marketing budget and rules to see it.</p>}
          </Card>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-secondary">Creative this campaign runs</legend>
          {creatives.length === 0 ? (
            <p className="text-sm text-secondary">There are no ads or posts yet. Add them in Ads or Social, then pick them here.</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {creatives.map(({ it, kind }) => (
                <li key={it.id}>
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input type="checkbox" checked={creative.has(it.id)} onChange={() => toggle(it.id)} className="h-4 w-4 accent-dutchOrange" />
                    <span className="truncate">{it.title}</span>
                    <span className="text-xs text-muted">{kind}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-xs font-medium text-secondary">Measure of success</legend>
          <Field label="Measure">
            <NativeSelect value={metric} onChange={(e) => setMetric(e.target.value as TargetMetric | "")}>
              <option value="">No target</option>
              {TARGET_METRICS.map((m) => <option key={m} value={m}>{TARGET_INFO[m].label} ({TARGET_INFO[m].direction === "at_most" ? "at most" : "at least"})</option>)}
            </NativeSelect>
          </Field>
          {metric && (
            <Field label={`Target${TARGET_INFO[metric].kind === "money" ? ` (${money.currency})` : TARGET_INFO[metric].kind === "fraction" ? " (%)" : ""}`}>
              <Input inputMode="decimal" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} />
            </Field>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-xs font-medium text-secondary">Stop or scale rule, as numbers (cost per order)</legend>
          <MoneyField label="Stop when cost per order is above" value={stop} onChange={setStop} currency={money.currency} />
          <MoneyField label="Scale when cost per order is below" value={scale} onChange={setScale} currency={money.currency} />
          <NumberField label="Raise the daily budget by" suffix="%" value={scaleBy} onChange={setScaleBy} />
          <MoneyField label="Judge only after this much is spent" value={after} onChange={setAfter} currency={money.currency} />
        </fieldset>

        <Field label="Message it carries (optional)"><Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {c && (
          <Field label="Status">
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
          </Field>
        )}
        {c && c.reasoning && (
          <details className="text-sm text-secondary">
            <summary className="cursor-pointer text-xs font-medium">Why it was drafted this way</summary>
            <p className="mt-1 whitespace-pre-wrap">{c.reasoning}</p>
            <ul className="mt-1 list-disc pl-5">{c.arithmetic.map((a, i) => <li key={i}><strong>{a.label}:</strong> {a.how}</li>)}</ul>
          </details>
        )}
        {err && <ErrorLine>{err}</ErrorLine>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
