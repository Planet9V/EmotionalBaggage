"use client";

/**
 * 3D print files: binary STL generated in the browser from part envelopes, the concept's saved STL
 * files, and loading an existing STL into the model.
 */
import { useRef, useState } from "react";
import { Download, Eye, EyeOff, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { api, useFilesChanged } from "@/lib/client";
import { messageOf, queries } from "@/lib/queries";
import type { FileMeta } from "@/lib/types";
import type { Part } from "@/lib/domain";
import { describeSize, fmt, type PartGeometry } from "./layout";
import { boxMesh, bounds, cylinderMesh, lidMesh, shellDims, trayMesh, type Mesh, type ShellParams } from "./stl";
import { parseStl } from "@/lib/geometry/meshFile";
import { bodies3mf, soupToStl, type PrintBody } from "@/lib/geometry/export";
import { downloadFile } from "@/lib/download";
import { fileSlug, fmtBytes, fmtDateTime } from "@/lib/format";
import { LoadingBlocks } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";

export type LoadedStl = {
  key: string;
  mesh: Mesh;
  name: string;
  format: "binary" | "ascii";
  triangles: number;
  /** extent in the file's own axes, mm */
  extent: [number, number, number];
  /** raw bytes when it came from the user's disk (so it can be saved); null when opened from the concept */
  bytes: ArrayBuffer | null;
  savedId: number | null;
  show: boolean;
};

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";
const MAX_BYTES = 25 * 1024 * 1024;

type Body = { body: "tray" | "lid" | "solid"; mesh: Mesh };

function bodiesFor(g: PartGeometry, p: ShellParams): { bodies: Body[]; problems: string[] } {
  if (g.shape === "shell") {
    const d = shellDims(g.size, p);
    if (d.problems.length) return { bodies: [], problems: d.problems };
    return { bodies: [{ body: "tray", mesh: trayMesh(g.size, p) }, { body: "lid", mesh: lidMesh(g.size, p) }], problems: [] };
  }
  if (g.shape === "cylinder") return { bodies: [{ body: "solid", mesh: cylinderMesh(g.size[0], g.size[1]) }], problems: [] };
  // Scene x, y (up), z become print x, z (up), y.
  return { bodies: [{ body: "solid", mesh: boxMesh(g.size[0], g.size[2], g.size[1]) }], problems: [] };
}


const downloadBytes = (buf: ArrayBuffer, name: string, type = "model/stl") => downloadFile(name, buf, type);

export function meshExtent(m: Mesh): [number, number, number] {
  const b = bounds(m);
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

function NumParam({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <Input
        type="number"
        step={step}
        min={0}
        className="h-8 w-28 px-2 font-mono text-xs"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= 0) onChange(v);
        }}
      />
    </label>
  );
}

const onlyStl = (files: FileMeta[]) => files.filter((f) => f.kind === "stl");

export function PrintPanel({ projectId, parts, params, setParams, onTogglePrint, loaded, setLoaded }: {
  projectId: string;
  parts: Part[];
  params: ShellParams;
  setParams: (p: ShellParams) => void;
  onTogglePrint: (part: Part, v: boolean) => void;
  loaded: LoadedStl | null;
  setLoaded: (l: LoadedStl | null) => void;
}) {
  const filesQuery = useQuery({ ...queries.files(projectId), select: onlyStl });
  const files = filesQuery.data ?? null;
  const filesError = messageOf(filesQuery.error);
  const loadFiles = useFilesChanged(projectId);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);


  const store = async (buf: ArrayBuffer, name: string, meta: Record<string, unknown>) => {
    const form = new FormData();
    form.append("file", new File([buf], name, { type: "model/stl" }));
    form.append("kind", "stl");
    form.append("meta", JSON.stringify(meta));
    const r = await api<{ file: FileMeta }>(`/api/projects/${projectId}/files`, { method: "POST", body: form });
    await loadFiles();
    return r.file;
  };

  const printable = parts.filter((p) => p.geometry);

  const generate = (p: Part, b: Body) => {
    const name = `${fileSlug(p.ref || p.item.title, "part")}-${b.body}.stl`;
    return { name, buf: soupToStl(b.mesh) };
  };

  /** Every printed body as its own object in one 3MF, laid out side by side on the bed. */
  const printedBodies = (only?: Part): PrintBody[] =>
    printable
      .filter((p) => (only ? p.item.id === only.item.id : (p.geometry as PartGeometry).print === true))
      .flatMap((p) => bodiesFor(p.geometry as PartGeometry, params).bodies.map((b) => ({ name: `${p.ref || fileSlug(p.item.title, "part")} ${b.body}`.trim(), mesh: b.mesh })));

  const download3mf = async (only?: Part) => {
    const bodies = printedBodies(only);
    if (!bodies.length) return;
    setBusy("3mf");
    setNotice(null);
    try {
      const buf = await bodies3mf(bodies);
      const name = `${only ? fileSlug(only.ref || only.item.title, "part") : fileSlug(projectId, "part")}-printed.3mf`;
      downloadBytes(buf, name, "model/3mf");
      setNotice({ tone: "ok", text: `Downloaded ${name}: ${bodies.length} object${bodies.length === 1 ? "" : "s"}, millimetres.` });
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not write the 3MF: ${(e as Error).message}` });
    } finally {
      setBusy("");
    }
  };
  /** The same 3MF, stored as a file of the concept, where 3D printing offers it for a new job. */
  const save3mf = async () => {
    const bodies = printedBodies();
    if (!bodies.length) return;
    setBusy("3mf-save");
    setNotice(null);
    try {
      const buf = await bodies3mf(bodies);
      const name = `${fileSlug(projectId, "part")}-printed.3mf`;
      const form = new FormData();
      form.append("file", new File([buf], name, { type: "model/3mf" }));
      form.append("kind", "3mf");
      form.append("meta", JSON.stringify({ printedParts: true, objects: bodies.length }));
      await api<{ file: FileMeta }>(`/api/projects/${projectId}/files`, { method: "POST", body: form });
      await loadFiles();
      setNotice({ tone: "ok", text: `Stored ${name} with ${bodies.length} object${bodies.length === 1 ? "" : "s"}. 3D printing offers it for a new job.` });
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not store the 3MF: ${(e as Error).message}` });
    } finally {
      setBusy("");
    }
  };
  const anyPrinted = printable.some((p) => (p.geometry as PartGeometry).print === true && bodiesFor(p.geometry as PartGeometry, params).bodies.length > 0);

  const saveBody = async (p: Part, b: Body) => {
    const g = p.geometry as PartGeometry;
    const { name, buf } = generate(p, b);
    setBusy(`${p.item.id}:${b.body}`);
    setNotice(null);
    try {
      await store(buf, name, {
        partRef: p.ref,
        body: b.body,
        wallMm: g.shape === "shell" ? params.wallMm : null,
        clearanceMm: g.shape === "shell" ? params.clearanceMm : null,
        lipMm: g.shape === "shell" ? params.lipMm : null,
        sizeMm: g.size,
      });
      setNotice({ tone: "ok", text: `Saved ${name} to the concept.` });
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not save ${name}: ${(e as Error).message}` });
    } finally {
      setBusy("");
    }
  };

  const readFile = async (file: File) => {
    setNotice(null);
    if (file.size > MAX_BYTES) {
      setNotice({ tone: "bad", text: `${file.name} is ${fmtBytes(file.size)}. Files are limited to 25 MB.` });
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      const parsed = parseStl(bytes);
      setLoaded({
        key: `${file.name}:${file.size}:${file.lastModified}`,
        mesh: parsed.soup,
        name: file.name,
        format: parsed.encoding ?? "binary",
        triangles: parsed.triangles,
        extent: parsed.extent,
        bytes,
        savedId: null,
        show: true,
      });
    } catch (e) {
      setNotice({ tone: "bad", text: `${file.name}: ${(e as Error).message}` });
    }
  };

  const openSaved = async (f: FileMeta) => {
    setBusy(`view:${f.id}`);
    setNotice(null);
    try {
      const res = await fetch(`/api/files/${f.id}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const parsed = parseStl(await res.arrayBuffer());
      setLoaded({ key: `saved:${f.id}`, mesh: parsed.soup, name: f.name, format: parsed.encoding ?? "binary", triangles: parsed.triangles, extent: parsed.extent, bytes: null, savedId: f.id, show: true });
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not open ${f.name}: ${(e as Error).message}` });
    } finally {
      setBusy("");
    }
  };

  const remove = async (f: FileMeta) => {
    setBusy(`del:${f.id}`);
    try {
      await api(`/api/files/${f.id}`, { method: "DELETE" });
      if (loaded?.savedId === f.id) setLoaded(null);
      await loadFiles();
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not delete ${f.name}: ${(e as Error).message}` });
    } finally {
      setBusy("");
      setConfirmDelete(null);
    }
  };

  const saveLoaded = async () => {
    if (!loaded?.bytes) return;
    setBusy("upload");
    setNotice(null);
    try {
      const f = await store(loaded.bytes, loaded.name, { uploaded: true });
      setLoaded({ ...loaded, savedId: f.id, bytes: null });
      setNotice({ tone: "ok", text: `Saved ${loaded.name} to the concept.` });
    } catch (e) {
      setNotice({ tone: "bad", text: `Could not save ${loaded.name}: ${(e as Error).message}` });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card variant="flat" as="section" className="p-5">
        <p className={eyebrow}>3D print files</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-primary">Generate STL from part envelopes</h3>
        <p className="mt-1 max-w-2xl text-sm text-secondary">
          This is a simple parametric shell generated from the envelope dimensions, not a finished enclosure design. It has no hinge, grille, posts or
          strap slots. An enclosure shell gives two bodies: an open tray and a lid with a locating lip. Boxes and cylinders give one solid.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <NumParam label="Wall, mm" step={0.1} value={params.wallMm} onChange={(v) => setParams({ ...params, wallMm: v })} />
          <NumParam label="Lid clearance, mm" step={0.05} value={params.clearanceMm} onChange={(v) => setParams({ ...params, clearanceMm: v })} />
          <NumParam label="Lip height, mm" step={0.5} value={params.lipMm} onChange={(v) => setParams({ ...params, lipMm: v })} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!anyPrinted || busy === "3mf"} onClick={() => void download3mf()}>
            <Download className="h-3.5 w-3.5" /> {busy === "3mf" ? "Writing 3MF" : "Download 3MF of all printed parts"}
          </Button>
          <Button size="sm" variant="outline" disabled={!anyPrinted || busy === "3mf-save"} onClick={() => void save3mf()}>
            <Save className="h-3.5 w-3.5" /> {busy === "3mf-save" ? "Storing 3MF" : "Send 3MF to 3D printing"}
          </Button>
          {!anyPrinted && <span className="text-xs text-muted">Tick Printed on a part to include it.</span>}
        </div>
        {notice && <p role={notice.tone === "bad" ? "alert" : "status"} className={`mt-3 text-sm ${notice.tone === "ok" ? "text-success" : "text-danger"}`}>{notice.text}</p>}
        {printable.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No part has geometry yet, so there is nothing to generate.</p>
        ) : (
          <ul className="mt-4 divide-y divide-(--border-hairline) border-y border-hairline">
            {printable.map((p) => {
              const g = p.geometry as PartGeometry;
              const out = g.print ? bodiesFor(g, params) : null;
              return (
                <li key={p.item.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-primary">
                        {p.ref && <span className="mr-1 font-mono text-xs text-link">{p.ref} </span>}
                        {p.item.title}
                      </p>
                      <p className="font-mono text-[11px] text-muted">
                        {g.shape} · {describeSize(g)}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-secondary">
                      <input type="checkbox" className="h-4 w-4 accent-[#E05A10]" checked={g.print === true} onChange={(e) => onTogglePrint(p, e.target.checked)} />
                      Printed
                    </label>
                  </div>
                  {out && out.problems.length > 0 && <p className="mt-2 text-xs text-warning">{out.problems.join(" ")}</p>}
                  {out && out.bodies.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {out.bodies.map((b) => {
                        const tris = b.mesh.length / 9;
                        const e = meshExtent(b.mesh);
                        const id = `${p.item.id}:${b.body}`;
                        return (
                          <div key={b.body} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-subtle px-3 py-2">
                            <p className="font-mono text-[11px] text-secondary">
                              <span className="text-primary">{b.body}</span> · {e.map(fmt).join(" x ")} mm · {tris} triangles · {fmtBytes(84 + 50 * tris)}
                              {(g.count ?? 1) > 1 && b.body === "solid" ? ` · one of ${g.count}` : ""}
                            </p>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const { name, buf } = generate(p, b);
                                  downloadBytes(buf, name);
                                }}
                              >
                                <Download className="h-3.5 w-3.5" /> Download STL
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy === "3mf"} onClick={() => void download3mf(p)}>
                                <Download className="h-3.5 w-3.5" /> 3MF
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy === id} onClick={() => void saveBody(p, b)}>
                                <Save className="h-3.5 w-3.5" /> {busy === id ? "Saving" : "Save to concept"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Files are Z up, in mm, sitting on z = 0. The lid is laid out plate down, lip up, ready to print.</p>
      </Card>

      <div className="flex flex-col gap-6">
        <Card variant="flat" as="section" className="p-5">
          <p className={eyebrow}>Load an STL</p>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void readFile(f);
            }}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${
              dragging ? "border-dutchOrange bg-dutchOrange/10" : "border-hairline hover:border-dutchOrange/40"
            }`}
          >
            <Upload className="h-5 w-5 text-muted" />
            <p className="text-sm text-primary">Drop an STL here or click to choose one</p>
            <p className="text-xs text-muted">Binary or ASCII, up to 25 MB. It is read in your browser.</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".stl,model/stl,application/sla"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
          {loaded && (
            <div className="mt-3 rounded-md bg-subtle px-3 py-2">
              <p className="truncate text-sm text-primary">{loaded.name}</p>
              <p className="font-mono text-[11px] text-muted">
                {loaded.format} · {loaded.triangles} triangles · {loaded.extent.map(fmt).join(" x ")} mm{loaded.savedId ? " · saved in the concept" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setLoaded({ ...loaded, show: !loaded.show })}>
                  {loaded.show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {loaded.show ? "Hide in model" : "Show in model"}
                </Button>
                {loaded.bytes && (
                  <Button size="sm" variant="outline" disabled={busy === "upload"} onClick={() => void saveLoaded()}>
                    <Save className="h-3.5 w-3.5" /> {busy === "upload" ? "Saving" : "Save to concept"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setLoaded(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card variant="flat" as="section" className="p-5">
          <p className={eyebrow}>Saved STL files</p>
          {filesError ? (
            <p className="mt-2 text-sm text-danger">Could not load files: {filesError}</p>
          ) : files === null ? (
            <LoadingBlocks rows={2} label="Loading files" />
          ) : files.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None yet. Generated or loaded STL files you save appear here.</p>
          ) : (
            <ul className="mt-2 divide-y divide-(--border-hairline)">
              {files.map((f) => {
                const m = f.meta ?? {};
                const desc = m.uploaded ? "loaded file" : [m.partRef, m.body].filter((x) => typeof x === "string" && x).join(" ");
                return (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <a href={`/api/files/${f.id}`} className="block truncate text-sm text-primary hover:text-link">
                        {f.name}
                      </a>
                      <p className="font-mono text-[11px] text-muted">
                        {desc ? `${desc} · ` : ""}
                        {fmtBytes(f.size)} · {fmtDateTime(f.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" disabled={busy === `view:${f.id}`} onClick={() => void openSaved(f)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                        <a href={`/api/files/${f.id}`} aria-label={`Download ${f.name}`}>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      {confirmDelete === f.id ? (
                        <>
                          <Button size="sm" variant="outline" className="text-danger" disabled={busy === `del:${f.id}`} onClick={() => void remove(f)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${f.name}`} onClick={() => setConfirmDelete(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
