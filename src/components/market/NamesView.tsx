"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { useItems } from "@/lib/client";
import { GROUP_LABEL, GROUP_ORDER, nameChecks, SCREENING_NOTE, screeningProgress } from "@/lib/market/nameChecks";
import { namesData } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { GeneratedLine, GenerateButton, ModelGate, Notes, Status, useGenerate, useModelStatus } from "./shared";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";

const STATUSES = ["draft", "candidate", "shortlist", "chosen", "rejected"];

export function NamesView({ project }: ViewProps) {
  const store = "concept/names";
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const gen = useGenerate(project.id);
  const model = useModelStatus(project.id);
  const brief = useItems(project.id, "concept/brief");
  const [kind, setKind] = useState<"" | "Name" | "Tagline">("");
  const [count, setCount] = useState("6");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | "Name" | "Tagline">("all");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState("");

  const shown = useMemo(() => items.filter((i) => filter === "all" || (i.data.kind === "Tagline" ? "Tagline" : "Name") === filter), [items, filter]);
  if (loading) return <LoadingBlocks label="Loading names" />;
  if (error && !items.length) return <LoadError what="Names and taglines" message={error} onRetry={() => void reload()} />;

  const briefEmpty = !brief.loading && brief.items.length === 0;
  const guard = async (p: Promise<unknown>) => {
    setActionError("");
    try { await p; } catch (e) { setActionError((e as Error).message); }
  };
  const tick = (it: Item, id: string, on: boolean) => {
    const cur = namesData.safeParse(it.data);
    const screening = { ...(cur.success ? cur.data.screening : {}), [id]: on };
    return guard(patch(it.id, { data: { screening } }));
  };

  return (
    <div className="space-y-5">
      {model.configured === false && <ModelGate what="Names and taglines are suggested from the brief and your audience." />}

      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-primary">Suggest names and taglines</h2>
        <p className="text-sm text-secondary">Candidates come in batches with a short reason each. {SCREENING_NOTE}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="What to suggest"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-40"><option value="">Names and taglines</option><option value="Name">Names</option><option value="Tagline">Taglines</option></NativeSelect></Field>
          <Field label="How many"><NativeSelect value={count} onChange={(e) => setCount(e.target.value)} className="w-20">{[3, 4, 6, 8, 10].map((n) => <option key={n}>{n}</option>)}</NativeSelect></Field>
          <Field label="Direction for this batch (optional)" className="min-w-64 flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: short, one word, easy to spell" /></Field>
          <GenerateButton pending={gen.pending} disabled={model.configured === false || briefEmpty} onClick={() => void gen.run({ generator: "names", count: Number(count), kind: kind || undefined, note: note.trim() || undefined }).catch(() => undefined)}>Suggest a batch</GenerateButton>
          <Button variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add by hand</Button>
        </div>
        {gen.error && <ErrorLine>{gen.error}</ErrorLine>}
        <Notes notes={gen.notes} />
      </Card>

      {(actionError || error) && <ErrorLine>{actionError || error}</ErrorLine>}

      {!items.length ? (
        <EmptyState title="No names or taglines yet">Suggest a batch from the brief, or add your own. Each one gets a checklist of searches for you to run.</EmptyState>
      ) : (
        <>
          <div role="group" aria-label="Show" className="inline-flex overflow-hidden rounded-md border border-hairline">
            {([["all", "All"], ["Name", "Names"], ["Tagline", "Taglines"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`h-9 px-3 text-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dutchOrange ${filter === k ? "bg-subtle font-medium text-primary" : "bg-surface text-secondary hover:text-primary"}`}>{l}</button>
            ))}
          </div>
          <ul className="space-y-3" aria-label="Names and taglines">
            {shown.map((it) => {
              const d = namesData.safeParse(it.data);
              const data = d.success ? d.data : {};
              const k: "Name" | "Tagline" = data.kind === "Tagline" ? "Tagline" : "Name";
              const checks = nameChecks(it.title, k);
              const prog = screeningProgress(checks, data.screening);
              const options = STATUSES.includes(it.status) ? STATUSES : [...STATUSES, it.status];
              return (
                <li key={it.id}>
                  <Card variant="outlined" hoverEffect={false} innerClassName="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold tracking-tight text-primary wrap-anywhere">{it.title}</h3>
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{k}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Status status={it.status} />
                        <NativeSelect aria-label={`Status of ${it.title}`} value={it.status} onChange={(e) => void guard(patch(it.id, { status: e.target.value }))} className="w-32">
                          {options.map((s) => <option key={s}>{s}</option>)}
                        </NativeSelect>
                        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${it.title}`} onClick={() => void guard(remove(it.id))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                      </div>
                    </div>
                    {(data.reason || it.body) && <p className="text-sm text-secondary">{data.reason || it.body}</p>}
                    <GeneratedLine from={data.generatedFrom} />
                    <details className="group rounded-lg border border-hairline bg-surface">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-primary">
                        <span>Checks to run yourself</span>
                        <span className="font-mono text-xs text-muted">{prog.done} of {prog.total} ticked</span>
                      </summary>
                      <div className="space-y-3 border-t border-hairline px-3 py-3">
                        <p className="text-xs text-secondary">Your own checks, not a clearance.</p>
                        {GROUP_ORDER.map((g) => {
                          const list = checks.filter((c) => c.group === g);
                          if (!list.length) return null;
                          return (
                            <fieldset key={g}>
                              <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{GROUP_LABEL[g]}</legend>
                              <ul className="mt-1 space-y-1">
                                {list.map((c) => (
                                  <li key={c.id} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" id={`c${it.id}-${c.id}`} checked={!!data.screening?.[c.id]} onChange={(e) => void tick(it, c.id, e.target.checked)} aria-label={`I checked: ${c.label}`} />
                                    <a href={c.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-link underline">{c.label}<ExternalLink className="h-3 w-3" aria-hidden /><span className="sr-only"> (opens in a new tab)</span></a>
                                  </li>
                                ))}
                              </ul>
                            </fieldset>
                          );
                        })}
                        <p className="text-xs text-muted">A tick is your record that you ran the search and read the results. It is not a result. For a trademark, a lawyer&apos;s search is the check that counts.</p>
                      </div>
                    </details>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {adding && <AddDialog onClose={() => setAdding(false)} onAdd={async (title, k) => { await add({ section: store, title, data: { kind: k }, status: "candidate" }); setAdding(false); }} />}
    </div>
  );
}

function AddDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string, kind: "Name" | "Tagline") => Promise<void> }) {
  const [t, setT] = useState("");
  const [k, setK] = useState<"Name" | "Tagline">("Name");
  const [err, setErr] = useState("");
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Add a name or tagline">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!t.trim()) return setErr("Type the name or line."); onAdd(t.trim(), k).catch((x) => setErr((x as Error).message)); }}>
        <Field label="Name or line"><Input value={t} onChange={(e) => setT(e.target.value)} autoFocus /></Field>
        <Field label="Kind"><NativeSelect value={k} onChange={(e) => setK(e.target.value as typeof k)}><option>Name</option><option>Tagline</option></NativeSelect></Field>
        {err && <ErrorLine>{err}</ErrorLine>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Add</Button></div>
      </form>
    </Modal>
  );
}
