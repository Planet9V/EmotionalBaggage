"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError, LoadingBlocks } from "@/components/ui/states";
import { useItems } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import type { Draft, GeneratorInfo, RunResult } from "@/lib/ai/drafts/shared";
import { draftQueries, useDraftActions } from "./api";
import { ApiError } from "@/lib/http";
import { DraftCard } from "./DraftCard";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Card } from "@/components/ui/Card";
import { fmtDateTime, fmtStamp } from "@/lib/format";

export const MODELS_HREF = "/admin?tab=models";

type Phase = { kind: "idle" } | { kind: "running"; started: number } | { kind: "confirm"; pending: number } | { kind: "error"; message: string } | { kind: "done"; result: RunResult };

/** The drafts waiting in one store, grouped by run, newest run first. */
function byRun(drafts: Draft[]) {
  const runs = new Map<string, Draft[]>();
  for (const d of drafts) runs.set(d.runId, [...(runs.get(d.runId) ?? []), d]);
  return [...runs.entries()].map(([runId, list]) => ({ runId, drafts: list.sort((a, b) => a.id - b.id), at: list[0]?.createdAt ?? "" })).sort((a, b) => b.at.localeCompare(a.at));
}

/** Approve every waiting draft of a run, after a confirm. */
function ApproveRunButton({ projectId, runId, count }: { projectId: string; runId: string; count: number }) {
  const { approveRun } = useDraftActions(projectId);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmButton
        label={approveRun.isPending ? "Approving" : `Approve all ${count}`}
        title={`Approve all ${count} drafts of this run?`}
        body="Each becomes a row of the section, or changes or removes the row it names. If any one cannot be approved, none are."
        confirmLabel="Approve all"
        disabled={approveRun.isPending}
        onConfirm={() => {
          setError("");
          approveRun.mutate(runId, { onError: (e) => setError(messageOf(e)) });
        }}
      />
      {error && <p role="alert" className="text-sm text-danger wrap-anywhere">{error}</p>}
    </div>
  );
}

export function WaitingDrafts({ projectId, store, drafts }: { projectId: string; store: string; drafts: Draft[] }) {
  const rows = useItems(projectId, store);
  const current = (d: Draft) => (d.itemId === null ? undefined : rows.loading ? undefined : rows.items.find((i) => i.id === d.itemId) ?? null);
  return (
    <div className="space-y-5">
      {byRun(drafts).map((r) => (
        <section key={r.runId} aria-label={`Run of ${fmtDateTime(r.at)}`} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Run of {fmtStamp(r.at)} · {r.drafts.length} waiting
            </p>
            {r.drafts.length > 1 && <ApproveRunButton projectId={projectId} runId={r.runId} count={r.drafts.length} />}
          </div>
          {r.drafts.map((d) => <DraftCard key={`${d.id}:${d.title}:${d.body.length}`} draft={d} current={current(d)} />)}
        </section>
      ))}
    </div>
  );
}

export function DraftPanel({
  open,
  onOpenChange,
  projectId,
  store,
  sectionLabel,
  generators,
  configured,
  reason,
  model,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  store: string;
  sectionLabel: string;
  generators: GeneratorInfo[];
  configured: boolean;
  reason: string;
  model: string;
}) {
  const [picked, setPicked] = useState(generators[0]?.id ?? "");
  const g = generators.find((x) => x.id === picked) ?? generators[0];
  const { run } = useDraftActions(projectId);
  const waiting = useQuery({ ...draftQueries.list(projectId, store, "draft"), enabled: open });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  const drafts = useMemo(() => waiting.data?.drafts ?? [], [waiting.data]);

  const go = async (supersede = false) => {
    if (!g) return;
    abort.current = new AbortController();
    setPhase({ kind: "running", started: Date.now() });
    try {
      const result = await run.mutateAsync({ generator: g.id, supersede, signal: abort.current.signal });
      setPhase({ kind: "done", result });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.detail?.pending) setPhase({ kind: "confirm", pending: e.detail.pending });
      else if ((e as Error).name === "AbortError") setPhase({ kind: "idle" });
      else setPhase({ kind: "error", message: messageOf(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) abort.current?.abort(); onOpenChange(o); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{sectionLabel} · AI drafts</p>
              <DialogTitle className="mt-1 text-lg font-semibold tracking-tight">{g ? g.action : "Draft with AI"}</DialogTitle>
              <DialogDescription className="mt-0.5">Drafts are not rows until you approve them. Each one lists the rows it was made from.</DialogDescription>
            </div>
            <DialogClose className="rounded-md p-1.5 text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {!configured ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
                <span>{reason || "No reasoning model is chosen."} Drafting needs a reasoning model served by Ollama, LM Studio or OpenRouter.</span>
                <Button asChild variant="outline" size="sm"><Link href={MODELS_HREF}>Choose a model</Link></Button>
              </div>
            ) : g ? (
              <section aria-label="Run" className="space-y-3">
                {generators.length > 1 && (
                  <div role="group" aria-label="What to draft" className="flex flex-wrap gap-2">
                    {generators.map((x) => (
                      <Button key={x.id} size="sm" variant={x.id === g.id ? "default" : "outline"} aria-pressed={x.id === g.id} onClick={() => setPicked(x.id)}>{x.label}</Button>
                    ))}
                  </div>
                )}
                <p className="text-sm text-secondary">
                  The reasoning model <span className="font-mono text-xs text-primary">{model}</span> reads {g.readsText.replace(/^from /, "")} and proposes rows for {sectionLabel}. Rows that do not fit the section are left out and listed.
                </p>
                {g.blocked ? (
                  <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-secondary">{g.blocked}</p>
                ) : phase.kind === "running" ? (
                  <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-hairline p-4">
                    <p className="text-sm text-primary">Read {g.readsText.replace(/^from /, "")}. Waiting for the model to answer; this can take a minute or two.</p>
                    <Skeleton className="h-3 w-2/3 bg-subtle" />
                    <Skeleton className="h-3 w-1/2 bg-subtle" />
                    <Button variant="outline" size="sm" onClick={() => abort.current?.abort()}>Cancel</Button>
                  </div>
                ) : phase.kind === "confirm" ? (
                  <div role="alertdialog" aria-label="Earlier drafts are waiting" className="space-y-3 rounded-xl border border-hairline bg-warning-soft p-4">
                    <p className="text-sm text-warning">
                      {phase.pending} {phase.pending === 1 ? "draft" : "drafts"} from an earlier run {phase.pending === 1 ? "is" : "are"} still waiting below. Running again marks {phase.pending === 1 ? "it" : "them"} rejected as superseded.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void go(true)}>Run again</Button>
                      <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>Keep them</Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => void go(false)}>
                    <Sparkles className="h-4 w-4" aria-hidden /> {phase.kind === "done" ? "Run again" : g.action}
                  </Button>
                )}
                {phase.kind === "error" && (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                    <span className="wrap-anywhere">{phase.message}</span>
                    <Button variant="outline" size="sm" onClick={() => void go(false)}>Retry</Button>
                  </div>
                )}
                {phase.kind === "done" && <RunSummary result={phase.result} />}
              </section>
            ) : null}

            <section aria-label="Waiting for review" className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight text-primary">Waiting for review</h2>
              {waiting.isPending ? (
                <LoadingBlocks rows={2} label="Loading drafts" />
              ) : waiting.error ? (
                <LoadError what="The drafts" message={messageOf(waiting.error)} onRetry={() => void waiting.refetch()} />
              ) : drafts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hairline px-4 py-5 text-sm text-secondary">No drafts are waiting. Drafts from a run appear here for you to approve, edit or reject.</p>
              ) : (
                <WaitingDrafts projectId={projectId} store={store} drafts={drafts} />
              )}
            </section>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export function RunSummary({ result }: { result: RunResult }) {
  return (
    <Card variant="well" role="status" className="space-y-2 p-4 text-sm">
      <p className="text-primary">
        {result.drafts.length} {result.drafts.length === 1 ? "draft" : "drafts"} saved for review
        {result.dropped.length ? `, ${result.dropped.length} left out` : ""}
        {result.superseded ? `; ${result.superseded} earlier ${result.superseded === 1 ? "draft" : "drafts"} superseded` : ""}.
      </p>
      {result.dropped.length > 0 && (
        <details>
          <summary className="cursor-pointer text-secondary hover:text-primary">What was left out, and why</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-secondary">
            {result.dropped.map((d, i) => <li key={i}><span className="text-primary">{d.title}</span>: {d.reason}.</li>)}
          </ul>
        </details>
      )}
      {result.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-secondary">
          {result.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </Card>
  );
}
