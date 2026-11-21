"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine, Field } from "@/components/parts/controls";
import { newId, offerSchema, type Offer } from "@/lib/sourcing/schemas";

const today = () => new Date().toISOString().slice(0, 10);

/** Adds one offer the user typed. A price the user typed is theirs; one from research arrives as a draft instead. */
export function OfferForm({ label, onAdd }: { label: string; onAdd: (o: Offer) => Promise<unknown> }) {
  const [v, setV] = useState({ supplier: "", partNumber: "", url: "", price: "", packSize: "1", stock: "", leadTimeDays: "", checkedAt: today() });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = { id: newId("o"), supplier: v.supplier.trim(), partNumber: v.partNumber.trim(), url: v.url.trim(), price: v.price, packSize: v.packSize || "1", stock: v.stock.trim(), leadTimeDays: v.leadTimeDays === "" ? undefined : v.leadTimeDays, checkedAt: v.checkedAt, source: "entered" as const };
    const r = offerSchema.safeParse(raw);
    if (!r.success) return setErr(`${r.error.issues[0].path.join(" ") || "offer"}: ${r.error.issues[0].message}`);
    setErr(""); setBusy(true);
    try { await onAdd(r.data); setV((x) => ({ ...x, supplier: "", partNumber: "", url: "", price: "", packSize: "1", stock: "", leadTimeDays: "" })); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-lg border border-hairline bg-subtle p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={`Add an offer for ${label}`}>
      <Field label="Supplier"><Input value={v.supplier} onChange={set("supplier")} maxLength={120} /></Field>
      <Field label="Price of one pack"><Input inputMode="decimal" value={v.price} onChange={set("price")} /></Field>
      <Field label="Pieces in the pack"><Input inputMode="numeric" value={v.packSize} onChange={set("packSize")} /></Field>
      <Field label="Lead time, days"><Input inputMode="numeric" value={v.leadTimeDays} onChange={set("leadTimeDays")} /></Field>
      <Field label="Part number"><Input value={v.partNumber} onChange={set("partNumber")} maxLength={120} /></Field>
      <Field label="Product page"><Input value={v.url} onChange={set("url")} placeholder="https://" maxLength={600} /></Field>
      <Field label="Stock note"><Input value={v.stock} onChange={set("stock")} maxLength={200} /></Field>
      <Field label="Price checked on"><Input type="date" value={v.checkedAt} onChange={set("checkedAt")} /></Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving" : "Add offer"}</Button>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
      </div>
    </form>
  );
}
