"use client";

// The Printers panel of Prototype, 3D printing (plan 6, status panel): one card per printer switched on in Admin, Printers, with its live
// state, the file, progress, time left and temperatures, a Test button, and pause, resume and cancel. Cancel asks first and names the
// printer and the file. Polled every 10 seconds; the server backs off a printer that does not answer and says when it tries again.
// Bambu printers push their state over MQTT; the poll reads what the server holds.
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorLine } from "@/components/parts/controls";
import { ConfirmButton, TestOutcome } from "@/components/admin/shared";
import { useConnectionTest } from "@/lib/admin/client";
import { messageOf, queries } from "@/lib/queries";
import { cancelPrint, controlPrinter, printerFetchers, printerKeys, type PrinterReading } from "@/lib/printers/client";
import { findModelFor } from "@/lib/printers/modelLookup";
import { FileOnlyGuide } from "./FileOnlyGuide";
import { minutesText, STATE_LABEL, STATE_TONE, tempText } from "./format";

const POLL_MS = 10_000;
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-[7rem_1fr]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-primary">{children}</dd>
    </div>
  );
}

function Reading({ r }: { r: PrinterReading }) {
  const s = r.status!;
  const temps = [s.temperatures.nozzle ? `Nozzle ${tempText(s.temperatures.nozzle)}` : null, s.temperatures.bed ? `bed ${tempText(s.temperatures.bed)}` : null, s.temperatures.chamber ? `chamber ${tempText(s.temperatures.chamber)}` : null].filter(Boolean);
  const active = s.state === "printing" || s.state === "paused";
  return (
    <div className="space-y-2">
      <dl className="space-y-1">
        <Row label="File">{s.file ? <span className="break-all">{s.file}</span> : <span className="text-secondary">none</span>}</Row>
        {active ? (
          <Row label="Progress">
            <span className="font-mono">{s.progress != null ? `${s.progress.toFixed(1)}%` : "not reported"}</span>
            {s.secondsLeft != null ? <span className="text-secondary">{`, about ${minutesText(s.secondsLeft)} left${s.secondsLeftEstimated ? " (estimated here)" : ""}`}</span> : null}
          </Row>
        ) : null}
        {temps.length ? <Row label="Heat"><span className="font-mono text-xs">{temps.join(", ")}</span></Row> : null}
      </dl>
      {active && s.progress != null ? (
        <div role="progressbar" aria-label={`Print progress on ${r.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress)} className="h-2 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-dutchOrange transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }} />
        </div>
      ) : null}
      {s.message ? <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">{s.message}</p> : null}
    </div>
  );
}

function Card({ r }: { r: PrinterReading }) {
  const qc = useQueryClient();
  const test = useConnectionTest();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const model = findModelFor(r.model);
  const fileOnly = !r.capabilities.status && !r.capabilities.start;
  const state = r.status?.state;

  const control = useMutation({
    mutationFn: (a: "pause" | "resume" | "cancel") => (a === "cancel" ? cancelPrint(r.printerId) : controlPrinter(r.printerId, a)),
    onSuccess: (res) => {
      setErr("");
      setNote(res.message);
      void qc.invalidateQueries({ queryKey: printerKeys.statuses() });
    },
    onError: (e) => {
      setNote("");
      setErr(messageOf(e));
      toast.error(messageOf(e));
    },
  });

  const certificate = r.family === "bambu" ? r.capabilities.notes.find((n) => /certificate/i.test(n)) : undefined;
  return (
    <li className="space-y-3 rounded-xl border border-hairline bg-surface p-4" data-testid={`printer-card-${r.printerId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-primary">{r.name}</h3>
          <p className="mt-0.5 text-xs text-secondary">
            {r.familyLabel}
            {r.model ? `, ${r.model}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {r.experimental ? <StatusBadge tone="warning" title="Built from the maker's or the community's documentation and not confirmed on this model. Use the Test button.">Experimental</StatusBadge> : null}
          {fileOnly ? <StatusBadge tone="neutral">Prints by hand</StatusBadge> : r.ok && state ? <StatusBadge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</StatusBadge> : !r.ok ? <StatusBadge tone="danger">Not answering</StatusBadge> : null}
        </div>
      </div>

      <div aria-live="polite" className="text-sm">
        {fileOnly ? (
          <FileOnlyGuide printerName={r.name} model={model} />
        ) : r.ok && r.status ? (
          <Reading r={r} />
        ) : (
          <div className="space-y-1">
            <ErrorLine>{r.error ?? "The printer did not answer."}</ErrorLine>
            {r.retryInSeconds ? <p className="text-xs text-muted">The server asks it again in {r.retryInSeconds} s. It waits longer after each miss, up to a minute.</p> : null}
          </div>
        )}
      </div>

      {!fileOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          {r.capabilities.pause && state === "printing" ? (
            <Button type="button" variant="outline" size="sm" disabled={control.isPending} onClick={() => control.mutate("pause")}>
              <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
            </Button>
          ) : null}
          {r.capabilities.resume && state === "paused" ? (
            <Button type="button" variant="outline" size="sm" disabled={control.isPending} onClick={() => control.mutate("resume")}>
              <Play className="h-3.5 w-3.5" aria-hidden /> Resume
            </Button>
          ) : null}
          {r.capabilities.cancel && (state === "printing" || state === "paused") ? (
            <ConfirmButton
              label="Cancel print"
              title={`Cancel the print on ${r.name}?`}
              body={`${r.status?.file ? `"${r.status.file}" stops where it is. ` : "The print stops where it is. "}A cancelled print cannot be resumed, and the line goes into the audit log.`}
              confirmLabel="Cancel the print"
              disabled={control.isPending}
              onConfirm={() => control.mutate("cancel")}
            />
          ) : null}
          <Button type="button" variant="ghost" size="sm" disabled={test.isPending} onClick={() => test.mutate({ kind: "printer", id: r.printerId })}>
            Test the connection
          </Button>
          {r.capabilities.pushedStatus ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Radio className="h-3 w-3" aria-hidden /> Status is pushed by the printer
            </span>
          ) : null}
          <span className="ml-auto text-xs text-muted">{timeOf(r.checkedAt) ? `Read at ${timeOf(r.checkedAt)}` : ""}</span>
        </div>
      ) : null}

      {note ? <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{note}</p> : null}
      {err ? <ErrorLine>{err}</ErrorLine> : null}
      <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />

      {certificate ? <p className="text-xs text-muted">{certificate}</p> : null}
      {!fileOnly && r.capabilities.notes.length ? (
        <details className="text-xs text-secondary">
          <summary className="cursor-pointer text-muted hover:text-primary">About this connection</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {r.capabilities.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/** The old single-printer reading from the environment (PRINTER_KIND), shown only while no printer is saved in Admin. */
function EnvPrinter() {
  const p = useQuery(queries.printer()).data;
  if (!p?.configured) return null;
  return (
    <p className="text-sm text-secondary">
      A printer is set in the server&apos;s environment ({p.kind}): {p.error ? p.error : `${p.state ?? "state unknown"}${p.file ? `, ${p.file}` : ""}${p.progress != null ? `, ${p.progress.toFixed(1)}%` : ""}`}. Add it in{" "}
      <Link href="/admin?tab=printers" className="text-link underline underline-offset-2">Admin, Printers</Link> to control it here.
    </p>
  );
}

export function PrintersPanel() {
  const list = useQuery({
    queryKey: printerKeys.statuses(),
    queryFn: ({ signal }) => printerFetchers.statuses({ signal }),
    refetchInterval: (q) => {
      const failing = (q.state.data ?? []).filter((p) => !p.ok && p.retryInSeconds).map((p) => p.retryInSeconds! * 1000);
      return failing.length && failing.length === (q.state.data ?? []).length ? Math.max(POLL_MS, Math.min(...failing)) : POLL_MS;
    },
  });
  const empty = list.isSuccess && list.data.length === 0;

  return (
    <section aria-labelledby="printers-h" className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="printers-h" className="text-base font-semibold tracking-tight text-primary">Printers</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Refreshes every 10 s</span>
      </div>
      <div className="mt-3 space-y-3">
        {list.isError ? (
          <div className="space-y-2">
            <ErrorLine>{messageOf(list.error)}</ErrorLine>
            <Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>Try again</Button>
          </div>
        ) : list.isPending ? (
          <p className="text-sm text-secondary" role="status">Reading the printers.</p>
        ) : empty ? (
          <div className="space-y-2 text-sm text-secondary">
            <p className="flex items-center gap-2"><StatusBadge tone="neutral">No printer yet</StatusBadge></p>
            <p>
              Add a printer in <Link href="/admin?tab=printers" className="text-link underline underline-offset-2">Admin, Printers</Link>, choosing it from the{" "}
              <Link href="/printers" className="text-link underline underline-offset-2">list of supported printers</Link>. A printer that is not on the list, or has no connection, still works: you download the file and print by hand.
            </p>
            <EnvPrinter />
          </div>
        ) : (
          <ul className="space-y-3">
            {list.data.map((r) => (
              <Card key={r.printerId} r={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

