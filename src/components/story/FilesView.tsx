"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, Download, FileText, Folder, FolderInput, Pencil, RefreshCw, Replace, Search, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadError, LoadingBlocks, NoConcept } from "@/components/ui/states";
import { WhyField } from "@/components/trace/WhyField";
import { useItems, useProject } from "@/lib/client";
import { parseCsvText } from "@/lib/csv";
import { fmtBytes, fmtDate, plural } from "@/lib/format";
import { fetchFileBytes } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import { sectionLabel, storeHref } from "@/lib/menuLookup";
import { statusTone } from "@/lib/statusTones";
import { indexText, sourceKeys, sourceQueries, useSourceActions, type SourceEntry } from "@/lib/story/client";
import { MAX_FILE_MB, previewKind, SOURCE_ACCEPT, SOURCE_KIND_LABEL, SOURCE_KINDS, SOURCES_STORE, STORY_PARTS, STORY_STORE, type SourceData } from "@/lib/story/parts";
import type { Project } from "@/lib/types";
import { StoryProse } from "./prose";

type FileData = SourceData & { fileId?: number | null; sha256?: string };
const ALL = "\u0000all";
const TOP = "";
const folderOf = (e: SourceEntry) => String((e.item.data as FileData).folder ?? "").trim();
const kindOf = (e: SourceEntry) => {
  const k = (e.item.data as FileData).kind;
  return k && k in SOURCE_KIND_LABEL ? SOURCE_KIND_LABEL[k] : "Other";
};

type Sort = "name" | "kind" | "size" | "date";
const SORTS: Record<Sort, (a: SourceEntry, b: SourceEntry) => number> = {
  name: (a, b) => a.item.title.localeCompare(b.item.title),
  kind: (a, b) => kindOf(a).localeCompare(kindOf(b)) || a.item.title.localeCompare(b.item.title),
  size: (a, b) => Number((b.item.data as FileData).size ?? 0) - Number((a.item.data as FileData).size ?? 0),
  date: (a, b) => String((b.item.data as FileData).addedAt ?? "").localeCompare(String((a.item.data as FileData).addedAt ?? "")),
};

export function FilesView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Whole concept" title="Files" />
        <NoConcept loading={loading} />
      </>
    );
  }
  return <FilesBody key={project.id} project={project} />;
}

function FilesBody({ project }: { project: Project }) {
  const [term, setTerm] = useState("");
  const search = useDeferredValue(term.trim());
  const all = useQuery(sourceQueries.list(project.id));
  const found = useQuery({ ...sourceQueries.search(project.id, search), enabled: search !== "" });
  const [folder, setFolder] = useState<string>(ALL);
  const [sort, setSort] = useState<Sort>("name");
  const [open, setOpen] = useState<number | null>(null);

  const entries = useMemo(() => all.data ?? [], [all.data]);
  const folders = useMemo(() => [...new Set(entries.map(folderOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [entries]);
  const shown = useMemo(() => (search ? (found.data ?? []) : entries).filter((e) => folder === ALL || folderOf(e) === folder).sort(SORTS[sort]), [search, found.data, entries, folder, sort]);
  const openEntry = entries.find((e) => e.item.id === open) ?? null;
  // "/files#file-12" (a story part's citation) opens that file's details once the list has loaded.
  const loaded = entries.length > 0;
  useEffect(() => {
    const m = window.location.hash.match(/^#file-(\d+)$/);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the address, which is outside React state
    if (m && loaded) setOpen(Number(m[1]));
  }, [loaded]);
  const count = (f: string) => entries.filter((e) => folderOf(e) === f).length;

  return (
    <>
      <PageHeader eyebrow={`Whole concept · ${project.name}`} title="Files" blurb="The concept's own file store: the documents, notes, chats, drawings and data it was written from. Chat and Draft with AI read the text of every file here and cite it by name." />
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 sm:px-8">
        <AddFiles projectId={project.id} folders={folders} current={folder === ALL ? TOP : folder} />

        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="Folders" className="self-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Folders</p>
            <ul className="mt-2 space-y-0.5 text-sm">
              {[{ key: ALL, label: "All files", n: entries.length }, { key: TOP, label: "Not in a folder", n: count(TOP) }, ...folders.map((f) => ({ key: f, label: f, n: count(f) }))].map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    aria-pressed={folder === f.key}
                    onClick={() => setFolder(f.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${folder === f.key ? "bg-dutchOrange/10 font-semibold text-link" : "text-secondary hover:bg-subtle hover:text-primary"}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5"><Folder className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{f.label}</span></span>
                    <span className="font-mono text-[10px] text-muted">{f.n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="files-h" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="files-h" className="text-base font-semibold tracking-tight text-primary">{folder === ALL ? "All files" : folder === TOP ? "Not in a folder" : folder}</h2>
              <div className="flex flex-wrap items-end gap-2">
                <Field id="files-search" label="Search by name or content" className="w-64 max-w-full">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                    <Input id="files-search" type="search" value={term} onChange={(e) => setTerm(e.target.value)} className="pl-7" autoComplete="off" />
                  </div>
                </Field>
                <Field id="files-sort" label="Sort by" className="w-36">
                  <NativeSelect id="files-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="name">Name</option>
                    <option value="kind">Kind</option>
                    <option value="size">Size, largest first</option>
                    <option value="date">Date added, newest first</option>
                  </NativeSelect>
                </Field>
              </div>
            </div>

            {all.isPending || (search && found.isPending) ? (
              <div className="mt-3"><LoadingBlocks rows={4} label="Loading the files" /></div>
            ) : all.error ? (
              <div className="mt-3"><LoadError what="The files" message={messageOf(all.error)} onRetry={() => void all.refetch()} /></div>
            ) : found.error && search ? (
              <div className="mt-3"><LoadError what="The search" message={messageOf(found.error)} onRetry={() => void found.refetch()} /></div>
            ) : entries.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No files yet">Upload the documents, notes, chats, drawings and data this concept came from, or paste text as a new file. Each file shows here with its kind, size, who added it, and the story parts and rows that cite it.</EmptyState>
              </div>
            ) : shown.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-hairline px-4 py-5 text-sm text-secondary">{search ? `No file's name or text matches "${search}".` : "This folder is empty. Move files here from a file's details."}</p>
            ) : (
              <div className="mt-3 rounded-xl border border-hairline">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead className="hidden md:table-cell">Added</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Cited by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((e) => {
                      const d = e.item.data as FileData;
                      return (
                        <TableRow key={e.item.id} id={`file-${e.item.id}`}>
                          <TableCell className="max-w-[22rem]">
                            <button type="button" onClick={() => setOpen(e.item.id)} className="flex min-w-0 items-start gap-2 text-left font-medium text-primary hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                              <span className="break-words">{e.item.title}</span>
                            </button>
                            {folder === ALL && folderOf(e) && <p className="ml-5.5 text-[11px] text-muted">{folderOf(e)}</p>}
                          </TableCell>
                          <TableCell className="text-sm text-secondary">{kindOf(e)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-secondary">{typeof d.size === "number" ? fmtBytes(d.size) : "No file"}</TableCell>
                          <TableCell className="hidden text-xs text-secondary md:table-cell">{d.addedAt ? fmtDate(d.addedAt) : ""}{d.addedBy ? <span className="block text-muted">by {d.addedBy}</span> : null}</TableCell>
                          <TableCell className="hidden md:table-cell"><StatusBadge tone={statusTone(e.item.status)}>{e.item.status}</StatusBadge></TableCell>
                          <TableCell className="hidden text-xs text-secondary lg:table-cell">{e.citedBy.length ? plural(e.citedBy.length, "row") : <span className="text-muted">None</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </div>
      {openEntry && <FileDetails projectId={project.id} entry={openEntry} folders={folders} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Upload by button or by dropping files (several at once), or paste text as a new file; into the folder chosen. */
function AddFiles({ projectId, folders, current }: { projectId: string; folders: string[]; current: string }) {
  const { upload, paste } = useSourceActions(projectId);
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState(current);
  const [newFolder, setNewFolder] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const folder = (newFolder.trim() || target).slice(0, 120);

  const send = async (files: File[]) => {
    if (!files.length) return;
    setDone([]);
    setFailed([]);
    for (const [i, file] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setFailed((f) => [...f, `${file.name}: larger than ${MAX_FILE_MB} MB`]);
        continue;
      }
      try {
        const r = await upload.mutateAsync({ file, folder: folder || undefined });
        setDone((d) => [...d, `${r.item.title}: ${plural(r.chunks, "passage")} of text. ${indexText(r.index)}`]);
      } catch (e) {
        setFailed((f) => [...f, `${file.name}: ${messageOf(e)}`]);
      }
    }
    setBusy("");
    setNewFolder("");
    if (input.current) input.current.value = "";
  };

  return (
    <Card variant="flat" as="section" aria-labelledby="add-files-h" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="add-files-h" className="text-base font-semibold tracking-tight text-primary">Add files</h2>
          <p className="mt-1 text-sm text-secondary">Markdown, text, CSV, JSON, code (SQL, YAML and the like), PDF or images. Up to {MAX_FILE_MB} MB a file. Word files: save them as PDF first.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPasting(true)}><ClipboardPaste className="h-3.5 w-3.5" aria-hidden /> Paste text as a file</Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id="add-folder" label="Into the folder">
          <NativeSelect id="add-folder" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Not in a folder</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </NativeSelect>
        </Field>
        <Field id="add-new-folder" label="Or a new folder" hint="Type a name to make a folder; files go into it.">
          <Input id="add-new-folder" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={120} autoComplete="off" />
        </Field>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void send([...e.dataTransfer.files]); }}
        className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${over ? "border-dutchOrange bg-dutchOrange/5" : "border-hairline"}`}
      >
        <p className="text-secondary">Drop files here, or</p>
        <input ref={input} id="add-file-input" type="file" multiple accept={SOURCE_ACCEPT} className="sr-only" onChange={(e) => void send([...(e.target.files ?? [])])} aria-label="Choose files to upload" />
        <Button id="add-file" type="button" size="sm" onClick={() => input.current?.click()} disabled={!!busy}><Upload className="h-3.5 w-3.5" aria-hidden /> Choose files</Button>
        {busy && <p role="status" className="text-xs text-secondary">{busy}</p>}
      </div>
      {done.length > 0 && (
        <ul role="status" className="mt-3 space-y-0.5 text-xs text-success">{done.map((d, i) => <li key={i}>Added {d}</li>)}</ul>
      )}
      {failed.length > 0 && (
        <ul role="alert" className="mt-3 space-y-0.5 text-xs text-danger">{failed.map((d, i) => <li key={i}>Not added: {d}</li>)}</ul>
      )}
      {pasting && <PasteFile open={pasting} onOpenChange={setPasting} folder={folder} paste={paste.mutateAsync} />}
    </Card>
  );
}

const pasteSchema = z.object({
  title: z.string().trim().min(1, "Give the file a name.").max(300),
  text: z.string().refine((t) => t.trim() !== "", "Paste some text.").pipe(z.string().max(1_000_000, "Paste at most 1,000,000 characters.")),
  what: z.string().trim().max(4000),
  kind: z.enum(SOURCE_KINDS),
  origin: z.string().trim().max(400),
});

function PasteFile({ open, onOpenChange, folder, paste }: { open: boolean; onOpenChange: (o: boolean) => void; folder: string; paste: ReturnType<typeof useSourceActions>["paste"]["mutateAsync"] }) {
  const { register, handleSubmit, setError, formState } = useForm<z.infer<typeof pasteSchema>>({ resolver: zodResolver(pasteSchema), defaultValues: { title: "", text: "", what: "", kind: "note", origin: "" } });
  const save = handleSubmit(async (v) => {
    try {
      await paste({ title: v.title, text: v.text, what: v.what || undefined, kind: v.kind, origin: v.origin || undefined, folder: folder || undefined });
      onOpenChange(false);
    } catch (e) {
      setError("root", { message: messageOf(e) });
    }
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Paste text as a new file" description={`It is stored as a .txt file${folder ? ` in "${folder}"` : ""}, and its text is searchable at once.`} width="44rem">
      <form onSubmit={save} noValidate className="space-y-4 px-5 py-4">
        <Field id="paste-title" label="Name" required error={formState.errors.title?.message}><Input id="paste-title" {...register("title")} /></Field>
        <Field id="paste-text" label="Text" required error={formState.errors.text?.message}><Textarea id="paste-text" rows={10} className="text-[13px]" {...register("text")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="paste-kind" label="What kind">
            <NativeSelect id="paste-kind" {...register("kind")}>{SOURCE_KINDS.map((k) => <option key={k} value={k}>{SOURCE_KIND_LABEL[k]}</option>)}</NativeSelect>
          </Field>
          <Field id="paste-origin" label="Where it came from"><Input id="paste-origin" {...register("origin")} /></Field>
        </div>
        <Field id="paste-what" label="What it is"><Textarea id="paste-what" rows={2} {...register("what")} /></Field>
        {formState.errors.root && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">The file was not added: {formState.errors.root.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" size="sm" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Adding" : "Add the file"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function citedHref(section: string, itemId: number, title: string) {
  if (section === STORY_STORE) {
    const part = STORY_PARTS.find((p) => p.heading === title);
    return `/story${part ? `#story-${part.key}` : ""}`;
  }
  const href = storeHref(section);
  return href ? `${href}?item=${itemId}` : "/";
}

/** One file: its preview, its details, what cites it, its versions, and every action on it. */
function FileDetails({ projectId, entry, folders, onClose }: { projectId: string; entry: SourceEntry; folders: string[]; onClose: () => void }) {
  const { item, citedBy } = entry;
  const d = item.data as FileData;
  const { reindex, remove, replace } = useSourceActions(projectId);
  const [mode, setMode] = useState<"view" | "edit" | "move" | "delete">("view");
  const [note, setNote] = useState("");
  const replaceInput = useRef<HTMLInputElement>(null);
  const error = messageOf(reindex.error) || messageOf(remove.error) || messageOf(replace.error);
  const hasFile = typeof d.fileId === "number";

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={item.title} description={item.body || `${SOURCE_KIND_LABEL[d.kind ?? "other"] ?? "File"}${folderOf(entry) ? ` in ${folderOf(entry)}` : ""}`} width="60rem">
      <div className="max-h-[78vh] space-y-5 overflow-y-auto px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {hasFile && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/files/${d.fileId}`} download><Download className="h-3.5 w-3.5" aria-hidden /> Download</a>
            </Button>
          )}
          {hasFile && (
            <>
              <input ref={replaceInput} type="file" accept={SOURCE_ACCEPT} className="sr-only" aria-label={`Choose a new version of ${item.title}`} onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void replace.mutateAsync({ id: item.id, file: f }).then((r) => setNote(`New version stored: ${plural(r.chunks, "passage")}. The earlier one is kept below.`)).catch(() => undefined);
              }} />
              <Button size="sm" variant="outline" disabled={replace.isPending} onClick={() => replaceInput.current?.click()}><Replace className="h-3.5 w-3.5" aria-hidden /> {replace.isPending ? "Replacing" : "Replace with a new version"}</Button>
              <Button size="sm" variant="outline" disabled={reindex.isPending} onClick={() => void reindex.mutateAsync(item.id).then((r) => setNote(`Read again: ${plural(r.chunks, "passage")}. ${indexText(r.index)}`)).catch(() => undefined)}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {reindex.isPending ? "Reading" : "Read again"}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" aria-pressed={mode === "edit"} onClick={() => setMode(mode === "edit" ? "view" : "edit")}><Pencil className="h-3.5 w-3.5" aria-hidden /> Rename or edit</Button>
          <Button size="sm" variant="outline" aria-pressed={mode === "move"} onClick={() => setMode(mode === "move" ? "view" : "move")}><FolderInput className="h-3.5 w-3.5" aria-hidden /> Move</Button>
          <Button size="sm" variant="outline" aria-pressed={mode === "delete"} onClick={() => setMode(mode === "delete" ? "view" : "delete")}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</Button>
        </div>
        {note && <p role="status" className="text-xs text-success">{note}</p>}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        {mode === "edit" && <EditFile projectId={projectId} entry={entry} onDone={() => setMode("view")} />}
        {mode === "move" && <MoveFile projectId={projectId} entry={entry} folders={folders} onDone={() => setMode("view")} />}
        {mode === "delete" && <DeleteFile title={item.title} pending={remove.isPending} onCancel={() => setMode("view")} onDelete={(why) => void remove.mutateAsync({ id: item.id, why }).then(onClose).catch(() => undefined)} />}

        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <div><dt className="inline text-muted">Kind: </dt><dd className="inline text-primary">{SOURCE_KIND_LABEL[d.kind ?? "other"] ?? "Other"}</dd></div>
          <div><dt className="inline text-muted">Size: </dt><dd className="inline text-primary">{typeof d.size === "number" ? fmtBytes(d.size) : "No file stored"}</dd></div>
          <div><dt className="inline text-muted">Added: </dt><dd className="inline text-primary">{d.addedAt ? fmtDate(d.addedAt) : "Not recorded"}{d.addedBy ? ` by ${d.addedBy}` : ""}</dd></div>
          <div><dt className="inline text-muted">Status: </dt><dd className="inline"><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></dd></div>
          <div className="sm:col-span-2"><dt className="inline text-muted">Where it came from: </dt><dd className="inline text-primary">{d.origin || "Not recorded"}</dd></div>
          {d.fileName && <div className="sm:col-span-2"><dt className="inline text-muted">File: </dt><dd className="inline break-all font-mono text-primary">{d.fileName}</dd></div>}
          {typeof d.chunks === "number" && hasFile && <div className="sm:col-span-2"><dt className="inline text-muted">Text: </dt><dd className="inline text-primary">{(d.chars ?? 0).toLocaleString("en")} characters, searched in {plural(d.chunks, "passage")}{d.extract?.note ? `. ${d.extract.note}` : ""}</dd></div>}
        </dl>
        {!hasFile && <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">No file is stored for this entry, so chat and drafting cannot read it. Upload a file with the same name to fill it in.</p>}

        <section aria-labelledby={`cited-${item.id}`}>
          <h3 id={`cited-${item.id}`} className="text-sm font-semibold text-primary">Cited by</h3>
          {citedBy.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {citedBy.map((c) => (
                <li key={`${c.itemId}-${c.how}`}>
                  <Link href={citedHref(c.section, c.itemId, c.title)} onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-xs text-primary hover:border-dutchOrange/50 hover:text-link">
                    {c.title}
                    <span className="text-muted">{c.section === STORY_STORE ? "Concept story" : sectionLabel(c.section)}{c.how === "drafted from" ? ", drafted from it" : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted">Nothing cites it yet. Story parts and AI drafts that use it are listed here.</p>
          )}
        </section>

        {d.versions?.length ? (
          <section aria-labelledby={`versions-${item.id}`}>
            <h3 id={`versions-${item.id}`} className="text-sm font-semibold text-primary">Earlier versions</h3>
            <ul className="mt-1.5 space-y-1 text-xs">
              {d.versions.map((v) => (
                <li key={v.fileId} className="flex flex-wrap gap-x-2">
                  <a href={`/api/files/${v.fileId}`} download className="font-mono text-link hover:underline">{v.fileName}</a>
                  <span className="text-muted">{fmtBytes(v.size)}, replaced {fmtDate(v.replacedAt)}{v.replacedBy ? ` by ${v.replacedBy}` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasFile && (
          <section aria-labelledby={`preview-${item.id}`}>
            <h3 id={`preview-${item.id}`} className="text-sm font-semibold text-primary">Preview</h3>
            <div className="mt-2"><Preview fileId={d.fileId as number} name={d.fileName ?? item.title} title={item.title} /></div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function Preview({ fileId, name, title }: { fileId: number; name: string; title: string }) {
  const kind = previewKind(name);
  const text = useQuery({
    queryKey: ["file-text", fileId],
    queryFn: async ({ signal }) => new TextDecoder("utf-8").decode(await fetchFileBytes(fileId, (s) => `The file could not be read (${s}).`, { signal })),
    enabled: kind !== "pdf" && kind !== "image" && kind !== "none",
    staleTime: Infinity,
  });
  // A stored file of any size, served by the app itself: next/image's optimiser has nothing to add here.
  // eslint-disable-next-line @next/next/no-img-element
  if (kind === "image") return <img src={`/api/files/${fileId}?inline=1`} alt={title} className="max-h-[60vh] max-w-full rounded-md border border-hairline bg-white" />;
  if (kind === "pdf") {
    return (
      <object data={`/api/files/${fileId}?inline=1`} type="application/pdf" aria-label={`${title}, as a PDF`} className="h-[60vh] w-full rounded-md border border-hairline">
        <p className="p-4 text-sm text-secondary">This browser does not show PDFs in the page. <a href={`/api/files/${fileId}`} download className="text-link underline">Download it</a>.</p>
      </object>
    );
  }
  if (kind === "none") return <p className="text-sm text-muted">There is no preview for this kind of file. Download it to open it.</p>;
  if (text.isPending) return <LoadingBlocks rows={3} label="Loading the preview" />;
  if (text.error) return <LoadError what="The preview" message={messageOf(text.error)} onRetry={() => void text.refetch()} />;
  const body = text.data ?? "";
  if (kind === "markdown") return <div className="max-w-[72ch] rounded-md border border-hairline p-4"><StoryProse markdown={body} /></div>;
  if (kind === "csv") {
    const { rows } = parseCsvText(body);
    if (!rows.length) return <p className="text-sm text-muted">The file has no rows.</p>;
    return (
      <div className="max-h-[60vh] overflow-auto rounded-md border border-hairline">
        <Table>
          <TableHeader><TableRow className="hover:bg-transparent">{rows[0].map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.slice(1).map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="align-top text-xs">{c}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      </div>
    );
  }
  return <pre className={`max-h-[60vh] overflow-auto whitespace-pre rounded-md border border-hairline bg-subtle p-4 text-xs leading-5 text-primary ${kind === "code" ? "font-mono" : "font-mono whitespace-pre-wrap"}`}>{body}</pre>;
}

const editSchema = z.object({ title: z.string().trim().min(1, "A file needs a name.").max(300), what: z.string().max(4000), origin: z.string().max(400), kind: z.enum(SOURCE_KINDS) });

function EditFile({ projectId, entry, onDone }: { projectId: string; entry: SourceEntry; onDone: () => void }) {
  const { item } = entry;
  const rows = useItems(projectId, SOURCES_STORE);
  const qc = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: item.title, what: item.body, origin: String(item.data.origin ?? ""), kind: (item.data.kind as SourceData["kind"]) ?? "document" },
  });
  const save = handleSubmit(async (v) => {
    try {
      await rows.patch(item.id, { title: v.title, body: v.what, data: { ...item.data, origin: v.origin, kind: v.kind } });
      await qc.invalidateQueries({ queryKey: sourceKeys.all(projectId) });
      onDone();
    } catch (e) {
      setError("root", { message: messageOf(e) });
    }
  });
  const id = (f: string) => `file-${item.id}-${f}`;
  return (
    <form onSubmit={save} noValidate className="grid gap-4 rounded-xl border border-hairline p-4 sm:grid-cols-2">
      <Field id={id("title")} label="Name" required error={formState.errors.title?.message}><Input id={id("title")} {...register("title")} /></Field>
      <Field id={id("kind")} label="What kind">
        <NativeSelect id={id("kind")} {...register("kind")}>{SOURCE_KINDS.map((k) => <option key={k} value={k}>{SOURCE_KIND_LABEL[k]}</option>)}</NativeSelect>
      </Field>
      <Field id={id("what")} label="What it is" className="sm:col-span-2"><Textarea id={id("what")} rows={2} {...register("what")} /></Field>
      <Field id={id("origin")} label="Where it came from" className="sm:col-span-2"><Input id={id("origin")} {...register("origin")} /></Field>
      {formState.errors.root && <p role="alert" className="text-sm text-danger sm:col-span-2">Not saved: {formState.errors.root.message}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving" : "Save"}</Button>
      </div>
    </form>
  );
}

function MoveFile({ projectId, entry, folders, onDone }: { projectId: string; entry: SourceEntry; folders: string[]; onDone: () => void }) {
  const rows = useItems(projectId, SOURCES_STORE);
  const qc = useQueryClient();
  const [to, setTo] = useState(folderOf(entry));
  const [fresh, setFresh] = useState("");
  const [why, setWhy] = useState("");
  const [err, setErr] = useState("");
  const id = `move-${entry.item.id}`;
  const move = async () => {
    const folder = (fresh.trim() || to).slice(0, 120);
    try {
      await rows.patch(entry.item.id, { data: { ...entry.item.data, folder }, ...(why.trim() ? { why: why.trim() } : {}) });
      await qc.invalidateQueries({ queryKey: sourceKeys.all(projectId) });
      onDone();
    } catch (e) {
      setErr(messageOf(e));
    }
  };
  return (
    <div className="grid gap-4 rounded-xl border border-hairline p-4 sm:grid-cols-3">
      <Field id={`${id}-to`} label="Move to">
        <NativeSelect id={`${id}-to`} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Not in a folder</option>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </NativeSelect>
      </Field>
      <Field id={`${id}-new`} label="Or a new folder"><Input id={`${id}-new`} value={fresh} onChange={(e) => setFresh(e.target.value)} maxLength={120} autoComplete="off" /></Field>
      <WhyField id={`${id}-why`} value={why} onChange={setWhy} />
      {err && <p role="alert" className="text-sm text-danger sm:col-span-3">Not moved: {err}</p>}
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="button" size="sm" onClick={() => void move()}>Move</Button>
      </div>
    </div>
  );
}

function DeleteFile({ title, pending, onCancel, onDelete }: { title: string; pending: boolean; onCancel: () => void; onDelete: (why: string) => void }) {
  const [why, setWhy] = useState("");
  return (
    <div role="alertdialog" aria-label={`Delete ${title}?`} className="space-y-3 rounded-xl border border-danger bg-danger-soft p-4">
      <p className="text-sm text-danger">Delete &ldquo;{title}&rdquo;? Its file, its earlier versions and its text are removed, and story parts stop citing it. The deletion is recorded in the history; it cannot be undone here.</p>
      <WhyField id="delete-file-why" value={why} onChange={setWhy} />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Keep it</Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => onDelete(why)}>{pending ? "Deleting" : "Delete the file"}</Button>
      </div>
    </div>
  );
}
