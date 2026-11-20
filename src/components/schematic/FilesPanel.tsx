"use client";

import { useState } from "react";
import { Check as CheckIcon, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useFilesChanged } from "@/lib/client";
import type { FileMeta } from "@/lib/types";
import { EYEBROW, ErrorLine } from "./controls";

export type GeneratedFile = { name: string; mime: string; text: string; format: string };

type Spec = { key: string; label: string; detail: string; note?: string; make: () => GeneratedFile[] };

function download(f: GeneratedFile) {
  const url = URL.createObjectURL(new Blob([f.text], { type: f.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/** Download or store each generated file. Files are generated at the moment of the click. */
export function FilesPanel({ projectId, specs, disabled }: { projectId: string; specs: Spec[]; disabled: boolean }) {
  const [busy, setBusy] = useState("");
  const filesChanged = useFilesChanged(projectId);
  const [saved, setSaved] = useState<Record<string, FileMeta[]>>({});
  const [error, setError] = useState("");

  const save = async (s: Spec) => {
    setBusy(s.key);
    setError("");
    try {
      const out: FileMeta[] = [];
      for (const f of s.make()) {
        const form = new FormData();
        form.append("file", new File([f.text], f.name, { type: f.mime }));
        form.append("kind", "schematic");
        form.append("meta", JSON.stringify({ format: f.format, generatedFrom: "design/wiring" }));
        const r = await api<{ file: FileMeta }>(`/api/projects/${projectId}/files`, { method: "POST", body: form });
        out.push(r.file);
      }
      setSaved((x) => ({ ...x, [s.key]: out }));
      void filesChanged();
    } catch (e) {
      setError(`${s.label} was not saved: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  return (
    <section aria-labelledby="schematic-files" className="rounded-xl border border-hairline bg-surface p-4">
      <p className={EYEBROW}>Generate files</p>
      <h3 id="schematic-files" className="mt-1 text-base font-semibold tracking-tight text-primary">
        Wiring files
      </h3>
      <p className="mt-0.5 text-xs text-muted">Built from the wires as they are now. Save to concept stores a copy with the concept&apos;s files.</p>
      {disabled ? (
        <p className="mt-3 text-sm text-secondary">Add a wire first; there is nothing to generate yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-hairline">
          {specs.map((s) => (
            <li key={s.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-md">
                  <p className="text-sm font-medium text-primary">{s.label}</p>
                  <p className="text-xs text-secondary">{s.detail}</p>
                  {s.note && <p className="mt-1 rounded-md bg-warning-soft px-2 py-1 text-[11px] text-warning">{s.note}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => s.make().forEach(download)}>
                    <Download className="h-3.5 w-3.5" aria-hidden /> Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => save(s)} disabled={busy === s.key}>
                    <Save className="h-3.5 w-3.5" aria-hidden /> {busy === s.key ? "Saving" : "Save to concept"}
                  </Button>
                </div>
              </div>
              {saved[s.key] && (
                <ul className="mt-2 space-y-0.5">
                  {saved[s.key].map((f) => (
                    <li key={f.id} className="flex items-center gap-1.5 text-xs text-success">
                      <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                      Saved{" "}
                      <a href={`/api/files/${f.id}`} className="font-mono text-link hover:underline">
                        {f.name}
                      </a>
                      <span className="text-muted">({kb(f.size)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="mt-3">
          <ErrorLine>{error}</ErrorLine>
        </div>
      )}
    </section>
  );
}
