"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { RowActions } from "@/components/drafts/RowActions";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineEdit } from "@/components/parts/InlineEdit";
import { saveOrMessage, useItems } from "@/lib/client";
import { competitorRange, costPlusPrice, margin, position, pricingUnitCost, type Competitor } from "@/lib/market/pricing";
import { useEconomicsRows, useProductionSettings } from "@/lib/economics/client";
import { NO_FEES, channelTakeRates, referenceUnitCost, type ChannelCosts } from "@/lib/economics/compute";
import { formatMoney, parseMinor, toInputText, toMinor } from "@/lib/economics/money";
import { readChannel, readEconomics } from "@/lib/economics/read";
import { pricingData } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { PriceStrip, type StripPoint } from "./PriceStrip";
import { Status } from "./shared";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";

type PriceRow = { item: Item; priceMinor: number; approach: string; note: string; currency: string };
type ChannelCol = ChannelCosts & { id: number | null; name: string };

export function PricingView({ project, store }: ViewProps) {
  const pricing = useItems(project.id, store);
  const settings = useProductionSettings(project.id);
  const econ = useEconomicsRows(project.id);
  const parts = { items: econ.rows.parts };
  const comps = useItems(project.id, "marketing/competitors");
  const { items, add, patch, remove } = pricing;
  const [err, setErr] = useState("");

  const parsed = useMemo(() => items.map((it) => ({ it, d: (() => { const r = pricingData.safeParse(it.data); return r.success ? r.data : {}; })() })), [items]);
  const assumptions = parsed.find((p) => p.d.kind === "assumptions");
  // One currency per concept, set on Unit economics (projects.currency). Pricing has no setting of its own.
  const currency = settings.currency;
  const allPrices: PriceRow[] = parsed.filter((p) => p.d.kind === "price").map((p) => ({ item: p.it, priceMinor: p.d.priceMinor ?? 0, approach: p.d.approach ?? "own", note: p.d.note ?? "", currency: (p.d.currency || currency).toUpperCase() }));
  // A price saved before the concept's currency changed is in the old currency: it is listed, not compared.
  const prices = allPrices.filter((p) => p.currency === currency);
  const otherPrices = allPrices.filter((p) => p.currency !== currency);
  // Channels and their fees are the Sales channels' (unit economics); Pricing only reads them.
  const channelRows: ChannelCol[] = econ.rows.channels.map(readChannel).map((c) => ({ ...c, id: c.id, name: c.title }));
  const cols: ChannelCol[] = channelRows.length ? channelRows : [{ ...NO_FEES, id: null, name: "No channel fee" }];

  const econUnit = useMemo(() => referenceUnitCost(readEconomics(econ.rows, currency)), [econ.rows, currency]);
  const unit = pricingUnitCost(econUnit);
  const competitors: (Competitor & { id: number })[] = comps.items.flatMap((c) => {
      const d = c.data as { priceMinor?: unknown; currency?: unknown; basis?: unknown; sourceUrl?: unknown };
      if (typeof d.priceMinor !== "number" || typeof d.currency !== "string") return [];
      const sourced = d.basis === "typed" || (d.basis === "research" && !!d.sourceUrl);
      return [{ id: c.id, name: c.title, priceMinor: d.priceMinor, currency: d.currency, sourced }];
    });
  const sameCurrency = competitors.filter((c) => c.currency.toUpperCase() === currency);
  const range = competitorRange(sameCurrency.filter((c) => c.sourced), currency);
  const otherCurrency = competitors.length - sameCurrency.length;

  if (pricing.loading || econ.loading || settings.loading || comps.loading) return <LoadingBlocks label="Loading pricing" />;
  if (pricing.error && !items.length) return <LoadError what="Pricing" message={pricing.error} onRetry={() => void pricing.reload()} />;

  const guard = async (p: Promise<unknown>) => {
    setErr("");
    try { await p; } catch (e) { setErr((e as Error).message); }
  };
  const setAssumption = (data: Record<string, unknown>) =>
    assumptions ? guard(patch(assumptions.it.id, { data })) : guard(add({ section: store, title: "Pricing assumptions", data: { kind: "assumptions", ...data }, status: "draft" }));
  const addPrice = (priceMinor: number, approach: PriceRow["approach"], note: string) =>
    guard(add({ section: store, title: `${formatMoney(priceMinor, currency)}${note ? ` (${note})` : ""}`, data: { kind: "price", priceMinor, currency, approach, note }, status: "draft" }));

  const points: StripPoint[] = [
    ...sameCurrency.map((c) => ({ id: `c${c.id}`, label: c.name, minor: c.priceMinor, kind: (c.sourced ? "competitor" : "unsourced") as StripPoint["kind"] })),
    ...prices.map((p) => ({ id: `p${p.item.id}`, label: formatMoney(p.priceMinor, currency), minor: p.priceMinor, kind: "candidate" as const })),
  ];

  const target = assumptions?.d.targetMarginPercent ?? null;

  return (
    <div className="space-y-6">
      {err && <ErrorLine>{err}</ErrorLine>}

      <section aria-labelledby="unit-cost" className="space-y-2">
        <h2 id="unit-cost" className="text-sm font-semibold text-primary">What one unit costs</h2>
        <Card variant="outlined" hoverEffect={false} innerClassName="space-y-2 p-4">
          {parts.items.length === 0 ? (
            <p className="text-sm text-secondary">There is no parts list yet, so no unit cost. <Link className="text-link underline" href="/s/design/bom">Add parts and their costs</Link>. Margins below are shown against a cost of zero until then.</p>
          ) : (
            <>
              <p className="text-sm text-primary">
                Unit cost at {unit.batchSize ?? 1} unit{unit.batchSize === 1 ? "" : "s"}: <span className="font-mono font-medium">{formatMoney(unit.minor, currency)}</span>
                {!unit.known && <StatusBadge tone="warning" className="ml-2">incomplete</StatusBadge>}
              </p>
              {unit.missing.length > 0 && (
                <p className="text-sm text-warning">
                  {unit.missing.length} cost line{unit.missing.length === 1 ? " is" : "s are"} not priced and left out of the total: {unit.missing.slice(0, 8).join(", ")}{unit.missing.length > 8 ? ` and ${unit.missing.length - 8} more` : ""}. Every margin below is marked until that is fixed.
                </p>
              )}
            </>
          )}
          <p className="text-xs text-muted">From <Link className="text-link underline" href="/s/production/economics">Unit economics</Link>: parts with their price breaks, plus labour, packaging, print and other cost lines, at the first planned batch size (1 when none is planned). Every amount is in {currency}, the concept&apos;s currency, which is set on Unit economics.</p>
          {econ.error && <ErrorLine>The unit cost could not be loaded: {econ.error}</ErrorLine>}
        </Card>
      </section>

      <section aria-labelledby="channels" className="space-y-2">
        <h2 id="channels" className="text-sm font-semibold text-primary">Channels and what each takes</h2>
        <p className="text-sm text-secondary">The channels and their fees are the ones on <Link className="text-link underline" href="/s/sales/channels">Sales channels</Link>: the platform fee and the payment fee, each a percent of the price plus a fixed amount per unit, then fulfilment, a returns allowance and advertising per order. Change one there and every margin here follows; a margin here is the margin Unit economics shows for the same price.</p>
        <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
          {channelRows.length > 0 ? (
            <Table aria-label="Channels">
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Platform fee</TableHead><TableHead>Payment fee</TableHead><TableHead>Fulfilment</TableHead><TableHead>Returns</TableHead><TableHead>Advertising</TableHead></TableRow></TableHeader>
              <TableBody>
                {channelRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="font-mono text-sm">{feeText(c.platformPercent, c.platformFixed, currency)}</TableCell>
                    <TableCell className="font-mono text-sm">{feeText(c.paymentPercent, c.paymentFixed, currency)}</TableCell>
                    <TableCell className="font-mono text-sm">{feeText(null, c.fulfilment, currency)}</TableCell>
                    <TableCell className="font-mono text-sm">{c.returnsPercent === null ? "not entered" : `${c.returnsPercent}%`}</TableCell>
                    <TableCell className="font-mono text-sm">{feeText(null, c.adCost, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted">No sales channels yet. Margins are shown with no channel fee until you add one on <Link className="text-link underline" href="/s/sales/channels">Sales channels</Link>.</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="approaches" className="space-y-2">
        <h2 id="approaches" className="text-sm font-semibold text-primary">Three ways to set a price</h2>
        <p className="text-sm text-secondary">Each one works a price out from numbers you gave. Adding one makes it a candidate you can compare below.</p>
        <div className="space-y-3">
          <Card variant="outlined" hoverEffect={false} innerClassName="space-y-2 p-4">
            <h3 className="text-sm font-medium text-primary">1. Cost plus</h3>
            <p className="text-xs text-muted">The price that leaves your target margin, as a share of the price, after everything the channel takes.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div><span className="mb-1 block text-xs font-medium text-secondary">Target margin, percent (click to change)</span><InlineEdit label="Target margin" mono placeholder="Set a target" value={target === null ? "" : String(target)} onSave={(v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n < 100 ? saveOrMessage(Promise.resolve(setAssumption({ targetMarginPercent: n }))) : "Enter a percent from 0 to 99."; }} /></div>
            </div>
            {target !== null && unit.minor === 0 ? <p className="text-sm text-secondary">There is no unit cost yet, so there is nothing to add a margin to.</p> : null}
            {target !== null && unit.minor > 0 && (
              <ul className="space-y-1.5">
                {cols.map((c) => {
                  const price = costPlusPrice(unit, target, c);
                  return (
                    <li key={c.name} className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="w-48 text-secondary">{c.name}</span>
                      {price === null ? <span className="text-warning">Fees and target add to 100 percent or more: no price works.</span> : (
                        <>
                          <span className="font-mono text-primary">{formatMoney(price, currency)}</span>
                          <Button size="xs" variant="outline" onClick={() => void addPrice(price, "cost-plus", `cost plus ${target}%, ${c.name}`)}><Plus className="h-3 w-3" aria-hidden /> Add as candidate</Button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card variant="outlined" hoverEffect={false} innerClassName="space-y-2 p-4">
            <h3 className="text-sm font-medium text-primary">2. Competitor based</h3>
            <p className="text-xs text-muted">From competitor prices that carry a source or that you typed, in {currency}. Unsourced prices are left out.</p>
            {range ? (
              <ul className="space-y-1.5">
                {([["Lowest", range.low], ["Middle", range.median], ["Highest", range.high]] as const).map(([l, v]) => (
                  <li key={l} className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="w-48 text-secondary">{l} of {range.count}</span>
                    <span className="font-mono text-primary">{formatMoney(v, currency)}</span>
                    <Button size="xs" variant="outline" onClick={() => void addPrice(v, "competitor", `${l.toLowerCase()} competitor price`)}><Plus className="h-3 w-3" aria-hidden /> Add as candidate</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-secondary">No sourced competitor price in {currency} yet. <Link className="text-link underline" href="/s/marketing/competitors">Research or add competitors</Link>.</p>
            )}
            {otherCurrency > 0 && <p className="text-xs text-muted">{otherCurrency} competitor price{otherCurrency === 1 ? " is" : "s are"} in another currency and not compared.</p>}
          </Card>

          <Card variant="outlined" hoverEffect={false} innerClassName="space-y-2 p-4">
            <h3 className="text-sm font-medium text-primary">3. Value based</h3>
            <p className="text-xs text-muted">What the product is worth to the buyer, in your own figure. The app does not estimate it.</p>
            <ValueForm
              currency={currency}
              valueMinor={assumptions?.d.valueMinor ?? null}
              note={assumptions?.d.valueNote ?? ""}
              onSave={(minor, note) => setAssumption({ valueMinor: minor, valueNote: note })}
              onAdd={(minor) => addPrice(minor, "value", "value based")}
            />
          </Card>
        </div>
      </section>

      <section aria-labelledby="candidates" className="space-y-2">
        <h2 id="candidates" className="text-sm font-semibold text-primary">Candidate prices and the margin on each</h2>
        <PriceForm currency={currency} onAdd={(minor) => addPrice(minor, "own", "")} />
        {!prices.length ? (
          <EmptyState title="No candidate prices yet">Add a price you are considering, or add one from the three ways above. Margins are worked out here, never typed.</EmptyState>
        ) : (
          <Card variant="outlined" hoverEffect={false} innerClassName="p-0">
            <Table aria-label="Margin per unit for each candidate price in each channel">
              <TableHeader>
                <TableRow>
                  <TableHead>Price</TableHead>
                  {cols.map((c) => { const f = channelTakeRates(c, currency); return <TableHead key={c.id ?? c.name}>{c.name}<span className="block text-[10px] font-normal text-muted">{f.percent}%{f.fixedMinor ? ` + ${formatMoney(f.fixedMinor, currency)}` : ""} per sale</span></TableHead>; })}
                  <TableHead>Against competitors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...prices].sort((a, b) => a.priceMinor - b.priceMinor).map((p) => (
                  <TableRow key={p.item.id}>
                    <TableCell className="whitespace-nowrap">
                      <InlineEdit label="Price" mono value={toInputText(p.priceMinor, currency)} onSave={(v) => { const m = parseMinor(v, currency); return m === null || m === 0 ? "Enter a price above zero." : saveOrMessage(patch(p.item.id, { title: `${formatMoney(m, currency)}${p.note ? ` (${p.note})` : ""}`, data: { priceMinor: m } })); }} />
                      <span className="block text-[11px] text-muted">{p.approach === "own" ? "your own" : p.approach.replace("-", " ")}</span>
                      <RowActions item={p.item} label={`the price ${formatMoney(p.priceMinor, currency)}`} />
                    </TableCell>
                    {cols.map((c) => {
                      const m = margin(p.priceMinor, unit, c);
                      const neg = m.marginMinor < 0;
                      return (
                        <TableCell key={c.id ?? c.name} className="whitespace-nowrap">
                          <span className={`font-mono ${neg ? "text-danger" : "text-primary"}`}>{formatMoney(m.marginMinor, currency)}</span>
                          <span className="ml-1.5 font-mono text-xs text-secondary">{m.marginPercent === null ? "" : `${m.marginPercent.toFixed(1)}%`}</span>
                          {neg && <span className="ml-1.5 text-xs text-danger">loss</span>}
                          {m.partial && <span className="ml-1 text-xs text-warning" title="The unit cost is incomplete">*</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-sm text-secondary">{position(p.priceMinor, range)}</TableCell>
                    <TableCell><Status status={p.item.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant={p.item.status === "approved" ? "outline" : "primary"} onClick={() => void guard(patch(p.item.id, { status: p.item.status === "approved" ? "draft" : "approved" }))}>{p.item.status === "approved" ? "Back to draft" : "Approve"}</Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${formatMoney(p.priceMinor, currency)}`} onClick={() => void guard(remove(p.item.id))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!unit.known && <p className="border-t border-hairline px-4 py-2 text-xs text-warning">* The unit cost is incomplete, so these margins are higher than they will be.</p>}
            {otherPrices.length > 0 && <p className="border-t border-hairline px-4 py-2 text-xs text-muted">{otherPrices.length} candidate price{otherPrices.length === 1 ? " was" : "s were"} saved in another currency ({[...new Set(otherPrices.map((p) => p.currency))].join(", ")}) and {otherPrices.length === 1 ? "is" : "are"} not compared. Nothing is converted.</p>}
          </Card>
        )}
      </section>

      <section aria-labelledby="strip" className="space-y-2">
        <h2 id="strip" className="text-sm font-semibold text-primary">Where the prices sit</h2>
        <PriceStrip points={points} unitCostMinor={unit.minor > 0 ? unit.minor : null} currency={currency} />
      </section>
    </div>
  );
}

const feeText = (percent: number | null, fixed: number | null, currency: string) =>
  percent === null && fixed === null ? "not entered" : percent === null ? formatMoney(toMinor(fixed ?? 0, currency), currency) : `${percent}%${fixed ? ` + ${formatMoney(toMinor(fixed, currency), currency)}` : ""}`;

function PriceForm({ currency, onAdd }: { currency: string; onAdd: (minor: number) => Promise<unknown> }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const go = async () => {
    const m = parseMinor(v, currency);
    if (m === null || m === 0) return setErr("Enter a price above zero, such as 24.95.");
    setErr("");
    await onAdd(m);
    setV("");
  };
  return (
    <form id="add-price" className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void go(); }}>
      <Field label={`A price to consider (${currency})`} className="w-56"><MoneyInput currency={currency} value={v} onChange={(e) => setV(e.target.value)} placeholder="24.95" /></Field>
      <Button type="submit"><Plus className="h-4 w-4" aria-hidden /> Add price</Button>
      {err && <p role="alert" className="w-full text-sm text-danger">{err}</p>}
    </form>
  );
}

function ValueForm({ currency, valueMinor, note, onSave, onAdd }: { currency: string; valueMinor: number | null; note: string; onSave: (minor: number, note: string) => Promise<unknown>; onAdd: (minor: number) => Promise<unknown> }) {
  const [v, setV] = useState(valueMinor === null ? "" : toInputText(valueMinor, currency));
  const [n, setN] = useState(note);
  const [err, setErr] = useState("");
  const parsed = parseMinor(v, currency);
  const save = async () => {
    if (parsed === null || parsed === 0) return setErr("Enter your figure above zero.");
    setErr("");
    await onSave(parsed, n);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={`Worth to the buyer (${currency})`} className="w-56"><Input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} /></Field>
        <Field label="Where the figure comes from" className="min-w-64 flex-1"><Input value={n} onChange={(e) => setN(e.target.value)} placeholder="For example: what they pay today for the workaround" /></Field>
        <Button variant="outline" onClick={() => void save()}>Save figure</Button>
        <Button variant="outline" disabled={parsed === null || parsed === 0} onClick={() => parsed && void onAdd(parsed)}><Plus className="h-4 w-4" aria-hidden /> Add as candidate</Button>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
    </div>
  );
}
