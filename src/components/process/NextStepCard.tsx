"use client";

import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { useProcess } from "@/lib/process/client";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CheckList } from "./CheckList";
import { gateBadge } from "./gateBadge";
import { focusHash } from "./DeepLinkFocus";

/** The next step in full, for the overview: what to do, why, and the current stage's gate. */
export function NextStepCard({ projectId, showGate = true }: { projectId: string; showGate?: boolean }) {
  const { view, loading, error, retry } = useProcess(projectId);

  if (loading) {
    return (
      <section aria-label="Next step" aria-busy="true" className="space-y-3 rounded-xl border border-hairline bg-surface p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </section>
    );
  }
  if (error || !view) {
    return (
      <section aria-label="Next step" className="rounded-xl border border-hairline bg-danger-soft p-5 text-sm text-danger" role="alert">
        <p>The next step could not be worked out: {error || "no answer"}</p>
        <button type="button" onClick={retry} className="mt-2 font-medium underline">Try again</button>
      </section>
    );
  }
  const { next, current } = view;
  const badge = gateBadge(current);
  return (
    <section aria-labelledby="next-step-h" className="rounded-xl border border-hairline bg-surface p-5" data-testid="next-step-card">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">
        Stage {String(current.n).padStart(2, "0")} · {current.label}
      </p>
      <h2 id="next-step-h" className="mt-1.5 text-lg font-semibold tracking-tight text-primary">Next step</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={next.href}
          onClick={() => window.setTimeout(() => focusHash(new URL(next.href, window.location.href).hash), 50)}
          className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-2 text-sm font-medium text-white transition hover:bg-action-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange focus-visible:ring-offset-2"
        >
          {next.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {showGate && (
          <Link href="/process" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-link">
            <ListChecks className="h-4 w-4" aria-hidden /> Open the process
          </Link>
        )}
      </div>
      <p className="mt-2 max-w-3xl text-sm text-secondary">
        <span className="font-semibold text-primary">Why:</span> {next.reason}
      </p>
      {showGate && <div className="mt-4">
        <h3 id="current-gate-h" className="flex items-center gap-2 text-sm font-semibold text-primary">
          The {current.label} gate <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
        </h3>
        <div className="mt-2">
          <CheckList checks={current.result.checks} labelledBy="current-gate-h" />
        </div>
      </div>}
    </section>
  );
}
