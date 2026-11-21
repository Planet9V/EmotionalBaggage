"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useItems } from "@/lib/client";
import { keys, messageOf, queries } from "@/lib/queries";
import type { AttackRecord } from "@/lib/ai/drafts/shared";
import type { Item } from "@/lib/types";
import { ApiError, useAttackRow, useDraftActions } from "./api";
import { MODELS_HREF } from "./DraftPanel";

const GENERATOR: Record<string, string> = { "concept/press": "press-release", "concept/faq": "faq" };

type Msg = { id: number; role: string; content: string; createdAt: string; itemId?: number | null };

/**
 * Beside an approved press release or FAQ: the reviewer's attack on each row, the button to attack it
 * when it has not been, and "Revise with this critique", which makes a new draft run that would replace it.
 */
export function CritiquePanel({ projectId, store }: { projectId: string; store: string }) {
  const rows = useItems(projectId, store);
  const thread = useQuery(queries.challenge(projectId));
  const qc = useQueryClient();
  // The server attacks after approval; while a row says "running", look again every few seconds.
  const running = rows.items.some((r) => (r.data.attack as AttackRecord | undefined)?.state === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      void qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) });
      void qc.invalidateQueries({ queryKey: keys.challenge(projectId) });
    }, 3000);
    return () => clearInterval(t);
  }, [running, qc, projectId]);
  if (!GENERATOR[store]) return null;
  if (rows.loading || thread.isPending) return <Skeleton role="status" aria-label="Loading the reviewer's critiques" className="h-16 w-full bg-subtle" />;
  if (!rows.items.length) return null;
  const messages = ((thread.data?.messages ?? []) as Msg[]).filter((m) => m.role === "assistant" && typeof m.itemId === "number");
  return (
    <section aria-labelledby="critique-h" className="rounded-2xl border border-hairline bg-surface p-4">
      <h2 id="critique-h" className="text-sm font-semibold text-primary">The reviewer&apos;s attack</h2>
      <p className="mt-0.5 text-xs text-secondary">Each approved row is put to the reviewer once, by the server, right after approval. Revise with the critique to get a new draft you can approve or reject.</p>
      {thread.error && <p role="alert" className="mt-2 text-sm text-danger">{messageOf(thread.error)}</p>}
      <ul className="mt-3 space-y-3">
        {rows.items.map((row) => (
          <CritiqueRow key={row.id} projectId={projectId} store={store} row={row} critique={[...messages].reverse().find((m) => m.itemId === row.id) ?? null} configured={thread.data?.configured ?? false} />
        ))}
      </ul>
    </section>
  );
}

function CritiqueRow({ projectId, store, row, critique, configured }: { projectId: string; store: string; row: Item; critique: Msg | null; configured: boolean }) {
  const attack = useAttackRow(projectId);
  const { run } = useDraftActions(projectId);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(0);
  const state = (row.data.attack as AttackRecord | undefined) ?? null;

  const revise = (supersede = false) => {
    if (!critique) return;
    setError("");
    setNote("");
    setConfirm(0);
    run.mutate(
      { generator: GENERATOR[store], reviseIds: [row.id], critique: critique.content, supersede },
      {
        onSuccess: (r) => setNote(r.drafts.length ? "A revised draft is waiting for review under Draft with AI." : `The model proposed no change${r.dropped.length ? ` (${r.dropped.map((d) => d.reason).join("; ")})` : ""}.`),
        onError: (e) => (e instanceof ApiError && e.status === 409 && e.detail?.pending ? setConfirm(e.detail.pending) : setError(messageOf(e))),
      }
    );
  };

  return (
    <li className="rounded-xl border border-hairline p-3">
      <p className="text-sm font-medium text-primary wrap-anywhere">{row.title}</p>
      {critique ? (
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-secondary">{critique.content}</p>
      ) : attack.isPending || state?.state === "running" ? (
        <p role="status" className="mt-1.5 text-sm text-secondary">The reviewer is reading it.</p>
      ) : state?.state === "failed" ? (
        <p className="mt-1.5 text-sm text-warning">The attack after approval did not happen: {state.reason}</p>
      ) : (
        <p className="mt-1.5 text-sm text-muted">Not attacked yet.</p>
      )}
      {!configured && <p className="mt-1.5 text-xs text-warning">The reviewer needs a reasoning model. <Link href={MODELS_HREF} className="underline">Choose one in Admin, Models.</Link></p>}
      {confirm > 0 && (
        <div role="alertdialog" aria-label="Earlier drafts are waiting" className="mt-2 space-y-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <p>{confirm} earlier {confirm === 1 ? "draft is" : "drafts are"} still waiting. Revising marks {confirm === 1 ? "it" : "them"} superseded.</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => revise(true)}>Revise anyway</Button><Button size="sm" variant="outline" onClick={() => setConfirm(0)}>Keep them</Button></div>
        </div>
      )}
      {(error || attack.error) && <p role="alert" className="mt-2 text-sm text-danger wrap-anywhere">{error || messageOf(attack.error)}</p>}
      {note && <p role="status" className="mt-2 text-sm text-success">{note}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {!critique && state?.state !== "running" && state?.state !== "done" && (
          <Button size="sm" variant="outline" disabled={!configured || attack.isPending} onClick={() => attack.mutate({ itemId: row.id })}>
            {attack.error ? "Retry the attack" : "Attack it"}
          </Button>
        )}
        {critique && (
          <Button size="sm" variant="outline" disabled={!configured || run.isPending} onClick={() => revise(false)}>
            {run.isPending ? "Revising; this can take a minute" : "Revise with this critique"}
          </Button>
        )}
      </div>
    </li>
  );
}
