"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine, Field } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { money, parseAmount } from "@/components/parts/bom";
import { useItems } from "@/lib/client";
import { messageOf, queries, type IntegrationsReport } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { ViewProps } from "./types";

type Sale = { item: Item; date: string; channel: string; units: number; revenue: number };

const toSale = (item: Item): Sale => {
  const n = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? "")) || 0);
  return { item, date: String(item.data.date ?? ""), channel: String(item.data.channel ?? ""), units: n(item.data.units), revenue: n(item.data.revenue) };
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const amazonSell = (r: IntegrationsReport) => r.integrations.find((i) => i.key === "amazon-sell") ?? null;

export function MonitorView({ project, store }: ViewProps) {
  const { items, loading, error, add, remove } = useItems(project.id, store);
  const reduce = useReducedMotion();
  // One request for /api/integrations however many views read it; this one picks the Amazon seller row.
  const integQuery = useQuery({ ...queries.integrations(), select: amazonSell });
  const integ = integQuery.data;
  const integError = messageOf(integQuery.error);
  const [del, setDel] = useState<Sale | null>(null);
  const [actionError, setActionError] = useState("");

  const sales = useMemo(() => items.map(toSale).sort((a, b) => b.date.localeCompare(a.date)), [items]);
  const byChannel = useMemo(() => {
    const m = new Map<string, { units: number; revenue: number; rows: number }>();
    for (const s of sales) {
      const k = s.channel.trim() || "(no channel)";
      const c = m.get(k) ?? { units: 0, revenue: 0, rows: 0 };
      m.set(k, { units: c.units + s.units, revenue: c.revenue + s.revenue, rows: c.rows + 1 });
    }
    return [...m.entries()];
  }, [sales]);
  const channels = [...new Set(sales.map((s) => s.channel.trim()).filter(Boolean))];

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-8">
      <section aria-labelledby="amz-h" className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="amz-h" className="text-base font-semibold tracking-tight text-primary">Amazon Seller Central</h2>
          {integ ? <StatusBadge tone={integ.configured ? "info" : "neutral"}>{integ.configured ? "Credentials present" : "Not connected"}</StatusBadge> : null}
        </div>
        {integError ? <div className="mt-3"><ErrorLine>{integError}</ErrorLine></div> : integ === undefined ? (
          <p className="mt-3 text-sm text-secondary">Checking the connection.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-secondary">
            <p>
              {integ?.configured
                ? "The credentials are set, but this prototype does not have the Amazon SP-API call code yet, so nothing is fetched and nothing is shown here."
                : "This prototype is not connected to Amazon and does not have the Amazon SP-API call code yet, so it shows no Amazon sales."}
            </p>
            <div>
              <p className="font-medium text-primary">What it needs</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>An Amazon seller account.</li>
                <li>An SP-API app registered for that account.</li>
                <li>
                  These three values in the .env file, then a restart:{" "}
                  <span className="font-mono text-xs text-primary">{(integ?.env?.length ? integ.env : ["AMAZON_SP_REFRESH_TOKEN", "AMAZON_SP_CLIENT_ID", "AMAZON_SP_CLIENT_SECRET"]).join(", ")}</span>
                </li>
              </ul>
            </div>
            <p>Once the call code is built, this page will show orders, units and revenue by day and by ASIN.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="log-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="log-h" className="text-base font-semibold tracking-tight text-primary">Sales log</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Entered by hand</p>
          </div>
          <AddSale channels={channels} onCreate={(v) => add({ section: store, title: `${v.date} ${v.channel}`, data: v }).then(() => undefined)} />
        </div>
        <p className="text-sm text-secondary">Rows you type in. They are not read from Amazon or any other channel.</p>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        {actionError ? <ErrorLine>{actionError}</ErrorLine> : null}
        {loading ? (
          <p className="text-sm text-secondary">Loading the log.</p>
        ) : !sales.length ? (
          <EmptyState title="Nothing logged yet">Add a row for each day and channel you want to track.</EmptyState>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead><TableHead>Channel</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="w-10"><span className="sr-only">Delete</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.item.id}>
                      <TableCell className="font-mono text-xs text-primary">{s.date}</TableCell>
                      <TableCell className="text-primary">{s.channel}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{s.units}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(s.revenue)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete the ${s.channel} row for ${s.date}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4" aria-hidden /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
              <p className="border-b border-hairline px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Totals by channel, from the rows above</p>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent"><TableHead>Channel</TableHead><TableHead className="text-right">Rows</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {byChannel.map(([k, c]) => (
                    <TableRow key={k}>
                      <TableCell className="text-primary">{k}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.rows}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.units}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(c.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-subtle hover:bg-subtle">
                    <TableCell className="font-medium text-primary">All channels</TableCell>
                    <TableCell className="text-right font-mono text-xs">{sales.length}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-primary">{sales.reduce((a, s) => a + s.units, 0)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-primary">{money(sales.reduce((a, s) => a + s.revenue, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <Modal open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this row?" description="It is removed from the log and from the totals.">
        <p className="font-mono text-sm text-primary">{del ? `${del.date}, ${del.channel}, ${del.units} units, ${money(del.revenue)}` : null}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDel(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!del) return;
            try { setActionError(""); await remove(del.item.id); } catch (e) { setActionError((e as Error).message); }
            setDel(null);
          }}>Delete row</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

function AddSale({ channels, onCreate }: { channels: string[]; onCreate: (v: { date: string; channel: string; units: number; revenue: number }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: today(), channel: "", units: "", revenue: "" });
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
            <Field label="Revenue"><Input value={f.revenue} onChange={(e) => setF({ ...f, revenue: e.target.value })} inputMode="decimal" className="font-mono" placeholder="0.00" required /></Field>
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
