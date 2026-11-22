"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { describe } from "@/components/ui/field";
import { ConceptDialog, FormError, fieldLabel } from "@/components/concepts/ConceptDialog";
import { messageOf } from "@/lib/queries";
import { useOverrideGate, type StageView } from "@/lib/process/client";

const REASON_ID = "override-reason";

const schema = z.object({
  reason: z.string().refine((v) => v.trim() !== "", "Type the reason for passing this gate without its checks."),
});
type Values = z.infer<typeof schema>;

/**
 * Pass a gate without its checks (owner's decision D6). The reason is required; it is kept on the
 * gate with who and when, and written to the history and the audit log.
 */
export function OverrideDialog({ projectId, stage, onClosed }: { projectId: string; stage: StageView; onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  const mutation = useOverrideGate(projectId);
  const busy = mutation.isPending;
  const unmet = stage.result.checks.filter((c) => !c.met);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: "" } });

  const submit = handleSubmit(async ({ reason }) => {
    try {
      await mutation.mutateAsync({ stage: stage.key, reason });
      setOpen(false);
    } catch (err) {
      setError("root", { message: messageOf(err) || "The override was not saved." });
    }
  });

  return (
    <ConceptDialog
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      onClosed={onClosed}
      eyebrow={`Stage ${String(stage.n).padStart(2, "0")} · ${stage.label}`}
      title={`Override the ${stage.label} gate`}
      description="The gate counts as passed even though these checks are not met. Your reason is kept with your name and the time."
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-secondary">
          {unmet.map((c) => (
            <li key={c.id}>{c.label}. <span className="text-muted">{c.detail}</span></li>
          ))}
        </ul>
        <label htmlFor={REASON_ID} className={fieldLabel}>Reason</label>
        <Textarea
          id={REASON_ID}
          className="mt-1"
          rows={4}
          maxLength={1000}
          {...describe(REASON_ID, { hint: true, error: errors.reason?.message ?? errors.root?.message })}
          {...register("reason")}
          data-autofocus
        />
        <p id={`${REASON_ID}-hint`} className="mt-1 text-xs text-muted">Say what you checked instead, or why these checks do not apply.</p>
        <FormError id={`${REASON_ID}-error`} message={errors.reason?.message ?? errors.root?.message ?? ""} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Keep the gate</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving..." : "Override gate"}</Button>
        </div>
      </form>
    </ConceptDialog>
  );
}
