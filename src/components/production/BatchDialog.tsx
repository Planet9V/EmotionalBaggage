"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine, Field, Select } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { readBatch } from "@/lib/economics/read";
import type { Item } from "@/lib/types";

const STATUSES = ["planned", "funded", "building", "shipped"];
export type BatchDraft = { title: string; status: string; data: { units: number; targetDate: string; build: string } };

export function BatchDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: Item | null; onSave: (v: BatchDraft) => Promise<void> }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Edit batch" : "Add batch"} description="A batch is one build run: how many units, by when, from which build.">
      {open ? <Form key={initial?.id ?? "new"} initial={initial ?? null} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
    </Modal>
  );
}

function Form({ initial, onCancel, onSave }: { initial: Item | null; onCancel: () => void; onSave: (v: BatchDraft) => Promise<void> }) {
  const was = initial ? readBatch(initial) : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [units, setUnits] = useState(was?.units ? String(was.units) : "");
  const [date, setDate] = useState(was?.targetDate ?? "");
  const [build, setBuild] = useState(was?.build ?? "");
  const [status, setStatus] = useState(initial?.status ?? STATUSES[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(units.replace(/,/g, ""));
    if (!title.trim()) return setError("Give the batch a name.");
    if (!Number.isInteger(n) || n < 1) return setError("Units: enter a whole number of at least 1.");
    setBusy(true);
    setError("");
    try {
      await onSave({ title: title.trim(), status, data: { units: n, targetDate: date, build: build.trim() } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Name">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Name" autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Units">
          <Input inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} aria-label="Units" />
        </Field>
        <Field label="Target date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Target date" />
        </Field>
      </div>
      <Field label="Build it belongs to" hint="Name the build the way the acceptance tests do. Tests that name no build count for every build.">
        <Input value={build} onChange={(e) => setBuild(e.target.value)} aria-label="Build it belongs to" />
      </Field>
      <Field label="Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
