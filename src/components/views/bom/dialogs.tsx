"use client";

import { MoneyInput } from "@/components/ui/money-input";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { mapImport, money, parseAmount, type ImportRow } from "@/components/parts/bom";
import { parseCsvText } from "@/lib/csv";
import { statusTone } from "@/lib/statusTones";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { PURCHASE_SOURCES } from "@/lib/channels/registry";


export function StatusLegend({ statuses }: { statuses: string[] }) {
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

export function AddPartDialog({ open, onOpenChange, statuses, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; statuses: string[]; onCreate: (v: NewPart) => Promise<void> }) {
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
            <datalist id="bom-sources">{PURCHASE_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Line cost"><MoneyInput value={f.line} onChange={set("line")} placeholder="0.00" /></Field>
        </div>
        <Field label="Search term" hint="Used to build the buy link on the Sourcing page."><Input value={f.search} onChange={set("search")} /></Field>
        {statuses.length > 0 && (
          <Field label="Status">
            <NativeSelect value={f.status} onChange={set("status")}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</NativeSelect>
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

export function ImportDialog({ open, onOpenChange, defaultStatus, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; defaultStatus?: string; onCreate: (rows: ImportRow[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mapped = useMemo(() => (text.trim() ? mapImport(parseCsvText(text).rows) : null), [text]);
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
