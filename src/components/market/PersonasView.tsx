"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { useItems } from "@/lib/client";
import { personaData } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ApproveButton, FieldRow, GeneratedLine, GenerateButton, ModelGate, Notes, Status, useGenerate, useModelStatus } from "./shared";
import { ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";

const FIELDS = [
  ["who", "Who they are"],
  ["job", "The job they are trying to get done"],
  ["trigger", "What makes them buy"],
  ["objection", "What stops them"],
  ["whereTheyLook", "Where they look for products like this"],
] as const;

export function PersonasView({ project, store }: ViewProps) {
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const gen = useGenerate(project.id);
  const model = useModelStatus(project.id);
  const brief = useItems(project.id, "concept/brief");
  const [count, setCount] = useState("3");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  const briefEmpty = !brief.loading && brief.items.length === 0;
  const sorted = useMemo(() => [...items].sort((a, b) => (a.status === b.status ? a.sort - b.sort : a.status === "approved" ? -1 : 1)), [items]);

  if (loading) return <LoadingBlocks label="Loading personas" />;
  if (error && !items.length) return <LoadError what="Personas" message={error} onRetry={() => void reload()} />;

  const draft = async () => {
    try {
      await gen.run({ generator: "personas", count: Number(count), note: note.trim() || undefined });
    } catch {
      /* the message is in gen.error */
    }
  };
  const guard = async (p: Promise<unknown>) => {
    setActionError("");
    try {
      await p;
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      {model.configured === false && <ModelGate what="Personas are drafted from the brief, the verified claims and your saved research answers." />}

      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-primary">Draft personas</h2>
        <p className="text-sm text-secondary">
          Reads the brief, the claims marked verified and your saved research answers. Each persona says which of them it drew on. Quotations appear only when a research answer holds the exact words.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="How many">
            <NativeSelect value={count} onChange={(e) => setCount(e.target.value)} className="w-24">
              {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
            </NativeSelect>
          </Field>
          <Field label="A note for this batch (optional)" className="min-w-64 flex-1">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: include one buyer who gives it as a gift" />
          </Field>
          <GenerateButton pending={gen.pending} onClick={() => void draft()} disabled={model.configured === false || briefEmpty}>Draft personas</GenerateButton>
          <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add by hand</Button>
        </div>
        {briefEmpty && <p className="text-xs text-muted">The brief is empty. <Link className="text-link underline" href="/s/concept/brief">Add to the brief</Link> first, so there is something to draft from.</p>}
        {gen.error && <ErrorLine>{gen.error}</ErrorLine>}
        <Notes notes={gen.notes} />
      </Card>

      {(actionError || error) && <ErrorLine>{actionError || error}</ErrorLine>}

      {!items.length ? (
        <SectionEmpty projectId={project.id} store="marketing/personas" sectionLabel="Personas" title="No personas yet">Positioning, ads and the listing are written for a persona, so they come first in Marketing. Drafts stay drafts until you approve them.</SectionEmpty>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2" aria-label="Personas">
          {sorted.map((it) => {
            const d = personaData.safeParse(it.data);
            const data = d.success ? d.data : {};
            return (
              <li key={it.id}>
                <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold tracking-tight text-primary">{it.title}</h3>
                    <div className="flex items-center gap-1"><Status status={it.status} /><RowActions item={it} /></div>
                  </div>
                  <dl className="space-y-2.5">
                    {FIELDS.map(([k, label]) => <FieldRow key={k} label={label}>{String(data[k] ?? "")}</FieldRow>)}
                    {data.theirWords?.length ? (
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">In their words, from research</dt>
                        <dd className="mt-1 space-y-1.5">
                          {data.theirWords.map((w, i) => (
                            <blockquote key={i} className="border-l-2 border-hairline pl-3 text-sm italic text-secondary">
                              &ldquo;{w.quote}&rdquo;{" "}
                              <Link href="/s/research/ask" className="not-italic text-xs text-link underline">research answer {w.researchId}</Link>
                            </blockquote>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <GeneratedLine from={data.generatedFrom} />
                  <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                    <ApproveButton item={it} onSet={(status) => patch(it.id, { status })} />
                    <Button size="sm" variant="outline" onClick={() => setEditing(it)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => void guard(remove(it.id))} aria-label={`Delete ${it.title}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <PersonaDialog
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (title, data) => {
            if (editing === "new") await add({ section: store, title, data, status: "draft" });
            // An edit of an approved persona puts it back to draft: what was approved has changed.
            else await patch(editing.id, { title, data, ...(editing.status === "approved" ? { status: "draft" } : {}) });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PersonaDialog({ item, onClose, onSave }: { item: Item | null; onClose: () => void; onSave: (title: string, data: Record<string, unknown>) => Promise<void> }) {
  const start = personaData.safeParse(item?.data ?? {});
  const d = start.success ? start.data : {};
  const [title, setTitle] = useState(item?.title ?? "");
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map(([k]) => [k, String(d[k] ?? "")])));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) return setErr("Give the persona a name.");
    setBusy(true);
    setErr("");
    try {
      await onSave(title.trim(), vals);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item ? "Edit persona" : "Add persona"} description={item?.status === "approved" ? "Saving an edit puts an approved persona back to draft." : undefined}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Name"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        {FIELDS.map(([k, label]) => (
          <Field key={k} label={label}><Textarea rows={2} value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} /></Field>
        ))}
        {err && <ErrorLine>{err}</ErrorLine>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
