"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/lib/client";
import { useProcess } from "@/lib/process/client";
import { productType } from "@/lib/productTypes";
import { fmtTime } from "@/components/plan/format";
import { NextStepCard } from "./NextStepCard";
import { ProcessStepper } from "./ProcessStepper";

/** The Process page: the stages, their gates, override and advance, and the history of gate and stage changes. */
export function ProcessPage() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Process" title="Process" nextStep={false} />
        <div className="p-8 text-sm text-secondary">
          {loading ? (
            <Skeleton className="h-4 w-64" />
          ) : (
            <p>
              No concept is open. <Link href="/new" className="text-link hover:underline">Start one with the wizard</Link> to see its stages and gates.
            </p>
          )}
        </div>
      </>
    );
  }
  return <Body key={project.id} projectId={project.id} name={project.name} />;
}

function Body({ projectId, name }: { projectId: string; name: string }) {
  const { view, loading, error, retry } = useProcess(projectId);
  const type = view ? productType(view.state.productType).label : "";
  return (
    <>
      <PageHeader
        eyebrow={`Process · ${name}`}
        title="Process"
        blurb={`Each stage has a gate: the checks that show it is done. Gates warn and never stop you reading or editing. ${type ? `This concept follows the process for: ${type}.` : ""}`}
        nextStep={false}
      >
        <Link href="/plan" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-link">
          <GitBranch className="h-4 w-4" aria-hidden /> Order of operations
        </Link>
      </PageHeader>
      <div className="grid gap-8 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <NextStepCard projectId={projectId} showGate={false} />
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading the stages">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : error || !view ? (
            <div className="rounded-xl border border-hairline bg-danger-soft p-4 text-sm text-danger" role="alert">
              <p>The stages could not be loaded: {error || "no answer"}</p>
              <button type="button" onClick={retry} className="mt-2 font-medium underline">Try again</button>
            </div>
          ) : (
            <ProcessStepper projectId={projectId} view={view} />
          )}
        </div>
        <aside className="min-w-0 space-y-3" aria-labelledby="history-h">
          <h2 id="history-h" className="text-base font-semibold tracking-tight text-primary">Gate and stage history</h2>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : view && view.state.history.length ? (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
              {view.state.history.map((e) => (
                <li key={e.id} className="px-4 py-2.5 text-sm">
                  <p className="font-mono text-[11px] text-muted">
                    {fmtTime(e.createdAt)}
                    {typeof e.data.by === "string" && e.data.by ? ` · ${e.data.by}` : ""}
                  </p>
                  <p className="mt-0.5 text-secondary">{e.summary}</p>
                </li>
              ))}
            </ul>
          ) : view ? (
            <p className="text-sm text-muted">No gate has been overridden and the stage has not changed yet. Overrides and stage moves appear here.</p>
          ) : null}
          <p className="text-xs text-muted">
            The order the work can be done in is on the <Link href="/plan" className="text-link hover:underline">order of operations</Link> page.
          </p>
        </aside>
      </div>
    </>
  );
}
