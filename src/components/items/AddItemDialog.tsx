"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Column } from "@/lib/menu";
import { ItemDialogShell } from "./ItemDialogShell";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Draft = { title: string; body: string; status: string; data: Record<string, string> };

export function AddItemDialog({
  open,
  onOpenChange,
  label,
  sectionLabel,
  columns,
  statuses,
  onCreate,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  sectionLabel: string;
  columns: Column[];
  statuses: string[];
  onCreate: (d: { title: string; body: string; status: string; data: Record<string, string> }) => Promise<void>;
  returnFocus?: () => HTMLElement | null | undefined;
}) {
  return (
    <ItemDialogShell returnFocus={returnFocus} open={open} onOpenChange={onOpenChange} eyebrow={sectionLabel} title={label} description="A title is required. Everything else can be filled in later.">
      {open && <AddForm columns={columns} statuses={statuses} onCancel={() => onOpenChange(false)} onCreate={onCreate} />}
    </ItemDialogShell>
  );
}

function AddForm({ columns, statuses, onCancel, onCreate }: { columns: Column[]; statuses: string[]; onCancel: () => void; onCreate: (d: Draft) => Promise<void> }) {
  const [d, setD] = useState<Draft>({ title: "", body: "", status: statuses[0] ?? "open", data: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) {
      setError("Give it a title.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.data)) if (v.trim()) data[k] = v.trim();
      await onCreate({ ...d, title: d.title.trim(), body: d.body.trim(), data });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 px-5 py-4" noValidate>
      <Field label="Title" id="add-title">
        <Input id="add-title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} autoFocus required aria-required aria-invalid={!!error && !d.title.trim()} />
      </Field>
      <Field label="Details" id="add-body">
        <Textarea id="add-body" rows={4} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
      </Field>
      {columns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {columns.map((c) => (
            <Field key={c.key} label={c.label} id={`add-${c.key}`}>
              <Input id={`add-${c.key}`} value={d.data[c.key] ?? ""} onChange={(e) => setD({ ...d, data: { ...d.data, [c.key]: e.target.value } })} />
            </Field>
          ))}
        </div>
      )}
      <Field label="Status" id="add-status">
        <NativeSelect id="add-status" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding" : "Add"}
        </Button>
      </div>
    </form>
  );
}
