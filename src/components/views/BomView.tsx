"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Box, CircuitBoard, Download, Plus, Trash2, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineEdit } from "@/components/parts/InlineEdit";
import { sumLine, toPart, type Part } from "@/lib/domain";
import { money, parseAmount, toCsv, groupParts } from "@/components/parts/bom";
import { saveOrMessage, useItems } from "@/lib/client";
import { conceptQueries } from "@/lib/conceptsClient";
import { sectionVisible } from "@/lib/productTypes";
import { usePins } from "@/lib/parts/client";
import { partKind } from "@/lib/parts/kinds";
import { libraryEntryById } from "@/lib/parts/library";
import { partPins, pinsByItem } from "@/lib/parts/pins";
import { PartElectricalDialog } from "@/components/parts/PartElectricalDialog";
import type { ViewProps } from "./types";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { NativeSelect } from "@/components/ui/native-select";
import { statusOptions } from "@/lib/statusOptions";
import { Modal } from "@/components/ui/modal";
import { downloadFile } from "@/lib/download";
import { Card } from "@/components/ui/Card";
import { AddPartDialog, ImportDialog, StatusLegend } from "./bom/dialogs";

type GroupBy = "none" | "source" | "status";

export function BomView({ project, section, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Part | null>(null);
  const [actionError, setActionError] = useState("");

  const parts = useMemo(() => items.map(toPart), [items]);
  // Kind and pins (plan 5.1) only for a product type that has a schematic: a non-electronic product shows none of it.
  const concept = useQuery(conceptQueries.one(project.id));
  const electrical = !!concept.data && sectionVisible(concept.data.productType, "design", "schematic");
  const pinsApi = usePins(electrical ? project.id : undefined);
  const ownPins = useMemo(() => pinsByItem(pinsApi.pins), [pinsApi.pins]);
  const [editingPins, setEditingPins] = useState<number | null>(null);
  const pinsPart = editingPins === null ? null : (items.find((i) => i.id === editingPins) ?? null);
  const total = sumLine(parts);
  const groups = useMemo(() => groupParts(parts, groupBy), [parts, groupBy]);
  const statuses = section.statuses ?? [];

  const setData = (p: Part, data: Record<string, unknown>) => patch(p.item.id, { data });

  const exportCsv = () => {
    downloadFile(`${project.id}-bill-of-materials.csv`, toCsv(parts), "text/csv;charset=utf-8");
  };

  const numberSave = (p: Part, key: "qty" | "line") => (v: string) => {
    const n = parseAmount(v);
    if (n === null) return "Enter a number, zero or more.";
    return saveOrMessage(setData(p, { [key]: n }));
  };

  if (loading) return <LoadingBlocks rows={2} label="Loading the parts" />;

  return (
    <div className="animate-enter space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add part
        </Button>
        <Button variant="outline" onClick={() => setImporting(true)}>
          <Upload className="h-4 w-4" aria-hidden /> Import CSV
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={!parts.length}>
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </Button>
        <div className="ml-auto flex items-center gap-2" role="group" aria-label="Group parts by">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Group by</span>
          {(["none", "source", "status"] as const).map((g) => (
            <Button key={g} size="sm" variant={groupBy === g ? "subtle" : "ghost"} aria-pressed={groupBy === g} onClick={() => setGroupBy(g)}>
              {g === "none" ? "None" : g === "source" ? "Source" : "Status"}
            </Button>
          ))}
        </div>
      </div>

      {error ? <ErrorLine>{error}</ErrorLine> : null}
      {actionError || writeError ? <ErrorLine>{actionError || writeError}</ErrorLine> : null}

      {!parts.length ? (
        <EmptyState title="No parts yet">
          Add a part, or import a CSV with the columns ref, title, spec, qty, source, search and line.
        </EmptyState>
      ) : (
        <Card variant="flat" className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">Ref</TableHead>
                <TableHead className="min-w-40">Part</TableHead>
                <TableHead className="min-w-56">Specification</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-36">Source</TableHead>
                <TableHead className="w-28 text-right">Line cost</TableHead>
                <TableHead className="w-36">Status</TableHead>
                {electrical && <TableHead className="w-40">Kind and pins</TableHead>}
                <TableHead className="w-14">3D</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Delete</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <Fragment key={g.key || "all"}>
                  {groupBy !== "none" && (
                    <TableRow className="bg-subtle hover:bg-subtle">
                      <TableCell colSpan={5} className="py-1.5 text-xs font-medium text-primary">
                        {g.key} <span className="font-mono text-muted">· {g.parts.length} {g.parts.length === 1 ? "part" : "parts"}</span>
                      </TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs text-primary">{money(g.total)}</TableCell>
                      <TableCell colSpan={electrical ? 4 : 3} className="py-1.5 text-xs text-muted">Subtotal</TableCell>
                    </TableRow>
                  )}
                  {g.parts.map((p) => (
                    <TableRow key={p.item.id}>
                      <TableCell>
                        <InlineEdit mono label={`reference of ${p.item.title}`} value={p.ref} onSave={(v) => saveOrMessage(setData(p, { ref: v.trim() }))} />
                      </TableCell>
                      <TableCell>
                        <InlineEdit label="part name" value={p.item.title} onSave={(v) => (v.trim() ? saveOrMessage(patch(p.item.id, { title: v.trim() })) : "A part needs a name.")} />
                      </TableCell>
                      <TableCell>
                        <InlineEdit label={`specification of ${p.item.title}`} value={p.item.body} onSave={(v) => saveOrMessage(patch(p.item.id, { body: v }))} />
                      </TableCell>
                      <TableCell>
                        <InlineEdit mono numeric align="right" label={`quantity of ${p.item.title}`} value={p.qty === null ? "" : String(p.qty)} onSave={numberSave(p, "qty")} />
                      </TableCell>
                      <TableCell>
                        <InlineEdit label={`source of ${p.item.title}`} value={p.source} onSave={(v) => saveOrMessage(setData(p, { source: v.trim() }))} />
                      </TableCell>
                      <TableCell>
                        <InlineEdit mono numeric align="right" label={`line cost of ${p.item.title}`} value={p.line === null ? "" : money(p.line)} onSave={numberSave(p, "line")} />
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          aria-label={`Status of ${p.item.title}`}
                          className="h-8 text-xs"
                          value={p.item.status}
                          onChange={(e) => void patch(p.item.id, { status: e.target.value })}
                        >
                          {statusOptions(statuses, p.item.status).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </NativeSelect>
                      </TableCell>
                      {electrical && (
                        <TableCell>
                          {(() => {
                            const r = partPins(p.item, ownPins.get(p.item.id) ?? []);
                            const kind = partKind(r.kindId);
                            const lib = libraryEntryById(r.libraryId);
                            const label = lib ? lib.name : kind ? kind.label : "Set kind";
                            const count = r.source === "wires" ? "" : `${r.pins.length} ${r.pins.length === 1 ? "pin" : "pins"}${r.source === "own" ? ", own" : ""}`;
                            return (
                              <button
                                type="button"
                                onClick={() => setEditingPins(p.item.id)}
                                className="group flex max-w-[11rem] flex-col items-start rounded-md px-1.5 py-1 text-left text-xs transition-colors duration-150 hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
                                aria-label={`Kind and pins of ${p.item.title}: ${label}${count ? `, ${count}` : ""}`}
                              >
                                <span className={`flex items-center gap-1 truncate ${kind || lib ? "text-primary" : "text-link"}`}>
                                  <CircuitBoard className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                                  <span className="truncate">{label}</span>
                                </span>
                                {/* a space between the two lines, so the button's visible text reads as one phrase */}
                                {count && " "}
                                {count && <span className="font-mono text-[10px] text-muted">{count}</span>}
                              </button>
                            );
                          })()}
                        </TableCell>
                      )}
                      <TableCell>
                        {p.geometry ? (
                          <Link href="/s/design/model" className="inline-flex items-center gap-1 text-link hover:underline" title="Has 3D geometry. Open the model.">
                            <Box className="h-4 w-4" aria-hidden />
                            <span className="sr-only">Has 3D geometry, open the model</span>
                          </Link>
                        ) : (
                          <span className="text-muted" title="No 3D geometry">
                            <span aria-hidden>-</span>
                            <span className="sr-only">No 3D geometry</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${p.item.title}`} onClick={() => setDeleting(p)}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
            <tfoot className="border-t border-hairline bg-subtle">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="text-sm font-medium text-primary">
                  Total <span className="font-mono text-xs text-muted">· {parts.length} {parts.length === 1 ? "part" : "parts"}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium text-primary" data-testid="bom-total">{money(total)}</TableCell>
                <TableCell colSpan={electrical ? 4 : 3} />
              </TableRow>
            </tfoot>
          </Table>
        </Card>
      )}

      <AddPartDialog
        open={adding}
        onOpenChange={setAdding}
        statuses={statuses}
        onCreate={async (v) => {
          await add({
            section: store,
            title: v.title,
            body: v.spec,
            status: v.status,
            data: { ref: v.ref, qty: v.qty, source: v.source, search: v.search, line: v.line, asin: "" },
          });
        }}
      />
      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        defaultStatus={statuses[0]}
        onCreate={async (rows) => {
          for (const r of rows) {
            await add({
              section: store,
              title: r.title,
              body: r.spec,
              status: statuses[0],
              data: { ref: r.ref, qty: r.qty, source: r.source, search: r.search, line: r.line, asin: "" },
            });
          }
        }}
      />
      <Modal open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title="Delete this part?" description="This removes the row from the bill of materials. It cannot be undone.">
        <p className="text-sm text-secondary">
          {deleting ? <><span className="font-medium text-primary">{deleting.item.title}</span>{deleting.ref ? ` (${deleting.ref})` : ""}{deleting.line === null ? "" : `, ${money(deleting.line)}`}</> : null}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)}>Keep it</Button>
          <Button
            onClick={async () => {
              if (!deleting) return;
              try {
                setActionError("");
                await remove(deleting.item.id);
              } catch (e) {
                setActionError((e as Error).message);
              }
              setDeleting(null);
            }}
          >
            Delete part
          </Button>
        </div>
      </Modal>
      {electrical && (
        <PartElectricalDialog
          part={pinsPart}
          ownPins={pinsPart ? (ownPins.get(pinsPart.id) ?? []) : []}
          onClose={() => setEditingPins(null)}
          onType={(change) => patch(pinsPart!.id, { data: change })}
          onPins={(pins) => pinsApi.setPins(pinsPart!.id, pins).then(() => undefined)}
        />
      )}
      {pinsApi.writeError ? <ErrorLine>{pinsApi.writeError}</ErrorLine> : null}
      <StatusLegend statuses={statuses} />
    </div>
  );
}
