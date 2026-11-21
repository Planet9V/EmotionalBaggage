"use client";

// Beside the 3D canvas: draw the scene as it is now and save it as an image file, optionally
// attached to one of the shots on the Imagery screen. The browser draws it; nothing is generated.
import { useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useFilesChanged, useItems } from "@/lib/client";
import { shotByKey } from "@/lib/market/imagery";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/Card";

/** A PNG data address drawn onto a white background (or left as it is), as a Blob. */
export async function renderBlob(dataUrl: string, background: "white" | "transparent"): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d");
  if (!g) throw new Error("This browser could not make an image from the scene.");
  if (background === "white") {
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
  if (!blob) throw new Error("This browser could not make an image from the scene.");
  return blob;
}

export function RenderToImagery({ projectId, capture }: { projectId: string; capture: (() => string) | null }) {
  const shots = useItems(projectId, "marketing/imagery");
  const filesChanged = useFilesChanged(projectId);
  const [shot, setShot] = useState("");
  const [bg, setBg] = useState<"white" | "transparent">("white");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const renderable = shots.items.filter((s) => shotByKey(String(s.data.shotKey ?? ""))?.render);

  const save = async () => {
    if (!capture) return;
    setBusy(true);
    setMsg(null);
    try {
      const blob = await renderBlob(capture(), bg);
      const row = shots.items.find((s) => String(s.id) === shot);
      const key = row ? String(row.data.shotKey ?? "render") : "render";
      const fd = new FormData();
      fd.append("file", new File([blob], `${key}-${Date.now()}.png`, { type: "image/png" }));
      fd.append("kind", "render");
      const r = await api<{ file: { id: number } }>(`/api/projects/${encodeURIComponent(projectId)}/files`, { method: "POST", body: fd });
      if (row) await shots.patch(row.id, { data: { fileId: r.file.id, source: "render" } });
      await filesChanged();
      setMsg({ ok: true, text: row ? `Saved and attached to "${row.title}".` : "Saved as a file of this concept." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="flat" className="rounded-lg flex flex-wrap items-end gap-3 px-3 py-2">
      <div className="min-w-48">
        <label htmlFor="render-shot" className="mb-1 block text-xs font-medium text-secondary">Save this view as a render for</label>
        <NativeSelect id="render-shot" value={shot} onChange={(e) => setShot(e.target.value)}>
          <option value="">Just save the file</option>
          {renderable.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="render-bg" className="mb-1 block text-xs font-medium text-secondary">Background</label>
        <NativeSelect id="render-bg" value={bg} onChange={(e) => setBg(e.target.value as typeof bg)}><option value="white">White</option><option value="transparent">Transparent</option></NativeSelect>
      </div>
      <Button size="sm" onClick={() => void save()} disabled={!capture || busy}><Camera className="h-3.5 w-3.5" aria-hidden /> {busy ? "Saving" : "Save a render"}</Button>
      {!shots.items.length && !shots.loading && <p className="text-xs text-muted">Add the standard shots on the Imagery page to attach a render to one.</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`w-full text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </Card>
  );
}
