"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageOf } from "@/lib/queries";
import { WhyField } from "@/components/trace/WhyField";
import { useArchiveConcept, useDuplicateConcept, type Concept } from "@/lib/conceptsClient";
import { ConceptDialog, FormError, fieldLabel } from "./ConceptDialog";

// The server checks the name (and refuses an empty one with its own sentence); the form only carries it.
const duplicateSchema = z.object({ name: z.string() });
const archiveSchema = z.object({ why: z.string() });

/** Asks for the copy's name; the server copies rows and files, not history, chat, research or stage decisions. */
export function DuplicateConceptDialog({ concept, onDone, onClosed }: { concept: Concept; onDone: (c: Concept) => void; onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  const dup = useDuplicateConcept();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<z.infer<typeof duplicateSchema>>({
    resolver: zodResolver(duplicateSchema),
    defaultValues: { name: `${concept.name} copy`.slice(0, 120) },
  });
  const busy = dup.isPending;

  const submit = handleSubmit(async ({ name }) => {
    try {
      onDone(await dup.mutateAsync({ id: concept.id, name }));
      setOpen(false);
    } catch (err) {
      setError("root", { message: messageOf(err) || "The copy was not made." });
    }
  });

  return (
    <ConceptDialog
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      onClosed={onClosed}
      eyebrow="Duplicate concept"
      title={`Duplicate "${concept.name}"`}
      description="The copy gets every row and file. Activity history, challenge messages, research answers and stage decisions stay with the original."
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label htmlFor="duplicate-name" className={fieldLabel}>Name of the copy</label>
        <Input id="duplicate-name" className="mt-1" maxLength={120} autoComplete="off" data-autofocus {...register("name")} />
        <FormError message={errors.root?.message ?? ""} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Duplicating..." : "Duplicate"}</Button>
        </div>
      </form>
    </ConceptDialog>
  );
}

/** Explains what archiving does before doing it. */
export function ArchiveConceptDialog({
  concept,
  isCurrent,
  onDone,
  onClosed,
}: {
  concept: Concept;
  isCurrent: boolean;
  onDone: (c: Concept) => void;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(true);
  const archive = useArchiveConcept();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<z.infer<typeof archiveSchema>>({ resolver: zodResolver(archiveSchema), defaultValues: { why: "" } });
  const busy = archive.isPending;

  const submit = handleSubmit(async ({ why }) => {
    try {
      onDone(await archive.mutateAsync({ id: concept.id, why }));
      setOpen(false);
    } catch (err) {
      setError("root", { message: messageOf(err) || "The concept was not archived." });
    }
  });

  return (
    <ConceptDialog
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      onClosed={onClosed}
      eyebrow="Archive concept"
      title={`Archive "${concept.name}"?`}
      description="Nothing is deleted. You can restore it at any time."
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>It leaves the concept switcher in the sidebar and cannot be opened.</li>
          <li>It stays on this page under Archived, where you can still export or delete it.</li>
          <li>Restore puts it back exactly as it was.</li>
          {isCurrent && <li>It is the concept open now. The app will open another one.</li>}
        </ul>
        <div className="mt-4">
          <Controller control={control} name="why" render={({ field }) => <WhyField id="archive-why" value={field.value} onChange={field.onChange} />} />
        </div>
        <FormError message={errors.root?.message ?? ""} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Archiving..." : "Archive"}</Button>
        </div>
      </form>
    </ConceptDialog>
  );
}
