"use client";

import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItems } from "@/lib/client";
import { LISTING_CATEGORIES, listingCategory, checkListing, type ListingFields } from "@/lib/content/channels";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { asFlags, Count, FlagList, MessageLine, Problems, SourceLink, StatusPill } from "./shared";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { Card } from "@/components/ui/Card";

const STATUSES = ["draft", "ready", "live"];
const bytes = (s: string) => new TextEncoder().encode(s).length;

export function ListingView({ project, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const shots = useItems(project.id, "marketing/imagery");
  const [err, setErr] = useState("");
  const rows = useMemo(() => items, [items]);
  const addBlank = async () => {
    setErr("");
    try {
      await add({ section: store, title: "New listing", status: "draft", data: { category: "default", fields: { title: "", bullets: [], description: "", searchTerms: "" } } });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">Use Draft with AI above to write a listing from your approved message, or add one by hand. A listing is not sent to Amazon from here.</p>
        <Button size="sm" onClick={() => void addBlank()}><Plus className="h-4 w-4" aria-hidden /> Add listing</Button>
      </div>
      {err || writeError ? <ErrorLine>{err || writeError}</ErrorLine> : null}
      {error && !items.length ? <ErrorLine>{error}</ErrorLine> : null}
      {loading ? (
        <LoadingBlocks rows={2} label="Loading the listings" />
      ) : rows.length === 0 ? (
        <SectionEmpty projectId={project.id} store="sales/listing" sectionLabel="Listing" title="No listing yet">The listing is what a buyer reads on Amazon before ordering. It carries a title, five bullets, a description and search terms.</SectionEmpty>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <ListingCard projectId={project.id} row={r} shots={shots.items} onSave={(c) => patch(r.id, c)} onDelete={() => remove(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingCard({ projectId, row, shots, onSave, onDelete }: { projectId: string; row: Item; shots: Item[]; onSave: (c: { data?: Record<string, unknown>; status?: string; title?: string }) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const saved = (row.data.fields ?? {}) as Partial<ListingFields>;
  const base: ListingFields = { title: saved.title ?? "", bullets: saved.bullets ?? [], description: saved.description ?? "", searchTerms: saved.searchTerms ?? "" };
  const [f, setF] = useState<ListingFields>(base);
  const [cat, setCat] = useState(String(row.data.category ?? "default"));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const category = listingCategory(cat);
  const L = category.limits;
  const problems = checkListing(category, f);
  const dirty = JSON.stringify(f) !== JSON.stringify(base) || cat !== String(row.data.category ?? "default");
  const checked = (row.data.imagesChecked ?? {}) as Record<string, boolean>;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = <K extends keyof ListingFields>(k: K, v: ListingFields[K]) => setF((p) => ({ ...p, [k]: v }));
  const exportable = row.status !== "draft";
  const q = `projectId=${encodeURIComponent(projectId)}&id=${row.id}`;
  const forListing = shots.filter((s) => Array.isArray(s.data.usedIn) ? (s.data.usedIn as string[]).some((u) => /listing/i.test(u)) : true);

  return (
    <Card variant="flat" as="article" aria-label={row.title} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={row.status} />
          {row.data.noProof === true && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">No proof</span>}
        </div>
        <Button size="icon" variant="ghost" aria-label={`Delete ${row.title}`} onClick={() => void run(onDelete)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="mt-2"><MessageLine message={row.data.message as { text?: string } | undefined} /></div>

      <div className="mt-3 grid gap-3">
        <Field label="Category" hint={category.note}>
          <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)}>
            {LISTING_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </NativeSelect>
        </Field>
        <div>
          <label htmlFor={`t${row.id}`} className="mb-1 block text-xs font-medium text-secondary">Title *</label>
          <Input id={`t${row.id}`} value={f.title} onChange={(e) => set("title", e.target.value)} />
          <div className="mt-0.5 text-right"><Count n={[...f.title].length} max={L.title.max} enforce={L.title.enforce} /></div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-secondary">Bullets (up to {L.bullets.count})</p>
          <ul className="space-y-1.5">
            {f.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <Textarea aria-label={`Bullet ${i + 1}`} rows={2} value={b} onChange={(e) => set("bullets", f.bullets.map((x, k) => (k === i ? e.target.value : x)))} />
                <span className="w-24 shrink-0 pt-2 text-right"><Count n={[...b].length} max={L.bullets.max} enforce={L.bullets.enforce} /></span>
                <Button size="icon" variant="ghost" aria-label={`Remove bullet ${i + 1}`} onClick={() => set("bullets", f.bullets.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
              </li>
            ))}
          </ul>
          <Button className="mt-1.5" size="sm" variant="outline" disabled={f.bullets.length >= L.bullets.count} onClick={() => set("bullets", [...f.bullets, ""])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add bullet</Button>
        </div>
        <div>
          <label htmlFor={`d${row.id}`} className="mb-1 block text-xs font-medium text-secondary">Description</label>
          <Textarea id={`d${row.id}`} rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} />
          <div className="mt-0.5 text-right"><Count n={[...f.description].length} max={L.description.max} enforce={L.description.enforce} /></div>
        </div>
        <div>
          <label htmlFor={`k${row.id}`} className="mb-1 block text-xs font-medium text-secondary">Search terms</label>
          <Textarea id={`k${row.id}`} rows={2} value={f.searchTerms} onChange={(e) => set("searchTerms", e.target.value)} />
          <div className="mt-0.5 text-right"><Count n={bytes(f.searchTerms)} max={L.searchTerms.maxBytes} enforce={L.searchTerms.enforce} /> <span className="text-[11px] text-muted">bytes</span></div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        Limits from <SourceLink url={L.title.source ?? "https://sellercentral.amazon.com"} label="Amazon&apos;s detail page guide" />. A limit marked a guide could not be read from Amazon&apos;s own page and is only a warning.
      </p>

      <Panel compact title="Image checklist">
        {forListing.length === 0 ? (
          <p className="text-sm text-secondary">No shots yet. Add them in Imagery; each one appears here to tick off.</p>
        ) : (
          <ul className="space-y-1.5">
            {forListing.map((s) => {
              const key = String(s.data.shotKey ?? s.id);
              const hasFile = !!s.data.fileId;
              return (
                <li key={s.id} className="flex items-start gap-2 text-sm">
                  <input
                    id={`c${row.id}-${key}`}
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={!!checked[key]}
                    onChange={(e) => void run(() => onSave({ data: { imagesChecked: { ...checked, [key]: e.target.checked } } }))}
                  />
                  <label htmlFor={`c${row.id}-${key}`} className="text-secondary">
                    <span className="font-medium text-primary">{s.title}</span> {hasFile ? "(file ready)" : <span className="text-warning">(no file yet)</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="mt-3 space-y-2">
        <FlagList flags={asFlags(row.data.flags)} />
        <Problems problems={problems} />
        {err && <ErrorLine>{err}</ErrorLine>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !dirty} onClick={() => void run(() => onSave({ title: (f.title || "New listing").slice(0, 120), data: { category: cat, fields: f } }))}>{busy ? "Saving" : dirty ? "Save changes" : "Saved"}</Button>
        <label className="flex items-center gap-2 text-xs text-secondary">
          Status
          <NativeSelect aria-label={`Status of ${row.title}`} className="h-8 w-32" value={row.status} disabled={busy || dirty} onChange={(e) => void run(() => onSave({ status: e.target.value }))}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </NativeSelect>
        </label>
        {exportable ? (
          <>
            <Button size="sm" variant="outline" asChild><a href={`/api/content/listing/export?${q}&format=text`}><Download className="h-4 w-4" aria-hidden /> Text</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`/api/content/listing/export?${q}&format=flat`}><Download className="h-4 w-4" aria-hidden /> Flat file</a></Button>
          </>
        ) : (
          <span className="text-xs text-muted">Mark it ready to export.</span>
        )}
      </div>
    </Card>
  );
}
