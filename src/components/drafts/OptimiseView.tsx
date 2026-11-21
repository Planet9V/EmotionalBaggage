"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadError, LoadingBlocks, Panel, when } from "@/components/admin/shared";
import { useProject } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import type { OptimiseState } from "@/lib/ai/drafts/service";
import type { RunResult } from "@/lib/ai/drafts/shared";
import type { Project } from "@/lib/types";
import { ApiError, draftQueries, useOptimise } from "./api";
import { MODELS_HREF, RunSummary, WaitingDrafts } from "./DraftPanel";

const WHAT: Record<string, string> = {
  cost: "The model proposes cheaper substitutes for parts. A substitute has no price until you enter one, so the after is counted from the costs you enter.",
  parts: "A design-for-assembly check: parts that could be merged or removed, and fewer fasteners. The counts are taken from the parts list.",
  print: "Faster print settings: walls, infill, layer height, orientation, splitting. A changed job is not sliced yet until you slice it and enter the time.",
};

export function OptimiseView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Optimisation" title="Optimise" />
        <p className="p-8 text-sm text-secondary">{loading ? "Loading the concept." : <>No concept is open. <Link href="/new" className="text-link hover:underline">Start one</Link>.</>}</p>
      </>
    );
  }
  return <OptimiseBody key={project.id} project={project} />;
}

function OptimiseBody({ project }: { project: Project }) {
  const state = useQuery(draftQueries.optimise(project.id));
  const gens = useQuery(draftQueries.generators(project.id, null));
  return (
    <>
      <PageHeader
        eyebrow={`Optimisation · ${project.name}`}
        title="Optimise"
        blurb="Three actions, each measured before and after from the concept's rows. The model proposes changes as drafts; it never supplies the figures."
      />
      <div className="max-w-4xl space-y-5 px-8 py-6">
        {gens.data && !gens.data.configured && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
            <span>{gens.data.reason} The measurements below still work.</span>
            <Button asChild variant="outline" size="sm"><Link href={MODELS_HREF}>Choose a model</Link></Button>
          </div>
        )}
        {state.isPending ? (
          <LoadingBlocks rows={3} label="Measuring" />
        ) : state.error ? (
          <LoadError message={messageOf(state.error)} onRetry={() => void state.refetch()} />
        ) : (
          state.data!.map((a) => <Action key={a.id} projectId={project.id} a={a} configured={gens.data?.configured ?? false} />)
        )}
      </div>
    </>
  );
}

function Action({ projectId, a, configured }: { projectId: string; a: OptimiseState; configured: boolean }) {
  const optimise = useOptimise(projectId);
  const waiting = useQuery(draftQueries.list(projectId, a.store, "draft"));
  const mine = (waiting.data?.drafts ?? []).filter((d) => d.generator === a.generator);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  // Nothing to optimise: no parts, or no print jobs. Counted from the rows, like the figures.
  const m = a.now.measure as { parts?: number; rows?: number; jobs?: number };
  const empty = (m.parts ?? m.rows ?? m.jobs ?? 0) === 0;

  const go = (supersede = false) => {
    setError("");
    setPending(0);
    optimise.mutate(
      { action: a.id, supersede },
      {
        onSuccess: setResult,
        onError: (e) => (e instanceof ApiError && e.status === 409 && e.detail?.pending ? setPending(e.detail.pending) : setError(messageOf(e))),
      }
    );
  };

  return (
    <Panel
      title={a.label}
      description={WHAT[a.id]}
      actions={
        <Button size="sm" onClick={() => go(false)} disabled={!configured || empty || optimise.isPending} title={empty ? "Nothing to optimise yet" : undefined}>
          {optimise.isPending ? "Asking the model" : a.action}
        </Button>
      }
    >
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted">Now</dt>
        <dd className="text-primary">{a.now.text}</dd>
        {a.last ? (
          <>
            <dt className="text-muted">Before the last run</dt>
            <dd className="text-primary">{a.last.before.text} <span className="text-xs text-muted">({when(a.last.at)})</span></dd>
            <dt className="text-muted">If every waiting proposal is approved</dt>
            <dd className="text-primary">{a.last.drafts.waiting ? a.last.ifApproved.text : "Nothing is waiting"}</dd>
            <dt className="text-muted">Proposals of the last run</dt>
            <dd className="text-secondary">{a.last.drafts.waiting} waiting, {a.last.drafts.approved} approved, {a.last.drafts.rejected} rejected</dd>
          </>
        ) : (
          <>
            <dt className="text-muted">Last run</dt>
            <dd className="text-secondary">Not run yet.</dd>
          </>
        )}
      </dl>
      {pending > 0 && (
        <div role="alertdialog" aria-label="Earlier proposals are waiting" className="mt-3 space-y-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          <p>{pending} earlier {pending === 1 ? "proposal is" : "proposals are"} still waiting. Running again marks {pending === 1 ? "it" : "them"} superseded.</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => go(true)}>Run again</Button><Button size="sm" variant="outline" onClick={() => setPending(0)}>Keep them</Button></div>
        </div>
      )}
      {error && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          <span className="wrap-anywhere">{error}</span>
          <Button variant="outline" size="sm" onClick={() => go(false)}>Retry</Button>
        </div>
      )}
      {result && <div className="mt-3"><RunSummary result={result} /></div>}
      {mine.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-4">
          <WaitingDrafts projectId={projectId} store={a.store} drafts={mine} />
        </div>
      )}
    </Panel>
  );
}
