"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, useFilesChanged } from "@/lib/client";
import type { PrintJobData } from "@/lib/slicing/jobState";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  projectId: string;
  data: PrintJobData;
  busy: boolean;
  onSave: (v: { outcome: string; actualSeconds?: number; actualG?: number; notes?: string; photoFileIds: number[] }) => Promise<unknown>;
};

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const amount = z.string().refine((v) => {
  const n = num(v);
  return n === undefined || (Number.isFinite(n) && n >= 0);
}, "Time and material are numbers, zero or more.");
const schema = z.object({ outcome: z.string(), minutes: amount, grams: amount, notes: z.string() });
type Values = z.infer<typeof schema>;

/** Time, material, outcome, photos and notes of a finished print. The slicer's figures are shown beside the boxes as the estimate. */
export function ResultForm({ projectId, data, busy, onSave }: Props) {
  const r = data.result;
  const filesChanged = useFilesChanged(projectId);
  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { outcome: r?.outcome ?? "good", minutes: r?.actualSeconds ? String(Math.round(r.actualSeconds / 60)) : "", grams: r?.actualG != null ? String(r.actualG) : "", notes: r?.notes ?? "" },
  });
  const [photos, setPhotos] = useState<number[]>(r?.photoFileIds ?? []);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    clearErrors("root");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "photo");
      form.append("meta", JSON.stringify({ printJob: true }));
      const res = await api<{ file: { id: number } }>(`/api/projects/${projectId}/files`, { method: "POST", body: form });
      setPhotos((p) => [...p, res.file.id]);
      void filesChanged();
    } catch (e) {
      setError("root", { message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const submit = handleSubmit(async (v) => {
    setSaved(false);
    const m = num(v.minutes);
    const g = num(v.grams);
    try {
      await onSave({ outcome: v.outcome, actualSeconds: m === undefined ? undefined : m * 60, actualG: g, notes: v.notes.trim() || undefined, photoFileIds: photos });
      setSaved(true);
    } catch (x) {
      setError("root", { message: (x as Error).message });
    }
  });

  const s = data.slice;
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-3 sm:grid-cols-2" aria-label="Record the result">
      <Field id="res-outcome" label="How did it come out">
        <NativeSelect id="res-outcome" {...register("outcome")}>
          <option value="good">Good, usable</option>
          <option value="flawed">Printed, with flaws</option>
          <option value="failed">Failed</option>
        </NativeSelect>
      </Field>
      <Field id="res-min" label="Actual time (minutes)" hint={s ? `The slicer said ${Math.round(s.seconds / 60)} min.` : undefined} error={errors.minutes?.message}>
        <Input id="res-min" inputMode="decimal" aria-invalid={!!errors.minutes} {...register("minutes")} />
      </Field>
      <Field id="res-g" label="Material used (grams)" hint={s ? `The slicer said ${s.filamentG} g.` : undefined} error={errors.grams?.message && errors.minutes?.message ? undefined : errors.grams?.message}>
        <Input id="res-g" inputMode="decimal" aria-invalid={!!errors.grams} {...register("grams")} />
      </Field>
      <Field label="Photos" hint={photos.length ? `${photos.length} attached` : "Optional"}>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-sm text-primary hover:border-dutchOrange focus-within:ring-2 focus-within:ring-dutchOrange">
          <Camera className="h-4 w-4" aria-hidden /> {uploading ? "Uploading" : "Add a photo"}
          <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </Field>
      <Field id="res-notes" label="Notes" className="sm:col-span-2"><Textarea id="res-notes" rows={3} className="w-full" {...register("notes")} /></Field>
      {errors.root?.message ? <div className="sm:col-span-2"><ErrorLine>{errors.root.message}</ErrorLine></div> : null}
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {saved && <span role="status" className="text-sm text-success">Saved</span>}
        <Button type="submit" disabled={busy || uploading || isSubmitting}>{busy ? "Saving" : r ? "Update result" : "Record result"}</Button>
      </div>
    </form>
  );
}
