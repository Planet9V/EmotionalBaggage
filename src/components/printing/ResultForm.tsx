"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine, Field, Select, Textarea } from "@/components/parts/controls";
import { api, useFilesChanged } from "@/lib/client";
import type { PrintJobData } from "@/lib/slicing/jobState";

type Props = {
  projectId: string;
  data: PrintJobData;
  busy: boolean;
  onSave: (v: { outcome: string; actualSeconds?: number; actualG?: number; notes?: string; photoFileIds: number[] }) => Promise<unknown>;
};

/** Time, material, outcome, photos and notes of a finished print. The slicer's figures are shown beside the boxes as the estimate. */
export function ResultForm({ projectId, data, busy, onSave }: Props) {
  const r = data.result;
  const filesChanged = useFilesChanged(projectId);
  const [outcome, setOutcome] = useState<string>(r?.outcome ?? "good");
  const [minutes, setMinutes] = useState(r?.actualSeconds ? String(Math.round(r.actualSeconds / 60)) : "");
  const [grams, setGrams] = useState(r?.actualG != null ? String(r.actualG) : "");
  const [notes, setNotes] = useState(r?.notes ?? "");
  const [photos, setPhotos] = useState<number[]>(r?.photoFileIds ?? []);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "photo");
      form.append("meta", JSON.stringify({ printJob: true }));
      const res = await api<{ file: { id: number } }>(`/api/projects/${projectId}/files`, { method: "POST", body: form });
      setPhotos((p) => [...p, res.file.id]);
      void filesChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = num(minutes);
    const g = num(grams);
    if ((m !== undefined && (!Number.isFinite(m) || m < 0)) || (g !== undefined && (!Number.isFinite(g) || g < 0))) return setErr("Time and material are numbers, zero or more.");
    setErr("");
    setSaved(false);
    try {
      await onSave({ outcome, actualSeconds: m === undefined ? undefined : m * 60, actualG: g, notes: notes.trim() || undefined, photoFileIds: photos });
      setSaved(true);
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  const s = data.slice;
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label="Record the result">
      <Field label="How did it come out">
        <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="good">Good, usable</option>
          <option value="flawed">Printed, with flaws</option>
          <option value="failed">Failed</option>
        </Select>
      </Field>
      <Field label="Actual time (minutes)" hint={s ? `The slicer said ${Math.round(s.seconds / 60)} min.` : undefined}>
        <Input inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </Field>
      <Field label="Material used (grams)" hint={s ? `The slicer said ${s.filamentG} g.` : undefined}>
        <Input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
      </Field>
      <Field label="Photos" hint={photos.length ? `${photos.length} attached` : "Optional"}>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-sm text-primary hover:border-dutchOrange focus-within:ring-2 focus-within:ring-dutchOrange">
          <Camera className="h-4 w-4" aria-hidden /> {uploading ? "Uploading" : "Add a photo"}
          <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </Field>
      <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" /></Field>
      {err ? <div className="sm:col-span-2"><ErrorLine>{err}</ErrorLine></div> : null}
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {saved && <span role="status" className="text-sm text-success">Saved</span>}
        <Button type="submit" disabled={busy || uploading}>{busy ? "Saving" : r ? "Update result" : "Record result"}</Button>
      </div>
    </form>
  );
}
