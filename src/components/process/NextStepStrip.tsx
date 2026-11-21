"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/lib/client";
import { queries } from "@/lib/queries";
import { draftQueries } from "@/components/drafts/api";
import { pageStep, refineStep, type Services } from "@/lib/process/refine";
import type { NextStep } from "@/lib/process/evaluate";
import { useProcess } from "@/lib/process/client";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingShape } from "@/components/ui/states";
import { DeepLinkFocus, focusHash } from "./DeepLinkFocus";
import { SkippedGates } from "./SkippedGates";

/** The compact next step under every page title, for the concept that is open. Nothing when no concept is open. */
export function NextStepStrip() {
  const { project } = useProject();
  if (!project) return null;
  return (
    <>
      <DeepLinkFocus />
      <Strip projectId={project.id} />
    </>
  );
}

/** What is set up in this install, for the next step's wording (U13); null while loading or unreadable. */
function useServices(): Services | null {
  const q = useQuery({ ...queries.integrations(), staleTime: 60_000 });
  return useMemo(() => {
    const list = q.data?.integrations;
    if (!list?.length) return null;
    const on = (k: string) => !!list.find((i) => i.key === k)?.configured;
    return { reasoning: on("reasoning-model"), perplexity: on("perplexity"), printer: on("printer"), x: on("x"), instagram: on("instagram"), amazonSell: on("amazon-sell") };
  }, [q.data]);
}

function StepLink({ step, testId }: { step: NextStep; testId?: string }) {
  return (
    <Link href={step.href} onClick={() => window.setTimeout(() => focusHash(new URL(step.href, window.location.href).hash), 50)} data-testid={testId} className="inline-flex items-center gap-1 font-medium text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
      {step.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

function Strip({ projectId }: { projectId: string }) {
  const { view, loading, error, retry } = useProcess(projectId);
  const pathname = usePathname() ?? "";
  const services = useServices();
  const drafts = useQuery({ ...draftQueries.list(projectId, null, "draft"), staleTime: 15_000 });
  const pending = drafts.data?.pending ?? null;
  const frame = "no-print flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline px-8 py-2 text-[13px]";

  if (loading) {
    return (
      <LoadingShape className={frame} label="Working out the next step">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </LoadingShape>
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
  const next = refineStep(view.next, services, pending);
  const current = view.current;
  // Every stage's checks, the current stage's first, for "On this page".
  const checks = [view.current, ...view.stages.filter((st) => st.key !== view.current.key)].flatMap((st) => st.result.checks);
  const here = pageStep(pathname, view.next, checks, services, pending);
  return (
    <>
    <div className={frame} data-testid="next-step-strip">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        {String(current.n).padStart(2, "0")} {current.label}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="font-semibold text-primary">Next:</span>
        <StepLink step={next} testId="next-step-link" />
      </span>
      <span className="min-w-0 text-secondary">
        <span className="font-semibold text-primary">Why:</span> {next.reason}
      </span>
    </div>
    {here && (
      <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline px-8 py-2 text-[13px]" data-testid="page-step-strip">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="font-semibold text-primary">On this page:</span>
          <StepLink step={here} testId="page-step-link" />
        </span>
        <span className="min-w-0 text-secondary">{here.reason}</span>
      </div>
    )}
    {view.skipped.length > 0 && (
      <div className="no-print border-t border-hairline px-8 py-2" data-testid="skipped-gates-strip">
        <SkippedGates projectId={projectId} skipped={view.skipped} compact />
      </div>
    )}
    </>
  );
}
