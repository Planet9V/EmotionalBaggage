"use client";

// Sales, Sales monitor (plan 8.17): Amazon orders read through SP-API on "Sync now", rows typed by hand,
// and one chart of units or revenue by day and channel, with the same numbers as a table.
import { MoneyInput } from "@/components/ui/money-input";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, parseAmount } from "@/components/parts/bom";
import { NotConnected, NotRealNote } from "@/components/channels/shared";
import { useItems } from "@/lib/client";
import { useChannelActions, useChannelStatus } from "@/lib/channels/client";
import { byDayAndChannel, toSaleRow } from "@/lib/channels/salesByDay";
import { messageOf } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { ViewProps } from "./types";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/Card";
import { fmtDateTime, todayLocal } from "@/lib/format";

const COLOURS = ["var(--color-dutchOrange-500)", "var(--color-charcoal-400)", "var(--color-info)", "var(--color-success)", "var(--color-warning)", "var(--color-dutchOrange-200)"];
const DAY_MS = 86_400_000;

function AmazonPanel({ projectId }: { projectId: string }) {
  const status = useChannelStatus(projectId);
  const { setMarketplace, sync } = useChannelActions(projectId);
  const [error, setError] = useState("");
  const a = status.data?.amazon;
  // The query's own fetch time stands in for "now", so render stays pure.
  const stale = a?.lastSyncAt ? status.dataUpdatedAt - new Date(a.lastSyncAt).getTime() > DAY_MS : false;
  return (
    <Card variant="flat" as="section" aria-labelledby="amz-h" className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="amz-h" className="text-base font-semibold tracking-tight text-primary">Amazon Seller Central</h2>
        {a ? <StatusBadge tone={a.configured ? "success" : "neutral"}>{a.configured ? "Credentials saved" : "Not connected"}</StatusBadge> : null}
      </div>
      {status.isPending ? (
        <LoadingBlocks rows={1} label="Checking the Amazon connection" />
      ) : status.isError ? (
        <LoadError what="The Amazon connection" message={messageOf(status.error)} onRetry={() => void status.refetch()} />
      ) : a ? (
        <div className="space-y-3 text-sm">
          {!a.configured ? <NotConnected service="Amazon" what="no orders are read" /> : null}
          <p className="text-secondary">
            Reads orders and Amazon&apos;s daily totals for one marketplace, read only, when you press Sync now. It needs a Professional selling account and a private SP-API app with the Inventory and Order Tracking role. Nothing about buyers is asked for or kept: each order is stored as its order id, date, items, quantities, amounts and marketplace.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Marketplace" className="w-72">
              <NativeSelect
                value={a.marketplaceId ?? ""}
                disabled={setMarketplace.isPending}
                onChange={(e) => {
                  setError("");
                  if (e.target.value) setMarketplace.mutate(e.target.value, { onError: (x) => setError(messageOf(x)) });
                }}
              >
                <option value="">Choose a marketplace</option>
                {a.marketplaces.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </NativeSelect>
            </Field>
            <Button
              disabled={!a.configured || !a.marketplaceId || sync.isPending}
              onClick={() => {
                setError("");
                sync.mutate(undefined, { onError: (x) => setError(messageOf(x)) });
              }}
            >
              <RefreshCw className={`h-4 w-4 ${sync.isPending ? "motion-safe:animate-spin" : ""}`} aria-hidden /> {sync.isPending ? "Syncing" : "Sync now"}
            </Button>
            <p className="text-xs text-muted">
              {a.lastSyncAt ? `Last synced ${fmtDateTime(a.lastSyncAt)}.` : "Never synced."}
              {stale ? " That is more than a day ago." : ""} There is no automatic sync.
            </p>
          </div>
          {sync.data ? <p role="status" className="text-success">{sync.data.message}</p> : a.lastResult ? <p className={a.lastResult.ok ? "text-secondary" : "text-danger"}>{a.lastResult.message}</p> : null}
          {error ? <ErrorLine>{error}</ErrorLine> : null}
          {a.metrics.length ? (
            <details className="rounded-md border border-hairline">
              <summary className="cursor-pointer px-3 py-2 text-xs text-secondary">Amazon&apos;s own daily totals (Sales API), to compare with the imported orders</summary>
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Day (UTC)</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...a.metrics].reverse().filter((m) => m.orders || m.units).map((m) => (
                    <TableRow key={m.day}><TableCell className="font-mono text-xs">{m.day}</TableCell><TableCell className="text-right font-mono text-xs">{m.orders}</TableCell><TableCell className="text-right font-mono text-xs">{m.units}</TableCell><TableCell className="text-right font-mono text-xs">{money(m.sales, m.currency)} {m.currency}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </details>
          ) : null}
          <NotRealNote service="The Amazon connection" />
        </div>
      ) : null}
    </Card>
  );
}

function SalesChart({ items }: { items: Item[] }) {
  const [metric, setMetric] = useState<"units" | "revenue">("units");
  const [showTable, setShowTable] = useState(false);
  const agg = useMemo(() => byDayAndChannel(items.map((i) => toSaleRow(i.data))), [items]);
  if (!agg.days.length) return null;
  const key = (c: string) => `c${agg.channels.indexOf(c)}`;
  const config = Object.fromEntries(agg.channels.map((c, k) => [key(c), { label: c, color: COLOURS[k % COLOURS.length] }])) satisfies ChartConfig;
  const data = agg.days.map((day) => {
    const row: Record<string, string | number> = { day };
    for (const c of agg.cells.filter((x) => x.day === day)) row[key(c.channel)] = c[metric];
    return row;
  });
  const mixed = Object.entries(agg.currencies).filter(([, v]) => v.length > 1).map(([k]) => k);
  return (
    <figure className="space-y-3 rounded-xl border border-hairline bg-surface p-5">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="block text-base font-semibold tracking-tight text-primary">{metric === "units" ? "Units" : "Revenue"} by day and channel</span>
          <span className="text-xs text-secondary">Sums of the rows below, {agg.days[0]} to {agg.days[agg.days.length - 1]}. Revenue is in each channel&apos;s own currency; nothing is converted.</span>
        </span>
        <span className="flex gap-2">
          <NativeSelect aria-label="What the chart shows" value={metric} onChange={(e) => setMetric(e.target.value as "units" | "revenue")} className="h-8 w-32 text-xs"><option value="units">Units</option><option value="revenue">Revenue</option></NativeSelect>
          <Button size="sm" variant="outline" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>{showTable ? "Show the chart" : "Show as a table"}</Button>
        </span>
      </figcaption>
      {mixed.length ? <p className="text-xs text-warning">{mixed.join(", ")} {mixed.length === 1 ? "has" : "have"} rows in more than one currency, so revenue for {mixed.length === 1 ? "it" : "them"} adds unlike amounts.</p> : null}
      {!showTable ? (
        <div aria-hidden="true">
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={56} allowDecimals={metric === "revenue"} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {agg.channels.map((c) => <Bar key={c} dataKey={key(c)} stackId="a" fill={`var(--color-${key(c)})`} isAnimationActive={false} />)}
            </BarChart>
          </ChartContainer>
        </div>
      ) : null}
      <div className={showTable ? undefined : "sr-only"}>
        <Table scroll={showTable}>
          <caption className="sr-only">Units and revenue by day and channel</caption>
          <TableHeader><TableRow className="hover:bg-transparent"><TableHead scope="col">Day</TableHead><TableHead scope="col">Channel</TableHead><TableHead scope="col" className="text-right">Rows</TableHead><TableHead scope="col" className="text-right">Units</TableHead><TableHead scope="col" className="text-right">Revenue</TableHead></TableRow></TableHeader>
          <TableBody>
            {[...agg.cells].reverse().map((c) => (
              <TableRow key={`${c.day}-${c.channel}`}><TableCell className="font-mono text-xs">{c.day}</TableCell><TableCell>{c.channel}</TableCell><TableCell className="text-right font-mono text-xs">{c.rows}</TableCell><TableCell className="text-right font-mono text-xs">{c.units}</TableCell><TableCell className="text-right font-mono text-xs">{money(c.revenue, agg.currencies[c.channel]?.length === 1 ? agg.currencies[c.channel][0] : undefined)}{agg.currencies[c.channel]?.length === 1 ? ` ${agg.currencies[c.channel][0]}` : ""}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </figure>
  );
}

export function MonitorView({ project, store }: ViewProps) {
  const { items, loading, error, add, remove, reload } = useItems(project.id, store);
  const [del, setDel] = useState<Item | null>(null);
  const [actionError, setActionError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => [...items].sort((a, b) => String(b.data.date ?? "").localeCompare(String(a.data.date ?? "")) || b.id - a.id), [items]);
  const channels = [...new Set(items.map((i) => (typeof i.data.channel === "string" ? i.data.channel.trim() : "")).filter(Boolean))];
  const visible = showAll ? rows : rows.slice(0, 50);

  return (
    <div className="animate-enter space-y-6">
      <AmazonPanel projectId={project.id} />
      {loading ? <LoadingBlocks rows={1} label="Loading the sales chart" /> : <SalesChart items={items} />}
      <section aria-labelledby="log-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="log-h" className="text-base font-semibold tracking-tight text-primary">Sales rows</h2>
            <p className="text-sm text-secondary">Amazon orders from Sync now, one row per order, and rows you type in for other channels.</p>
          </div>
          <AddSale channels={channels} onCreate={(v) => add({ section: store, title: `${v.date} ${v.channel}`, data: { ...v, source: "hand" } }).then(() => undefined)} />
        </div>
        {error ? <LoadError what="The sales rows" message={error} onRetry={() => reload()} /> : null}
        {actionError ? <ErrorLine>{actionError}</ErrorLine> : null}
        {loading ? (
          <LoadingBlocks rows={2} label="Loading the sales rows" />
        ) : !rows.length ? (
          <EmptyState title="No sales yet">Press Sync now once Amazon is connected, or add a row for each day and channel you track.</EmptyState>
        ) : (
          <Card variant="flat" className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent"><TableHead>Date</TableHead><TableHead>Channel</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="w-10"><span className="sr-only">Delete</span></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((s) => {
                  const r = toSaleRow(s.data);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-primary">{r.date}</TableCell>
                      <TableCell className="text-primary">{r.channel}</TableCell>
                      <TableCell className="font-mono text-xs text-secondary">{typeof s.data.orderId === "string" ? `${s.data.orderId}${s.data.orderStatus ? ` (${String(s.data.orderStatus).toLowerCase()})` : ""}` : "typed in"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.units}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(r.revenue, r.currency)}{r.currency ? ` ${r.currency}` : ""}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete the ${r.channel} row for ${r.date}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4" aria-hidden /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length > 50 ? <div className="border-t border-hairline p-2 text-center"><Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show the latest 50" : `Show all ${rows.length} rows`}</Button></div> : null}
          </Card>
        )}
      </section>

      <Modal open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this row?" description="It is removed from the rows and the chart. An Amazon order comes back on the next sync if Amazon still reports it as updated since then.">
        <p className="font-mono text-sm text-primary">{del ? `${String(del.data.date ?? "")}, ${String(del.data.channel ?? "")}, ${String(del.data.units ?? "")} units` : null}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDel(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!del) return;
            try { setActionError(""); await remove(del.id); } catch (e) { setActionError((e as Error).message); }
            setDel(null);
          }}>Delete row</Button>
        </div>
      </Modal>
    </div>
  );
}

function AddSale({ channels, onCreate }: { channels: string[]; onCreate: (v: { date: string; channel: string; units: number; revenue: number }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: todayLocal(), channel: "", units: "", revenue: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const units = parseAmount(f.units);
    const revenue = parseAmount(f.revenue);
    if (!f.date) return setErr("Pick a date.");
    if (!f.channel.trim()) return setErr("Name the channel.");
    if (units === null || !Number.isInteger(units)) return setErr("Units must be a whole number.");
    if (revenue === null) return setErr("Revenue must be a number.");
    setBusy(true);
    try {
      await onCreate({ date: f.date, channel: f.channel.trim(), units, revenue });
      setF({ date: f.date, channel: f.channel, units: "", revenue: "" });
      setErr("");
      setOpen(false);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add row</Button>
      <Modal open={open} onOpenChange={setOpen} title="Add a sales row" description="Entered by hand. Revenue is in whatever currency you use for this channel.">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
            <Field label="Channel">
              <Input value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} list="sales-channels" required autoFocus />
              <datalist id="sales-channels">{channels.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Units"><Input value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} inputMode="numeric" className="font-mono" required /></Field>
            <Field label="Revenue"><MoneyInput value={f.revenue} onChange={(e) => setF({ ...f, revenue: e.target.value })} placeholder="0.00" required /></Field>
          </div>
          {err ? <ErrorLine>{err}</ErrorLine> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Adding" : "Add row"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
