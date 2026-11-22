"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useItems } from "@/lib/client";
import { analyze } from "@/lib/campaigns/analyze";
import { formatDay, isDay } from "@/lib/campaigns/days";
import { derive, percent, type ResultRow } from "@/lib/campaigns/metrics";
import { campaignsOf, planOf } from "@/lib/campaigns/read";
import { CAMPAIGN_STORE } from "@/lib/campaigns/schemas";
import type { ViewProps } from "@/components/views/types";
import { readNumber } from "./fields";
import { explain, useMoney, useRemoveResults, useResults, useSaveResults, useSummary, type Explanation } from "./hooks";
import { ImportPanel } from "./ImportPanel";
import { ResultsChart } from "./ResultsChart";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { describe, Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { todayUtc } from "@/lib/format";

const TONE = { stop: "danger", scale: "success", hold: "info", not_enough_data: "warning", no_rule: "neutral" } as const;
const WORD = { stop: "Stop", scale: "Scale", hold: "Hold", not_enough_data: "Not enough data", no_rule: "No rule" } as const;

export function ResultsView({ project }: ViewProps) {
  const store = useItems(project.id, CAMPAIGN_STORE);
  const ads = useItems(project.id, "marketing/ads").items;
  const posts = useItems(project.id, "marketing/social").items;
  const { summary, loading: sLoading, error: sError, retry: sRetry } = useSummary(project.id);
  const res = useResults(project.id);
  const money = useMoney(summary?.currency);
  const [picked, setPicked] = useState("");
  const [tab, setTab] = useState<"enter" | "import" | null>(null);
  const [msg, setMsg] = useState("");

  const campaigns = useMemo(() => campaignsOf(store.items), [store.items]);
  const plan = useMemo(() => planOf(store.items), [store.items]);
  const campaign = campaigns.find((c) => String(c.id) === picked) ?? campaigns[0] ?? null;
  const creatives = useMemo(() => {
    const ids = new Set((campaign?.creative ?? []).map((r) => r.itemId));
    return [...ads, ...posts].filter((x) => ids.has(x.id));
  }, [campaign, ads, posts]);

  const a = useMemo(() => {
    if (!campaign || !res.data || !summary) return null;
    const margin = campaign.salesChannel ? summary.margins.find((m) => m.channelId === campaign.salesChannel!.itemId)?.marginBeforeAds ?? null : null;
    return analyze({ campaign, rows: res.data.rows, linkClicks: res.data.linkClicks, plan, unitMarginBeforeAds: margin, money: money.format });
  }, [campaign, res.data, summary, plan, money]);

  if (store.loading || res.loading || sLoading) return <LoadingBlocks label="Loading campaign results" />;
  if (store.error && !store.items.length) return <LoadError what="Campaigns" message={store.error} onRetry={() => void store.reload()} />;
  if (res.error) return <LoadError what="Results" message={res.error} onRetry={res.retry} />;
  if (sError) return <LoadError what="The concept's currency" message={sError} onRetry={sRetry} />;
  if (!campaign) return <EmptyState title="No campaign to show results for">Add a campaign in <Link className="text-link underline" href="/s/marketing/campaigns">Campaigns</Link>, then come back to enter or import what it spent and got.</EmptyState>;

  const rows = (res.data?.rows ?? []).filter((r) => r.campaignId === campaign.id);
  const d = a?.derived ?? derive({ spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Campaign" className="min-w-64">
          <NativeSelect value={String(campaign.id)} onChange={(e) => { setPicked(e.target.value); setMsg(""); }}>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.status})</option>)}
          </NativeSelect>
        </Field>
        <Button id="enter-results" variant={tab === "enter" ? "primary" : "outline"} aria-pressed={tab === "enter"} onClick={() => setTab(tab === "enter" ? null : "enter")}>Enter a day</Button>
        <Button variant={tab === "import" ? "primary" : "outline"} aria-pressed={tab === "import"} onClick={() => setTab(tab === "import" ? null : "import")}>Paste or import a report</Button>
      </div>
      {msg && <p role="status" className="text-sm text-success">{msg}</p>}
      {tab === "enter" && <EntryForm projectId={project.id} campaignId={campaign.id} creatives={creatives} money={money} onDone={(m) => { setMsg(m); setTab(null); }} />}
      {tab === "import" && <Card variant="outlined" hoverEffect={false} innerClassName="p-4"><ImportPanel projectId={project.id} campaignId={campaign.id} campaignTitle={campaign.title} creatives={creatives} money={money} onDone={(m) => { setMsg(m); setTab(null); }} /></Card>}

      {a && a.empty ? (
        <EmptyState title="No results yet for this campaign">Enter a day by hand, paste a report, or open a CSV file. With results in, this page says whether the rule you set tells you to stop, hold or scale.</EmptyState>
      ) : a ? (
        <>
          <section aria-labelledby="verdict" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="verdict" className="text-sm font-semibold text-primary">Verdict, from your rule</h2>
              <StatusBadge tone={TONE[a.evaluation.verdict]}>{WORD[a.evaluation.verdict]}</StatusBadge>
            </div>
            <p className="max-w-3xl text-base text-primary" data-testid="verdict-sentence">{a.evaluation.headline}</p>
            {a.evaluation.warnings.map((w, i) => <p key={i} role="status" className="max-w-3xl text-sm text-warning">{w}</p>)}
            {a.clicks.source === "links" && <p className="text-sm text-secondary">The report has no clicks, so the {a.clicks.value} clicks counted by your tracked links are used.</p>}
            {a.target && <p className="text-sm text-secondary">Target: {a.target.text}</p>}
            <ExplainBox projectId={project.id} campaignId={campaign.id} key={campaign.id} />
          </section>

          <section aria-labelledby="figures" className="space-y-3">
            <h2 id="figures" className="text-sm font-semibold text-primary">Figures against the target</h2>
            <Table>
              <TableHeader><TableRow><TableHead>Figure</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>How it is worked out</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ["Spend", money.format(a.counts.spend), "Sum of the days entered"],
                  ["Impressions", a.counts.impressions.toLocaleString("en"), "Sum of the days entered"],
                  ["Clicks", a.counts.clicks.toLocaleString("en"), a.clicks.source === "links" ? "From your tracked links" : "Sum of the days entered"],
                  ["Orders", a.counts.orders.toLocaleString("en"), "Sum of the days entered"],
                  ["Revenue", money.format(a.counts.revenue), "Sum of the days entered"],
                  ["Click-through rate", percent(d.ctr), "Clicks / impressions"],
                  ["Cost per click", d.cpc === null ? "not worked out" : money.format(Math.round(d.cpc)), "Spend / clicks"],
                  ["Conversion rate", percent(d.cvr), "Orders / clicks"],
                  ["Cost per order", d.cpo === null ? "not worked out" : money.format(Math.round(d.cpo)), "Spend / orders"],
                  ["Return on ad spend", d.roas === null ? "not worked out" : `${Number(d.roas.toFixed(2))} to 1`, "Revenue / spend"],
                  ["Margin after ads", a.marginAfter ? money.format(a.marginAfter.amount) : "not worked out", a.marginAfter ? a.marginAfter.how : "Needs a sales channel on the campaign with a worked-out margin"],
                ].map(([k, v, how]) => (
                  <TableRow key={k}><TableCell className="font-medium">{k}</TableCell><TableCell className="text-right font-mono">{v}</TableCell><TableCell className="text-secondary">{how}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section aria-labelledby="chart" className="space-y-3">
            <h2 id="chart" className="text-sm font-semibold text-primary">Spend and orders by day</h2>
            <ResultsChart days={a.days} money={money} />
          </section>

          {a.creatives.length > 1 && (
            <section aria-labelledby="creatives" className="space-y-3">
              <h2 id="creatives" className="text-sm font-semibold text-primary">By creative</h2>
              <Table>
                <TableHeader><TableRow><TableHead>Creative</TableHead><TableHead className="text-right">Spend</TableHead><TableHead className="text-right">Clicks</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Click-through</TableHead><TableHead className="text-right">Conversion</TableHead></TableRow></TableHeader>
                <TableBody>
                  {a.creatives.map((g) => { const x = derive(g.counts); return (
                    <TableRow key={g.creativeId ?? "none"}><TableCell className="font-medium">{g.label}</TableCell><TableCell className="text-right font-mono">{money.format(g.counts.spend)}</TableCell><TableCell className="text-right font-mono">{g.counts.clicks}</TableCell><TableCell className="text-right font-mono">{g.counts.orders}</TableCell><TableCell className="text-right font-mono">{percent(x.ctr)}</TableCell><TableCell className="text-right font-mono">{percent(x.cvr)}</TableCell></TableRow>
                  ); })}
                </TableBody>
              </Table>
              {a.comparisons.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-medium text-secondary">Is the gap real? A 95% interval on the difference (Newcombe hybrid score method)</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-primary">{a.comparisons.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="rows" className="space-y-3">
            <h2 id="rows" className="text-sm font-semibold text-primary">Days entered</h2>
            <RowsTable projectId={project.id} campaignId={campaign.id} rows={rows} money={money} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function RowsTable({ projectId, campaignId, rows, money }: { projectId: string; campaignId: number; rows: ResultRow[]; money: ReturnType<typeof useMoney> }) {
  const del = useRemoveResults(projectId);
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(-14);
  return (
    <div className="space-y-2">
      {del.error && <ErrorLine>{(del.error as Error).message}</ErrorLine>}
      <Table>
        <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Creative</TableHead><TableHead className="text-right">Spend</TableHead><TableHead className="text-right">Impressions</TableHead><TableHead className="text-right">Clicks</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead>Source</TableHead><TableHead><span className="sr-only">Remove</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDay(r.day)}</TableCell><TableCell>{r.creativeId === null ? "Whole campaign" : r.creativeLabel}</TableCell>
              <TableCell className="text-right font-mono">{money.format(r.spend)}</TableCell><TableCell className="text-right font-mono">{r.impressions}</TableCell><TableCell className="text-right font-mono">{r.clicks}</TableCell><TableCell className="text-right font-mono">{r.orders}</TableCell><TableCell className="text-right font-mono">{money.format(r.revenue)}</TableCell>
              <TableCell className="text-secondary">{r.source}</TableCell>
              <TableCell><Button size="sm" variant="ghost" aria-label={`Remove ${r.day}`} disabled={del.isPending} onClick={() => del.mutate({ campaignId, ids: [r.id] })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 14 && <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Show the last 14 rows" : `Show all ${rows.length} rows`}</Button>}
    </div>
  );
}

const AMOUNT_MESSAGE = "Spend and revenue must be amounts such as 12.50.";
const COUNT_MESSAGE = "Impressions, clicks and orders must be whole numbers, zero or more.";
const isCount = (text: string) => {
  const n = readNumber(text || "0");
  return n !== null && !Number.isNaN(n) && n >= 0 && Number.isInteger(n);
};

function EntryForm({ projectId, campaignId, creatives, money, onDone }: { projectId: string; campaignId: number; creatives: { id: number; title: string }[]; money: ReturnType<typeof useMoney>; onDone: (m: string) => void }) {
  const save = useSaveResults(projectId);
  const isAmount = (text: string) => {
    const n = money.fromInput(text || "0");
    return n !== null && !Number.isNaN(n);
  };
  const entrySchema = z.object({
    day: z.string().refine(isDay, "Pick the day these numbers are for."),
    creative: z.string(),
    spend: z.string().refine(isAmount, AMOUNT_MESSAGE),
    revenue: z.string().refine(isAmount, AMOUNT_MESSAGE),
    impressions: z.string().refine(isCount, COUNT_MESSAGE),
    clicks: z.string().refine(isCount, COUNT_MESSAGE),
    orders: z.string().refine(isCount, COUNT_MESSAGE),
  });
  const { register, handleSubmit, setError, formState: { errors } } = useForm<z.infer<typeof entrySchema>>({
    resolver: zodResolver(entrySchema),
    defaultValues: { day: todayUtc(), creative: "", spend: "", impressions: "", clicks: "", orders: "", revenue: "" },
  });
  const submit = handleSubmit(async (v) => {
    try {
      const r = await save.mutateAsync({
        campaignId,
        source: "manual",
        rows: [{
          day: v.day,
          creativeId: v.creative ? Number(v.creative) : null,
          spend: money.fromInput(v.spend || "0") as number,
          revenue: money.fromInput(v.revenue || "0") as number,
          impressions: readNumber(v.impressions || "0") as number,
          clicks: readNumber(v.clicks || "0") as number,
          orders: readNumber(v.orders || "0") as number,
        }],
      });
      onDone(r.replaced ? `Replaced the numbers for ${v.day}.` : `Saved ${v.day}.`);
    } catch (e) {
      setError("root", { message: (e as Error).message });
    }
  });
  return (
    <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" noValidate onSubmit={(e) => void submit(e)}>
        <Field id="entry-day" label="Day" error={errors.day?.message}><Input id="entry-day" type="date" {...describe("entry-day", { error: errors.day?.message })} {...register("day")} /></Field>
        <Field label="Creative"><NativeSelect {...register("creative")}><option value="">Whole campaign</option>{creatives.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</NativeSelect></Field>
        <Field id="entry-spend" label={`Spend (${money.currency})`} error={errors.spend?.message}><MoneyInput id="entry-spend" currency={money.currency} {...describe("entry-spend", { error: errors.spend?.message })} {...register("spend")} /></Field>
        <Field id="entry-revenue" label={`Revenue (${money.currency})`} error={errors.revenue?.message}><MoneyInput id="entry-revenue" currency={money.currency} {...describe("entry-revenue", { error: errors.revenue?.message })} {...register("revenue")} /></Field>
        <Field id="entry-impressions" label="Impressions" error={errors.impressions?.message}><Input id="entry-impressions" inputMode="numeric" {...describe("entry-impressions", { error: errors.impressions?.message })} {...register("impressions")} /></Field>
        <Field id="entry-clicks" label="Clicks" error={errors.clicks?.message}><Input id="entry-clicks" inputMode="numeric" {...describe("entry-clicks", { error: errors.clicks?.message })} {...register("clicks")} /></Field>
        <Field id="entry-orders" label="Orders" error={errors.orders?.message}><Input id="entry-orders" inputMode="numeric" {...describe("entry-orders", { error: errors.orders?.message })} {...register("orders")} /></Field>
        <div className="flex items-end"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving" : "Save this day"}</Button></div>
      </form>
      <p className="text-xs text-muted">Entering a day that already has numbers for the same creative replaces them.</p>
      {errors.root?.message && <ErrorLine>{errors.root.message}</ErrorLine>}
    </Card>
  );
}

/** The model's explanation, on request. The verdict above is the rule's; this text is labelled as the model's and is never saved. */
function ExplainBox({ projectId, campaignId }: { projectId: string; campaignId: number }) {
  const [state, setState] = useState<{ busy: boolean; err: string; out: Explanation | null }>({ busy: false, err: "", out: null });
  const go = async () => {
    setState({ busy: true, err: "", out: null });
    try {
      setState({ busy: false, err: "", out: await explain(projectId, campaignId) });
    } catch (e) {
      setState({ busy: false, err: (e as Error).message, out: null });
    }
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => void go()} disabled={state.busy} aria-busy={state.busy}><Sparkles className="h-3.5 w-3.5" aria-hidden /> {state.busy ? "Asking the model" : "Explain this with the model"}</Button>
      {state.err && <ErrorLine>{state.err} <Link className="underline" href="/admin?tab=models">Open Admin, Models</Link>.</ErrorLine>}
      {state.out && (
        <Card variant="well" className="rounded-lg max-w-3xl p-3 text-sm" data-testid="explanation">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Written by the model ({state.out.model}). The verdict is the rule&apos;s, not the model&apos;s.</p>
          <p className="mt-1 text-primary">{state.out.modelText.explanation}</p>
          <p className="mt-1 text-secondary">To consider: {state.out.modelText.suggestion}</p>
        </Card>
      )}
    </div>
  );
}
