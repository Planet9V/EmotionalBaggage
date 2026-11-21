"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchPrinter } from "@/lib/slicing/match";
import type { SlicerState } from "@/lib/slicing/queries";
import type { PrinterView } from "@/lib/admin/printers";
import type { FileMeta, Item } from "@/lib/types";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Modal } from "@/components/ui/modal";

export type NewJob = { title: string; data: Record<string, unknown> };

const schema = z.object({
  title: z.string().trim().min(1, "A job needs a name."),
  fileId: z.string().min(1, "Choose the file to print."),
  part: z.string(),
  printerId: z.string().min(1, "Choose a printer."),
  modelKey: z.string().min(1, "Choose the printer model the slicer should use."),
  material: z.string(),
  layer: z.string(),
  infill: z.string().refine((v) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
  }, "Infill is a number from 0 to 100."),
  supports: z.boolean(),
  buildKey: z.string(),
});
type Values = z.infer<typeof schema>;

const ENCLOSURE = /enclosure|tray|lid|case|shell|base/i;
export const isPrintable = (f: FileMeta) => /\.(stl|3mf)$/i.test(f.name) && !/\.gcode\.3mf$/i.test(f.name);

export function NewJobDialog({ open, onOpenChange, files, parts, builds, printers, slicer, onCreate, editing }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  files: FileMeta[];
  parts: { ref: string; title: string }[];
  builds: { key: string; title: string }[];
  printers: PrinterView[];
  slicer: SlicerState | undefined;
  onCreate: (j: NewJob) => Promise<void>;
  /** a queued job to change instead of a new one; the parent gives the dialog a new key per job */
  editing?: Item | null;
}) {
  const was = (editing?.data ?? {}) as Record<string, unknown>;
  const str = (k: string, d = "") => (was[k] == null ? d : String(was[k]));
  const printable = useMemo(() => files.filter(isPrintable), [files]);
  const enclosure = printable.filter((f) => ENCLOSURE.test(f.name));
  const rest = printable.filter((f) => !ENCLOSURE.test(f.name));
  const usable = printers.filter((p) => p.enabled);
  const profiles = (slicer?.printers ?? []).filter((p) => p.available);

  const { register, handleSubmit, control, setValue, getValues, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: editing?.title ?? "",
      fileId: str("fileId"),
      part: str("part"),
      printerId: str("printerId"),
      modelKey: was.printerMaker && was.printerModel ? `${str("printerMaker")}|${str("printerModel")}` : "",
      material: str("material", "PLA"),
      layer: str("layerHeight", "0.2"),
      infill: str("infill", "15"),
      supports: !!was.supports,
      buildKey: str("buildKey"),
    },
  });
  const modelKey = useWatch({ control, name: "modelKey" });
  const profile = profiles.find((p) => `${p.maker}|${p.model}` === modelKey) ?? null;
  const layers = profile?.layerHeights ?? [];
  const mats = profile?.materials ?? [];

  // Choosing a printer picks its slicer profile; choosing a profile keeps material and layer height valid for it.
  const pickModel = (key: string) => {
    setValue("modelKey", key, { shouldValidate: !!errors.modelKey });
    const m = profiles.find((p) => `${p.maker}|${p.model}` === key);
    if (!m) return;
    if (!m.materials.includes(getValues("material"))) setValue("material", m.materials.includes("PLA") ? "PLA" : (m.materials[0] ?? ""));
    const layer = getValues("layer");
    if (!m.layerHeights.some((h) => String(h) === layer || h === Number(layer))) setValue("layer", String(m.layerHeights.includes(0.2) ? 0.2 : (m.layerHeights[0] ?? 0.2)));
  };
  const pickPrinter = (id: string) => {
    setValue("printerId", id, { shouldValidate: !!errors.printerId });
    const p = usable.find((x) => String(x.id) === id);
    const m = p ? matchPrinter(p.model, profiles) : null;
    if (m) pickModel(`${m.maker}|${m.model}`);
  };
  const pickFile = (id: string) => {
    setValue("fileId", id, { shouldValidate: !!errors.fileId });
    const f = files.find((x) => String(x.id) === id);
    if (f && !getValues("title").trim()) setValue("title", f.name.replace(/\.(stl|3mf)$/i, ""));
  };

  const submit = handleSubmit(async (v) => {
    const f = files.find((x) => String(x.id) === v.fileId)!;
    const p = usable.find((x) => String(x.id) === v.printerId)!;
    if (!profile) return setError("modelKey", { message: "Choose the printer model the slicer should use." });
    try {
      await onCreate({
        title: v.title.trim(),
        data: {
          fileId: f.id, fileName: f.name, ...(v.part ? { part: v.part } : {}),
          printerId: p.id, printerName: p.name, printerMaker: profile.maker, printerModel: profile.model, printerFamily: p.family,
          material: v.material, layerHeight: Number(v.layer), infill: Number(v.infill), supports: v.supports, ...(v.buildKey ? { buildKey: v.buildKey } : {}),
        },
      });
      if (!editing) { setValue("title", ""); setValue("fileId", ""); setValue("part", ""); }
      onOpenChange(false);
    } catch (x) {
      setError("root", { message: (x as Error).message });
    }
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? "Edit print job" : "New print job"} description="Pick what to print and where. The slicer works out time and material when you slice it." wide>
      <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-3 sm:grid-cols-2">
        <Field id="job-file" label="File to print" hint={printable.length ? "Stored .stl and .3mf files of this concept." : undefined} error={errors.fileId?.message} className="sm:col-span-2">
          <NativeSelect id="job-file" aria-invalid={!!errors.fileId} {...register("fileId", { onChange: (e) => pickFile(e.target.value) })}>
            <option value="">Choose a file</option>
            {enclosure.length > 0 && <optgroup label="Enclosure">{enclosure.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
            {rest.length > 0 && <optgroup label="Other files">{rest.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
          </NativeSelect>
          {!printable.length && (
            <span className="mt-1 block text-xs text-secondary">
              No .stl or .3mf file is stored yet. Generate or upload one in <Link href="/s/design/model" className="text-link underline">Design, 3D model</Link>.
            </span>
          )}
        </Field>
        <Field id="job-name" label="Job name" error={errors.title?.message}><Input id="job-name" aria-invalid={!!errors.title} {...register("title")} /></Field>
        <Field id="job-part" label="Printed part (optional)">
          <NativeSelect id="job-part" {...register("part")}>
            <option value="">Not tied to a part</option>
            {parts.map((p) => <option key={p.ref || p.title} value={p.ref || p.title}>{p.ref ? `${p.ref} ` : ""}{p.title}</option>)}
          </NativeSelect>
        </Field>
        <Field id="job-printer" label="Printer" hint={usable.length ? undefined : "No printer is enabled."} error={errors.printerId?.message} className="sm:col-span-1">
          <NativeSelect id="job-printer" aria-invalid={!!errors.printerId} {...register("printerId", { onChange: (e) => pickPrinter(e.target.value) })}>
            <option value="">Choose a printer</option>
            {usable.map((p) => <option key={p.id} value={p.id}>{p.name}{p.model ? ` (${p.model})` : ""}</option>)}
          </NativeSelect>
          {!usable.length && <span className="mt-1 block text-xs text-secondary">Add one in <Link href="/admin?tab=printers" className="text-link underline">Admin, Printers</Link>.</span>}
        </Field>
        <Field id="job-model" label="Slicer profile for this printer" hint={slicer && !slicer.ok ? "The slicer is not available." : "The model OrcaSlicer has profiles for."} error={errors.modelKey?.message}>
          <NativeSelect id="job-model" aria-invalid={!!errors.modelKey} disabled={!profiles.length} {...register("modelKey", { onChange: (e) => pickModel(e.target.value) })}>
            <option value="">Choose a model</option>
            {profiles.map((p) => <option key={`${p.maker}|${p.model}`} value={`${p.maker}|${p.model}`}>{p.maker} {p.model}</option>)}
          </NativeSelect>
        </Field>
        <Field id="job-material" label="Material">
          <NativeSelect id="job-material" disabled={!profile} {...register("material")}>
            {mats.map((m) => <option key={m} value={m}>{m}</option>)}
          </NativeSelect>
        </Field>
        <Field id="job-layer" label="Layer height (mm)">
          <NativeSelect id="job-layer" disabled={!profile} {...register("layer")}>
            {layers.map((h) => <option key={h} value={h}>{h.toFixed(2)}</option>)}
          </NativeSelect>
        </Field>
        <Field id="job-infill" label="Infill (%)" error={errors.infill?.message}><Input id="job-infill" inputMode="numeric" aria-invalid={!!errors.infill} {...register("infill")} /></Field>
        <Field id="job-build" label="Belongs to build (optional)">
          <NativeSelect id="job-build" {...register("buildKey")}>
            <option value="">No build</option>
            {builds.map((b) => <option key={b.key} value={b.key}>{b.title}</option>)}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2 text-sm text-primary sm:col-span-2">
          <input type="checkbox" {...register("supports")} className="h-4 w-4 accent-dutchOrange" />
          Add supports where the slicer finds an overhang
        </label>
        {errors.root?.message ? <div className="sm:col-span-2"><ErrorLine>{errors.root.message}</ErrorLine></div> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving" : editing ? "Save job" : "Add job"}</Button>
        </div>
      </form>
    </Modal>
  );
}
