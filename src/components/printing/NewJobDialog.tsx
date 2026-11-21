"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine, Field, Select } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { matchPrinter } from "@/lib/slicing/match";
import type { SlicerState } from "@/lib/slicing/queries";
import type { PrinterView } from "@/lib/admin/printers";
import type { FileMeta } from "@/lib/types";

export type NewJob = { title: string; data: Record<string, unknown> };

const ENCLOSURE = /enclosure|tray|lid|case|shell|base/i;
export const isPrintable = (f: FileMeta) => /\.(stl|3mf)$/i.test(f.name) && !/\.gcode\.3mf$/i.test(f.name);

export function NewJobDialog({ open, onOpenChange, files, parts, builds, printers, slicer, onCreate }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  files: FileMeta[];
  parts: { ref: string; title: string }[];
  builds: { key: string; title: string }[];
  printers: PrinterView[];
  slicer: SlicerState | undefined;
  onCreate: (j: NewJob) => Promise<void>;
}) {
  const printable = useMemo(() => files.filter(isPrintable), [files]);
  const enclosure = printable.filter((f) => ENCLOSURE.test(f.name));
  const rest = printable.filter((f) => !ENCLOSURE.test(f.name));
  const usable = printers.filter((p) => p.enabled);
  const profiles = (slicer?.printers ?? []).filter((p) => p.available);

  const [title, setTitle] = useState("");
  const [fileId, setFileId] = useState("");
  const [part, setPart] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [material, setMaterial] = useState("PLA");
  const [layer, setLayer] = useState("0.2");
  const [infill, setInfill] = useState("15");
  const [supports, setSupports] = useState(false);
  const [buildKey, setBuildKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const profile = profiles.find((p) => `${p.maker}|${p.model}` === modelKey) ?? null;
  const layers = profile?.layerHeights ?? [];
  const mats = profile?.materials ?? [];

  const pickPrinter = (id: string) => {
    setPrinterId(id);
    const p = usable.find((x) => String(x.id) === id);
    const m = p ? matchPrinter(p.model, profiles) : null;
    if (m) pickModel(`${m.maker}|${m.model}`);
  };
  const pickModel = (key: string) => {
    setModelKey(key);
    const m = profiles.find((p) => `${p.maker}|${p.model}` === key);
    if (!m) return;
    if (!m.materials.includes(material)) setMaterial(m.materials.includes("PLA") ? "PLA" : (m.materials[0] ?? ""));
    if (!m.layerHeights.some((h) => String(h) === layer || h === Number(layer))) setLayer(String(m.layerHeights.includes(0.2) ? 0.2 : (m.layerHeights[0] ?? 0.2)));
  };
  const pickFile = (id: string) => {
    setFileId(id);
    const f = files.find((x) => String(x.id) === id);
    if (f && !title.trim()) setTitle(f.name.replace(/\.(stl|3mf)$/i, ""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setErr("A job needs a name.");
    if (!fileId) return setErr("Choose the file to print.");
    if (!printerId) return setErr("Choose a printer.");
    if (!profile) return setErr("Choose the printer model the slicer should use.");
    const n = Number(infill);
    if (!Number.isFinite(n) || n < 0 || n > 100) return setErr("Infill is a number from 0 to 100.");
    const f = files.find((x) => String(x.id) === fileId)!;
    const p = usable.find((x) => String(x.id) === printerId)!;
    setBusy(true);
    setErr("");
    try {
      await onCreate({
        title: title.trim(),
        data: {
          fileId: f.id, fileName: f.name, ...(part ? { part } : {}),
          printerId: p.id, printerName: p.name, printerMaker: profile.maker, printerModel: profile.model, printerFamily: p.family,
          material, layerHeight: Number(layer), infill: n, supports, ...(buildKey ? { buildKey } : {}),
        },
      });
      setTitle(""); setFileId(""); setPart("");
      onOpenChange(false);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New print job" description="Pick what to print and where. The slicer works out time and material when you slice it." wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="File to print" hint={printable.length ? "Stored .stl and .3mf files of this concept." : undefined} className="sm:col-span-2">
          <Select value={fileId} onChange={(e) => pickFile(e.target.value)} required>
            <option value="">Choose a file</option>
            {enclosure.length > 0 && <optgroup label="Enclosure">{enclosure.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
            {rest.length > 0 && <optgroup label="Other files">{rest.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
          </Select>
          {!printable.length && (
            <span className="mt-1 block text-xs text-secondary">
              No .stl or .3mf file is stored yet. Generate or upload one in <Link href="/s/design/model" className="text-link underline">Design, 3D model</Link>.
            </span>
          )}
        </Field>
        <Field label="Job name"><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Printed part (optional)">
          <Select value={part} onChange={(e) => setPart(e.target.value)}>
            <option value="">Not tied to a part</option>
            {parts.map((p) => <option key={p.ref || p.title} value={p.ref || p.title}>{p.ref ? `${p.ref} ` : ""}{p.title}</option>)}
          </Select>
        </Field>
        <Field label="Printer" hint={usable.length ? undefined : "No printer is enabled."} className="sm:col-span-1">
          <Select value={printerId} onChange={(e) => pickPrinter(e.target.value)} required>
            <option value="">Choose a printer</option>
            {usable.map((p) => <option key={p.id} value={p.id}>{p.name}{p.model ? ` (${p.model})` : ""}</option>)}
          </Select>
          {!usable.length && <span className="mt-1 block text-xs text-secondary">Add one in <Link href="/admin?tab=printers" className="text-link underline">Admin, Printers</Link>.</span>}
        </Field>
        <Field label="Slicer profile for this printer" hint={slicer && !slicer.ok ? "The slicer is not available." : "The model OrcaSlicer has profiles for."}>
          <Select value={modelKey} onChange={(e) => pickModel(e.target.value)} required disabled={!profiles.length}>
            <option value="">Choose a model</option>
            {profiles.map((p) => <option key={`${p.maker}|${p.model}`} value={`${p.maker}|${p.model}`}>{p.maker} {p.model}</option>)}
          </Select>
        </Field>
        <Field label="Material">
          <Select value={material} onChange={(e) => setMaterial(e.target.value)} disabled={!profile}>
            {mats.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Layer height (mm)">
          <Select value={layer} onChange={(e) => setLayer(e.target.value)} disabled={!profile}>
            {layers.map((h) => <option key={h} value={h}>{h.toFixed(2)}</option>)}
          </Select>
        </Field>
        <Field label="Infill (%)"><Input inputMode="numeric" value={infill} onChange={(e) => setInfill(e.target.value)} /></Field>
        <Field label="Belongs to build (optional)">
          <Select value={buildKey} onChange={(e) => setBuildKey(e.target.value)}>
            <option value="">No build</option>
            {builds.map((b) => <option key={b.key} value={b.key}>{b.title}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-primary sm:col-span-2">
          <input type="checkbox" checked={supports} onChange={(e) => setSupports(e.target.checked)} className="h-4 w-4 accent-dutchOrange" />
          Add supports where the slicer finds an overhang
        </label>
        {err ? <div className="sm:col-span-2"><ErrorLine>{err}</ErrorLine></div> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Adding" : "Add job"}</Button>
        </div>
      </form>
    </Modal>
  );
}
