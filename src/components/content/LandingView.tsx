"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, useItems } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { KIND_LABEL } from "@/lib/content/landing";
import { LANDING_KINDS, type LandingKind } from "@/lib/content/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { asFlags, FlagList, StatusPill } from "./shared";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { Card } from "@/components/ui/Card";

type Preview = { html: string; problems: string[]; unapproved: number[]; sections: number; contrast: { label: string; ratio: number }[] };
type Content = Record<string, unknown>;
const orderOf = (i: Item) => (typeof i.data.order === "number" ? i.data.order : 0);
const kindOf = (i: Item) => i.data.kind as LandingKind;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function LandingView({ project, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const [err, setErr] = useState("");
  const sections = useMemo(() => items.filter((i) => LANDING_KINDS.includes(kindOf(i))).sort((a, b) => orderOf(a) - orderOf(b) || a.id - b.id), [items]);
  const stamp = sections.map((s) => `${s.id}:${s.status}:${s.title}:${JSON.stringify(s.data.content)}:${orderOf(s)}`).join("|");
  const preview = useQuery({
    queryKey: ["landing-preview", project.id, scheme, stamp],
    queryFn: () => api<Preview>(`/api/content/landing/preview?projectId=${encodeURIComponent(project.id)}&scheme=${scheme}`),
    enabled: !loading,
    placeholderData: (p) => p,
  });
  // The preview frame is fully sandboxed (sandbox="", no scripts, opaque origin): the page has no script of its own (a test checks),
  // and its images arrive inlined as data: addresses. A test tool that injects a script into every frame is handled in the test helper.
  const drafts = sections.filter((s) => s.status !== "approved").length;
  const run = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const move = (i: number, d: -1 | 1) =>
    run(async () => {
      const j = i + d;
      if (j < 0 || j >= sections.length) return;
      // Renumber the whole list so equal or missing orders cannot tie.
      const next = [...sections];
      [next[i], next[j]] = [next[j], next[i]];
      await Promise.all(next.map((s, n) => (orderOf(s) === n && s === sections[n] ? Promise.resolve() : patch(s.id, { data: { order: n } }))));
    });
  const addSection = (kind: LandingKind) =>
    run(() => add({ section: store, title: KIND_LABEL[kind], status: "draft", data: { kind, order: sections.length, content: starter(kind) } }));
  const present = new Set(sections.map(kindOf));
  const canExport = sections.length > 0 && drafts === 0;

  return (
    <div className="space-y-5">
      <Card variant="well" role="note" className="p-3 text-sm text-secondary">
        <p className="font-medium text-primary">Public preview, not published.</p>
        <p>
          This page is drawn from the rows below in your brand kit. Nothing here is put on the internet: the address{" "}
          <Link className="text-link hover:underline" href={`/p/${project.id}`}>/p/{project.id}</Link> works only while you are signed in. Export a zip to host it yourself.
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {LANDING_KINDS.filter((k) => !present.has(k) || k === "faq").map((k) => (
            <Button key={k} size="sm" variant="outline" onClick={() => void addSection(k)}><Plus className="h-3.5 w-3.5" aria-hidden /> {KIND_LABEL[k]}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/p/${project.id}`} target="_blank"><ExternalLink className="h-4 w-4" aria-hidden /> Open preview<span className="sr-only"> (new tab)</span></Link>
          </Button>
          <Button size="sm" disabled={!canExport} title={canExport ? undefined : drafts ? "Approve every section first" : "Add sections first"} asChild={canExport}>
            {canExport ? <a href={`/api/content/landing/export?projectId=${encodeURIComponent(project.id)}`}><Download className="h-4 w-4" aria-hidden /> Export zip</a> : <span><Download className="h-4 w-4" aria-hidden /> Export zip</span>}
          </Button>
        </div>
      </div>
      {items.length > sections.length && (
        <p className="text-xs text-muted">{items.length - sections.length} older {items.length - sections.length === 1 ? "row is" : "rows are"} a page plan (a list of pages) rather than a page&apos;s sections. They are kept and are not drawn in the preview.</p>
      )}
      {err || writeError ? <ErrorLine>{err || writeError}</ErrorLine> : null}
      {error && !items.length ? <ErrorLine>{error}</ErrorLine> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {loading ? (
            <LoadingBlocks rows={2} label="Loading the sections" />
          ) : sections.length === 0 ? (
            <EmptyState title="No sections yet">Use Draft with AI above to write the page from your approved message, or add a section.</EmptyState>
          ) : (
            sections.map((s, i) => (
              <SectionCard key={s.id} item={s} first={i === 0} last={i === sections.length - 1} onMove={(d) => void move(i, d)} onSave={(c) => patch(s.id, c)} onDelete={() => remove(s.id)} />
            ))
          )}
        </div>

        <Panel
          compact
          title="Preview"
          actions={
            <div role="group" aria-label="Preview colours" className="flex gap-1">
              {(["light", "dark"] as const).map((m) => (
                <Button key={m} size="sm" variant={scheme === m ? "default" : "outline"} aria-pressed={scheme === m} onClick={() => setScheme(m)}>{m === "light" ? "Light" : "Dark"}</Button>
              ))}
            </div>
          }
        >
          {preview.isError ? <ErrorLine>{messageOf(preview.error)}</ErrorLine> : null}
          {preview.data?.problems.length ? (
            <ul className="mb-2 list-disc space-y-0.5 pl-4 text-xs text-warning">{preview.data.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
          ) : null}
          {preview.data?.html ? (
            <iframe title="Landing page preview" sandbox="" srcDoc={preview.data.html} className="h-[640px] w-full rounded-md border border-hairline bg-white" />
          ) : (
            <p className="text-sm text-secondary" role="status">{preview.isPending && !loading ? "Drawing the preview." : "Nothing to show yet."}</p>
          )}
          {preview.data?.contrast?.length ? (
            <p className="mt-2 text-[11px] text-muted">Text contrast ratios of the page colours: {preview.data.contrast.map((c) => `${c.label} ${c.ratio.toFixed(1)} to 1`).join("; ")}.</p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function starter(kind: LandingKind): Content {
  switch (kind) {
    case "hero": return { headline: "Headline", subhead: "", ctaLabel: "Get it" };
    case "problem": return { heading: "The problem", points: [""] };
    case "how": return { heading: "How it works", steps: [{ title: "", text: "" }, { title: "", text: "" }] };
    case "proof": return { heading: "Proof", items: [] };
    case "comparison": return { heading: "How it compares", competitorIds: [] };
    case "faq": return { heading: "Questions", items: [{ q: "", a: "" }] };
    case "price": return { heading: "Price", ctaLabel: "Order" };
    case "footer": return { text: "" };
  }
}

function SectionCard({ item, first, last, onMove, onSave, onDelete }: { item: Item; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onSave: (c: { data?: Record<string, unknown>; status?: string }) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const kind = kindOf(item);
  const saved = (item.data.content ?? {}) as Content;
  const [c, setC] = useState<Content>(saved);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);
  const set = (k: string, v: unknown) => setC((p) => ({ ...p, [k]: v }));
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
  const t = (k: string, label: string, long = false) => (
    <Field label={label}>{long ? <Textarea rows={2} value={str(c[k])} onChange={(e) => set(k, e.target.value)} /> : <Input value={str(c[k])} onChange={(e) => set(k, e.target.value)} />}</Field>
  );
  const id = `s${item.id}`;

  return (
    <Card variant="flat" as="article" aria-label={KIND_LABEL[kind]} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-primary">{KIND_LABEL[kind]}</h3>
          <StatusPill status={item.status} />
          {item.data.noProof === true && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">No proof</span>}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label={`Move ${KIND_LABEL[kind]} up`} disabled={first} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" aria-hidden /></Button>
          <Button size="icon" variant="ghost" aria-label={`Move ${KIND_LABEL[kind]} down`} disabled={last} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" aria-hidden /></Button>
          <Button size="icon" variant="ghost" aria-label={`Delete ${KIND_LABEL[kind]}`} onClick={() => void run(onDelete)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {kind === "hero" && (<>
          {t("headline", "Headline")}{t("subhead", "Subhead", true)}{t("ctaLabel", "Button label")}{t("ctaHref", "Button address")}
          <Field label="Image file number" hint="The id of an image in Files. Alt text is required with an image."><Input inputMode="numeric" value={c.imageFileId == null ? "" : String(c.imageFileId)} onChange={(e) => set("imageFileId", e.target.value.trim() === "" ? null : Number(e.target.value))} /></Field>
          {t("imageAlt", "Image alt text", true)}
        </>)}
        {kind === "problem" && (<>{t("heading", "Heading")}<Lines label="Points" values={arr<string>(c.points)} onChange={(v) => set("points", v)} max={5} /></>)}
        {kind === "how" && (<>{t("heading", "Heading")}<Pairs label="Steps" a="title" b="text" rows={arr<Record<string, string>>(c.steps)} onChange={(v) => set("steps", v)} max={5} /></>)}
        {kind === "proof" && (<>{t("heading", "Heading")}<Proofs rows={arr<Record<string, unknown>>(c.items)} onChange={(v) => set("items", v)} /></>)}
        {kind === "comparison" && (<>{t("heading", "Heading")}{t("intro", "Introduction", true)}{t("ourLine", "Our line", true)}
          <Field label="Competitor row numbers" hint="Only rows with a source are shown. Others are left out of the page."><Input value={arr<number>(c.competitorIds).join(", ")} onChange={(e) => set("competitorIds", e.target.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isInteger))} /></Field></>)}
        {kind === "faq" && (<>{t("heading", "Heading")}<Pairs label="Questions" a="q" b="a" rows={arr<Record<string, string>>(c.items)} onChange={(v) => set("items", v)} max={10} /></>)}
        {kind === "price" && (<>{t("heading", "Heading")}{t("note", "Note", true)}{t("ctaLabel", "Button label")}{t("ctaHref", "Button address")}
          <Field label="Price row number" hint="An approved Pricing row. Empty uses the only approved one."><Input inputMode="numeric" value={c.priceItemId == null ? "" : String(c.priceItemId)} onChange={(e) => set("priceItemId", e.target.value.trim() === "" ? null : Number(e.target.value))} /></Field></>)}
        {kind === "footer" && t("text", "Footer text", true)}
      </div>

      <div className="mt-3 space-y-2">
        <FlagList flags={asFlags(item.data.flags)} />
        {err && <ErrorLine>{err}</ErrorLine>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !dirty} onClick={() => void run(() => onSave({ data: { content: c } }))}>{busy ? "Saving" : dirty ? "Save changes" : "Saved"}</Button>
        <label className="flex items-center gap-2 text-xs text-secondary" htmlFor={`${id}-status`}>
          Status
          <NativeSelect id={`${id}-status`} className="h-8 w-32" value={item.status} disabled={busy || dirty} onChange={(e) => void run(() => onSave({ status: e.target.value }))}>
            <option>draft</option>
            <option>approved</option>
          </NativeSelect>
        </label>
      </div>
    </Card>
  );
}

function Lines({ label, values, onChange, max }: { label: string; values: string[]; onChange: (v: string[]) => void; max: number }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-secondary">{label}</p>
      <ul className="space-y-1.5">
        {values.map((v, i) => (
          <li key={i} className="flex gap-2">
            <Input aria-label={`${label} ${i + 1}`} value={v} onChange={(e) => onChange(values.map((x, k) => (k === i ? e.target.value : x)))} />
            <Button size="icon" variant="ghost" aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(values.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
          </li>
        ))}
      </ul>
      <Button className="mt-1.5" size="sm" variant="outline" disabled={values.length >= max} onClick={() => onChange([...values, ""])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add</Button>
    </div>
  );
}

function Pairs({ label, a, b, rows, onChange, max }: { label: string; a: string; b: string; rows: Record<string, string>[]; onChange: (v: Record<string, string>[]) => void; max: number }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-secondary">{label}</p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-2">
            <div className="grid flex-1 gap-1.5">
              <Input aria-label={`${label} ${i + 1}, ${a}`} value={r[a] ?? ""} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, [a]: e.target.value } : x)))} />
              <Textarea aria-label={`${label} ${i + 1}, ${b}`} rows={2} value={r[b] ?? ""} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, [b]: e.target.value } : x)))} />
            </div>
            <Button size="icon" variant="ghost" aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(rows.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
          </li>
        ))}
      </ul>
      <Button className="mt-1.5" size="sm" variant="outline" disabled={rows.length >= max} onClick={() => onChange([...rows, { [a]: "", [b]: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add</Button>
    </div>
  );
}

function Proofs({ rows, onChange }: { rows: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void }) {
  const upd = (i: number, k: string, v: unknown) => onChange(rows.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-secondary">Proof items (each needs a proof row)</p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-2">
            <div className="grid flex-1 gap-1.5">
              <Input aria-label={`Claim ${i + 1}`} placeholder="The claim" value={str(r.claim)} onChange={(e) => upd(i, "claim", e.target.value)} />
              <Textarea aria-label={`Evidence ${i + 1}`} placeholder="The evidence, in words" rows={2} value={str(r.evidence)} onChange={(e) => upd(i, "evidence", e.target.value)} />
              <Input aria-label={`Proof row number ${i + 1}`} placeholder="Proof row number" inputMode="numeric" value={typeof r.proofItemId === "number" ? String(r.proofItemId) : ""} onChange={(e) => upd(i, "proofItemId", Number(e.target.value))} />
            </div>
            <Button size="icon" variant="ghost" aria-label={`Remove proof item ${i + 1}`} onClick={() => onChange(rows.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
          </li>
        ))}
      </ul>
      <Button className="mt-1.5" size="sm" variant="outline" disabled={rows.length >= 6} onClick={() => onChange([...rows, { claim: "", evidence: "", proofItemId: 0 }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add</Button>
    </div>
  );
}
