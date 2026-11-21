"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toPart } from "@/lib/domain";
import { useItems } from "@/lib/client";
import { useProductionSettings } from "@/lib/economics/client";
import { useSourcingResearch } from "@/lib/sourcing/queries";
import type { Kind } from "@/lib/sourcing/research";
import type { ViewProps } from "@/components/views/types";
import { SourcingView } from "@/components/views/SourcingView";
import { PartCard } from "./PartCard";
import { ShoppingList } from "./ShoppingList";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";

export function SourcingBoard(props: ViewProps) {
  const { project, store } = props;
  const { items, loading, error, writeError, patch } = useItems(project.id, store);
  const settings = useProductionSettings(project.id);
  const research = useSourcingResearch(project.id);
  const parts = useMemo(() => items.map(toPart), [items]);
  const [ask, setAsk] = useState<{ partId: number; title: string; kind: Kind } | null>(null);
  const [note, setNote] = useState("");

  if (loading) return <LoadingBlocks rows={2} label="Loading the parts" />;
  if (error) return <ErrorLine>{error}</ErrorLine>;
  if (!parts.length) return <EmptyState title="No parts to source">Parts come from the bill of materials. <Link href="/s/design/bom" className="text-link underline">Add parts there</Link> first.</EmptyState>;

  const currency = settings.currency;
  const go = async () => {
    if (!ask) return;
    setNote("");
    try {
      const r = await research.mutateAsync({ partId: ask.partId, kind: ask.kind });
      setNote(`${r.drafts.length} draft${r.drafts.length === 1 ? "" : "s"} saved for ${ask.title}${r.dropped.length ? `. Left out: ${r.dropped.join("; ")}` : ""}. Review them on the part.`);
      setAsk(null);
    } catch { /* shown in the dialog */ }
  };

  return (
    <div className="animate-enter space-y-8">
      {writeError ? <ErrorLine>{writeError}</ErrorLine> : null}
      {note ? <p role="status" className="text-sm text-secondary">{note}</p> : null}
      <p className="max-w-3xl text-sm text-secondary">
        Record who sells each part and at what price. The app never places an order and never reads a shop for you: search links open the distributor, and you check the price yourself. Prices from research arrive as drafts with their source page, and count as nothing until you accept them. Money is in {currency}.
      </p>

      <section aria-labelledby="parts-h" className="space-y-3">
        <h2 id="parts-h" className="text-base font-semibold tracking-tight text-primary">Parts</h2>
        <ul className="space-y-3">
          {parts.map((p) => (
            <PartCard key={p.item.id} part={p} currency={currency} onSave={(c) => patch(p.item.id, c)} onResearch={(kind) => { research.reset(); setAsk({ partId: p.item.id, title: p.item.title, kind }); }} />
          ))}
        </ul>
      </section>

      <ShoppingList parts={parts} currency={currency} projectName={project.name} />

      <details className="rounded-xl border border-hairline">
        <summary className="cursor-pointer px-4 py-3 text-base font-semibold tracking-tight text-primary">Amazon cart and part status</summary>
        <div className="border-t border-hairline p-4"><SourcingView {...props} /></div>
      </details>

      <Modal open={!!ask} onOpenChange={(o) => { if (!o && !research.isPending) setAsk(null); }} title={ask?.kind === "alternates" ? "Find alternates?" : "Check prices?"} description="This asks Perplexity, which is billed to your key.">
        <p className="text-sm text-primary">{ask?.title}</p>
        <p className="mt-2 text-sm text-secondary">The answer is saved as a research entry. Only lines whose page was cited, in {currency}, become drafts. Nothing is added to the part until you accept it.</p>
        {research.isError ? <div className="mt-3"><ErrorLine>{(research.error as Error).message}</ErrorLine></div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAsk(null)} disabled={research.isPending}>Not now</Button>
          <Button onClick={() => void go()} disabled={research.isPending}>{research.isPending ? "Asking, this takes a moment" : "Ask Perplexity (billed)"}</Button>
        </div>
      </Modal>
    </div>
  );
}
