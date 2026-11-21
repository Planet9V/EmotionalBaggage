"use client";

// Audit log (plan item 2.6a): every change in the install, newest first, with filters, "Load more" and a
// download of the same filtered lines as a file.
import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageOf } from "@/lib/queries";
import { downloadAuditLog, useAuditLog, type AuditConcept, type AuditFilters } from "@/lib/admin/client";
import {  } from "./shared";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Panel } from "@/components/ui/panel";

const ALL = "__all";

/** Kinds of change, by the start of the action name. */
export const KINDS: { prefix: string; label: string }[] = [
  { prefix: "project.", label: "Concepts" },
  { prefix: "item.", label: "Rows" },
  { prefix: "file.", label: "Files" },
  { prefix: "research.", label: "Research" },
  { prefix: "challenge.", label: "Reviewer" },
  { prefix: "credential.", label: "Keys" },
  { prefix: "setting.", label: "Settings" },
  { prefix: "printer.", label: "Printers" },
  { prefix: "session.", label: "Sign-in" },
  { prefix: "password.", label: "Passwords" },
  { prefix: "audit.", label: "Audit log copies" },
];

/** A concept's name in the filter, marked when it has been deleted. */
export const conceptLabel = (c: AuditConcept) => (c.exists ? c.name : `${c.name} (deleted)`);

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function AuditTab() {
  const [project, setProject] = useState("");
  const [action, setAction] = useState("");
  const [text, setText] = useState("");
  const q = useDebounced(text);
  const filters: AuditFilters = { project: project || undefined, action: action || undefined, q: q.trim() || undefined };
  const log = useAuditLog(filters);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const pages = log.data?.pages ?? [];
  const entries = pages.flatMap((p) => p.entries);
  const concepts = pages[0]?.concepts ?? [];
  const deleted = new Set(concepts.filter((c) => !c.exists).map((c) => c.id));
  const filtered = !!(filters.project || filters.action || filters.q);

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const download = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const name = await downloadAuditLog(filters);
      toast.success(`Downloaded ${name}.`);
    } catch (err) {
      const m = messageOf(err);
      setDownloadError(m);
      toast.error(m);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Panel
      title="Audit log"
      description="Every change in this install, newest first: rows, files, research, keys (never their values), settings, printers, sign-ins and passwords. Lines are never edited or removed, and they survive deleting a concept."
      actions={
        <Button size="sm" variant="outline" onClick={() => void download()} disabled={downloading}>
          <Download className="h-3.5 w-3.5" aria-hidden /> {downloading ? "Downloading…" : "Download"}
        </Button>
      }
    >
      <div role="search" aria-label="Filter the audit log" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="audit-concept" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Concept
          </label>
          <Select value={project || ALL} onValueChange={(v) => setProject(v === ALL ? "" : v)}>
            <SelectTrigger id="audit-concept" className="mt-1 w-full border-hairline bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All concepts and install-wide</SelectItem>
              {concepts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {conceptLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="audit-kind" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Kind of change
          </label>
          <Select value={action || ALL} onValueChange={(v) => setAction(v === ALL ? "" : v)}>
            <SelectTrigger id="audit-kind" className="mt-1 w-full border-hairline bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Every kind</SelectItem>
              {KINDS.map((k) => (
                <SelectItem key={k.prefix} value={k.prefix}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="audit-text" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Text
          </label>
          <Input id="audit-text" type="search" className="mt-1" placeholder="In the summary, concept or user" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>

      {downloadError ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {downloadError}
        </p>
      ) : null}

      <div className="mt-4">
        {log.isPending ? (
          <LoadingBlocks rows={2} label="Reading the audit log" />
        ) : log.isError && !entries.length ? (
          <LoadError message={messageOf(log.error)} onRetry={() => void log.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState>{filtered ? "No lines match these filters." : "No lines yet. Every change made in the app will be listed here."}</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-hairline" aria-busy={log.isFetching || undefined}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8"><span className="sr-only">Details</span></TableHead>
                    <TableHead className="w-44">Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Concept</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="min-w-[18rem]">Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const isOpen = open.has(e.id);
                    return (
                      <Fragment key={e.id}>
                        <TableRow className="align-top" data-testid={`audit-${e.id}`}>
                          <TableCell className="align-top">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-expanded={isOpen}
                              aria-controls={`audit-detail-${e.id}`}
                              aria-label={`${isOpen ? "Hide" : "Show"} details of line ${e.id}`}
                              onClick={() => toggle(e.id)}
                            >
                              {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                            </Button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top font-mono text-xs text-muted">{fmtDateTime(e.at)}</TableCell>
                          <TableCell className="align-top text-xs">{e.actor || "none"}</TableCell>
                          <TableCell className="align-top text-xs">
                            {e.projectId ? (
                              <span className="inline-flex flex-wrap items-center gap-1">
                                {e.projectName || e.projectId}
                                {deleted.has(e.projectId) ? <StatusBadge tone="neutral">deleted</StatusBadge> : null}
                              </span>
                            ) : (
                              <span className="text-muted">install-wide</span>
                            )}
                          </TableCell>
                          <TableCell className="align-top font-mono text-xs">{e.action}</TableCell>
                          <TableCell className="align-top text-xs text-primary">
                            {e.summary}
                            {typeof e.detail?.reason === "string" && e.detail.reason && !e.summary.includes(e.detail.reason) ? (
                              <span className="mt-1 block text-secondary wrap-anywhere">
                                <span className="font-medium text-primary">Why:</span> {e.detail.reason}
                              </span>
                            ) : null}
                          </TableCell>
                        </TableRow>
                        {isOpen ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6} className="bg-subtle">
                              <pre id={`audit-detail-${e.id}`} className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-primary">
                                {JSON.stringify(e.detail, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {log.isError ? (
              <div className="mt-3">
                <LoadError message={messageOf(log.error)} onRetry={() => void log.refetch()} />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {log.hasNextPage ? (
                <Button variant="outline" size="sm" disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
                  {log.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              ) : (
                <span className="text-xs text-muted">That is every line{filtered ? " that matches" : ""}.</span>
              )}
              <span className="text-xs text-muted" role="status">
                {entries.length} line{entries.length === 1 ? "" : "s"} shown.
              </span>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
