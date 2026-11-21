"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { draftQueries } from "./api";
import { DraftPanel, MODELS_HREF } from "./DraftPanel";

/** "N drafts waiting for review", the shared plural. */
export function waitingText(n: number) {
  return `${n} ${n === 1 ? "draft" : "drafts"} waiting for review`;
}

/**
 * The AI half of an empty state: where a generator writes this section, "Draft with AI" (or "Review N
 * drafts" when some wait) with a reasoning model chosen, else "Set a model in Admin" as a link. Nothing
 * where no generator writes the section.
 */
export function EmptyDraftAction({ projectId, store, sectionLabel }: { projectId: string; store: string; sectionLabel: string }) {
  const [open, setOpen] = useState(false);
  const gens = useQuery(draftQueries.generators(projectId, store));
  const list = gens.data?.generators ?? [];
  if (gens.isPending || gens.error || !list.length) return null;
  const pending = list.reduce((a, g) => a + g.pending, 0);
  if (!gens.data!.configured && !pending) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={MODELS_HREF}>Set a model in Admin</Link>
      </Button>
    );
  }
  return (
    <>
      <Button variant={pending ? "default" : "outline"} size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" aria-hidden /> {pending ? `Review ${pending} waiting ${pending === 1 ? "draft" : "drafts"}` : "Draft with AI"}
      </Button>
      {open && (
        <DraftPanel
          open={open}
          onOpenChange={setOpen}
          projectId={projectId}
          store={store}
          sectionLabel={sectionLabel}
          generators={list}
          configured={gens.data!.configured}
          reason={gens.data!.reason}
          model={gens.data!.model}
        />
      )}
    </>
  );
}

/** The count of drafts waiting in a store, for an empty state's sentence ("2 drafts waiting for review"). */
export function useWaitingDrafts(projectId: string, store: string) {
  const gens = useQuery(draftQueries.generators(projectId, store));
  return (gens.data?.generators ?? []).reduce((a, g) => a + g.pending, 0);
}

/**
 * A section's empty state: the kit's EmptyState with the section's AI action. When drafts wait, the title
 * says so instead of "No ... yet", so an empty page never hides work waiting for review.
 */
export function SectionEmpty({
  projectId,
  store,
  sectionLabel,
  icon,
  title,
  children,
  action,
  testId,
}: {
  projectId: string;
  store: string;
  sectionLabel: string;
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  const waiting = useWaitingDrafts(projectId, store);
  return (
    <EmptyState
      icon={icon}
      title={waiting ? `${title}, ${waitingText(waiting)}` : title}
      action={action}
      ai={<EmptyDraftAction projectId={projectId} store={store} sectionLabel={sectionLabel} />}
      testId={testId}
    >
      {children}
    </EmptyState>
  );
}
