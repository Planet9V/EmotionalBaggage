"use client";

// A job with no slicer here: the model leaves the app, the person slices it in their own slicer, and the sliced
// file comes back with the time and grams that slicer reported, which the job then shows as entered by hand.
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Paperclip } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ErrorLine } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/client";
import { keys } from "@/lib/queries";
import { printKeys } from "@/lib/slicing/queries";
import { OWN_SLICERS, OWN_SLICER_STEPS } from "@/lib/slicing/messages";

const positive = (msg: string, min0 = false) =>
  z.string().refine((v) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && (min0 ? n >= 0 : n > 0);
  }, msg);

const schema = z.object({
  slicer: z.string().trim().min(1, "Name the slicer the file came from.").max(80),
  minutes: positive("The print time is a number of minutes above 0."),
  grams: positive("Filament is a number of grams, 0 or more.", true),
});
type Values = z.infer<typeof schema>;

const SLICED = /\.(gcode|gco|g|bgcode|3mf)$/i;

export function OwnSlicer({ projectId, jobId, fileId, fileName, reason }: { projectId: string; jobId: number; fileId?: number | null; fileName?: string; reason: string }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [open, setOpen] = useState(false);
  const listId = `own-slicers-${jobId}`;
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { slicer: "", minutes: "", grams: "" } });

  const submit = handleSubmit(async (v) => {
    if (!file) return setFileError("Choose the sliced G-code or .3mf.");
    if (!SLICED.test(file.name)) return setFileError("Attach the sliced file: G-code (.gcode, .bgcode) or a sliced .3mf.");
    setFileError("");
    const form = new FormData();
    form.append("file", file);
    form.append("slicer", v.slicer.trim());
    form.append("minutes", v.minutes.trim());
    form.append("grams", v.grams.trim());
    try {
      await api(`/api/print-jobs/${jobId}/attach`, { method: "POST", body: form });
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) }),
        qc.invalidateQueries({ queryKey: keys.files(projectId) }),
        qc.invalidateQueries({ queryKey: printKeys.plan(jobId) }),
      ]);
    } catch (x) {
      setError("root", { message: (x as Error).message });
    }
  });

  return (
    <Card variant="well" as="section" className="rounded-lg p-3 text-sm" aria-label="Slice it in your own slicer">
      <p className="font-medium text-primary">Slice it in your own slicer</p>
      <p className="mt-0.5 text-xs text-secondary">{reason}</p>
      <ol className="mt-2 list-decimal text-xs space-y-0.5 pl-5 text-secondary">{OWN_SLICER_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
      <div className="mt-2 flex flex-wrap gap-2">
        {fileId ? (
          <a href={`/api/files/${fileId}`} download={fileName} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download className="h-3.5 w-3.5" aria-hidden /> Download the STL/3MF to slice in your own slicer
          </a>
        ) : null}
        <Button type="button" size="sm" variant={open ? "ghost" : "outline"} aria-expanded={open} aria-controls={`att-form-${jobId}`} onClick={() => setOpen((o) => !o)}>
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> {open ? "Hide the attach form" : "I have sliced it: attach the file"}
        </Button>
      </div>
      {open ? <form id={`att-form-${jobId}`} onSubmit={(e) => void submit(e)} noValidate className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Attach the sliced file">
        <Field id={`att-file-${jobId}`} label="Sliced file (G-code or .3mf)" error={fileError} className="sm:col-span-2">
          <Input id={`att-file-${jobId}`} type="file" accept=".gcode,.gco,.g,.bgcode,.3mf" aria-invalid={!!fileError} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFileError(""); }} />
        </Field>
        <Field id={`att-slicer-${jobId}`} label="Sliced in" hint="The slicer's name, as it will be shown beside the numbers." error={errors.slicer?.message}>
          <Input id={`att-slicer-${jobId}`} list={listId} aria-invalid={!!errors.slicer} {...register("slicer")} />
        </Field>
        <datalist id={listId}>{OWN_SLICERS.map((s) => <option key={s} value={s} />)}</datalist>
        <Field id={`att-min-${jobId}`} label="Print time (minutes)" hint="As your slicer reports it." error={errors.minutes?.message}>
          <Input id={`att-min-${jobId}`} inputMode="decimal" aria-invalid={!!errors.minutes} {...register("minutes")} />
        </Field>
        <Field id={`att-g-${jobId}`} label="Filament (grams)" hint="As your slicer reports it." error={errors.grams?.message}>
          <Input id={`att-g-${jobId}`} inputMode="decimal" aria-invalid={!!errors.grams} {...register("grams")} />
        </Field>
        {errors.root?.message ? <div className="sm:col-span-2"><ErrorLine>{errors.root.message}</ErrorLine></div> : null}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            <Paperclip className="h-3.5 w-3.5" aria-hidden /> {isSubmitting ? "Attaching" : "Attach the sliced file"}
          </Button>
        </div>
      </form> : null}
    </Card>
  );
}
