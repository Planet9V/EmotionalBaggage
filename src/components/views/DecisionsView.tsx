"use client";

/**
 * Concept → Decision tree. One rounded surface: a toolbar (Tree / Path view, the
 * walkthrough), a caption bar with one dash per decision, then a split view with the
 * React Flow tree on the left and the selected decision in full on the right.
 * Everything shown comes from the concept's decision store; nothing is made up here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, ListTree, Pause, Play, Plus, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useItems } from "@/lib/client";
import { keys, STORE, toDecision, type Decision } from "@/lib/domain";
import { DecisionFlow } from "@/components/decisions/DecisionFlow";
import { DecisionDetail } from "@/components/decisions/DecisionDetail";
import { DecisionEditor, type DecisionDraft } from "@/components/decisions/DecisionEditor";
import { ancestry, buildTree, caption, isDecided, routeKeys, stateOf, walkOrder } from "@/components/decisions/model";
import type { ViewProps } from "./types";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { EmptyState, LoadingBlocks } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";

const STEP_MS = 4000;

type Editor = { open: boolean; editing: Decision | null; parent: string };

export function DecisionsView({ project }: ViewProps) {
  const { items, loading, error, add, patch, remove, reload } = useItems(project.id, STORE.decisions);
  const reduce = !!useReducedMotion();

  const all = useMemo(() => items.map(toDecision).filter((d): d is Decision => !!d), [items]);
  const byKey = useMemo(() => new Map(all.map((d) => [d.key, d])), [all]);
  const tree = useMemo(() => buildTree(all, byKey), [all, byKey]);
  const order = useMemo(() => walkOrder(all, byKey, tree), [all, byKey, tree]);
  const route = useMemo(() => routeKeys(all, byKey, tree), [all, byKey, tree]);
  const skipped = items.length - all.length;

  const [view, setView] = useState<"tree" | "path">("tree");
  const [picked, setPicked] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [editor, setEditor] = useState<Editor>({ open: false, editing: null, parent: "" });
  const playIdx = useRef(0);

  // with nothing picked, open on the first decision that can be made now, else the first in order
  const fallback = useMemo(() => order.find((k) => stateOf(byKey.get(k)!, all) === "open") ?? order[0] ?? null, [order, byKey, all]);
  const selected = picked && byKey.has(picked) ? picked : fallback;
  const sel = selected ? byKey.get(selected)! : null;

  // what is open in the tree: whatever was opened, plus the chain down to the selection, less what was closed
  const expanded = useMemo(() => {
    const chain = selected ? ancestry(selected, byKey, tree) : [];
    const above = new Set(chain.slice(0, -1));
    const out = new Set<string>([...opened, ...above]);
    if (selected && !collapsed.has(selected)) out.add(selected);
    for (const k of collapsed) if (!above.has(k)) out.delete(k);
    return out;
  }, [opened, collapsed, selected, byKey, tree]);

  const stop = useCallback(() => setPlaying(false), []);

  const show = useCallback(
    (key: string) => {
      setPicked(key);
      const chain = ancestry(key, byKey, tree);
      setOpened((s) => new Set([...s, ...chain]));
      setCollapsed((s) => {
        const n = new Set(s);
        for (const k of chain) n.delete(k);
        return n;
      });
    },
    [byKey, tree],
  );

  // a click on a card: select it and open it; a click on the open, selected card closes it
  const clickNode = useCallback(
    (key: string) => {
      stop();
      if (key === selected && expanded.has(key) && view === "tree") {
        setCollapsed((s) => new Set(s).add(key));
        setOpened((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
        return;
      }
      show(key);
    },
    [stop, selected, expanded, view, show],
  );

  const selectFromDetail = useCallback(
    (key: string) => {
      stop();
      show(key);
    },
    [stop, show],
  );

  // the walkthrough: parents before children, dependencies before dependents, one step every four seconds
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = playIdx.current + 1;
      if (next >= order.length) {
        setPlaying(false);
        return;
      }
      playIdx.current = next;
      show(order[next]);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, order, show]);

  const togglePlay = () => {
    if (playing) return stop();
    if (!order.length) return;
    playIdx.current = 0;
    show(order[0]);
    setPlaying(true);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (d: Decision, optionId: string) => {
    stop();
    setPicked(d.key);
    void run(() => patch(d.item.id, { status: "decided", data: { chosen: optionId } }));
  };
  const reopen = (d: Decision) => {
    stop();
    setPicked(d.key);
    void run(() => patch(d.item.id, { status: "open", data: { chosen: "" } }));
  };

  const save = async (draft: DecisionDraft) => {
    const data: Record<string, unknown> = {
      key: draft.key,
      parent: draft.parent,
      viaOption: draft.viaOption,
      dependsOn: draft.dependsOn,
      source: draft.source,
      unlocks: keys(draft.unlocks),
      options: draft.options,
    };
    const editing = editor.editing;
    if (editing) {
      // a removed chosen option reopens the decision
      const keep = draft.options.some((o) => o.id === editing.chosen);
      const reopenIt = !!editing.chosen && !keep;
      await patch(editing.item.id, {
        title: draft.question,
        body: draft.context,
        ...(reopenIt ? { status: "open" } : {}),
        data: { ...data, ...(reopenIt ? { chosen: "" } : {}) },
      });
      show(editing.key);
    } else {
      await add({ section: STORE.decisions, title: draft.question, body: draft.context, status: "open", data: { ...data, chosen: "" } });
      show(draft.key);
    }
  };

  const del = async (d: Decision) => {
    try {
      await remove(d.item.id);
    } catch (e) {
      await reload();
      throw e;
    }
    // drop the deleted key from every decision that depended on it, so none waits forever on a decision that is gone
    for (const x of all) {
      if (x.key !== d.key && x.dependsOn.includes(d.key)) await patch(x.item.id, { data: { dependsOn: x.dependsOn.filter((k) => k !== d.key) } });
    }
    setPicked(d.parent && byKey.has(d.parent) ? d.parent : null);
  };

  const openAdd = (parent = "") => {
    stop();
    setEditor({ open: true, editing: null, parent });
  };
  const openEdit = (d: Decision) => {
    stop();
    setEditor({ open: true, editing: d, parent: d.parent });
  };

  const editorEl = (
    <DecisionEditor
      open={editor.open}
      onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
      editing={editor.editing}
      defaultParent={editor.parent}
      all={all}
      byKey={byKey}
      tree={tree}
      onSave={save}
      onDelete={del}
    />
  );

  if (loading) return <LoadingBlocks rows={2} label="Loading the decision tree" />;

  if (all.length === 0) {
    return (
      <>
        <EmptyState
          icon={GitBranch}
          testId="decisions-empty"
          title="No decisions yet"
          action={
            <Button size="sm" onClick={() => openAdd("")}>
              <Plus className="h-4 w-4" aria-hidden />
              Add the first decision
            </Button>
          }
        >
          Later stages wait on the choices made here, and the Concept gate needs the go or stop decision. Each decision lists its options and what each leads to.
          {skipped > 0 && <span className="mt-2 block text-xs text-warning">{skipped} item{skipped === 1 ? "" : "s"} in this store have no decision key, so they are not shown.</span>}
          {error && <span role="alert" className="mt-2 block text-xs text-danger">{error}</span>}
        </EmptyState>
        {editorEl}
      </>
    );
  }

  const decidedCount = all.filter(isDecided).length;
  const only = view === "path" ? route : null;

  return (
    <div className="space-y-3">
      <Card variant="flat" className="rounded-2xl overflow-hidden shadow-xs" data-testid="decisions-view">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-hairline px-4 py-2.5 sm:px-5">
          <div role="group" aria-label="View" className="flex rounded-full border border-hairline p-0.5">
            {(
              [
                ["tree", "Tree", ListTree],
                ["path", "Path", Route],
              ] as const
            ).map(([v, labelText, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  stop();
                  setView(v);
                }}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-150 ${
                  view === v ? "bg-action text-white" : "text-secondary hover:text-primary"
                }`}
                data-testid={`decisions-view-${v}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {labelText}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dutchOrange/40 bg-dutchOrange/10 px-3 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-dutchOrange/20"
            data-testid="decisions-play"
            aria-pressed={playing}
          >
            {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {playing ? "Pause the walkthrough" : "Play the walkthrough"}
          </button>
          {view === "tree" && (
            <button
              type="button"
              onClick={() => {
                stop();
                setOpened(new Set(all.map((d) => d.key)));
                setCollapsed(new Set());
              }}
              className="inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-medium text-secondary transition-colors duration-150 hover:text-primary"
            >
              Expand all
            </button>
          )}
          <span className="ml-auto hidden font-mono text-[11px] text-muted md:inline">
            {all.length} decision{all.length === 1 ? "" : "s"} · {decidedCount} decided
          </span>
          <Button variant="outline" size="sm" onClick={() => openAdd(selected ?? "")}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add decision
          </Button>
        </div>

        {/* caption: one dash per decision in walk order, and one sentence on the selected one */}
        <div className="flex min-h-13 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-subtle px-4 py-2.5 sm:px-5" aria-live="polite" data-testid="decisions-caption">
          <span className="flex shrink-0 flex-wrap gap-1">
            {order.map((k) => {
              const d = byKey.get(k)!;
              const on = k === selected;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => selectFromDetail(k)}
                  title={`${d.key}: ${d.question}`}
                  aria-label={`${d.question} (${isDecided(d) ? "decided" : "open"})`}
                  aria-current={on ? "true" : undefined}
                  className="group flex h-4 items-center"
                >
                  <span
                    className={`block h-1.5 w-5 rounded-full transition-all duration-150 ${isDecided(d) ? "bg-dutchOrange" : "bg-hairline group-hover:bg-dutchOrange/40"} ${
                      on ? "outline-solid outline-2 outline-offset-2 outline-dutchOrange/60" : ""
                    }`}
                  />
                </button>
              );
            })}
          </span>
          {sel && (
            <p key={sel.key} className="min-w-0 flex-1 text-[13px] leading-snug text-primary">
              {caption(sel, all, byKey)}
            </p>
          )}
        </div>

        {/* split view */}
        <div className="grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
          <div className="relative h-[560px] min-h-[560px] border-b border-hairline bg-canvas lg:h-[680px] lg:border-b-0 lg:border-r">
            <DecisionFlow
              all={all}
              byKey={byKey}
              tree={tree}
              selected={selected}
              expanded={expanded}
              only={only}
              onSelect={clickNode}
              onUserMove={stop}
              instant={reduce}
            />
            {view === "path" && (
              <p className="pointer-events-none absolute left-3 top-3 max-w-[60%] rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] leading-snug text-secondary shadow-xs">
                {decidedCount === 0 ? "Nothing decided yet; the path shows where to start." : "The route taken so far: decided decisions, the chain above them and what comes next."}
              </p>
            )}
          </div>
          <div className="min-w-0 lg:h-[680px] lg:overflow-y-auto" onPointerDown={stop}>
            {sel ? (
              <DecisionDetail
                d={sel}
                all={all}
                byKey={byKey}
                tree={tree}
                order={order}
                busy={busy}
                onSelect={selectFromDetail}
                onChoose={choose}
                onReopen={reopen}
                onEdit={openEdit}
                onAddChild={(d) => openAdd(d.key)}
              />
            ) : (
              <p className="p-6 text-sm text-secondary">Select a decision in the tree.</p>
            )}
          </div>
        </div>
      </Card>
      {(error || actionError) && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
          {actionError || error}
        </p>
      )}
      {skipped > 0 && (
        <p className="text-xs text-muted">
          {skipped} item{skipped === 1 ? "" : "s"} in this store have no decision key, so they are not in the tree.
        </p>
      )}
      {editorEl}
    </div>
  );
}
