"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useProject } from "@/lib/client";
import { useProcess } from "@/lib/process/client";
import { Skeleton } from "@/components/ui/skeleton";

/** The compact next step under every page title, for the concept that is open. Nothing when no concept is open. */
export function NextStepStrip() {
  const { project } = useProject();
  if (!project) return null;
  return <Strip projectId={project.id} />;
}

function Strip({ projectId }: { projectId: string }) {
  const { view, loading, error, retry } = useProcess(projectId);
  const frame = "no-print flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline px-8 py-2 text-[13px]";

  if (loading) {
    return (
      <div className={frame} aria-busy="true" aria-label="Working out the next step">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
    );
  }
  if (error || !view) {
    return (
      <div className={frame} role="alert">
        <span className="text-danger">The next step could not be worked out: {error || "no answer"}</span>
        <button type="button" onClick={retry} className="font-medium text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
          Try again
        </button>
      </div>
    );
  }
  const { next, current } = view;
  return (
    <div className={frame} data-testid="next-step-strip">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        {String(current.n).padStart(2, "0")} {current.label}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="font-semibold text-primary">Next:</span>
        <Link href={next.href} className="inline-flex items-center gap-1 font-medium text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
          {next.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </span>
      <span className="min-w-0 text-secondary">
        <span className="font-semibold text-primary">Why:</span> {next.reason}
      </span>
    </div>
  );
}
