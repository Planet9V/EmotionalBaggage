"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useItemHistory, historyKeys } from "@/lib/trace/client";
import { restoreBody, type HistoryChange } from "@/lib/trace/history";
import type { Item } from "@/lib/types";
import { HistoryEntryView } from "./HistoryEntryView";
import { WhyField } from "./WhyField";
import { api } from "@/lib/http";
import { LoadingShape } from "@/components/ui/states";

/**
 * The History tab of the row editor: this row's changes, newest first. "Restore this value" is an
 * ordinary save (`onRestore`), so the restoring is itself in the history.
 */
export function HistoryPanel({ item, onRestore }: { item: Item; onRestore: (id: number, change: Record<string, unknown>) => Promise<void> }) {
  const qc = useQueryClient();
  const h = useItemHistory(item.id);

  // An optional reason for the next restore, kept with it in the history.
  const [why, setWhy] = useState("");
  const restore = async (c: HistoryChange) => {
    await onRestore(item.id, { ...restoreBody(c.field, c.before), ...(why.trim() ? { why: why.trim() } : {}) });
    setWhy("");
    await qc.invalidateQueries({ queryKey: historyKeys.item(item.id) });
  };
  const addReason = async (entry: { id: number }, text: string) => {
    await api(`/api/items/${item.id}/reason`, { method: "POST", body: JSON.stringify({ why: text, forEvent: entry.id }) });
    await qc.invalidateQueries({ queryKey: historyKeys.item(item.id) });
    await qc.invalidateQueries({ queryKey: ["history", "activity"] });
  };
  const canRestore = h.entries.some((e) => e.changes.some((c) => c.restorable));

  if (h.loading) {
    return (
      <LoadingShape className="space-y-2 px-5 py-4" label="Loading history">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-subtle" />
        ))}
      </LoadingShape>
    );
  }
  if (h.error && !h.entries.length) {
    return (
      <div role="alert" className="m-5 rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The history could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{h.error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={h.reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (!h.entries.length) {
    return <p className="px-5 py-6 text-sm text-secondary">No changes are recorded for this row yet. Edit it and the change shows here.</p>;
  }
  return (
    <div className="space-y-3 px-5 py-4">
      {canRestore && <WhyField id="restore-why" value={why} onChange={setWhy} label="Why you are restoring (kept in the history)" hint="Optional. Used by the next Restore." />}
      <ol className="space-y-2" aria-label="Changes to this row, newest first">
        {h.entries.map((e) => (
          <HistoryEntryView key={e.id} entry={e} current={item} onRestore={restore} onAddReason={addReason} />
        ))}
      </ol>
      {h.error && (
        <p role="alert" className="text-sm text-danger">
          {h.error}
        </p>
      )}
      {h.more && (
        <Button variant="outline" size="sm" onClick={h.loadMore} disabled={h.loadingMore}>
          {h.loadingMore ? "Loading" : "Load more"}
        </Button>
      )}
    </div>
  );
}
