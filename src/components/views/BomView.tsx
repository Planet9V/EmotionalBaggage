"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Box, CircuitBoard, Download, Plus, Trash2, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine, Field, Select, Textarea, statusOptions } from "@/components/parts/controls";
import { InlineEdit } from "@/components/parts/InlineEdit";
import { Modal } from "@/components/parts/Modal";
import { sumLine, toPart, type Part } from "@/lib/domain";
import { mapImport, money, parseAmount, parseCsv, toCsv, groupParts, type ImportRow } from "@/components/parts/bom";
import { saveOrMessage, useItems } from "@/lib/client";
import { statusTone } from "@/lib/statusTones";
import { conceptQueries } from "@/lib/conceptsClient";
import { sectionVisible } from "@/lib/productTypes";
import { usePins } from "@/lib/parts/client";
import { partKind } from "@/lib/parts/kinds";
import { libraryEntryById } from "@/lib/parts/library";
import { partPins, pinsByItem } from "@/lib/parts/pins";
import { PartElectricalDialog } from "@/components/parts/PartElectricalDialog";
import type { ViewProps } from "./types";

type GroupBy = "none" | "source" | "status";
const SOURCES = ["Amazon", "Micro Center", "Own printer"];

export function BomView({ project, section, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const reduce = useReducedMotion();
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
    const blob = new Blob([toCsv(parts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id}-bill-of-materials.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const numberSave = (p: Part, key: "qty" | "line") => (v: string) => {
    const n = parseAmount(v);
    if (n === null) return "Enter a number, zero or more.";
    return saveOrMessage(setData(p, { [key]: n }));
  };

  if (loading) return <p className="text-sm text-secondary">Loading the parts.</p>;

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-4">
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
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
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
                        <Select
                          aria-label={`Status of ${p.item.title}`}
                          className="h-8 text-xs"
                          value={p.item.status}
                          onChange={(e) => void patch(p.item.id, { status: e.target.value })}
                        >
                          {statusOptions(statuses, p.item.status).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
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
        </div>
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
    </motion.div>
  );
}

function StatusLegend({ statuses }: { statuses: string[] }) {
  if (!statuses.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
      Statuses:
      {statuses.map((s) => (
        <StatusBadge key={s} tone={statusTone(s)}>{s}</StatusBadge>
      ))}
    </p>
  );
}

type NewPart = { ref: string; title: string; spec: string; qty: number; source: string; search: string; line: number; status: string };

function AddPartDialog({ open, onOpenChange, statuses, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; statuses: string[]; onCreate: (v: NewPart) => Promise<void> }) {
  const blank = { ref: "", title: "", spec: "", qty: "1", source: "", search: "", line: "", status: statuses[0] ?? "" };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseAmount(f.qty || "1");
    const line = parseAmount(f.line);
    if (!f.title.trim()) return setErr("A part needs a name.");
    if (qty === null) return setErr("Qty must be a number.");
    if (line === null) return setErr("Line cost must be a number.");
    setBusy(true);
    try {
      await onCreate({ ref: f.ref.trim(), title: f.title.trim(), spec: f.spec, qty, source: f.source.trim(), search: f.search.trim(), line, status: f.status });
      setF(blank);
      setErr("");
      onOpenChange(false);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add part" description="Line cost is the cost of the whole line, not of one unit.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ref"><Input value={f.ref} onChange={set("ref")} className="font-mono" /></Field>
          <Field label="Part" className="col-span-2"><Input value={f.title} onChange={set("title")} required autoFocus /></Field>
        </div>
        <Field label="Specification"><Textarea rows={2} value={f.spec} onChange={set("spec")} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Qty"><Input value={f.qty} onChange={set("qty")} inputMode="decimal" className="font-mono" /></Field>
          <Field label="Source">
            <Input value={f.source} onChange={set("source")} list="bom-sources" />
            <datalist id="bom-sources">{SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Line cost"><Input value={f.line} onChange={set("line")} inputMode="decimal" className="font-mono" placeholder="0.00" /></Field>
        </div>
        <Field label="Search term" hint="Used to build the buy link on the Sourcing page."><Input value={f.search} onChange={set("search")} /></Field>
        {statuses.length > 0 && (
          <Field label="Status">
            <Select value={f.status} onChange={set("status")}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          </Field>
        )}
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Adding" : "Add part"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportDialog({ open, onOpenChange, defaultStatus, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; defaultStatus?: string; onCreate: (rows: ImportRow[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mapped = useMemo(() => (text.trim() ? mapImport(parseCsv(text)) : null), [text]);
  const good = mapped?.rows.filter((r) => !r.problem) ?? [];
  const bad = (mapped?.rows.length ?? 0) - good.length;

  const create = async () => {
    setBusy(true);
    setErr("");
    try {
      await onCreate(good);
      setText("");
      onOpenChange(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Import parts from CSV"
      description="Columns: ref, title, spec, qty, source, search, line. A header row is matched by name; without one, columns are read in that order."
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            aria-label="CSV file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setText(await file.text());
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose a file</Button>
          <span className="text-xs text-muted">or paste below</span>
        </div>
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" placeholder="ref,title,spec,qty,source,search,line" aria-label="CSV text" />
        {mapped && (
          <div className="space-y-2">
            <p className="text-xs text-secondary">
              {mapped.usedHeader ? "Header row found." : "No header row found, reading columns in the default order."} {good.length} ready to create{bad ? `, ${bad} skipped` : ""}. New parts get status <span className="font-mono">{defaultStatus ?? "none"}</span>.
            </p>
            <div className="max-h-64 overflow-auto rounded-md border border-hairline">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Ref</TableHead><TableHead>Part</TableHead><TableHead>Spec</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Source</TableHead><TableHead>Search</TableHead><TableHead className="text-right">Line</TableHead><TableHead>Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapped.rows.map((r, i) => (
                    <TableRow key={i} className={r.problem ? "bg-danger-soft hover:bg-danger-soft" : ""}>
                      <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                      <TableCell className="text-xs">{r.title}</TableCell>
                      <TableCell className="max-w-48 truncate text-xs">{r.spec}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.qty}</TableCell>
                      <TableCell className="text-xs">{r.source}</TableCell>
                      <TableCell className="max-w-40 truncate text-xs">{r.search}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(r.line)}</TableCell>
                      <TableCell className="text-xs text-danger">{r.problem || <span className="text-success">OK</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!good.length || busy} onClick={create}>{busy ? "Creating" : `Create ${good.length} ${good.length === 1 ? "part" : "parts"}`}</Button>
        </div>
      </div>
    </Modal>
  );
}
