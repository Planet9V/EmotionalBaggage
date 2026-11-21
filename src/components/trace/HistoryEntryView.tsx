"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldValue, sameValue, valueText, type HistoryChange, type HistoryEntry } from "@/lib/trace/history";
import type { Item } from "@/lib/types";

/** Written the way people read a date: the time in their own zone, with the full stamp in the tooltip. */
export function when(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const isLong = (...v: unknown[]) => v.some((x) => {
  const t = valueText(x);
  return t.length > 70 || t.includes("\n");
});

function Block({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-hairline bg-subtle p-2 font-sans text-xs text-primary wrap-anywhere">{valueText(value) || "empty"}</pre>
    </div>
  );
}

function ChangeView({ change, current, onRestore }: { change: HistoryChange; current?: Item; onRestore?: (change: HistoryChange) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasBefore = "before" in change;
  const hasAfter = "after" in change;
  const already = current ? sameValue(fieldValue(current, change.field), change.before) : false;
  const restore = async () => {
    if (!onRestore) return;
    setBusy(true);
    setError("");
    try {
      await onRestore(change);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="space-y-1.5 border-t border-hairline pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">{change.label}</p>
        {onRestore && change.restorable &&
          (already ? (
            <span className="text-[11px] text-muted">This is the current value</span>
          ) : (
            <Button type="button" variant="outline" size="xs" onClick={() => void restore()} disabled={busy} aria-label={`Restore this value of ${change.label}`}>
              <RotateCcw className="h-3 w-3" aria-hidden /> {busy ? "Restoring" : "Restore this value"}
            </Button>
          ))}
      </div>
      {isLong(change.before, change.after) || !hasBefore || !hasAfter ? (
        <div className={`grid gap-2 ${hasBefore && hasAfter ? "sm:grid-cols-2" : ""}`}>
          {hasBefore && <Block label="Before" value={change.before} />}
          {hasAfter && <Block label="After" value={change.after} />}
        </div>
      ) : (
        <p className="text-xs text-secondary wrap-anywhere">
          <span className="sr-only">Before: </span>
          <span className="rounded bg-danger-soft px-1 text-danger line-through">{valueText(change.before) || "empty"}</span>
          <span aria-hidden className="mx-1.5 text-muted">to</span>
          <span className="sr-only"> After: </span>
          <span className="rounded bg-success-soft px-1 text-success">{valueText(change.after) || "empty"}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger wrap-anywhere">
          {error}
        </p>
      )}
    </li>
  );
}

/** One recorded change: who, when, and each field before and after. */
export function HistoryEntryView({
  entry,
  current,
  onRestore,
  showRow,
}: {
  entry: HistoryEntry;
  current?: Item;
  onRestore?: (change: HistoryChange) => Promise<void>;
  /** the Activity page names the row each change is about */
  showRow?: boolean;
}) {
  return (
    <li className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium text-primary wrap-anywhere">
          {showRow && entry.title && !entry.summary.includes(entry.title) ? <>{entry.title}: </> : null}
          <span className="font-normal text-secondary">{entry.summary}</span>
        </p>
        <p className="shrink-0 text-xs text-muted">
          <span className="text-secondary">{entry.actor || "The app"}</span> · <time dateTime={entry.at} title={entry.at}>{when(entry.at)}</time>
        </p>
      </div>
      {entry.changes.length > 0 && (
        <ul className="mt-2 space-y-2" aria-label="Fields changed">
          {entry.changes.map((c) => (
            <ChangeView key={c.field} change={c} current={current} onRestore={onRestore} />
          ))}
        </ul>
      )}
    </li>
  );
}
