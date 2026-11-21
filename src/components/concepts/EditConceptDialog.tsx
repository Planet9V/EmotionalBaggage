"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGES } from "@/lib/menu";
import { messageOf } from "@/lib/queries";
import { useEditConcept, type Concept, type ConceptChange } from "@/lib/conceptsClient";
import { ConceptDialog, FormError, fieldLabel, selectClass } from "./ConceptDialog";
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
      description="Change the name, the one-line description, the product type or the stage."
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

function EditForm({ concept, onCancel, onSaved }: { concept: Concept; onCancel: () => void; onSaved: (c: Concept) => void }) {
  const edit = useEditConcept();
  const [name, setName] = useState(concept.name);
  const [oneLiner, setOneLiner] = useState(concept.oneLiner);
  const [type, setType] = useState(concept.productType);
  const [stage, setStage] = useState(concept.stage);
  const [error, setError] = useState("");
  const hiding = newlyHidden(concept.productType, type);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const change: ConceptChange = {};
    if (name !== concept.name) change.name = name;
    if (oneLiner !== concept.oneLiner) change.oneLiner = oneLiner;
    if (type !== concept.productType) change.productType = type;
    if (stage !== concept.stage) change.stage = stage;
    if (!Object.keys(change).length) {
      onSaved(concept);
      return;
    }
    try {
      onSaved(await edit.mutateAsync({ id: concept.id, change }));
    } catch (err) {
      setError(messageOf(err) || "The change was not saved.");
    }
  };

  const busy = edit.isPending;
  return (
    <form onSubmit={save} noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor="concept-name" className={fieldLabel}>Name</label>
          <Input id="concept-name" className="mt-1" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="concept-oneliner" className={fieldLabel}>One-line description</label>
          <Input id="concept-oneliner" className="mt-1" value={oneLiner} maxLength={400} onChange={(e) => setOneLiner(e.target.value)} autoComplete="off" />
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
                  name="concept-type"
                  value={t.key}
                  checked={type === t.key}
                  onChange={() => setType(t.key)}
                  className="mt-0.5 accent-[#E05A10]"
                />
                <span>
                  <span className="block font-medium text-primary">{t.label}</span>
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
        <div>
          <label htmlFor="concept-stage" className={fieldLabel}>Stage</label>
          <select id="concept-stage" className={selectClass} value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>{String(s.n).padStart(2, "0")} {s.label}</option>
            ))}
          </select>
        </div>
      </div>
      <FormError message={error} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  );
}
