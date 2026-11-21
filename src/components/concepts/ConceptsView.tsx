"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { conceptQueries, useRestoreConcept, type Concept, type DeletedConcept } from "@/lib/conceptsClient";
import { ConceptTable } from "./ConceptTable";
import { EditConceptDialog } from "./EditConceptDialog";
import { DeleteConceptDialog } from "./DeleteConceptDialog";
import { ArchiveConceptDialog, DuplicateConceptDialog } from "./SmallDialogs";
import { groupConcepts, sortConcepts, type SortKey } from "./model";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";
import { LoadingShape } from "@/components/ui/states";

/** The concept is kept as it was when the dialog opened, so a dialog whose concept has just gone can still close properly. */
type Action = { kind: "edit" | "delete" | "duplicate" | "archive"; id: string; concept: Concept };
/** Where focus goes once a dialog has closed or a row has moved. */
type FocusTarget = { row: string } | "search" | "archived";

const NO_CONCEPTS: Concept[] = [];

export function ConceptsView() {
  const listQuery = useQuery(conceptQueries.all());
  const concepts = listQuery.data ?? NO_CONCEPTS;
  const { project, select } = useProject();
  const currentId = project?.id ?? "";
  const restore = useRestoreConcept();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("changed");
  const [showArchived, setShowArchived] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pageError, setPageError] = useState("");
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const archivedToggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupConcepts(concepts, search, sort), [concepts, search, sort]);
  const totalArchived = useMemo(() => concepts.filter((c) => c.archivedAt).length, [concepts]);
  const acting = action ? concepts.find((c) => c.id === action.id) ?? action.concept : null;

  // Move focus once the list has re-rendered with the row in its new place.
  useEffect(() => {
    if (!focusTarget) return;
    const root = rootRef.current;
    let el: HTMLElement | null = null;
    if (typeof focusTarget === "object") {
      el = root?.querySelector<HTMLElement>(`[data-row-menu="${CSS.escape(focusTarget.row)}"]`) ?? null;
      if (!el) el = archivedToggleRef.current;
    } else if (focusTarget === "archived") {
      el = archivedToggleRef.current;
    }
    (el ?? searchRef.current)?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: the target is consumed once focus has moved
    setFocusTarget(null);
  }, [focusTarget, groups, showArchived]);

  /** Another active concept to open when the current one is archived or deleted, or "" when none is left. */
  const switchAwayFrom = useCallback(
    (id: string) => {
      if (id !== currentId) return;
      const next = sortConcepts(concepts.filter((c) => !c.archivedAt && c.id !== id), "changed")[0];
      select(next?.id ?? "");
    },
    [concepts, currentId, select]
  );

  /** The row after the one that went away, in the same group, for focus. */
  const neighbour = (id: string): FocusTarget => {
    const group = groups.active.some((c) => c.id === id) ? groups.active : groups.archived;
    const i = group.findIndex((c) => c.id === id);
    const next = group[i + 1] ?? group[i - 1];
    return next ? { row: next.id } : "search";
  };

  const doRestore = async (c: Concept) => {
    setPageError("");
    setAnnounce("");
    try {
      await restore.mutateAsync(c.id);
      setAnnounce(`Restored ${c.name}. It is back in the sidebar.`);
      setFocusTarget({ row: c.id });
    } catch (e) {
      setPageError(`${c.name} was not restored. ${messageOf(e)}`);
    }
  };

  const onOpenConcept = (c: Concept) => select(c.id);

  const closedTo = useRef<FocusTarget | null>(null);
  const startAction = (a: Action) => {
    setPageError("");
    setAnnounce("");
    closedTo.current = { row: a.id };
    setAction(a);
  };
  const onClosed = () => {
    setAction(null);
    setFocusTarget(closedTo.current ?? "search");
    closedTo.current = null;
  };

  const loading = listQuery.isPending;
  const loadError = messageOf(listQuery.error);
  const empty = !loading && !loadError && concepts.length === 0;
  const tableProps = {
    currentId,
    busyId: restore.isPending ? restore.variables : undefined,
    onOpen: onOpenConcept,
    onAction: startAction,
    onRestore: doRestore,
  };

  return (
    <div ref={rootRef}>
      <PageHeader eyebrow="Concepts" title="All concepts" blurb="Open, edit, copy, archive or delete a concept. Archived concepts are kept below.">
        <Button asChild>
          <Link href="/new"><Plus className="h-4 w-4" aria-hidden /> New concept</Link>
        </Button>
      </PageHeader>

      <p className="sr-only" aria-live="polite" role="status">{announce}</p>

      <div className="space-y-4 px-8 py-6">
        {pageError && (
          <p role="alert" className="rounded-md border border-hairline bg-danger-soft px-3 py-2 text-sm text-danger">{pageError}</p>
        )}

        {loadError ? (
          <div role="alert" className="rounded-xl border border-hairline bg-danger-soft p-5 text-sm text-danger">
            <p className="font-semibold">The concepts could not be loaded.</p>
            <p className="mt-1">{loadError}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void listQuery.refetch()} disabled={listQuery.isFetching}>
              {listQuery.isFetching ? "Trying again..." : "Try again"}
            </Button>
          </div>
        ) : empty ? (
          <Card variant="flat" className="p-8 text-center">
            <p className="text-sm text-secondary">There are no concepts yet. The wizard starts one from a name and a line.</p>
            <Button asChild className="mt-4">
              <Link href="/new"><Plus className="h-4 w-4" aria-hidden /> Start a concept</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem] flex-1">
                <label htmlFor="concept-search" className="sr-only">Search concepts</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input
                    id="concept-search"
                    ref={searchRef}
                    type="search"
                    placeholder="Search by name or description"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="w-48">
                <label htmlFor="concept-sort" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Sort by</label>
                <NativeSelect id="concept-sort" className="mt-1" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} disabled={loading}>
                  <option value="changed">Last changed</option>
                  <option value="name">Name</option>
                </NativeSelect>
              </div>
            </div>

            <Card variant="flat" as="section" aria-labelledby="active-heading">
              <h2 id="active-heading" className="border-b border-hairline px-4 py-3 text-sm font-semibold text-primary">
                Active <span className="font-mono text-xs font-normal text-muted">{loading ? "" : groups.active.length}</span>
              </h2>
              {loading ? (
                <LoadingRows />
              ) : groups.active.length ? (
                <ConceptTable concepts={groups.active} label="Active concepts" {...tableProps} />
              ) : (
                <p className="px-4 py-6 text-sm text-secondary">
                  {search.trim()
                    ? `No active concept matches "${search.trim()}".`
                    : "No active concepts. Restore one from the archive or start a new one."}
                </p>
              )}
            </Card>

            {!loading && totalArchived > 0 && (
              <Card variant="flat" as="section" aria-labelledby="archived-heading">
                <h2 id="archived-heading" className="text-sm font-semibold text-primary">
                  <button
                    ref={archivedToggleRef}
                    type="button"
                    aria-expanded={showArchived}
                    aria-controls="archived-list"
                    onClick={() => setShowArchived((s) => !s)}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                  >
                    {showArchived ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                    Archived <span className="font-mono text-xs font-normal text-muted">{groups.archived.length}</span>
                  </button>
                </h2>
                <div id="archived-list" hidden={!showArchived} className="border-t border-hairline">
                  {groups.archived.length ? (
                    <ConceptTable concepts={groups.archived} label="Archived concepts" {...tableProps} />
                  ) : (
                    <p className="px-4 py-6 text-sm text-secondary">No archived concept matches &quot;{search.trim()}&quot;.</p>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {action?.kind === "edit" && (
        <EditConceptDialog
          key={action.id}
          concept={acting}
          onClosed={onClosed}
          onDone={(c) => setAnnounce(`Saved ${c.name}.`)}
        />
      )}
      {action?.kind === "duplicate" && acting && (
        <DuplicateConceptDialog
          key={action.id}
          concept={acting}
          onClosed={onClosed}
          onDone={(c) => {
            setAnnounce(`Made ${c.name}, a copy of ${acting.name}.`);
            closedTo.current = { row: c.id };
          }}
        />
      )}
      {action?.kind === "archive" && acting && (
        <ArchiveConceptDialog
          key={action.id}
          concept={acting}
          isCurrent={acting.id === currentId}
          onClosed={onClosed}
          onDone={(c) => {
            switchAwayFrom(c.id);
            setAnnounce(`Archived ${c.name}. It is listed under Archived.`);
            closedTo.current = showArchived ? { row: c.id } : "archived";
          }}
        />
      )}
      {action?.kind === "delete" && acting && (
        <DeleteConceptDialog
          key={action.id}
          concept={acting}
          onClosed={onClosed}
          onDone={(d: DeletedConcept) => {
            closedTo.current = neighbour(d.concept);
            switchAwayFrom(d.concept);
            setAnnounce(`Deleted ${d.name}. The audit log keeps a record of the deletion.`);
          }}
        />
      )}
    </div>
  );
}

function LoadingRows() {
  return (
    <LoadingShape className="divide-y divide-hairline" label="Loading concepts">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </LoadingShape>
  );
}
