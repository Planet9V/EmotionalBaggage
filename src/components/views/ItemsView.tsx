"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { LayoutGrid, Plus, Rows3, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItems } from "@/lib/client";
import { DEFAULT_STATUSES } from "@/lib/menu";
import { AddItemDialog } from "@/components/items/AddItemDialog";
import { ItemDrawer } from "@/components/items/ItemDrawer";
import { ItemsTable } from "@/components/items/ItemsTable";
import { Kanban } from "@/components/items/Kanban";
import { matches, statusList } from "@/components/items/shared";
import { ClaimEvidence } from "@/components/research/ClaimEvidence";
import { CLAIMS_SECTION } from "@/lib/research/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "./types";

type Layout = "board" | "table";
const layoutListeners = new Set<() => void>();

export function ItemsView({ project, section, store }: ViewProps) {
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const configured = section.statuses ?? DEFAULT_STATUSES;
  const columns = section.columns ?? [];
  const addLabel = section.addLabel ?? "Add";
  const lsKey = `ctr:items-layout:${store}`;
  // Claims show their evidence and the reason for their status on each card and in the editor.
  const isClaims = store === CLAIMS_SECTION;
  const cardExtra = isClaims ? (it: Item) => <ClaimEvidence item={it} projectId={project.id} compact /> : undefined;
  const drawerExtra = isClaims ? { legend: "Evidence", render: (it: Item) => <ClaimEvidence item={it} projectId={project.id} /> } : undefined;

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  const stored = useSyncExternalStore(
    (cb) => {
      layoutListeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        layoutListeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(lsKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const layout: Layout = stored === "board" || stored === "table" ? stored : configured.length >= 3 ? "board" : "table";
  const pick = (l: Layout) => {
    try {
      window.localStorage.setItem(lsKey, l);
    } catch {
      /* storage unavailable: the choice is not remembered */
    }
    layoutListeners.forEach((f) => f());
  };

  const statuses = useMemo(() => statusList(configured, items), [configured, items]);
  const searched = useMemo(() => items.filter((i) => matches(i, q)), [items, q]);
  const shown = useMemo(() => (filter ? searched.filter((i) => i.status === filter) : searched), [searched, filter]);
  const opened = items.find((i) => i.id === openId) ?? null;
  const filtering = q.trim() !== "" || filter !== null;

  const move = async (id: number, status: string) => {
    setActionError("");
    try {
      await patch(id, { status });
    } catch (e) {
      // Name the row: a refusal from the board would otherwise not say which card it is about.
      const title = items.find((i) => i.id === id)?.title;
      setActionError(`${title ? `${title}: ` : ""}${(e as Error).message}`);
    }
  };

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="h-4 w-4" aria-hidden /> {addLabel}
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={`Loading ${section.label}`}>
        <div className="flex gap-2">
          <div className="h-9 w-64 animate-pulse rounded-md bg-subtle" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-subtle" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((c) => (
            <div key={c} className="space-y-2 rounded-xl border border-hairline p-2">
              <div className="h-6 w-24 animate-pulse rounded-full bg-subtle" />
              {[0, 1, 2].slice(0, 3 - c).map((r) => (
                <div key={r} className="h-20 animate-pulse rounded-lg bg-subtle" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">{section.label} could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  const dialogs = (
    <>
      <AddItemDialog
        open={adding}
        onOpenChange={setAdding}
        label={addLabel}
        sectionLabel={section.label}
        columns={columns}
        statuses={configured}
        onCreate={async (d) => {
          await add({ section: store, title: d.title, body: d.body || undefined, data: d.data, status: d.status });
          setAdding(false);
        }}
      />
      <ItemDrawer
        item={opened}
        onClose={() => setOpenId(null)}
        sectionLabel={section.label}
        columns={columns}
        statuses={statuses}
        onSave={(id, c) => patch(id, c)}
        onDelete={(id) => remove(id)}
        extra={drawerExtra}
      />
    </>
  );

  if (!items.length) {
    return (
      <>
        <div className="max-w-xl rounded-xl border border-dashed border-hairline bg-surface p-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{section.label}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-primary">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-secondary">This section holds: {section.blurb}</p>
          <div className="mt-4 flex justify-center">{addButton}</div>
        </div>
        {dialogs}
      </>
    );
  }

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${
      active ? "border-dutchOrange bg-dutchOrange/10 text-primary" : "border-hairline bg-surface text-secondary hover:border-dutchOrange/60 hover:text-primary"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, details and values" aria-label={`Search ${section.label}`} className="pl-8 pr-8" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <div role="group" aria-label="Layout" className="inline-flex overflow-hidden rounded-md border border-hairline">
          {([["board", "Board", LayoutGrid], ["table", "Table", Rows3]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={layout === k}
              onClick={() => pick(k)}
              className={`inline-flex h-9 items-center gap-1.5 px-3 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dutchOrange ${
                layout === k ? "bg-subtle font-medium text-primary" : "bg-surface text-secondary hover:text-primary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <div className="ml-auto">{addButton}</div>
      </div>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)} className={chip(filter === null)}>
          All <span className="font-mono text-[10px] text-muted">{searched.length}</span>
        </button>
        {statuses.map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(filter === s ? null : s)} className={chip(filter === s)}>
            {s} <span className="font-mono text-[10px] text-muted">{searched.filter((i) => i.status === s).length}</span>
          </button>
        ))}
      </div>

      {(error || actionError) && (
        <p role="alert" className="text-sm text-danger wrap-anywhere">
          {actionError || error}
        </p>
      )}

      {filtering && !shown.length ? (
        <div className="rounded-xl border border-dashed border-hairline p-6 text-center">
          <p className="text-sm text-secondary">Nothing matches.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setQ(""); setFilter(null); }}>
            Clear search and filter
          </Button>
        </div>
      ) : layout === "board" ? (
        <Kanban items={shown} statuses={statuses} columns={columns} onOpen={setOpenId} onMove={move} cardExtra={cardExtra} />
      ) : (
        <ItemsTable items={shown} statuses={statuses} columns={columns} onOpen={setOpenId} onStatus={move} />
      )}
      {dialogs}
    </div>
  );
}
