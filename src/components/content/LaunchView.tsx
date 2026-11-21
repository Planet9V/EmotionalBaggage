"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItems } from "@/lib/client";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { asFlags, FlagList, MessageLine, StatusPill } from "./shared";
import { ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/Card";

const KINDS: Record<string, string> = { email: "Launch email", "press-note": "Press note", sequence: "Email sequence" };
const kindOf = (i: Item) => String(i.data.kind ?? "email");
const lines = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

export function LaunchView({ project, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const ordered = [...items].sort((a, b) => Object.keys(KINDS).indexOf(kindOf(a)) - Object.keys(KINDS).indexOf(kindOf(b)) || (Number(a.data.step) || 0) - (Number(b.data.step) || 0) || a.id - b.id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">Written from the approved press release. Exports are files; nothing is sent from here.</p>
        <div className="flex gap-2">
          {Object.entries(KINDS).map(([k, label]) => (
            <Button key={k} size="sm" variant="outline" onClick={() => void run(() => add({ section: store, title: label, status: "draft", data: { kind: k, ...(k === "sequence" ? { step: items.filter((i) => kindOf(i) === "sequence").length + 1 } : {}) } }))}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> {label}
            </Button>
          ))}
        </div>
      </div>
      {err || writeError ? <ErrorLine>{err || writeError}</ErrorLine> : null}
      {error && !items.length ? <ErrorLine>{error}</ErrorLine> : null}
      {loading ? (
        <LoadingBlocks rows={2} label="Loading" />
      ) : ordered.length === 0 ? (
        <SectionEmpty projectId={project.id} store="marketing/announce" sectionLabel="Launch email and press" title="No launch pieces yet">The launch email and press note tell your first buyers the product exists. They are written from the approved press release.</SectionEmpty>
      ) : (
        <ul className="space-y-4">
          {ordered.map((r) => (
            <li key={r.id}><LaunchCard projectId={project.id} row={r} onSave={(c) => patch(r.id, c)} onDelete={() => remove(r.id)} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LaunchCard({ projectId, row, onSave, onDelete }: { projectId: string; row: Item; onSave: (c: { title?: string; body?: string; data?: Record<string, unknown>; status?: string }) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const kind = kindOf(row);
  const sv = { title: row.title, body: row.body, subjects: lines(row.data.subjects), preview: String(row.data.previewText ?? ""), goal: String(row.data.goal ?? ""), offset: row.data.sendOffsetDays === undefined ? "" : String(row.data.sendOffsetDays) };
  const [v, setV] = useState(sv);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(sv);
  const set = <K extends keyof typeof sv>(k: K, x: (typeof sv)[K]) => setV((p) => ({ ...p, [k]: x }));
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
  const q = `projectId=${encodeURIComponent(projectId)}&id=${row.id}`;
  const hasSubject = kind !== "press-note";
  const save = () =>
    onSave({
      title: v.title,
      body: v.body,
      data: {
        ...(hasSubject ? { subjects: v.subjects.filter((s) => s.trim()), previewText: v.preview } : {}),
        ...(kind === "sequence" ? { goal: v.goal, ...(v.offset.trim() !== "" && Number.isInteger(Number(v.offset)) ? { sendOffsetDays: Number(v.offset) } : {}) } : {}),
      },
    });
  return (
    <Card variant="flat" as="article" aria-label={row.title} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-secondary">{KINDS[kind] ?? kind}</span>
          <StatusPill status={row.status} />
          {row.data.noProof === true && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">No proof</span>}
        </div>
        <RowActions item={row} />
        <Button size="icon" variant="ghost" aria-label={`Delete ${row.title}`} onClick={() => void run(onDelete)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="mt-2"><MessageLine message={row.data.message as { text?: string } | undefined} /></div>
      <div className="mt-3 grid gap-3">
        <Field label="Name"><Input value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
        {hasSubject && (
          <>
            <div>
              <p className="mb-1 text-xs font-medium text-secondary">Subject options</p>
              <ul className="space-y-1.5">
                {v.subjects.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input aria-label={`Subject ${i + 1}`} value={s} onChange={(e) => set("subjects", v.subjects.map((x, k) => (k === i ? e.target.value : x)))} />
                    <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted">{[...s].length}</span>
                    <Button size="icon" variant="ghost" aria-label={`Remove subject ${i + 1}`} onClick={() => set("subjects", v.subjects.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </li>
                ))}
              </ul>
              <Button className="mt-1.5" size="sm" variant="outline" disabled={v.subjects.length >= 10} onClick={() => set("subjects", [...v.subjects, ""])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add subject</Button>
            </div>
            <Field label="Preview text" hint="The line a mail app shows after the subject.">
              <Input value={v.preview} onChange={(e) => set("preview", e.target.value)} />
            </Field>
          </>
        )}
        {kind === "sequence" && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Goal of this email"><Input value={v.goal} onChange={(e) => set("goal", e.target.value)} /></Field>
            <Field label="Days from launch day" hint="Negative is before launch."><Input inputMode="numeric" value={v.offset} onChange={(e) => set("offset", e.target.value)} /></Field>
          </div>
        )}
        <Field label={kind === "sequence" ? "Outline" : "Body"}><Textarea rows={kind === "press-note" ? 10 : 8} value={v.body} onChange={(e) => set("body", e.target.value)} /></Field>
      </div>
      <div className="mt-3 space-y-2">
        <FlagList flags={asFlags(row.data.flags)} />
        {err && <ErrorLine>{err}</ErrorLine>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !dirty} onClick={() => void run(save)}>{busy ? "Saving" : dirty ? "Save changes" : "Saved"}</Button>
        <label className="flex items-center gap-2 text-xs text-secondary">
          Status
          <NativeSelect aria-label={`Status of ${row.title}`} className="h-8 w-32" value={row.status} disabled={busy || dirty} onChange={(e) => void run(() => onSave({ status: e.target.value }))}>
            <option>draft</option>
            <option>approved</option>
          </NativeSelect>
        </label>
        {row.status === "approved" ? (
          <>
            <Button size="sm" variant="outline" asChild><a href={`/api/content/launch/export?${q}&format=html`}><Download className="h-4 w-4" aria-hidden /> HTML</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`/api/content/launch/export?${q}&format=text`}><Download className="h-4 w-4" aria-hidden /> Text</a></Button>
          </>
        ) : (
          <span className="text-xs text-muted">Approve it to export.</span>
        )}
      </div>
    </Card>
  );
}
