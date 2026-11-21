"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Part } from "@/lib/domain";
import { shoppingCsv, shoppingList } from "@/lib/sourcing/list";
import { toInputText } from "@/lib/economics/money";
import { EmptyState } from "@/components/ui/states";
import { downloadFile } from "@/lib/download";
import { fileSlug } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function ShoppingList({ parts, currency, projectName }: { parts: Part[]; currency: string; projectName: string }) {
  const fmt = (minor: number) => toInputText(minor, currency);
  const list = useMemo(() => shoppingList(parts.map((p) => ({ id: p.item.id, ref: p.ref, title: p.item.title, qty: p.qty, status: p.item.status, data: p.item.data })), currency), [parts, currency]);
  const empty = !list.groups.length && !list.unchosen.length;

  const download = () => {
    downloadFile(`${fileSlug(projectName, "project")}-shopping-list.csv`, shoppingCsv(list, currency), "text/csv;charset=utf-8");
  };

  return (
    <section aria-labelledby="shop-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="shop-h" className="text-base font-semibold tracking-tight text-primary">Shopping list</h2>
        <Button variant="outline" onClick={download} disabled={empty}><Download className="h-4 w-4" aria-hidden /> Download CSV</Button>
      </div>
      {empty ? (
        <EmptyState title="Nothing to buy yet">Choose a supplier on a part and it appears here, grouped by supplier, with whole packs and a total.</EmptyState>
      ) : (
        <div className="space-y-4">
          {list.groups.map((g) => (
            <Card variant="flat" key={g.supplier} className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="border-b border-hairline px-4 py-2 text-left font-semibold text-primary">{g.supplier} <span className="font-mono text-xs font-normal text-secondary">subtotal {fmt(g.totalMinor)} {currency}</span></caption>
                <thead><tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted"><th className="px-4 py-1.5">Part</th><th className="px-2 py-1.5 text-right">Need</th><th className="px-2 py-1.5 text-right">Packs</th><th className="px-2 py-1.5 text-right">Spare</th><th className="px-4 py-1.5 text-right">Total</th></tr></thead>
                <tbody>
                  {g.lines.map((l) => (
                    <tr key={l.partId} className="border-t border-hairline">
                      <td className="px-4 py-1.5 text-primary">{l.ref ? <span className="mr-2 font-mono text-xs text-muted">{l.ref}</span> : null}{l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">{l.title}</a> : l.title}<span className="block font-mono text-[11px] text-muted">{l.packSize > 1 ? `packs of ${l.packSize}, ` : ""}{fmt(l.priceMinor)} per pack{l.checkedAt ? `, checked ${l.checkedAt}` : ""}</span></td>
                      <td className="px-2 py-1.5 text-right font-mono">{l.need}</td><td className="px-2 py-1.5 text-right font-mono">{l.packs}</td><td className="px-2 py-1.5 text-right font-mono">{l.spare}</td><td className="px-4 py-1.5 text-right font-mono">{fmt(l.totalMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
          {list.unchosen.length > 0 && (
            <p className="text-sm text-secondary"><span className="font-medium text-primary">No supplier chosen:</span> {list.unchosen.map((u) => `${u.ref ? u.ref + " " : ""}${u.title} (need ${u.need})`).join(", ")}</p>
          )}
          {list.groups.length ? (
            <p className="font-mono text-sm text-primary">
              Total {fmt(list.totalMinor)} {currency}
              {list.unchosen.length ? <span className="font-sans text-xs text-secondary"> for the parts with a chosen offer; {list.unchosen.length} {list.unchosen.length === 1 ? "part has" : "parts have"} none yet and {list.unchosen.length === 1 ? "is" : "are"} not in it.</span> : null}
            </p>
          ) : (
            <p className="text-sm text-secondary" data-testid="shopping-nothing-priced">Nothing is priced yet. Choose an offer on a part and its packs and total appear here.</p>
          )}
          {list.excluded.length > 0 && <p className="text-xs text-muted">Left out: {list.excluded.map((e) => `${e.ref || e.title} (${e.why})`).join("; ")}</p>}
        </div>
      )}
    </section>
  );
}
