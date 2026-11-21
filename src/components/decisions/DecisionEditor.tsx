"use client";

/**
 * Add or edit one decision: the question, its context, where it hangs (parent and,
 * optionally, the parent's option it follows), what it depends on, its source, what it
 * unlocks, and its options. Deleting is confirmed inside the dialog and refused while
 * the decision still has children.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Decision, DecisionOption } from "@/lib/domain";
import { parentOf, slugKey, slugOption, type Tree } from "./model";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type DecisionDraft = {
  key: string;
  question: string;
  context: string;
  parent: string;
  viaOption: string;
  dependsOn: string[];
  source: string;
  unlocks: string;
  options: DecisionOption[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the decision being edited; null to add a new one */
  editing: Decision | null;
  /** parent to preselect when adding */
  defaultParent: string;
  all: Decision[];
  byKey: Map<string, Decision>;
  tree: Tree;
  onSave: (draft: DecisionDraft) => Promise<void>;
  onDelete: (d: Decision) => Promise<void>;
};

const label = "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";

function initial(editing: Decision | null, defaultParent: string): DecisionDraft {
  if (!editing) return { key: "", question: "", context: "", parent: defaultParent, viaOption: "", dependsOn: [], source: "", unlocks: "", options: [] };
  return {
    key: editing.key,
    question: editing.question,
    context: editing.context,
    parent: editing.parent,
    viaOption: String(editing.item.data.viaOption ?? ""),
    dependsOn: [...editing.dependsOn],
    source: editing.source,
    unlocks: editing.unlocks.join(", "),
    options: editing.options.map((o) => ({ ...o })),
  };
}

export function DecisionEditor(props: Props) {
  // the form remounts each time it opens, so its state always starts from the decision as stored
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="fixed left-1/2 top-1/2 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl">
          {props.open && <Form key={props.editing?.key ?? "new"} {...props} />}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function Form({ onOpenChange, editing, defaultParent, all, byKey, tree, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<DecisionDraft>(() => initial(editing, defaultParent));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof DecisionDraft>(k: K, v: DecisionDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const self = editing?.key ?? "";

  // decisions under this one cannot be its parent
  const descendants = useMemo(() => {
    const out = new Set<string>();
    if (!self) return out;
    const stack = [...(tree.children.get(self) ?? [])];
    while (stack.length) {
      const k = stack.pop()!;
      if (out.has(k)) continue;
      out.add(k);
      stack.push(...(tree.children.get(k) ?? []));
    }
    return out;
  }, [self, tree]);

  // a dependency on a decision that already waits on this one would make a loop nobody can decide
  const waitsOnSelf = useMemo(() => {
    const out = new Set<string>();
    if (!self) return out;
    const pre = (k: string) => {
      const d = byKey.get(k);
      if (!d) return [] as string[];
      const p = parentOf(d, byKey);
      return [...(p ? [p] : []), ...d.dependsOn];
    };
    for (const d of all) {
      const seen = new Set<string>();
      const stack = [d.key];
      while (stack.length) {
        const k = stack.pop()!;
        if (seen.has(k)) continue;
        seen.add(k);
        if (k === self && d.key !== self) {
          out.add(d.key);
          break;
        }
        stack.push(...pre(k));
      }
    }
    return out;
  }, [self, all, byKey]);

  const parentDecision = draft.parent ? byKey.get(draft.parent) : undefined;
  const kids = self ? (tree.children.get(self) ?? []) : [];
  const chosenGone = !!editing?.chosen && !draft.options.some((o) => o.id === editing.chosen);

  const setOption = (i: number, change: Partial<DecisionOption>) => set("options", draft.options.map((o, j) => (j === i ? { ...o, ...change } : o)));
  // The new option's label takes focus, so what is typed next lands in it (U10).
  const focusOption = useRef<number | null>(null);
  const addOption = () => {
    focusOption.current = draft.options.length;
    set("options", [...draft.options, { id: "", label: "", outcome: "" }]);
  };
  useEffect(() => {
    if (focusOption.current === null) return;
    document.getElementById(`decision-option-${focusOption.current}-label`)?.focus();
    focusOption.current = null;
  }, [draft.options.length]);
  const removeOption = (i: number) => set("options", draft.options.filter((_, j) => j !== i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = draft.question.trim();
    if (!question) return setError("Write the question this decision answers.");
    const named = draft.options.filter((o) => o.label.trim());
    if (draft.options.some((o) => !o.label.trim() && o.outcome.trim())) return setError("Every option with an outcome needs a label.");
    if (draft.options.length > 0 && named.length === 0) return setError("Every option is blank. Type a label for at least one option, or remove the blank ones.");
    // give new options a unique id from their label; existing options keep theirs so a choice stays attached
    const ids = new Set(named.filter((o) => o.id).map((o) => o.id));
    const options = named.map((o) => {
      if (o.id) return { id: o.id, label: o.label.trim(), outcome: o.outcome.trim() };
      const id = slugOption(o.label, ids);
      ids.add(id);
      return { id, label: o.label.trim(), outcome: o.outcome.trim() };
    });
    const key = self || slugKey(question, new Set(all.map((d) => d.key)));
    const via = parentDecision?.options.some((o) => o.id === draft.viaOption) ? draft.viaOption : "";
    setBusy(true);
    setError("");
    try {
      await onSave({ ...draft, key, question, context: draft.context.trim(), source: draft.source.trim(), viaOption: via, options });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(editing);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{editing ? `Decision ${editing.key}` : "New decision"}</p>
          <DialogTitle className="mt-1 text-lg font-semibold tracking-tight">{editing ? "Edit decision" : "Add a decision"}</DialogTitle>
          <DialogDescription className="mt-0.5">
            {editing ? "Changes save to this concept's decision tree." : "It gets a short key from its question. Options can be added now or later."}
          </DialogDescription>
        </div>
        <DialogClose className="rounded-md p-1.5 text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" aria-label="Close">
          <X className="h-4 w-4" aria-hidden />
        </DialogClose>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <label className="block space-y-1.5">
          <span className={label}>Question</span>
          <Input value={draft.question} onChange={(e) => set("question", e.target.value)} placeholder="What has to be decided?" autoFocus />
        </label>
        <label className="block space-y-1.5">
          <span className={label}>Context</span>
          <Textarea value={draft.context} onChange={(e) => set("context", e.target.value)} rows={3} placeholder="Why it matters and what is known so far." />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={label}>Hangs under</span>
            <NativeSelect value={draft.parent} onChange={(e) => setDraft((d) => ({ ...d, parent: e.target.value, viaOption: "" }))}>
              <option value="">Nothing (a root decision)</option>
              {all
                .filter((d) => d.key !== self && !descendants.has(d.key))
                .map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.key}: {d.question}
                  </option>
                ))}
            </NativeSelect>
          </label>
          <label className="block space-y-1.5">
            <span className={label}>Follows option</span>
            <NativeSelect
              value={draft.viaOption}
              onChange={(e) => set("viaOption", e.target.value)}
              disabled={!parentDecision || parentDecision.options.length === 0}
            >
              <option value="">Any option of the parent</option>
              {parentDecision?.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            <span className="block text-[11px] text-muted">{parentDecision ? "Hangs this decision off one of the parent's options in the tree." : "Pick a parent first."}</span>
          </label>
        </div>

        <fieldset className="space-y-1.5">
          <legend className={label}>Depends on</legend>
          {all.filter((d) => d.key !== self).length === 0 ? (
            <p className="text-xs text-muted">No other decisions yet.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-hairline p-2">
              {all
                .filter((d) => d.key !== self)
                .map((d) => {
                  const loop = waitsOnSelf.has(d.key);
                  const on = draft.dependsOn.includes(d.key);
                  return (
                    <label key={d.key} className={`flex items-start gap-2 rounded-sm px-1.5 py-1 text-sm ${loop && !on ? "opacity-50" : "hover:bg-subtle"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[#E05A10]"
                        checked={on}
                        disabled={loop && !on}
                        onChange={(e) => set("dependsOn", e.target.checked ? [...draft.dependsOn, d.key] : draft.dependsOn.filter((k) => k !== d.key))}
                      />
                      <span className="min-w-0">
                        <span className="font-mono text-[11px] text-link">{d.key}</span> <span className="text-primary">{d.question}</span>
                        {loop && <span className="block text-[11px] text-muted">Already waits on this decision, so it would make a loop.</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={label}>Source</span>
            <Input value={draft.source} onChange={(e) => set("source", e.target.value)} placeholder="Where this comes from" />
          </label>
          <label className="block space-y-1.5">
            <span className={label}>Unlocks</span>
            <Input value={draft.unlocks} onChange={(e) => set("unlocks", e.target.value)} placeholder="design/bom, sales/listing" />
            <span className="block text-[11px] text-muted">Comma separated. stage/section keys become links.</span>
          </label>
        </div>

        <fieldset className="space-y-2">
          <div className="flex items-center justify-between">
            <legend className={label}>Options</legend>
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add option
            </Button>
          </div>
          {draft.options.length === 0 && <p className="text-xs text-muted">No options yet. A decision needs at least one before it can be chosen.</p>}
          {draft.options.map((o, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-hairline p-2.5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
              <Input id={`decision-option-${i}-label`} value={o.label} onChange={(e) => setOption(i, { label: e.target.value })} placeholder="Label" aria-label={`Option ${i + 1} label`} />
              <Input value={o.outcome} onChange={(e) => setOption(i, { outcome: e.target.value })} placeholder="What choosing it leads to" aria-label={`Option ${i + 1} outcome`} />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)} aria-label={`Remove option ${o.label || i + 1}`}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
              {editing?.chosen && o.id === editing.chosen && <p className="text-[11px] text-link sm:col-span-3">This is the chosen option.</p>}
            </div>
          ))}
          {chosenGone && <p className="text-xs text-warning">The chosen option is removed, so saving reopens this decision.</p>}
        </fieldset>

        {editing && (
          <div className="rounded-lg border border-hairline p-3">
            {kids.length > 0 ? (
              <p className="text-xs text-secondary">
                This decision cannot be deleted while {kids.length === 1 ? "a decision hangs" : `${kids.length} decisions hang`} under it ({kids.join(", ")}). Move or delete
                {kids.length === 1 ? " it" : " them"} first.
              </p>
            ) : confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-xs text-primary">Delete &ldquo;{editing.question}&rdquo;? This cannot be undone.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Keep it
                </Button>
                <Button type="button" size="sm" onClick={remove} disabled={busy} className="bg-danger-solid! hover:opacity-90!">
                  Delete
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-xs text-muted">
                  {all.some((d) => d.dependsOn.includes(editing.key)) ? "Other decisions depend on this one; deleting it drops that link." : "Nothing hangs under this decision."}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete decision
                </Button>
              </div>
            )}
          </div>
        )}
        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : editing ? "Save changes" : "Add decision"}
        </Button>
      </div>
    </form>
  );
}
