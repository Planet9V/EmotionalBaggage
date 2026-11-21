"use client";

import { RowActions } from "@/components/drafts/RowActions";
import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, ListPlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, useFilesChanged, useItems } from "@/lib/client";
import { queries } from "@/lib/queries";
import { shotByKey, SHOTS } from "@/lib/market/imagery";
import { imageryData } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ApproveButton, Status } from "./shared";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function ImageryView({ project, store }: ViewProps) {
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const files = useQuery(queries.files(project.id));
  const filesChanged = useFilesChanged(project.id);
  const [busy, setBusy] = useState<number | "list" | null>(null);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<Item | null>(null);

  if (loading) return <LoadingBlocks label="Loading the shot list" />;
  if (error && !items.length) return <LoadError what="The shot list" message={error} onRetry={() => void reload()} />;

  const have = new Set(items.map((i) => String(i.data.shotKey ?? "")));
  const missing = SHOTS.filter((s) => !have.has(s.key));
  const fileOf = (it: Item) => {
    const id = imageryData.safeParse(it.data).data?.fileId;
    return typeof id === "number" ? (files.data ?? []).find((f) => f.id === id) ?? null : null;
  };

  const addStandard = async () => {
    setErr("");
    setBusy("list");
    try {
      for (const s of missing) {
        await add({ section: store, title: s.title, body: s.purpose, data: { shotKey: s.key, purpose: s.purpose, usedIn: s.usedIn, fileId: null, source: null }, status: "draft" });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (it: Item, file: File) => {
    setErr("");
    if (!IMAGE_TYPES.includes(file.type)) return setErr("A shot must be a PNG, JPEG, WebP or SVG image.");
    setBusy(it.id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "image");
      const r = await api<{ file: { id: number } }>(`/api/projects/${encodeURIComponent(project.id)}/files`, { method: "POST", body: fd });
      await patch(it.id, { data: { fileId: r.file.id, source: "upload" }, ...(it.status === "approved" ? { status: "draft" } : {}) });
      await filesChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const clearFile = async (it: Item) => {
    setErr("");
    try {
      await patch(it.id, { data: { fileId: null, source: null }, status: "draft" });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-primary">The shots a listing and ads need</h2>
        <p className="text-sm text-secondary">
          A starting list of seven shots. Photographs are uploaded by you. Where the 3D model can supply a shot, render it from the <Link className="text-link underline" href="/s/design/model">3D model</Link> page (use &ldquo;Save a render&rdquo; under the canvas). Nothing here is generated, and there are no stock or generated photos of people.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void addStandard()} disabled={busy === "list" || missing.length === 0}><ListPlus className="h-4 w-4" aria-hidden /> {missing.length === 0 ? "All seven shots are on the list" : items.length ? `Add the ${missing.length} missing shot${missing.length === 1 ? "" : "s"}` : "Add the standard shots"}</Button>
        </div>
      </Card>

      {(err || error) && <ErrorLine>{err || error}</ErrorLine>}

      {!items.length ? (
        <EmptyState title="No shots listed yet">Add the standard list, then upload or render a file for each.</EmptyState>
      ) : (
        <Card variant="outlined" hoverEffect={false} innerClassName="p-0">
          <input ref={input} type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" aria-label="Choose an image file" onChange={(e) => { const f = e.target.files?.[0]; if (f && target.current) void upload(target.current, f); }} />
          <Table aria-label="Shot list">
            <TableHeader>
              <TableRow><TableHead>Shot</TableHead><TableHead>Purpose</TableHead><TableHead>Used in</TableHead><TableHead>File</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const d = imageryData.safeParse(it.data).data ?? {};
                const f = fileOf(it);
                const canRender = !!shotByKey(String(d.shotKey ?? ""))?.render;
                return (
                  <TableRow key={it.id} className="align-top">
                    <TableCell className="min-w-32 font-medium text-primary">{it.title}</TableCell>
                    <TableCell className="min-w-56 text-secondary">{d.purpose}</TableCell>
                    <TableCell className="min-w-36 text-secondary">{(d.usedIn ?? []).join(", ")}</TableCell>
                    <TableCell className="min-w-36">
                      {f ? (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a stored upload served by the files route */}
                          <img src={`/api/files/${f.id}`} alt={`${it.title}: ${f.name}`} className="h-12 w-12 rounded border border-hairline bg-white object-contain" />
                          <span className="text-xs text-secondary"><span className="block max-w-32 truncate" title={f.name}>{f.name}</span>{d.source === "render" ? "rendered from the model" : "uploaded"}</span>
                        </div>
                      ) : <span className="text-sm text-muted">No file yet</span>}
                    </TableCell>
                    <TableCell><Status status={it.status} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-start gap-1.5">
                        <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => { target.current = it; input.current?.click(); }}><Upload className="h-3.5 w-3.5" aria-hidden /> {f ? "Replace" : "Upload"}<span className="sr-only"> a file for {it.title}</span></Button>
                        {canRender && <Button size="sm" variant="outline" asChild><Link href="/s/design/model"><Box className="h-3.5 w-3.5" aria-hidden /> Render from the 3D model<span className="sr-only"> for {it.title}</span></Link></Button>}
                        <ApproveButton item={it} onSet={(status) => patch(it.id, { status })} disabled={!f} reason="Add a file first." />
                        {f && <Button size="sm" variant="ghost" onClick={() => void clearFile(it)}>Detach file</Button>}
                        <RowActions item={it} />
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${it.title} from the list`} onClick={() => void remove(it.id).catch((e) => setErr((e as Error).message))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
