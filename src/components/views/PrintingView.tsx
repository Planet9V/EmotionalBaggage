"use client";
import { toPart } from "@/lib/domain";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorLine, Field, Select, statusOptions } from "@/components/parts/controls";
import { InlineEdit } from "@/components/parts/InlineEdit";
import { Modal } from "@/components/parts/Modal";
import { PrintersPanel } from "@/components/printers/PrintersPanel";

import { api, saveOrMessage, useFilesChanged, useItems } from "@/lib/client";
import { messageOf, queries } from "@/lib/queries";
import { statusTone } from "@/lib/statusTones";
import type { FileMeta, Item } from "@/lib/types";
import type { ViewProps } from "./types";


const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
const fileIdOf = (it: Item): number | null => {
  const v = it.data.fileId;
  return typeof v === "number" ? v : v ? Number(v) || null : null;
};

const NO_FILES: FileMeta[] = [];
const onlyStl = (files: FileMeta[]) => files.filter((f) => f.kind === "stl");

export function PrintingView({ project, section, store }: ViewProps) {
  const jobs = useItems(project.id, store);
  const bom = useItems(project.id, "design/bom");
  const reduce = useReducedMotion();
  const filesQuery = useQuery({ ...queries.files(project.id), select: onlyStl });
  const files = filesQuery.data ?? NO_FILES;
  const filesError = messageOf(filesQuery.error);
  const filesChanged = useFilesChanged(project.id);
  const [adding, setAdding] = useState(false);
  const [delJob, setDelJob] = useState<Item | null>(null);
  const [delFile, setDelFile] = useState<FileMeta | null>(null);
  const [actionError, setActionError] = useState("");


  const columns = section.columns ?? [];
  const statuses = section.statuses ?? [];
  const printedParts = useMemo(() => bom.items.map(toPart).filter((p) => p.geometry?.print === true || p.item.status === "to print"), [bom.items]);

  const linkFile = (job: Item, id: string) => {
    const f = files.find((x) => String(x.id) === id);
    void jobs.patch(job.id, { data: { fileId: f ? f.id : null, fileName: f ? f.name : "" } });
  };

  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-8">
      <PrintersPanel />

      {actionError || jobs.writeError ? <ErrorLine>{actionError || jobs.writeError}</ErrorLine> : null}

      <section aria-labelledby="jobs-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="jobs-h" className="text-base font-semibold tracking-tight text-primary">Print jobs</h2>
          <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> {section.addLabel ?? "Add print job"}</Button>
        </div>
        {jobs.error ? <ErrorLine>{jobs.error}</ErrorLine> : null}
        {jobs.loading ? (
          <p className="text-sm text-secondary">Loading the jobs.</p>
        ) : !jobs.items.length ? (
          <EmptyState title="No print jobs yet">Add a job for each part you print, then link a stored STL file to it.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-40">Job</TableHead>
                  {columns.map((c) => <TableHead key={c.key} className="min-w-32">{c.label}</TableHead>)}
                  <TableHead className="min-w-44">File</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Delete</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.items.map((j) => {
                  const fid = fileIdOf(j);
                  const stored = files.some((f) => f.id === fid);
                  const fname = typeof j.data.fileName === "string" ? j.data.fileName : "";
                  return (
                    <TableRow key={j.id}>
                      <TableCell>
                        <InlineEdit label="job name" value={j.title} onSave={(v) => (v.trim() ? saveOrMessage(jobs.patch(j.id, { title: v.trim() })) : "A job needs a name.")} />
                      </TableCell>
                      {columns.map((c) => (
                        <TableCell key={c.key}>
                          <InlineEdit label={`${c.label} of ${j.title}`} value={typeof j.data[c.key] === "string" || typeof j.data[c.key] === "number" ? String(j.data[c.key]) : ""} onSave={(v) => saveOrMessage(jobs.patch(j.id, { data: { [c.key]: v.trim() } }))} />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Select aria-label={`STL file for ${j.title}`} className="h-8 text-xs" value={stored ? String(fid) : ""} onChange={(e) => linkFile(j, e.target.value)}>
                          <option value="">No file linked</option>
                          {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </Select>
                        {fid && !stored && !filesError ? <p className="mt-1 text-[11px] text-warning">{fname || `File ${fid}`} is no longer stored.</p> : null}
                      </TableCell>
                      <TableCell>
                        <Select aria-label={`Status of ${j.title}`} className="h-8 text-xs" value={j.status} onChange={(e) => void jobs.patch(j.id, { status: e.target.value })}>
                          {statusOptions(statuses, j.status).map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${j.title}`} onClick={() => setDelJob(j)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="files-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="files-h" className="text-base font-semibold tracking-tight text-primary">STL files</h2>
          <Link href="/s/design/model" className={buttonVariants({ variant: "outline" })}>Generate or upload in the 3D model</Link>
        </div>
        {filesError ? <ErrorLine>{filesError}</ErrorLine> : null}
        {!files.length && !filesError ? (
          <EmptyState title="No STL files stored">Generate one from the model or upload your own in <Link href="/s/design/model" className="text-link underline">Design, 3D model</Link>.</EmptyState>
        ) : files.length ? (
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead><TableHead className="text-right">Size</TableHead><TableHead>SHA-256</TableHead><TableHead>Created</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-primary">{f.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{bytes(f.size)}</TableCell>
                    <TableCell className="font-mono text-xs" title={f.sha256}>{f.sha256.slice(0, 12)}</TableCell>
                    <TableCell className="text-xs">{when(f.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <a href={`/api/files/${f.id}`} download={f.name} aria-label={`Download ${f.name}`} className={buttonVariants({ variant: "ghost", size: "icon", className: "h-8 w-8" })}><Download className="h-4 w-4" aria-hidden /></a>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${f.name}`} onClick={() => setDelFile(f)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="pp-h" className="space-y-3">
        <h2 id="pp-h" className="text-base font-semibold tracking-tight text-primary">Printed parts</h2>
        <p className="text-sm text-secondary">Parts in the bill of materials that are marked as printed or have the status to print. Each needs a file.</p>
        {bom.loading ? (
          <p className="text-sm text-secondary">Loading the parts.</p>
        ) : !printedParts.length ? (
          <EmptyState title="No printed parts">No part in the bill of materials is marked as printed.</EmptyState>
        ) : (
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
            {printedParts.map((p) => (
              <li key={p.item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-sm text-primary">
                  {p.ref ? <span className="mr-2 font-mono text-xs text-muted">{p.ref}</span> : null}
                  {p.item.title}
                  {p.item.body ? <span className="ml-2 text-xs text-secondary">{p.item.body}</span> : null}
                </span>
                <StatusBadge tone={statusTone(p.item.status)}>{p.item.status}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddJobDialog
        open={adding}
        onOpenChange={setAdding}
        columns={columns}
        statuses={statuses}
        files={files}
        onCreate={async (v) => {
          await jobs.add({ section: store, title: v.title, status: v.status, data: v.data });
        }}
      />
      <Modal open={!!delJob} onOpenChange={(o) => !o && setDelJob(null)} title="Delete this print job?" description="The stored file, if any, is kept.">
        <p className="text-sm font-medium text-primary">{delJob?.title}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDelJob(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!delJob) return;
            try { setActionError(""); await jobs.remove(delJob.id); } catch (e) { setActionError((e as Error).message); }
            setDelJob(null);
          }}>Delete job</Button>
        </div>
      </Modal>
      <Modal open={!!delFile} onOpenChange={(o) => !o && setDelFile(null)} title="Delete this file?" description="The file is removed from storage. Jobs linked to it keep the name but lose the file.">
        <p className="font-mono text-sm text-primary">{delFile?.name}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDelFile(null)}>Keep it</Button>
          <Button onClick={async () => {
            if (!delFile) return;
            try { setActionError(""); await api(`/api/files/${delFile.id}`, { method: "DELETE" }); await filesChanged(); } catch (e) { setActionError((e as Error).message); }
            setDelFile(null);
          }}>Delete file</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

function AddJobDialog({ open, onOpenChange, columns, statuses, files, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; columns: { key: string; label: string }[]; statuses: string[]; files: FileMeta[];
  onCreate: (v: { title: string; status: string; data: Record<string, unknown> }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(statuses[0] ?? "");
  const [fileId, setFileId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setErr("A job needs a name.");
    const f = files.find((x) => String(x.id) === fileId);
    const data: Record<string, unknown> = {};
    for (const c of columns) if (vals[c.key]?.trim()) data[c.key] = vals[c.key].trim();
    if (f) { data.fileId = f.id; data.fileName = f.name; }
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), status, data });
      setTitle(""); setVals({}); setFileId(""); setErr("");
      onOpenChange(false);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add print job">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Job"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required /></Field>
        {columns.map((c) => (
          <Field key={c.key} label={c.label}><Input value={vals[c.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [c.key]: e.target.value }))} /></Field>
        ))}
        <Field label="STL file" hint={files.length ? undefined : "No STL files are stored yet. You can link one later."}>
          <Select value={fileId} onChange={(e) => setFileId(e.target.value)}>
            <option value="">No file linked</option>
            {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>
        {statuses.length > 0 && (
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        )}
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Adding" : "Add job"}</Button>
        </div>
      </form>
    </Modal>
  );
}
