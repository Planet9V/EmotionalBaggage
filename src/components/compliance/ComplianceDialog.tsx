"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isPublicUrl } from "@/lib/economics/schemas";
import type { Item } from "@/lib/types";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";

export type ComplianceDraft = { title: string; data: { why: string; check: string; evidence: string } };

export function ComplianceDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: Item | null; onSave: (v: ComplianceDraft) => Promise<void> }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={initial ? "Edit compliance row" : "Add compliance row"} description="A topic for your own checking. Not advice.">
      {open ? <Form key={initial?.id ?? "new"} initial={initial ?? null} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
    </Modal>
  );
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

function Form({ initial, onCancel, onSave }: { initial: Item | null; onCancel: () => void; onSave: (v: ComplianceDraft) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [why, setWhy] = useState(text(initial?.data.why));
  const [check, setCheck] = useState(text(initial?.data.check));
  const [evidence, setEvidence] = useState(text(initial?.data.evidence));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Name the topic, for example: Radio equipment: FCC Part 15 in the US, RED in the EU.");
    if (evidence.trim() && !isPublicUrl(evidence.trim())) return setError("Evidence: enter a public web address starting with http:// or https://.");
    setBusy(true);
    setError("");
    try {
      await onSave({ title: title.trim(), data: { why: why.trim(), check: check.trim(), evidence: evidence.trim() } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Topic">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Topic" autoFocus />
      </Field>
      <Field label="Why it may apply" hint="Name the part or the claim that triggers it.">
        <Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Why it may apply" />
      </Field>
      <Field label="What to check">
        <Textarea rows={3} value={check} onChange={(e) => setCheck(e.target.value)} aria-label="What to check" />
      </Field>
      <Field label="Evidence web address" hint="Where the evidence can be seen. A public address only.">
        <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} aria-label="Evidence web address" inputMode="url" />
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
