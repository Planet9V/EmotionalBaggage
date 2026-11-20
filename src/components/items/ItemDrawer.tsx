"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Column } from "@/lib/menu";
import type { Item } from "@/lib/types";
import { ItemDialogShell } from "./ItemDialogShell";
import { Field, SELECT_CLS, TEXTAREA_CLS, prim } from "./shared";

type Change = { title: string; body: string; status: string; data: Record<string, unknown> };

const afterText = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : prim(v));

export function ItemDrawer({
  item,
  onClose,
  sectionLabel,
  columns,
  statuses,
  onSave,
  onDelete,
}: {
  item: Item | null;
  onClose: () => void;
  sectionLabel: string;
  columns: Column[];
  statuses: string[];
  onSave: (id: number, c: Change) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  return (
    <ItemDialogShell
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      eyebrow={sectionLabel}
      title={item?.title || "Item"}
      description="Edit the fields and save, or delete the item."
    >
      {item && <EditForm key={item.id} item={item} columns={columns} statuses={statuses} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </ItemDialogShell>
  );
}

function EditForm({
  item,
  columns,
  statuses,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item;
  columns: Column[];
  statuses: string[];
  onClose: () => void;
  onSave: (id: number, c: Change) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [status, setStatus] = useState(item.status);
  const [cols, setCols] = useState<Record<string, string>>(() => Object.fromEntries(columns.map((c) => [c.key, prim(item.data[c.key])])));
  const [key, setKey] = useState(prim(item.data.key));
  const [minutes, setMinutes] = useState(prim(item.data.minutes));
  const [after, setAfter] = useState(afterText(item.data.after));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const editable = (k: string) => {
    const v = item.data[k];
    return v === undefined || v === null || prim(v) !== "" || v === "";
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("The title cannot be empty.");
      return;
    }
    const mins = minutes.trim();
    if (mins && !Number.isFinite(Number(mins))) {
      setError("Minutes must be a number.");
      return;
    }
    const data: Record<string, unknown> = {};
    for (const c of columns) if (editable(c.key) && cols[c.key] !== prim(item.data[c.key])) data[c.key] = cols[c.key]!.trim();
    if (key.trim() !== prim(item.data.key)) data.key = key.trim();
    if (mins !== prim(item.data.minutes) && mins !== "") data.minutes = Number(mins);
    const cleanAfter = after.split(",").map((s) => s.trim()).filter(Boolean).join(",");
    if (cleanAfter !== afterText(item.data.after).split(",").map((s) => s.trim()).filter(Boolean).join(",")) data.after = cleanAfter;
    setBusy(true);
    setError("");
    try {
      await onSave(item.id, { title: title.trim(), body, status, data });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    setError("");
    try {
      await onDelete(item.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 px-5 py-4" noValidate>
      <Field label="Title" htmlFor="edit-title">
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required aria-required />
      </Field>
      <Field label="Details" htmlFor="edit-body">
        <textarea id="edit-body" rows={5} className={TEXTAREA_CLS} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {columns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {columns.map((c) => (
            <Field key={c.key} label={c.label} htmlFor={`edit-${c.key}`} hint={editable(c.key) ? undefined : "Structured value, not editable here."}>
              <Input
                id={`edit-${c.key}`}
                value={cols[c.key] ?? ""}
                disabled={!editable(c.key)}
                onChange={(e) => setCols({ ...cols, [c.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      )}
      <Field label="Status" htmlFor="edit-status">
        <select id="edit-status" className={SELECT_CLS} value={status} onChange={(e) => setStatus(e.target.value)}>
          {(statuses.includes(status) ? statuses : [...statuses, status]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="space-y-3 rounded-xl border border-hairline bg-subtle p-4">
        <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-link">Step in the order of operations</legend>
        <p className="text-xs leading-snug text-secondary">Give this row a key and a duration and it becomes a step in the plan. Leave the key empty to keep it out.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Key" htmlFor="edit-step-key" hint="Unique, short, for example p1.">
            <Input id="edit-step-key" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Minutes" htmlFor="edit-step-min">
            <Input id="edit-step-min" inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="font-mono" />
          </Field>
        </div>
        <Field label="After" htmlFor="edit-step-after" hint="Keys of the steps this one waits on, separated by commas.">
          <Input id="edit-step-after" value={after} onChange={(e) => setAfter(e.target.value)} className="font-mono" placeholder="p0, p2" />
        </Field>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {confirming ? (
        <div role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-danger-soft p-3">
          <p className="text-sm text-danger">Delete this item for good?</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={busy} autoFocus>
              Keep it
            </Button>
            <Button type="button" size="sm" onClick={() => void del()} disabled={busy} className="bg-danger text-white hover:opacity-90">
              {busy ? "Deleting" : "Delete"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)} disabled={busy} className="text-danger hover:text-danger">
            Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
