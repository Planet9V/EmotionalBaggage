"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { useMemo, useState } from "react";
import { CheckCircle2, Hammer, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddItemDialog } from "@/components/items/AddItemDialog";
import { ItemDrawer } from "@/components/items/ItemDrawer";
import { statusList } from "@/components/items/shared";
import type { ViewProps } from "@/components/views/types";
import { useItems } from "@/lib/client";
import { STORE } from "@/lib/domain/schemas";
import { buildProgress, lostEvidence, passRefusal, PASSED } from "@/lib/trace/builds";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import { BuildPanel } from "./BuildPanel";
import { CriteriaChecklist } from "./CriteriaChecklist";
import { Card } from "@/components/ui/Card";
import { EmptyState, LoadingShape } from "@/components/ui/states";

const day = (v: unknown) => (typeof v === "string" && v ? v : "");

/** Named builds, one card each: what it has to show, how far it is, which tests it waits on, and whether it may pass. */
export function BuildsView({ project, section, store }: ViewProps) {
  const { items: builds, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const { items: tests } = useItems(project.id, STORE.tests);
  const statuses = useMemo(() => statusList(section.statuses ?? [], builds), [section.statuses, builds]);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // A refusal is shown on the card it is about.
  const [refused, setRefused] = useState<Record<number, string>>({});

  const setStatus = async (b: Item, status: string) => {
    setRefused((r) => ({ ...r, [b.id]: "" }));
    try {
      await patch(b.id, { status });
    } catch (e) {
      setRefused((r) => ({ ...r, [b.id]: (e as Error).message }));
    }
  };

  const toggle = async (b: Item, index: number, met: boolean) => {
    const criteria = buildProgress(b, tests).criteria.map((c, i) => (i === index ? { ...c, met } : c));
    setRefused((r) => ({ ...r, [b.id]: "" }));
    try {
      await patch(b.id, { data: { criteria } });
    } catch (e) {
      setRefused((r) => ({ ...r, [b.id]: (e as Error).message }));
    }
  };

  if (loading) {
    return (
      <LoadingShape className="grid gap-4 lg:grid-cols-2" label="Loading builds">
        {[0, 1].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-subtle" />
        ))}
      </LoadingShape>
    );
  }
  if (error && !builds.length) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">Builds could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  const opened = builds.find((b) => b.id === openId) ?? null;
  const dialogs = (
    <>
      <AddItemDialog
        open={adding}
        onOpenChange={setAdding}
        label="Add build"
        sectionLabel={section.label}
        columns={[]}
        statuses={section.statuses ?? []}
        onCreate={async (d) => {
          await add({ section: store, title: d.title, body: d.body || undefined, data: d.data, status: d.status });
          setAdding(false);
        }}
      />
      <ItemDrawer
        item={opened}
        onClose={() => setOpenId(null)}
        sectionLabel={section.label}
        columns={[]}
        statuses={statuses}
        onSave={(id, c) => patch(id, c)}
        onDelete={(id) => remove(id)}
        onRestore={(id, c) => patch(id, c)}
        extra={{ legend: "Exit criteria, tests and dates", render: (it) => <BuildPanel item={it} projectId={project.id} /> }}
      />
    </>
  );

  if (!builds.length) {
    return (
      <>
        <EmptyState
          icon={Hammer}
          title="No builds yet"
          action={
            <Button id="add-build" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add build
            </Button>
          }
        >
          A build is the evidence that the prototype works: the Prototype gate needs one marked passed. Name it (works-like, looks-like, EVT, DVT, PVT or your own), say what it has to show, and link its tests.
        </EmptyState>
        {dialogs}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">A build can be marked passed once every exit criterion is met and every linked test has passed.</p>
        <Button id="add-build" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add build
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger wrap-anywhere">
          {error}
        </p>
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {builds.map((b) => {
          const p = buildProgress(b, tests);
          const passed = b.status === PASSED;
          const cannotPass = passed ? null : passRefusal(b, tests);
          // The stored status is not the whole story: a build marked passed whose evidence went bad says so.
          const stale = passed ? lostEvidence(b, tests) : [];
          const sentBack = !passed && typeof b.data.revertedBecause === "string" ? b.data.revertedBecause : "";
          const start = day(b.data.start);
          const end = day(b.data.end);
          return (
            <Card variant="flat" as="li" key={b.id} className="flex flex-col gap-3 p-4" aria-label={b.title}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-primary wrap-anywhere">{b.title}</h2>
                  {(start || end) && (
                    <p className="mt-0.5 text-xs text-muted">
                      {start || "no start date"} to {end || "no end date"}
                    </p>
                  )}
                </div>
                <StatusBadge tone={statusTone(b.status)}>{b.status}</StatusBadge>
              </div>
              {b.body && <p className="text-sm text-secondary wrap-anywhere">{b.body}</p>}

              <section aria-label={`Exit criteria of ${b.title}`} className="space-y-1.5">
                <p className="text-xs font-medium text-primary">
                  {p.criteria.length ? `${p.met} of ${p.criteria.length} exit criteria met` : "No exit criteria set"}
                </p>
                <CriteriaChecklist criteria={p.criteria} onToggle={(i, met) => void toggle(b, i, met)} />
              </section>

              <section aria-label={`Tests of ${b.title}`} className="space-y-1.5">
                <p className="text-xs font-medium text-primary">
                  {p.linked.length ? `${p.testsDone} of ${p.linked.length} tests passed` : "No tests linked"}
                </p>
                {p.linked.length > 0 && (
                  <ul className="space-y-1">
                    {p.linked.map((t) => (
                      <li key={t.key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 wrap-anywhere text-secondary">{t.title ?? `${t.key} (no longer exists)`}</span>
                        {t.status && <StatusBadge tone={statusTone(t.status)}>{t.status}</StatusBadge>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {stale.length > 0 && (
                <p role="status" className="text-sm text-warning wrap-anywhere">
                  Marked passed, but its evidence no longer holds: {stale.join("; ")}. Open it to move it back to testing.
                </p>
              )}
              {sentBack && (
                <p role="status" className="text-sm text-warning wrap-anywhere">
                  Moved back to testing because {sentBack}.
                </p>
              )}
              {cannotPass && !refused[b.id] && (
                <p id={`pass-reason-${b.id}`} className="text-xs text-warning wrap-anywhere">
                  {cannotPass}
                </p>
              )}
              {refused[b.id] && (
                <p role="alert" className="text-sm text-danger wrap-anywhere">
                  {refused[b.id]}
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
                <span className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setOpenId(b.id)} aria-label={`Open ${b.title}`}>
                    Open
                  </Button>
                  <RowActions item={b} />
                </span>
                {passed ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${stale.length ? "text-warning" : "text-success"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {stale.length ? "Passed, evidence lost" : "Passed"}
                  </span>
                ) : (
                  <Button size="sm" disabled={cannotPass !== null} aria-describedby={cannotPass ? `pass-reason-${b.id}` : undefined} onClick={() => void setStatus(b, PASSED)} aria-label={`Mark passed: ${b.title}`}>
                    Mark passed
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
      {dialogs}
    </div>
  );
}
