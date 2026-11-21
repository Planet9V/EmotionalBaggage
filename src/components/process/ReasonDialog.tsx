"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConceptDialog, FormError } from "@/components/concepts/ConceptDialog";
import { WhyField } from "@/components/trace/WhyField";
import { messageOf } from "@/lib/queries";

/**
 * A confirmation with an optional "Why (kept in the history)": moving a stage back and withdrawing an
 * override use it. Only a gate override needs a reason; these two take one when you have it.
 */
export function ReasonDialog({
  eyebrow,
  title,
  description,
  confirm,
  busyLabel,
  onConfirm,
  onClosed,
}: {
  eyebrow: string;
  title: string;
  description: string;
  confirm: string;
  busyLabel: string;
  /** resolves when done; a rejection is shown in the dialog */
  onConfirm: (why: string) => Promise<void>;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onConfirm(why.trim());
      setOpen(false);
    } catch (err) {
      setError(messageOf(err) || "That was not saved.");
      setBusy(false);
    }
  };

  return (
    <ConceptDialog open={open} onOpenChange={(o) => !busy && setOpen(o)} onClosed={onClosed} eyebrow={eyebrow} title={title} description={description}>
      <form onSubmit={submit} noValidate>
        <WhyField id="reason-dialog-why" value={why} onChange={setWhy} hint="Optional. Kept with your name and the time." autoFocus />
        <FormError message={error} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? busyLabel : confirm}</Button>
        </div>
      </form>
    </ConceptDialog>
  );
}
