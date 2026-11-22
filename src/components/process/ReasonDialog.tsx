"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ConceptDialog, FormError } from "@/components/concepts/ConceptDialog";
import { WhyField } from "@/components/trace/WhyField";
import { messageOf } from "@/lib/queries";

const schema = z.object({ why: z.string() });
type Values = z.infer<typeof schema>;

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
  const { control, handleSubmit, setError, formState: { errors, isSubmitting: busy } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { why: "" } });

  const submit = handleSubmit(async ({ why }) => {
    try {
      await onConfirm(why.trim());
      setOpen(false);
    } catch (err) {
      setError("root", { message: messageOf(err) || "That was not saved." });
    }
  });

  return (
    <ConceptDialog open={open} onOpenChange={(o) => !busy && setOpen(o)} onClosed={onClosed} eyebrow={eyebrow} title={title} description={description}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Controller
          control={control}
          name="why"
          render={({ field }) => <WhyField id="reason-dialog-why" value={field.value} onChange={field.onChange} hint="Optional. Kept with your name and the time." autoFocus />}
        />
        <FormError message={errors.root?.message ?? ""} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? busyLabel : confirm}</Button>
        </div>
      </form>
    </ConceptDialog>
  );
}
