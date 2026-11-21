"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { useState } from "react";
import { ExternalLink, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Part } from "@/lib/domain";
import { statusTone } from "@/lib/statusTones";
import { searchLinks, searchTerm } from "@/lib/sourcing/links";
import { pieceUnitPrice } from "@/lib/sourcing/list";
import { newId, ORDER_STATUSES, orderSchema, readSourcing, type Draft, type Offer, type Sourcing } from "@/lib/sourcing/schemas";
import type { Kind } from "@/lib/sourcing/research";
import { OfferForm } from "./OfferForm";
import { ResearchDrafts } from "./ResearchDrafts";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";

export type Change = { status?: string; data?: Record<string, unknown> };

/** The part's own status follows the order: it is what the bill of materials and the old cart read. */
const STATUS_FOR_ORDER: Record<string, string> = { "to order": "to buy", ordered: "ordered", shipped: "ordered", short: "ordered", received: "in hand" };

export function PartCard({ part, currency, onSave, onResearch }: {
  part: Part;
  currency: string;
  onSave: (c: Change) => Promise<unknown>;
  onResearch: (kind: Kind) => void;
}) {
  const s = readSourcing(part.item.data);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const chosen = s.offers.find((o) => o.id === s.chosen) ?? null;
  const term = searchTerm({ title: part.item.title, search: part.search, partNumber: chosen?.partNumber });
  const own = part.source.trim().toLowerCase() === "own" || part.item.status === "to print";

  const save = async (next: Sourcing, extra: Change = {}) => {
    setErr("");
    try { await onSave({ ...extra, data: { ...(extra.data ?? {}), sourcing: next } }); } catch (e) { setErr((e as Error).message); }
  };
  const choose = (o: Offer | null) => save({ ...s, chosen: o?.id }, o ? { data: { unit: pieceUnitPrice(o), supplier: o.supplier } } : {});
  const removeOffer = (id: string) => save({ ...s, offers: s.offers.filter((o) => o.id !== id), chosen: s.chosen === id ? undefined : s.chosen });
  const accept = (d: Draft) => {
    const rest = { ...s, drafts: s.drafts.filter((x) => x.id !== d.id) };
    if (d.offer) return save({ ...rest, offers: [...rest.offers, { ...d.offer, id: newId("o"), source: "research", citation: d.citation }] });
    if (d.alternate) return save({ ...rest, alternates: [...rest.alternates, { ...d.alternate, id: newId("a"), source: "research", citation: d.citation }] });
  };
  const reject = (d: Draft) => save({ ...s, drafts: s.drafts.filter((x) => x.id !== d.id) });

  return (
    <Card variant="flat" as="li" aria-label={part.item.title}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">
            {part.ref ? <span className="mr-2 font-mono text-xs text-muted">{part.ref}</span> : null}{part.item.title}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            qty {part.qty ?? "not set"} · {chosen ? `${chosen.supplier}, ${chosen.price.toFixed(2)} ${currency} per ${chosen.packSize} (${pieceUnitPrice(chosen)} each)` : own ? "printed in house" : s.offers.length ? "no supplier chosen" : "no offers yet"}
            {s.drafts.length ? ` · ${s.drafts.length} draft${s.drafts.length === 1 ? "" : "s"} to review` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={statusTone(s.order?.status ?? part.item.status)}>{s.order?.status ?? part.item.status}</StatusBadge>
          <RowActions item={part.item} />
          <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Open"}<span className="sr-only"> {part.item.title}</span></Button>
        </div>
      </div>

      {open && (
        <div className="space-y-5 border-t border-hairline px-4 py-4">
          {err ? <ErrorLine>{err}</ErrorLine> : null}

          <section aria-label="Search the distributors" className="space-y-1.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Search for <span className="normal-case tracking-normal text-secondary">{term}</span></h3>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              {searchLinks(term).map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" title={l.for} className="inline-flex items-center gap-1 text-sm text-link hover:underline">
                  <Search className="h-3 w-3" aria-hidden />{l.label}<ExternalLink className="h-3 w-3" aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </p>
            <p className="text-xs text-muted">These open a search on the distributor. The app does not look at the page, and it never buys.</p>
          </section>

          <section aria-label="Offers" className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Offers</h3>
            {!s.offers.length ? <p className="text-sm text-secondary">No offer yet. Add one you found, or ask for price drafts below.</p> : (
              <ul className="divide-y divide-hairline rounded-lg border border-hairline">
                {s.offers.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <label className="flex min-w-0 items-start gap-2">
                      <input type="radio" name={`chosen-${part.item.id}`} checked={s.chosen === o.id} onChange={() => void choose(o)} className="mt-1 accent-dutchOrange" />
                      <span className="min-w-0">
                        <span className="font-medium text-primary">{o.supplier}</span>{" "}
                        <span className="font-mono text-xs text-secondary">{o.price.toFixed(2)} {currency} per {o.packSize} · {pieceUnitPrice(o)} each</span>
                        <span className="block text-xs text-muted">
                          {o.partNumber ? `${o.partNumber} · ` : ""}{o.stock ? `${o.stock} · ` : ""}{o.leadTimeDays != null ? `${o.leadTimeDays} day lead · ` : ""}checked {o.checkedAt || "no date"}
                          {o.source === "research" ? " · from research" : ""}
                          {o.url ? <> · <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">page</a></> : null}
                          {o.citation && o.citation !== o.url ? <> · <a href={o.citation} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">source</a></> : null}
                        </span>
                      </span>
                    </label>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove the ${o.supplier} offer`} onClick={() => void removeOffer(o.id)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </li>
                ))}
              </ul>
            )}
            {chosen && <p className="text-xs text-muted">The chosen offer sets this part&apos;s unit price to {pieceUnitPrice(chosen)} {currency}, which the economics reads from the bill of materials.</p>}
            <OfferForm label={part.item.title} onAdd={(o) => save({ ...s, offers: [...s.offers, o] })} />
          </section>

          <section aria-label="Research drafts" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Drafts from research</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onResearch("prices")}><Sparkles className="h-3.5 w-3.5" aria-hidden /> Check prices</Button>
                <Button size="sm" variant="outline" onClick={() => onResearch("alternates")}><Sparkles className="h-3.5 w-3.5" aria-hidden /> Find alternates</Button>
              </div>
            </div>
            <ResearchDrafts projectId={part.item.projectId} partId={part.item.id} />
            {!s.drafts.length ? null : (
              <ul className="space-y-2">
                {s.drafts.map((d) => (
                  <li key={d.id} className="rounded-lg border border-dashed border-hairline p-3 text-sm">
                    <p className="font-medium text-primary">
                      {d.offer ? `${d.offer.supplier}: ${d.offer.price.toFixed(2)} ${currency} per ${d.offer.packSize}` : `Alternate: ${d.alternate?.name}`}
                      <span className="ml-2 font-mono text-[11px] font-normal text-muted">draft</span>
                    </p>
                    <p className="text-xs text-secondary">
                      {d.offer?.stock ? `${d.offer.stock} · ` : ""}{d.alternate?.whatChanges ? `${d.alternate.whatChanges} · ` : ""}
                      <a href={d.citation} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">{new URL(d.citation).hostname}</a> · {d.model ?? "research"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => void accept(d)}>{d.offer ? "Accept as offer" : "Accept as alternate"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void reject(d)}>Discard</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {s.alternates.length > 0 && (
            <section aria-label="Alternates" className="space-y-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Alternates</h3>
              <ul className="space-y-1 text-sm">
                {s.alternates.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <span><span className="font-medium text-primary">{a.name}</span>{a.partNumber ? ` (${a.partNumber})` : ""}<span className="block text-xs text-secondary">{a.whatChanges || "No change noted."}{a.citation ? <> · <a href={a.citation} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">source</a></> : null}</span></span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Remove alternate ${a.name}`} onClick={() => void save({ ...s, alternates: s.alternates.filter((x) => x.id !== a.id) })}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <OrderForm part={part} s={s} onSave={(order) => save({ ...s, order }, { status: STATUS_FOR_ORDER[order.status] })} />
        </div>
      )}
    </Card>
  );
}

function OrderForm({ part, s, onSave }: { part: Part; s: Sourcing; onSave: (o: NonNullable<Sourcing["order"]>) => Promise<unknown> }) {
  const o = s.order;
  const [v, setV] = useState({ status: o?.status ?? "to order", qtyOrdered: String(o?.qtyOrdered ?? ""), qtyReceived: String(o?.qtyReceived ?? ""), orderedOn: o?.orderedOn ?? "", shippedOn: o?.shippedOn ?? "", receivedOn: o?.receivedOn ?? "", note: o?.note ?? "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = (x: string) => (x.trim() === "" ? undefined : x.trim());
    const r = orderSchema.safeParse({ status: v.status, qtyOrdered: clean(v.qtyOrdered), qtyReceived: clean(v.qtyReceived), orderedOn: v.orderedOn, shippedOn: v.shippedOn, receivedOn: v.receivedOn, note: clean(v.note) });
    if (!r.success) return setErr(`${r.error.issues[0].path.join(" ")}: ${r.error.issues[0].message}`);
    setErr("");
    try { await onSave(r.data); } catch (x) { setErr((x as Error).message); }
  };
  const short = v.status === "received" && v.qtyOrdered && v.qtyReceived && Number(v.qtyReceived) < Number(v.qtyOrdered);
  return (
    <form onSubmit={submit} className="space-y-2" aria-label={`Order status of ${part.item.title}`}>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Order, tracked by you</h3>
      <p className="text-xs text-muted">You place the order on the supplier&apos;s site. Record here what happened.</p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Status"><NativeSelect value={v.status} onChange={set("status")}>{ORDER_STATUSES.map((x) => <option key={x}>{x}</option>)}</NativeSelect></Field>
        <Field label="Quantity ordered"><Input inputMode="numeric" value={v.qtyOrdered} onChange={set("qtyOrdered")} /></Field>
        <Field label="Quantity received"><Input inputMode="numeric" value={v.qtyReceived} onChange={set("qtyReceived")} /></Field>
        <Field label="Ordered on"><Input type="date" value={v.orderedOn} onChange={set("orderedOn")} /></Field>
        <Field label="Shipped on"><Input type="date" value={v.shippedOn} onChange={set("shippedOn")} /></Field>
        <Field label="Received on"><Input type="date" value={v.receivedOn} onChange={set("receivedOn")} /></Field>
      </div>
      <Field label="Note"><Input value={v.note} onChange={set("note")} maxLength={500} /></Field>
      {short ? <p className="text-xs text-warning">Fewer arrived than were ordered. Set the status to short to keep the rest on the list.</p> : null}
      <div className="flex items-center gap-2"><Button type="submit" size="sm">Save order status</Button>{err ? <ErrorLine>{err}</ErrorLine> : null}</div>
    </form>
  );
}
