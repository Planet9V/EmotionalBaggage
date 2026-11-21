"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { draftQueries } from "./api";
import { DraftPanel } from "./DraftPanel";
import { PrerequisiteLink } from "./PrerequisiteLink";

/**
 * "Draft with AI" in a section's header, placed once by the section page shell. It shows only where a
 * generator writes this section for this concept's product type, says what it will read, and counts the
 * drafts waiting for review. Without a reasoning model it still shows; the panel says what is missing
 * and links to Admin, Models.
 */
export function DraftButton({ projectId, store, sectionLabel }: { projectId: string; store: string; sectionLabel: string }) {
  const [open, setOpen] = useState(false);
  const gens = useQuery(draftQueries.generators(projectId, store));
  const list = gens.data?.generators ?? [];
  if (gens.isPending) return <Button variant="outline" size="sm" disabled aria-label="Draft with AI (loading)"><Sparkles className="h-4 w-4" aria-hidden /> Draft with AI</Button>;
  // A failure to list generators hides the button rather than block the section; the section works without it.
  if (gens.error || !list.length) return null;
  const pending = list.reduce((a, g) => a + g.pending, 0);
  const first = list[0];
  const hint = !gens.data!.configured ? "No reasoning model is chosen" : first.blocked ? first.blocked : first.readsText;
  return (
    <>
      <div className="flex flex-col items-end gap-0.5">
        <Button id="draft-with-ai" variant="outline" size="sm" onClick={() => setOpen(true)} aria-describedby={`draft-hint-${store}`}>
          <Sparkles className="h-4 w-4 text-link" aria-hidden /> Draft with AI
          {pending > 0 && <span className="ml-1 rounded-full bg-dutchOrange/15 px-1.5 font-mono text-[10px] text-link">{pending} waiting</span>}
        </Button>
        <span id={`draft-hint-${store}`} className="max-w-72 text-right text-[11px] leading-snug text-muted wrap-break-word">
          {hint}
          {gens.data!.configured && first.blocked && <PrerequisiteLink generator={first} />}
        </span>
      </div>
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
