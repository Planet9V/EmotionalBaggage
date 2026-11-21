"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine } from "@/components/parts/controls";
import { statusTone } from "@/lib/statusTones";
import { useItems } from "@/lib/client";
import { batchResults, fixedCosts } from "@/lib/economics/compute";
import { useEconomicsRows, useProductionSettings } from "@/lib/economics/client";
import { formatMoney } from "@/lib/economics/money";
import { readEconomics } from "@/lib/economics/read";
import { readiness } from "@/lib/economics/readiness";
import { STORE_BATCHES } from "@/lib/economics/schemas";
import { HowThisIsWorkedOut, MissingList, Panel, PanelLoading } from "@/components/economics/shared";
import { FixedCostsTable } from "@/components/economics/FixedCostsTable";
import type { ViewProps } from "@/components/views/types";
import { BatchDialog } from "./BatchDialog";
import { ReadinessPanel } from "./ReadinessPanel";

export function BatchesView({ project }: ViewProps) {
  const settings = useProductionSettings(project.id);
  const { rows, loading, error, reload } = useEconomicsRows(project.id);
  const batches = useItems(project.id, STORE_BATCHES);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const currency = settings.currency;
  const inputs = useMemo(() => readEconomics(rows, currency), [rows, currency]);
  const results = useMemo(() => batchResults(inputs), [inputs]);
  const oneOff = useMemo(() => {
    const f = fixedCosts(inputs);
    const lines = f.lines.filter((l) => !l.setup);
    return { lines, total: lines.reduce((a, l) => a + l.amount, 0), missing: f.missing };
  }, [inputs]);
  const selected = results.find((r) => r.id === picked) ?? results[0] ?? null;
  const checks = useMemo(() => readiness(rows, { batchId: selected?.id ?? null, currency }), [rows, selected, currency]);

  if (loading || settings.loading) return <PanelLoading label="Loading the batch plan" />;
  if (error || settings.error) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The batch plan could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{error || settings.error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void (error ? reload() : settings.reload())}>
          Try again
        </Button>
      </div>
    );
  }

  const fm = (m: number) => formatMoney(m, currency);
  const editingRow = typeof editing === "number" ? rows.batches.find((b) => b.id === editing) ?? null : null;
  const remove = async (id: number) => {
    setMessage("");
    try {
      await batches.remove(id);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const add = (
    <Button id="add-row" onClick={() => setEditing("new")}>
      <Plus className="h-4 w-4" aria-hidden /> Add batch
    </Button>
  );

  return (
    <div className="space-y-5">
      {message || batches.writeError ? <ErrorLine>{message || batches.writeError}</ErrorLine> : null}

      {!results.length ? (
        <EmptyState title="No batches yet">
          A batch is one build run. Add one to see what each unit costs at that size and how much cash it needs.
          <div className="mt-3 flex justify-center">{add}</div>
        </EmptyState>
      ) : (
        <Panel id="batches" title="Batches" note="Unit cost, cash needed and what is not priced are worked out at each batch's own size." action={add}>
          <div className="space-y-3">
            <Table>
              <caption className="sr-only">Planned batches with computed unit cost and cash needed</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Batch</TableHead>
                  <TableHead scope="col" className="text-right">Units</TableHead>
                  <TableHead scope="col">Target date</TableHead>
                  <TableHead scope="col">Build</TableHead>
                  <TableHead scope="col" className="text-right">Unit cost</TableHead>
                  <TableHead scope="col" className="text-right">Cash needed</TableHead>
                  <TableHead scope="col">Not priced</TableHead>
                  <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id} data-selected={selected?.id === r.id} className={selected?.id === r.id ? "bg-subtle" : ""}>
                    <TableCell className="text-primary">
                      <button
                        type="button"
                        aria-pressed={selected?.id === r.id}
                        onClick={() => setPicked(r.id)}
                        className="text-left font-medium hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                      >
                        {r.title}
                      </button>
                      <StatusBadge tone={statusTone(r.status)} className="ml-2">{r.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.units === null ? <span className="text-muted">not set</span> : r.units.toLocaleString("en")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.targetDate || <span className="text-muted">none</span>}</TableCell>
                    <TableCell>{r.build || <span className="text-muted">none</span>}</TableCell>
                    <TableCell className="text-right font-mono">{r.unitCost === null ? <span className="text-muted">n/a</span> : fm(r.unitCost)}</TableCell>
                    <TableCell className="text-right font-mono">{r.cash === null ? <span className="text-muted">n/a</span> : fm(r.cash)}</TableCell>
                    <TableCell>
                      {r.missing.length ? <StatusBadge tone="warning">{r.missing.length} not priced</StatusBadge> : <span className="text-xs text-secondary">Everything priced</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r.id)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.title}`} onClick={() => void remove(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {selected ? <MissingList items={selected.missing} title={`Not priced in ${selected.title}`} /> : null}
            <HowThisIsWorkedOut lines={results.flatMap((r) => r.how.map((h, i) => ({ label: i === 0 ? r.title : "", how: h })))} />
          </div>
        </Panel>
      )}

      {results.length ? (
        <Panel id="readiness" title="Production readiness" note="Whether this batch can start. Each check is worked out from the rows, never ticked by hand.">
          <ReadinessPanel checks={checks} batchTitle={selected?.title} />
        </Panel>
      ) : null}

      <Panel id="one-off" title="One-off costs outside any batch" note="Tooling and certification are paid once for the whole plan, so they are not in any batch's cash figure above.">
        <FixedCostsTable fixed={oneOff} currency={currency} />
      </Panel>

      <BatchDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editingRow}
        onSave={async (v) => {
          if (editingRow) await batches.patch(editingRow.id, { title: v.title, status: v.status, data: v.data });
          else await batches.add({ section: STORE_BATCHES, title: v.title, status: v.status, data: v.data });
          setEditing(null);
        }}
      />
    </div>
  );
}
