"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GitBranch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { messageOf } from "@/lib/queries";
import { type RunResult } from "@/lib/ai/drafts/shared";
import { storeLink } from "@/lib/menuLookup";
import { WATCHED_STORES, type ImpactReply } from "@/lib/ai/drafts/impact";
import type { Item } from "@/lib/types";
import { draftKeys, useImpact } from "./api";
import { ApiError } from "@/lib/http";
import { RunSummary } from "./DraftPanel";
import { Card } from "@/components/ui/Card";

/** Changes that do not alter what a row means: positions, order, a status on its own. */
const COSMETIC = new Set(["geometry", "schematic", "sort"]);

type Change = { title?: string; body?: string; status?: string; sort?: number; data?: Record<string, unknown> };

/** Whether a saved change to a row is worth checking for what it affects. */
export function meaningful(item: Pick<Item, "section">, change: Change) {
  if (!WATCHED_STORES.has(item.section)) return false;
  if (change.title !== undefined || change.body !== undefined) return true;
  const data = Object.keys(change.data ?? {}).filter((k) => !COSMETIC.has(k));
  return data.length > 0;
}

/**
 * After a decision, requirement or part is saved with a change that matters, asks the planner what it
 * affects and, when anything is, shows a quiet notice "This affects 7 rows" that opens the Impact panel.
 * It never blocks the save. It listens to the item writes of the shared hooks, so every view that saves
 * through useItems is covered without changing the view.
 */
export function ImpactNotice({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { impact } = useImpact(projectId);
  const [reply, setReply] = useState<ImpactReply | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const check = impact.mutate;

  useEffect(
    () =>
      qc.getMutationCache().subscribe((ev) => {
        if (ev.type !== "updated" || ev.action.type !== "success") return;
        const key = ev.mutation.options.mutationKey;
        if (!Array.isArray(key) || key[0] !== "items-write" || key[1] !== projectId) return;
        // Counts on the Draft with AI buttons change with the rows.
        void qc.invalidateQueries({ queryKey: draftKeys.all(projectId) });
        const vars = ev.mutation.state.variables as { id?: number; change?: Change } | undefined;
        const row = ev.action.data as Item | undefined;
        if (!vars?.change || !row || typeof row.id !== "number") return;
        if (!meaningful(row, vars.change)) return;
        setDismissed(false);
        check(row.id, { onSuccess: setReply, onError: () => setReply(null) });
      }),
    [qc, projectId, check]
  );

  if (!reply || dismissed) return null;
  if (reply.engine === "unavailable") {
    return (
      <Card variant="well" role="status" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm text-secondary">
        <span>{reply.note}</span>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </Card>
    );
  }
  if (reply.total === 0) return null;
  return (
    <>
      <Card variant="flat" role="status" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <span className="text-primary">
          <GitBranch className="mr-1.5 inline h-4 w-4 text-link" aria-hidden />
          Your change to &ldquo;{reply.changed.title}&rdquo; affects {reply.total} {reply.total === 1 ? "row" : "rows"} in {reply.groups.length} {reply.groups.length === 1 ? "section" : "sections"}.
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Show what it affects</Button>
          <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} aria-label="Dismiss">
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </Card>
      <ImpactPanel projectId={projectId} reply={reply} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ImpactPanel({ projectId, reply, open, onOpenChange }: { projectId: string; reply: Extract<ImpactReply, { engine: "networkx" }>; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { propose } = useImpact(projectId);
  const [runs, setRuns] = useState<RunResult[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const groups = reply.groups
    .filter((g) => g.generator)
    .reduce<{ generator: string; itemIds: number[] }[]>((acc, g) => {
      const found = acc.find((x) => x.generator === g.generator);
      const ids = g.rows.map((r) => r.itemId);
      if (found) found.itemIds = [...new Set([...found.itemIds, ...ids])];
      else acc.push({ generator: g.generator!, itemIds: [...new Set(ids)] });
      return acc;
    }, []);
  const byHand = reply.groups.filter((g) => !g.generator);

  const go = (supersede = false) => {
    setError("");
    setPending(0);
    propose.mutate(
      { itemId: reply.changed.itemId, groups, supersede },
      {
        onSuccess: (r) => setRuns(r.runs),
        onError: (e) => (e instanceof ApiError && e.status === 409 && e.detail?.pending ? setPending(e.detail.pending) : setError(messageOf(e))),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="fixed left-1/2 top-1/2 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Impact · worked out by the planner</p>
              <DialogTitle className="mt-1 text-lg font-semibold tracking-tight wrap-anywhere">What &ldquo;{reply.changed.title}&rdquo; affects</DialogTitle>
              <DialogDescription className="mt-0.5">Every row that depends on it, by section, with the link that reaches it.</DialogDescription>
            </div>
            <DialogClose className="rounded-md p-1.5 text-muted hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </DialogClose>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {reply.groups.map((g) => (
              <section key={g.section} aria-labelledby={`imp-${g.section}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id={`imp-${g.section}`} className="text-sm font-semibold text-primary">
                    <Link href={storeLink(g.section)} className="hover:text-link hover:underline">{g.label}</Link>
                    <span className="ml-2 font-mono text-[10px] text-muted">{g.rows.length}</span>
                  </h2>
                  <span className="text-xs text-muted">{g.generator ? "Can be proposed" : "Review by hand"}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {g.rows.map((r) => (
                    <li key={r.nodeId} className="rounded-lg border border-hairline px-3 py-2">
                      <p className="text-sm text-primary">{r.title}</p>
                      <p className="mt-0.5 text-xs text-secondary">Why: {r.why}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section aria-label="Propose updates" className="space-y-3 border-t border-hairline pt-4">
              {groups.length ? (
                <p className="text-sm text-secondary">
                  Propose updates asks the reasoning model to revise only the affected rows of{" "}
                  {reply.groups.filter((g) => g.generator).map((g) => g.label).join(", ")}. Each proposal is a draft showing the row before and after; nothing changes until you approve it.
                </p>
              ) : (
                <p className="text-sm text-secondary">No generator writes these sections, so there is nothing to propose. Review them by hand.</p>
              )}
              {byHand.length > 0 && groups.length > 0 && <p className="text-xs text-muted">{byHand.map((g) => g.label).join(", ")}: no generator writes these; review them by hand.</p>}
              {pending > 0 && (
                <div role="alertdialog" aria-label="Earlier drafts are waiting" className="space-y-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                  <p>{pending} earlier {pending === 1 ? "draft" : "drafts"} of one of these generators {pending === 1 ? "is" : "are"} still waiting. Proposing now marks {pending === 1 ? "it" : "them"} rejected as superseded.</p>
                  <div className="flex gap-2"><Button size="sm" onClick={() => go(true)}>Propose anyway</Button><Button size="sm" variant="outline" onClick={() => setPending(0)}>Keep them</Button></div>
                </div>
              )}
              {error && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  <span className="wrap-anywhere">{error}</span>
                  <Button variant="outline" size="sm" onClick={() => go(false)}>Retry</Button>
                </div>
              )}
              {runs ? (
                <div className="space-y-2">
                  {runs.map((r) => <RunSummary key={r.runId} result={r} />)}
                  <Button asChild size="sm"><Link href="/drafts">Review the drafts</Link></Button>
                </div>
              ) : groups.length > 0 && !pending ? (
                <Button onClick={() => go(false)} disabled={propose.isPending}>{propose.isPending ? "Proposing; this can take a minute" : "Propose updates"}</Button>
              ) : null}
            </section>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
