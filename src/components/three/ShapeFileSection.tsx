"use client";

/**
 * Attach an STL or STEP file as a part's real shape. The file is stored with the concept through
 * the files API; the part's geometry then points at it and takes its bounding box as its size.
 * A file whose size is not plausible in millimetres is flagged and is never rescaled on its own:
 * the user picks a unit factor, or says the size is right, before it can be attached.
 */
import { useRef, useState } from "react";
import { Download, FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useFilesChanged } from "@/lib/client";
import type { FileMeta } from "@/lib/types";
import type { Geometry } from "@/lib/domain";
import { fileToScene } from "@/lib/geometry/shapes";
import { formatOf, parseShape, type ParsedShape } from "@/lib/geometry/meshFile";
import { checkUnits, UNIT_FACTORS } from "@/lib/geometry/units";
import type { ShapeStatus } from "@/lib/geometry/useShapes";
import { fmt, type PartGeometry } from "./layout";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";
const MAX_BYTES = 25 * 1024 * 1024;

type Pending = { file: File; bytes: ArrayBuffer; parsed: ParsedShape; scale: number; accepted: boolean };

export function ShapeFileSection({ projectId, partRef, geometry, status, onSave }: {
  projectId: string;
  partRef: string;
  geometry: PartGeometry | null;
  status?: ShapeStatus;
  onSave: (g: PartGeometry) => Promise<void>;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const filesChanged = useFilesChanged(projectId);
  const attached = geometry?.file ?? null;

  const choose = async (file: File) => {
    setError("");
    setPending(null);
    if (!formatOf(file.name)) return setError("Use an STL or STEP file (.stl, .stp, .step).");
    if (file.size > MAX_BYTES) return setError(`${file.name} is over 25 MB, the limit for stored files.`);
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const parsed = await parseShape(file.name, bytes);
      setPending({ file, bytes, parsed, scale: 1, accepted: false });
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const check = pending ? checkUnits(pending.parsed.extent, pending.scale) : null;
  const mustConfirm = !!pending && !!check && !check.ok;
  const canAttach = !!pending && !busy && (!mustConfirm || pending.accepted);

  const attach = async () => {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const { size } = fileToScene(pending.parsed.soup, pending.scale);
      const form = new FormData();
      form.append("file", new File([pending.bytes], pending.file.name, { type: pending.parsed.format === "stl" ? "model/stl" : "model/step" }));
      form.append("kind", "shape");
      form.append("meta", JSON.stringify({ partRef, format: pending.parsed.format, scale: pending.scale, sizeMm: size.map((v) => Math.round(v * 1000) / 1000) }));
      const { file: stored } = await api<{ file: FileMeta }>(`/api/projects/${projectId}/files`, { method: "POST", body: form });
      void filesChanged();
      const shape: Geometry["file"] = { id: stored.id, name: stored.name, format: pending.parsed.format, scale: pending.scale };
      const rounded = size.map((v) => Math.round(v * 1000) / 1000);
      const next: PartGeometry = geometry
        ? { ...geometry, shape: "box", size: rounded, file: shape }
        : { shape: "box", size: rounded, pos: [0, rounded[1] / 2, 0], explode: [0, 0, 0], basis: "typical", file: shape };
      delete next.axis;
      delete next.count;
      await onSave(next);
      setPending(null);
    } catch (e) {
      setError(`Could not attach ${pending.file.name}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const detach = async () => {
    if (!geometry) return;
    setBusy(true);
    try {
      const next: PartGeometry = { ...geometry };
      delete next.file;
      await onSave(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Shape file" className="flex flex-col gap-2 rounded-xl border border-hairline p-3">
      <p className={eyebrow}>Real shape (STL or STEP)</p>
      {attached ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-primary">
            <span className="font-mono text-xs">{attached.name}</span> <span className="text-muted">· {attached.format.toUpperCase()}{attached.scale !== 1 ? ` · scaled x ${fmt(attached.scale)}` : ""}</span>
          </p>
          {geometry && <p className="font-mono text-[11px] text-muted">Bounding box {geometry.size.map(fmt).join(" x ")} mm, centred on the part.</p>}
          {status?.state === "loading" && <p role="status" className="text-xs text-muted">{status.message}</p>}
          {status?.state === "error" && <p role="alert" className="text-xs text-warning">{status.message} The part shows its bounding box instead.</p>}
          {status?.state === "ready" && <p className="text-xs text-muted">Drawn from the file, {status.message}.</p>}
          <div className="flex flex-wrap gap-1.5">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/files/${attached.id}`} download={attached.name}>
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void detach()} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" /> Use a plain box again
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Attach a file to show this part as it really looks. It is centred on the part and read in millimetres.</p>
      )}
      <div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          <FileUp className="h-3.5 w-3.5" /> {attached ? "Replace the file" : "Attach a file"}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".stl,.stp,.step,model/stl,model/step"
          className="sr-only"
          aria-label="Choose an STL or STEP file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void choose(f);
            e.target.value = "";
          }}
        />
      </div>
      {busy && !pending && <p role="status" className="text-xs text-muted">Reading the file.</p>}
      {pending && check && (
        <div className="flex flex-col gap-2 rounded-md bg-subtle p-2.5">
          <p className="truncate text-sm text-primary">{pending.file.name}</p>
          <p className="font-mono text-[11px] text-muted">
            {pending.parsed.format.toUpperCase()} · {pending.parsed.triangles} triangles · {pending.parsed.extent.map((v) => fmt(Math.round(v * pending.scale * 1000) / 1000)).join(" x ")} mm
          </p>
          {check.ok ? (
            <p className="text-xs text-success">The size is plausible in millimetres.</p>
          ) : (
            <div role="alert" className="flex flex-col gap-2">
              <p className="text-xs text-warning">{check.message}</p>
              {check.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {check.suggestions.map((u) => (
                    <Button key={u.factor} size="chip" variant="outline" onClick={() => setPending({ ...pending, scale: pending.scale * u.factor, accepted: false })}>
                      {u.label}: {fmt(Math.round(u.longestMm * 100) / 100)} mm
                    </Button>
                  ))}
                  {pending.scale !== 1 && (
                    <Button size="chip" variant="ghost" onClick={() => setPending({ ...pending, scale: 1, accepted: false })}>
                      Reset to the file&apos;s own numbers
                    </Button>
                  )}
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-xs text-secondary">
                <input type="checkbox" className="h-4 w-4 accent-[#E05A10]" checked={pending.accepted} onChange={(e) => setPending({ ...pending, accepted: e.target.checked })} />
                This size is right, use it as it is
              </label>
            </div>
          )}
          <p className="sr-only">The usual unit factors are {UNIT_FACTORS.map((u) => u.label).join(", ")}.</p>
          <div className="flex gap-1.5">
            <Button size="sm" disabled={!canAttach} onClick={() => void attach()}>
              {busy ? "Attaching" : "Attach to this part"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </section>
  );
}
