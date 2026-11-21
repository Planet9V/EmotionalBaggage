"use client";

import { useState } from "react";
import { Download, Pause, Play, Printer, Scissors, Send, Square, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import { FILE_ONLY_STEPS } from "@/lib/slicing/fileOnlySteps";
import { STATUS_WORDS, normaliseStatus, printJobData, type PrintStatus } from "@/lib/slicing/jobState";
import { duration } from "@/lib/slicing/format";
import { usePlan, usePrintActions, useTrack } from "@/lib/slicing/queries";
import { ResultForm } from "./ResultForm";
import { ErrorLine } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/Card";
import { fmtDateTime } from "@/lib/format";

type Pending = null | { kind: "send" | "start" | "cancel"; printer: string; file: string };

const dt = fmtDateTime;

export function JobCard({ projectId, job, buildTitle, onDelete, onEdit, onRequeue }: { projectId: string; job: Item; buildTitle?: string; onDelete: () => void; onEdit: () => void; onRequeue: () => Promise<unknown> }) {
  const status = normaliseStatus(job.status) as PrintStatus;
  const parsed = printJobData.safeParse(job.data);
  const d = parsed.success ? parsed.data : (job.data as never);
  const hasSlice = !!d.slice && ["sliced", "sent", "printing", "done", "failed", "cancelled"].includes(status);
  const ready = !!(d.fileId && d.printerId && d.printerMaker && d.printerModel);
  const live = status === "sent" || status === "printing";
  const act = usePrintActions(projectId, job.id);
  const plan = usePlan(job.id, ["sliced", "sent", "printing", "done"].includes(status));
  const track = useTrack(projectId, job.id, live && !!plan.data?.capabilities.status);
  const [pending, setPending] = useState<Pending>(null);
  const [err, setErr] = useState("");
  const [resultOpen, setResultOpen] = useState(false);

  const p = plan.data;
  const busy = act.slice.isPending || act.send.isPending || act.start.isPending || act.control.isPending;
  const fail = (e: unknown) => setErr((e as Error).message);
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); } catch (e) { fail(e); } };

  const confirm = async () => {
    if (!pending) return;
    const c = { printer: pending.printer, file: pending.file };
    setErr("");
    try {
      if (pending.kind === "send") await act.send.mutateAsync(c);
      else if (pending.kind === "start") await act.start.mutateAsync(c);
      else await act.control.mutateAsync({ action: "cancel", confirm: c });
      setPending(null);
    } catch (e) {
      fail(e);
    }
  };

  const printerName = p?.printer?.name ?? d.printerName ?? "the printer";
  const sentFile = d.sentName ?? p?.send?.name ?? "";

  return (
    <Card variant="flat" as="li" className="space-y-3 p-4" aria-label={`Print job ${job.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{job.title}</p>
          <p className="mt-0.5 text-xs text-secondary">
            {d.fileName || "No file"} on {d.printerName || "no printer"}{d.printerModel ? ` (sliced as ${d.printerMaker} ${d.printerModel})` : ""}
            {buildTitle ? <> &middot; build {buildTitle}</> : null}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            {d.material || "material not set"} · {d.layerHeight ?? "?"} mm · {d.infill ?? "?"}% infill · {d.supports ? "supports on" : "no supports"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${job.title}`} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden /></Button>
        </div>
      </div>
      <p className="text-xs text-muted">{STATUS_WORDS[status] ?? status}</p>

      {d.sliceError && status === "queued" ? <ErrorLine>The last slice failed: {d.sliceError}</ErrorLine> : null}
      {err ? <ErrorLine>{err}</ErrorLine> : null}

      {hasSlice && d.slice ? (
        <Card variant="well" className="rounded-lg p-3" aria-label="What the slicer says">
          <p className="text-xs font-medium text-secondary">From OrcaSlicer {d.slice.orcaVersion}, read from its own output</p>
          <dl className="mt-1 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div><dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Print time</dt><dd className="font-mono text-primary">{duration(d.slice.seconds)}</dd></div>
            <div><dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Filament</dt><dd className="font-mono text-primary">{d.slice.filamentG} g, {(d.slice.filamentMm / 1000).toFixed(2)} m</dd></div>
            <div><dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Layers</dt><dd className="font-mono text-primary">{d.slice.layers ?? "not reported"}</dd></div>
          </dl>
          <p className="mt-1 break-words font-mono text-[11px] text-muted">{d.slice.profile.machine} · {d.slice.profile.process} · {d.slice.profile.filament}</p>
          {d.slice.warnings.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-warning">{d.slice.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </Card>
      ) : null}

      {live && (
        <div aria-live="polite" className="text-sm text-secondary">
          {!p?.capabilities.status ? (
            <p>This printer does not report its status here. Come back and record the result when the print finishes.</p>
          ) : track.isError ? (
            <ErrorLine>{(track.error as Error).message}</ErrorLine>
          ) : !track.data ? (
            <p>Asking the printer.</p>
          ) : track.data.printer ? (
            <div className="space-y-1">
              <p>Printer says: <span className="font-mono text-primary">{track.data.printer.rawState ?? track.data.printer.state}</span>{track.data.printer.progress != null ? ` · ${track.data.printer.progress.toFixed(0)}%` : ""}{track.data.printer.secondsLeft != null ? ` · ${duration(track.data.printer.secondsLeft)} left` : ""}</p>
              {track.data.printer.progress != null && (
                <div role="progressbar" aria-label="Print progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(track.data.printer.progress)} className="h-2 overflow-hidden rounded-full bg-subtle">
                  <div className="h-full rounded-full bg-dutchOrange transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, track.data.printer.progress))}%` }} />
                </div>
              )}
            </div>
          ) : (
            <p>{track.data.message || "No reading yet."}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(status === "queued" || status === "sliced") && (
          <Button size="sm" onClick={() => void run(() => act.slice.mutateAsync())} disabled={busy || !ready} title={ready ? undefined : "Choose a file, a printer and a slicer profile first"}>
            <Scissors className="h-3.5 w-3.5" aria-hidden /> {act.slice.isPending ? "Slicing, this can take a minute" : status === "sliced" ? "Slice again" : "Slice"}
          </Button>
        )}
        {status === "queued" && <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>{ready ? "Edit job" : "Choose file and printer"}</Button>}
        {status === "slicing" && <span role="status" className="text-sm text-secondary">The slicer is working. This page updates when it is done.</span>}

        {status === "sliced" && p && !p.fileOnly && p.send && p.printer && (
          <Button size="sm" variant="outline" onClick={() => setPending({ kind: "send", printer: p.printer!.name, file: p.send!.name })} disabled={busy}>
            <Send className="h-3.5 w-3.5" aria-hidden /> Send to {p.printer.name}
          </Button>
        )}
        {status === "sent" && p?.capabilities.start && (
          <Button size="sm" onClick={() => setPending({ kind: "start", printer: printerName, file: sentFile })} disabled={busy}>
            <Play className="h-3.5 w-3.5" aria-hidden /> Start on {printerName}
          </Button>
        )}
        {status === "printing" && p?.capabilities.pause && <Button size="sm" variant="outline" onClick={() => void run(() => act.control.mutateAsync({ action: "pause" }))} disabled={busy}><Pause className="h-3.5 w-3.5" aria-hidden /> Pause</Button>}
        {status === "printing" && p?.capabilities.resume && <Button size="sm" variant="outline" onClick={() => void run(() => act.control.mutateAsync({ action: "resume" }))} disabled={busy}><Play className="h-3.5 w-3.5" aria-hidden /> Resume</Button>}
        {(status === "sent" || status === "printing") && p?.capabilities.cancel && (
          <Button size="sm" variant="outline" onClick={() => setPending({ kind: "cancel", printer: printerName, file: sentFile })} disabled={busy}><Square className="h-3.5 w-3.5" aria-hidden /> Cancel print</Button>
        )}
        {(status === "queued" || status === "sliced") && (
          <Button size="sm" variant="ghost" onClick={() => void run(() => act.control.mutateAsync({ action: "cancel" }))} disabled={busy}>Cancel job</Button>
        )}
        {(["sent", "printing", "done", "failed", "cancelled"].includes(status) || (status === "sliced" && p?.fileOnly)) && (
          <Button size="sm" variant="outline" onClick={() => setResultOpen((v) => !v)} aria-expanded={resultOpen}>{d.result ? "Edit result" : "Record result"}</Button>
        )}
        {(status === "failed" || status === "cancelled") && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(onRequeue)}>Queue again</Button>}
      </div>

      {status === "sliced" && p?.fileOnly && p.download && (
        <Card variant="well" className="rounded-lg p-3 text-sm" aria-label="File only">
          <p className="font-medium text-primary">{p.printer ? `${p.printer.name} has no connection from here` : "Choose a printer"}: take the file to it</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-secondary">{FILE_ONLY_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={`/api/files/${p.download.gcodeFileId}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download className="h-3.5 w-3.5" aria-hidden /> Download G-code</a>
            {p.download.projectFileId != null && <a href={`/api/files/${p.download.projectFileId}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Download className="h-3.5 w-3.5" aria-hidden /> Download sliced .3mf</a>}
          </div>
        </Card>
      )}

      {d.sentAt && <p className="font-mono text-[11px] text-muted">Sent {dt(d.sentAt)} as {d.sentName}{d.startedAt ? ` · started ${dt(d.startedAt)}` : ""}</p>}

      {resultOpen && (
        <ResultForm projectId={projectId} data={d} busy={act.result.isPending} onSave={async (v) => { await act.result.mutateAsync(v); }} />
      )}
      {d.result && !resultOpen && (
        <p className="text-sm text-secondary">
          Result: <span className="text-primary">{d.result.outcome}</span>
          {d.result.actualSeconds != null ? ` · ${duration(d.result.actualSeconds)}` : ""}{d.result.actualG != null ? ` · ${d.result.actualG} g` : ""}
          {d.result.photoFileIds.length ? ` · ${d.result.photoFileIds.length} photo${d.result.photoFileIds.length === 1 ? "" : "s"}` : ""}
          {d.result.notes ? ` · ${d.result.notes}` : ""}
        </p>
      )}

      <Modal
        open={!!pending}
        onOpenChange={(o) => { if (!o && !busy) setPending(null); }}
        title={pending?.kind === "send" ? "Send this file to the printer?" : pending?.kind === "start" ? "Start this print?" : "Cancel this print?"}
        description={pending?.kind === "start" ? "The printer will start moving." : pending?.kind === "cancel" ? "The print stops and cannot be resumed." : "The file is copied to the printer. Nothing starts yet."}
      >
        <dl className="space-y-2 text-sm">
          <div><dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Printer</dt><dd className="font-medium text-primary">{pending?.printer}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">File</dt><dd className="break-all font-mono text-primary">{pending?.file}</dd></div>
        </dl>
        {err ? <div className="mt-3"><ErrorLine>{err}</ErrorLine></div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>Back</Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            <Printer className="h-4 w-4" aria-hidden />
            {pending?.kind === "send" ? `Send to ${pending.printer}` : pending?.kind === "start" ? `Start on ${pending.printer}` : "Cancel the print"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
