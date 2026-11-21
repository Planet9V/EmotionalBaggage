"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { messageOf } from "@/lib/queries";
import { useEditConcept, type Concept, type ConceptChange } from "@/lib/conceptsClient";
import { ConceptDialog, FormError, fieldLabel } from "./ConceptDialog";
import { joinWords, newlyHidden, TYPE_OPTIONS, typeLabel } from "./model";

/** Name, one-line description, product type and stage. A refused save keeps the form and shows the server's reason. */
export function EditConceptDialog({
  concept,
  onDone,
  onClosed,
}: {
  concept: Concept | null;
  onDone: (c: Concept) => void;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <ConceptDialog
      open={open && !!concept}
      onOpenChange={setOpen}
      onClosed={onClosed}
      eyebrow="Edit concept"
      title={concept ? concept.name : ""}
      description="Change the name, the one-line description or the product type."
    >
      {concept && (
        <EditForm
          concept={concept}
          onCancel={() => setOpen(false)}
          onSaved={(c) => {
            onDone(c);
            setOpen(false);
          }}
        />
      )}
    </ConceptDialog>
  );
}

const schema = z.object({ name: z.string().max(120), oneLiner: z.string().max(400), type: z.string() });
type Values = z.infer<typeof schema>;

function EditForm({ concept, onCancel, onSaved }: { concept: Concept; onCancel: () => void; onSaved: (c: Concept) => void }) {
  const edit = useEditConcept();
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: concept.name, oneLiner: concept.oneLiner, type: concept.productType },
  });
  const type = useWatch({ control, name: "type" });
  const hiding = newlyHidden(concept.productType, type as typeof concept.productType);

  const save = handleSubmit(async (v) => {
    const change: ConceptChange = {};
    if (v.name !== concept.name) change.name = v.name;
    if (v.oneLiner !== concept.oneLiner) change.oneLiner = v.oneLiner;
    if (v.type !== concept.productType) change.productType = v.type as typeof concept.productType;
    if (!Object.keys(change).length) {
      onSaved(concept);
      return;
    }
    try {
      onSaved(await edit.mutateAsync({ id: concept.id, change }));
    } catch (err) {
      setError("root", { message: messageOf(err) || "The change was not saved." });
    }
  });

  const busy = edit.isPending;
  return (
    <form onSubmit={(e) => void save(e)} noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor="concept-name" className={fieldLabel}>Name</label>
          <Input id="concept-name" className="mt-1" maxLength={120} autoComplete="off" data-autofocus {...register("name")} />
        </div>
        <div>
          <label htmlFor="concept-oneliner" className={fieldLabel}>One-line description</label>
          <Input id="concept-oneliner" className="mt-1" maxLength={400} autoComplete="off" {...register("oneLiner")} />
        </div>
        <fieldset>
          <legend className={fieldLabel}>Product type</legend>
          <div className="mt-1 space-y-1.5">
            {TYPE_OPTIONS.map((t) => (
              <label
                key={t.key}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-dutchOrange ${
                  type === t.key ? "border-dutchOrange bg-subtle" : "border-hairline hover:bg-subtle"
                }`}
              >
                <input
                  type="radio"
                  value={t.key}
                  className="mt-0.5 accent-[#E05A10]"
                  {...register("type")}
                />
                <span>
                  <span className="block font-medium text-primary">
                    {t.label}
                    {t.key === concept.productType && <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wide text-muted">Current</span>}
                  </span>
                  <span className="block text-xs text-secondary">{t.sentence}</span>
                </span>
              </label>
            ))}
          </div>
          {hiding.length > 0 && (
            <p className="mt-2 flex gap-2 rounded-md border border-hairline bg-warning-soft px-3 py-2 text-xs text-primary" role="status">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              <span>
                As {typeLabel(type).toLowerCase()}, this concept will hide {joinWords(hiding)}. Their rows are kept, not deleted.
                Change the type back to see them again.
              </span>
            </p>
          )}
        </fieldset>
        <p className="text-xs text-secondary">
          The stage is changed on the <a className="text-link underline" href="/process">Process page</a>, where each stage has a gate.
        </p>
      </div>
      <FormError message={errors.root?.message ?? ""} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}
