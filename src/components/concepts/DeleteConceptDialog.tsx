"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { messageOf, queries } from "@/lib/queries";
import { exportHref, useDeleteConcept, type Concept, type DeletedConcept } from "@/lib/conceptsClient";
import { ConceptDialog, FormError, fieldLabel } from "./ConceptDialog";
import { plural } from "@/lib/format";

/**
 * Says what will go, offers the JSON export first, and deletes only once the exact name is typed.
 * The counts come from the same reads the concept's own screens use: rows from the concept list,
 * files, research answers and challenge messages from their routes.
 */
export function DeleteConceptDialog({
  concept,
  onDone,
  onClosed,
}: {
  concept: Concept;
  onDone: (d: DeletedConcept) => void;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(true);
  const del = useDeleteConcept();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  // Once the delete has gone through, nothing may ask for the concept again (it would answer 404).
  const live = !del.isPending && !del.isSuccess;
  const files = useQuery({ ...queries.files(concept.id), enabled: live });
  const research = useQuery({ ...queries.research(concept.id), enabled: live });
  const messages = useQuery({ ...queries.challenge(concept.id), enabled: live });
  const matchesName = typed === concept.name;
  const busy = del.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchesName || busy) return;
    setError("");
    try {
      const d = await del.mutateAsync({ id: concept.id, confirm: typed });
      onDone(d);
      setOpen(false);
    } catch (err) {
      setError(messageOf(err) || "The concept was not deleted.");
    }
  };

  const count = (q: { isPending: boolean; error: unknown }, n: number | undefined, one: string, many?: string) =>
    q.isPending ? (
      <Skeleton className="inline-block h-3.5 w-20 align-middle" aria-label={`Counting ${many ?? `${one}s`}`} />
    ) : q.error ? (
      <span>{many ?? `${one}s`}: could not be counted ({messageOf(q.error)})</span>
    ) : (
      <span>{plural(n ?? 0, one, many)}</span>
    );

  return (
    <ConceptDialog
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      onClosed={onClosed}
      eyebrow="Delete concept"
      title={`Delete "${concept.name}"?`}
      description="This cannot be undone."
    >
      <form onSubmit={submit} noValidate>
        <p className="text-sm text-secondary">This deletes the concept and everything in it:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-primary" aria-live="polite">
          <li>{plural(concept.rowCount, "row")}</li>
          <li>{count(files, files.data?.length, "file")}</li>
          <li>{count(research, research.data?.entries.length, "research answer")}</li>
          <li>{count(messages, messages.data?.messages.length, "challenge message")}</li>
          <li>its activity history and stage decisions</li>
        </ul>
        <p className="mt-3 text-sm text-secondary">
          <a
            href={exportHref(concept.id)}
            download
            className="inline-flex items-center gap-1.5 font-medium text-link underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Download everything as JSON first
          </a>
        </p>
        <p className="mt-3 text-xs text-secondary">
          The deletion is recorded in the audit log, which is kept. The log keeps the concept&apos;s name and id, not its contents.
        </p>
        <div className="mt-4">
          <label htmlFor="delete-confirm" className={fieldLabel}>
            Type the name to confirm
          </label>
          <p id="delete-confirm-name" className="mt-1 break-all font-mono text-xs text-primary">{concept.name}</p>
          <Input
            id="delete-confirm"
            className="mt-1"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="delete-confirm-name"
            data-autofocus
          />
        </div>
        <FormError message={error} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={!matchesName || busy} aria-busy={busy}>
            {busy ? "Deleting..." : "Delete concept"}
          </Button>
        </div>
      </form>
    </ConceptDialog>
  );
}
