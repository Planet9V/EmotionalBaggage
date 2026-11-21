"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { draftQueries } from "@/components/drafts/api";
import { DraftPanel, MODELS_HREF } from "@/components/drafts/DraftPanel";

const STORE = "design/requirements";

/**
 * "Draft links with AI" above the Traceability tables. It shows only when gaps exist. With a reasoning model the
 * model proposes requirement-to-test and requirement-to-part links as drafts (each says why and cites both rows);
 * approving one writes both ends. Without a model it says what is missing and links to Admin, Models.
 */
export function DraftLinks({ projectId, gaps }: { projectId: string; gaps: number }) {
  const [open, setOpen] = useState(false);
  const gens = useQuery(draftQueries.links(projectId));
  const g = gens.data?.generators[0];
  if (!gaps || gens.isPending || gens.error || !g) return null;
  const configured = gens.data!.configured;
  return (
    <section aria-label="Draft links with AI" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <p id="draft-links-hint" className="max-w-2xl text-sm text-secondary">
        {!configured
          ? `${gens.data!.reason || "No reasoning model is chosen."} Choose one to have links drafted for the gaps below.`
          : g.blocked || `${gaps} ${gaps === 1 ? "gap" : "gaps"} below. The model proposes links with a reason for each; nothing is linked until you approve it.`}
      </p>
      {!configured ? (
        <Button asChild variant="outline" size="sm"><Link href={MODELS_HREF}>Choose a model</Link></Button>
      ) : (
        <Button variant="outline" size="sm" disabled={!!g.blocked} aria-describedby="draft-links-hint" onClick={() => setOpen(true)}>
          <Sparkles className="h-4 w-4 text-link" aria-hidden /> Draft links with AI
          {g.pending > 0 && <span className="ml-1 rounded-full bg-dutchOrange/15 px-1.5 font-mono text-[10px] text-link">{g.pending} waiting</span>}
        </Button>
      )}
      {open && (
        <DraftPanel open={open} onOpenChange={setOpen} projectId={projectId} store={STORE} sectionLabel="Traceability" generators={gens.data!.generators} configured={configured} reason={gens.data!.reason} model={gens.data!.model} only={g.id} />
      )}
    </section>
  );
}
