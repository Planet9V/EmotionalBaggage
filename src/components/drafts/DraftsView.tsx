"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useItems, useProject } from "@/lib/client";
import { storeHref, type Draft } from "@/lib/ai/drafts/shared";
import { messageOf } from "@/lib/queries";
import type { Project } from "@/lib/types";
import { draftQueries } from "./api";
import { DraftCard } from "./DraftCard";
import { WaitingDrafts } from "./DraftPanel";
import { storeLabelClient } from "./labels";
import { EmptyState, LoadError, LoadingBlocks, NoConcept } from "@/components/ui/states";

type Tab = "draft" | "approved" | "rejected";
const TABS: [Tab, string][] = [["draft", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"]];

export function DraftsView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="AI drafts" title="Drafts" />
        <NoConcept loading={loading} />
      </>
    );
  }
  return <DraftsBody key={project.id} project={project} />;
}

function group(drafts: Draft[]) {
  const m = new Map<string, Draft[]>();
  for (const d of drafts) m.set(d.targetStore, [...(m.get(d.targetStore) ?? []), d]);
  return [...m.entries()];
}

function DraftsBody({ project }: { project: Project }) {
  const [tab, setTab] = useState<Tab>("draft");
  const list = useQuery(draftQueries.list(project.id, null, tab));
  const drafts = list.data?.drafts ?? [];
  const waiting = Object.values(list.data?.pending ?? {}).reduce((a, n) => a + n, 0);
  return (
    <>
      <PageHeader eyebrow={`AI drafts · ${project.name}`} title="Drafts" blurb="Everything the assistant has drafted for this concept. A draft becomes a row only when you approve it." />
      <div className="max-w-4xl space-y-5 px-8 py-6">
        <div role="tablist" aria-label="Which drafts" className="inline-flex overflow-hidden rounded-md border border-hairline">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`h-9 px-3 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dutchOrange ${tab === k ? "bg-subtle font-medium text-primary" : "bg-surface text-secondary hover:text-primary"}`}
            >
              {label}
              {k === "draft" && list.data ? <span className="ml-1.5 font-mono text-[10px] text-muted">{waiting}</span> : null}
            </button>
          ))}
        </div>
        {list.isPending ? (
          <LoadingBlocks rows={2} label="Loading drafts" />
        ) : list.error ? (
          <LoadError message={messageOf(list.error)} onRetry={() => void list.refetch()} />
        ) : drafts.length === 0 ? (
          <EmptyState action={tab === "draft" ? <Button asChild variant="outline" size="sm"><Link href="/s/design/requirements">Go to Requirements</Link></Button> : undefined}>
            {tab === "draft" ? "No drafts are waiting. Use Draft with AI at the top of a section, for example Requirements, to have the assistant propose rows." : `No ${tab} drafts yet.`}
          </EmptyState>
        ) : (
          group(drafts).map(([store, list]) => (
            <section key={store} aria-labelledby={`dr-${store}`} className="space-y-3">
              <h2 id={`dr-${store}`} className="text-base font-semibold tracking-tight text-primary">
                <Link href={storeHref(store)} className="hover:text-link hover:underline">{storeLabelClient(store)}</Link>
                <span className="ml-2 font-mono text-xs text-muted">{list.length}</span>
              </h2>
              {tab === "draft" ? <WaitingDrafts projectId={project.id} store={store} drafts={list} /> : <Decided projectId={project.id} store={store} drafts={list} />}
            </section>
          ))
        )}
      </div>
    </>
  );
}

function Decided({ projectId, store, drafts }: { projectId: string; store: string; drafts: Draft[] }) {
  const rows = useItems(projectId, store);
  return (
    <div className="space-y-3">
      {drafts.map((d) => (
        <DraftCard key={d.id} draft={d} decided current={d.itemId === null ? undefined : rows.items.find((i) => i.id === d.itemId)} />
      ))}
    </div>
  );
}
