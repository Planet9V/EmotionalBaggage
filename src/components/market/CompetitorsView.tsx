"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, useItems } from "@/lib/client";
import { keys, messageOf, queries } from "@/lib/queries";
import { formatMoney, parseMinor } from "@/lib/market/pricing";
import { competitorData } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ApproveButton, GeneratedLine, GenerateButton, ModelGate, Notes, Status, useGenerate, useModelStatus } from "./shared";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";

type Row = {
  item: Item;
  name: string;
  kind: "product" | "alternative";
  what: string;
  priceText: string;
  priceMinor: number | null;
  currency: string;
  claim: string;
  weakness: string;
  sourceUrl: string;
  basis: "research" | "typed" | "unsourced";
};

function toRow(item: Item): Row {
  const r = competitorData.safeParse(item.data);
  const d = r.success ? r.data : {};
  const url = d.sourceUrl ?? "";
  return {
    item,
    name: item.title,
    kind: d.kind ?? "product",
    what: d.what ?? "",
    priceText: d.priceText ?? "",
    priceMinor: typeof d.priceMinor === "number" ? d.priceMinor : null,
    currency: d.currency ?? "",
    claim: d.claim ?? "",
    weakness: d.weakness ?? "",
    sourceUrl: url,
    // A row with no basis recorded and no source is shown as unsourced, never as fact.
    basis: d.basis ?? (url ? "research" : "unsourced"),
  };
}

type SortKey = "name" | "kind" | "price" | "source" | "status";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function compare(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "kind": return a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name);
    case "price": {
      // Rows with no price sort last in either direction (handled by the caller).
      return (a.priceMinor ?? 0) - (b.priceMinor ?? 0);
    }
    case "source": return a.basis.localeCompare(b.basis) || host(a.sourceUrl).localeCompare(host(b.sourceUrl));
    case "status": return a.item.status.localeCompare(b.item.status);
  }
}

export function CompetitorsView({ project, store }: ViewProps) {
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const research = useQuery(queries.research(project.id));
  const gen = useGenerate(project.id);
  const model = useModelStatus(project.id);
  const qc = useQueryClient();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [asking, setAsking] = useState(false);
  const [picked, setPicked] = useState("");
  const [actionError, setActionError] = useState("");
  const [flow, setFlow] = useState<{ cost: number | null; message: string } | null>(null);

  const rows = useMemo(() => items.map(toRow), [items]);
  const sorted = useMemo(() => {
    const out = [...rows].sort((a, b) => {
      if (sort.key === "price") {
        if (a.priceMinor === null && b.priceMinor === null) return a.name.localeCompare(b.name);
        if (a.priceMinor === null) return 1;
        if (b.priceMinor === null) return -1;
      }
      return compare(a, b, sort.key) * sort.dir;
    });
    return out;
  }, [rows, sort]);

  const askM = useMutation({
    mutationFn: (query: string) => api<{ entry: { id: number }; costUsd: number | null }>("/api/research", { method: "POST", body: JSON.stringify({ projectId: project.id, query }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.research(project.id) }),
  });

  if (loading) return <LoadingBlocks label="Loading competitors" />;
  if (error && !items.length) return <LoadError what="Competitors" message={error} onRetry={() => void reload()} />;

  const answers = research.data?.entries ?? [];
  const perplexityOn = research.data?.configured ?? null;
  const defaultQuestion = `What do buyers use today instead of "${project.name}"${project.oneLiner ? ` (${project.oneLiner})` : ""}? List the competing products, workarounds and substitutes. For each give its name, what it is, its price if one is stated, what it claims, and the weaknesses or complaints reported. Cite a source for each.`;

  const header = (key: SortKey, label: string) => (
    <TableHead aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />) : <ArrowUpDown className="h-3 w-3 text-muted" aria-hidden />}
      </button>
    </TableHead>
  );

  const extract = async (researchId: number) => {
    try {
      await gen.run({ generator: "competitors", researchId });
    } catch {
      /* shown from gen.error */
    }
  };

  const guard = async (p: Promise<unknown>) => {
    setActionError("");
    try { await p; } catch (e) { setActionError((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      {model.configured === false && <ModelGate what="Competitors are read out of a cited research answer." />}

      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-primary">Find competitors and alternatives</h2>
        <p className="text-sm text-secondary">
          A price or a claim is shown only when a cited research answer says it, or when you type it. Anything the model could not tie to a source is marked &ldquo;unsourced: check this&rdquo;. Include what a buyer does today instead, even if that is nothing.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={() => { setFlow(null); setAsking(true); }} disabled={perplexityOn === false || model.configured === false}>
            <Search className="h-4 w-4" aria-hidden /> Research competitors
          </Button>
          <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add by hand</Button>
          {answers.length > 0 && model.configured !== false && (
            <div className="flex items-end gap-2">
              <Field label="Or read a saved answer">
                <NativeSelect value={picked} onChange={(e) => setPicked(e.target.value)} className="w-72">
                  <option value="">Choose a research answer</option>
                  {answers.map((a) => <option key={a.id} value={a.id}>{a.query.length > 60 ? `${a.query.slice(0, 60)}...` : a.query}</option>)}
                </NativeSelect>
              </Field>
              <GenerateButton pending={gen.pending} onClick={() => void extract(Number(picked))} disabled={!picked}>Extract rows</GenerateButton>
            </div>
          )}
        </div>
        {perplexityOn === false && (
          <p className="text-xs text-muted">Perplexity is not connected, so research is off. <Link className="text-link underline" href="/admin?tab=credentials">Add a key in Admin, Credentials</Link>. You can still add rows by hand.</p>
        )}
        {flow && <p role="status" className="text-xs text-secondary">{flow.message}</p>}
        {gen.error && <ErrorLine>{gen.error}</ErrorLine>}
        <Notes notes={gen.notes} />
      </Card>

      {(actionError || error) && <ErrorLine>{actionError || error}</ErrorLine>}

      {!rows.length ? (
        <EmptyState title="No competitors yet">Research the market, read a saved answer, or add a row by hand. Add the non-product alternatives too: doing nothing, a workaround.</EmptyState>
      ) : (
        <Card variant="outlined" hoverEffect={false} innerClassName="p-0">
          <Table aria-label="Competitors and alternatives">
            <TableHeader>
              <TableRow>
                {header("name", "Name")}
                {header("kind", "Kind")}
                <TableHead>What it is</TableHead>
                {header("price", "Price")}
                <TableHead>Main claim</TableHead>
                <TableHead>Weakness</TableHead>
                {header("source", "Source")}
                {header("status", "Status")}
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.item.id} className="align-top">
                  <TableCell className="min-w-32 font-medium text-primary">{r.name}</TableCell>
                  <TableCell className="text-secondary">{r.kind === "alternative" ? "Alternative" : "Product"}</TableCell>
                  <TableCell className="min-w-44 text-secondary">{r.what}<GeneratedLine from={r.item.data.generatedFrom} /></TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{r.priceMinor !== null && r.currency ? formatMoney(r.priceMinor, r.currency) : r.priceText || <span className="text-muted">none stated</span>}</TableCell>
                  <TableCell className="min-w-44 text-secondary">{r.claim}</TableCell>
                  <TableCell className="min-w-44 text-secondary">{r.weakness}</TableCell>
                  <TableCell className="min-w-32">
                    {r.basis === "research" && r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-xs text-link underline wrap-anywhere">{host(r.sourceUrl)}</a>
                      : r.basis === "typed" ? <span className="text-xs text-secondary">typed by you{r.sourceUrl ? <> · <a href={r.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-link underline">{host(r.sourceUrl)}</a></> : null}</span>
                      : <StatusBadge tone="warning">unsourced: check this</StatusBadge>}
                  </TableCell>
                  <TableCell><Status status={r.item.status} /></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ApproveButton item={r.item} onSet={(status) => patch(r.item.id, { status })} />
                      <Button size="icon-sm" variant="outline" onClick={() => setEditing(r.item)} aria-label={`Edit ${r.name}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => void guard(remove(r.item.id))} aria-label={`Delete ${r.name}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {asking && (
        <AskDialog
          initial={defaultQuestion}
          pending={askM.isPending || gen.pending}
          onClose={() => setAsking(false)}
          onAsk={async (query) => {
            setFlow(null);
            try {
              const r = await askM.mutateAsync(query);
              const cost = r.costUsd ?? null;
              setAsking(false);
              setFlow({ cost, message: `Perplexity answered and the answer is saved in Research${cost !== null ? ` (it reported about $${cost.toFixed(3)} for the question)` : ""}. Reading rows out of it now.` });
              const out = await gen.run({ generator: "competitors", researchId: r.entry.id });
              setFlow({ cost, message: `Perplexity answered${cost !== null ? ` (about $${cost.toFixed(3)} billed for the question)` : ""}. ${out.items.length} row${out.items.length === 1 ? "" : "s"} added as drafts.` });
            } catch (e) {
              setAsking(false);
              setFlow({ cost: null, message: `${(e as Error).message} If the answer was saved, you can read it from the list of saved answers above.` });
            }
          }}
          error={messageOf(askM.error)}
        />
      )}

      {editing && (
        <CompetitorDialog
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (title, data) => {
            if (editing === "new") await add({ section: store, title, data, status: "draft" });
            else await patch(editing.id, { title, data, ...(editing.status === "approved" ? { status: "draft" } : {}) });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AskDialog({ initial, pending, error, onAsk, onClose }: { initial: string; pending: boolean; error: string; onAsk: (q: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState(initial);
  return (
    <Modal open onOpenChange={(o) => !o && !pending && onClose()} title="Research competitors" description="This sends one question to Perplexity.">
      <div className="space-y-3">
        <p className="text-sm text-secondary">
          This sends the question below to Perplexity, an outside service. <strong className="font-semibold text-primary">Perplexity bills per question.</strong> Nothing is sent until you confirm. The answer is saved in Research with its sources, and rows are then read out of it as drafts.
        </p>
        <Field label="The question that will be sent"><Textarea rows={6} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={2000} /></Field>
        {error && <ErrorLine>{error}</ErrorLine>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={() => onAsk(query.trim())} disabled={pending || !query.trim()} aria-busy={pending}>{pending ? "Asking Perplexity" : "Ask Perplexity (billed)"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function CompetitorDialog({ item, onClose, onSave }: { item: Item | null; onClose: () => void; onSave: (title: string, data: Record<string, unknown>) => Promise<void> }) {
  const r = item ? toRow(item) : null;
  const [name, setName] = useState(r?.name ?? "");
  const [kind, setKind] = useState<string>(r?.kind ?? "product");
  const [what, setWhat] = useState(r?.what ?? "");
  const [price, setPrice] = useState(r?.priceMinor !== null && r?.priceMinor !== undefined ? String(r.priceMinor / 100) : "");
  const [priceText, setPriceText] = useState(r?.priceMinor === null ? (r?.priceText ?? "") : "");
  const [currency, setCurrency] = useState(r?.currency || "USD");
  const [claim, setClaim] = useState(r?.claim ?? "");
  const [weakness, setWeakness] = useState(r?.weakness ?? "");
  const [url, setUrl] = useState(r?.sourceUrl ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return setErr("Give it a name.");
    const minor = price.trim() ? parseMinor(price) : null;
    if (price.trim() && minor === null) return setErr("The price must be a number, such as 29.99.");
    if (url.trim()) {
      try { const u = new URL(url.trim()); if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("x"); } catch { return setErr("The source must be a web address starting with http or https."); }
    }
    // A row the user edits keeps its research basis only if the source is unchanged; otherwise it is the user's own.
    const keepsResearch = r?.basis === "research" && url.trim() === r.sourceUrl;
    setBusy(true);
    setErr("");
    try {
      await onSave(name.trim(), {
        kind,
        what,
        claim,
        weakness,
        sourceUrl: url.trim(),
        basis: keepsResearch ? "research" : "typed",
        currency: minor !== null ? currency.toUpperCase().slice(0, 3) : "",
        priceText: minor !== null ? formatMoney(minor, currency) : priceText,
        ...(minor !== null ? { priceMinor: minor } : {}),
      });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? "Edit competitor" : "Add competitor or alternative"} description="What you type here is yours: the row is marked typed by you unless it keeps its research source.">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Kind"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}><option value="product">Product</option><option value="alternative">Alternative (do nothing, a workaround)</option></NativeSelect></Field>
        </div>
        <Field label="What it is"><Textarea rows={2} value={what} onChange={(e) => setWhat(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <Field label="Price" hint="A single price, as a number. Leave empty if there is none or it is a range."><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29.99" /></Field>
          <Field label="Currency"><Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></Field>
        </div>
        {!price.trim() && <Field label="Price, as stated (optional)" hint="For a range or a plan, such as $20 to $30 a month."><Input value={priceText} onChange={(e) => setPriceText(e.target.value)} /></Field>}
        <Field label="Main claim"><Textarea rows={2} value={claim} onChange={(e) => setClaim(e.target.value)} /></Field>
        <Field label="Weakness"><Textarea rows={2} value={weakness} onChange={(e) => setWeakness(e.target.value)} /></Field>
        <Field label="Source address (optional)"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        {err && <ErrorLine>{err}</ErrorLine>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
