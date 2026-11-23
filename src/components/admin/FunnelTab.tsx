"use client";

// Admin, Funnel: the welcome page's first-party counts (src/lib/events/store.ts), per UTC day and in total for a
// chosen range, and by referrer and campaign. A visit counts once per step. Plain tables; no chart library.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, describe } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadError, LoadingBlocks, SavedNote, useFlag } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { useFunnel, useSaveRetention } from "@/lib/admin/earlyAccessClient";
import type { FunnelCounts } from "@/lib/events/shared";

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => day(new Date(Date.now() - n * 86_400_000));

const STEPS: { key: keyof FunnelCounts; label: string }[] = [
  { key: "visits", label: "Visits" },
  { key: "reachedPricing", label: "Reached pricing" },
  { key: "startedForm", label: "Started form" },
  { key: "sentForm", label: "Sent form" },
  { key: "claimedPlace", label: "Claimed place" },
];

/** A step as a share of visits, one decimal; a dash with no visits. */
const share = (n: number, visits: number) => (visits > 0 ? `${((n / visits) * 100).toFixed(1)}%` : "–");

function CountCells({ c }: { c: FunnelCounts }) {
  return (
    <>
      {STEPS.map((s) => (
        <TableCell key={s.key} className="text-right font-mono text-sm tabular-nums">
          {c[s.key]}
          {s.key !== "visits" ? <span className="ml-1.5 text-xs text-muted">{share(c[s.key], c.visits)}</span> : null}
        </TableCell>
      ))}
    </>
  );
}

function StepHeads() {
  return (
    <>
      {STEPS.map((s) => (
        <TableHead key={s.key} className="text-right">
          {s.label}
        </TableHead>
      ))}
    </>
  );
}

export function FunnelTab() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(day(new Date()));
  const report = useFunnel(from, to);
  const preset = (n: number) => {
    setFrom(daysAgo(n - 1));
    setTo(day(new Date()));
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Funnel"
        description="Visits to the public welcome page, counted on this server and stored in this install's database; nothing is sent to anyone else. A visit is one browser session. Browsers that ask not to be tracked and known crawlers are not counted. Days are UTC. Percentages are shares of visits."
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field id="funnel-from" label="From">
            <Input id="funnel-from" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field id="funnel-to" label="To">
            <Input id="funnel-to" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-40" />
          </Field>
          <div className="flex gap-2 pb-0.5">
            {[7, 30, 90].map((n) => (
              <Button key={n} type="button" size="sm" variant="outline" onClick={() => preset(n)}>
                Last {n} days
              </Button>
            ))}
          </div>
        </div>
      </Panel>

      {report.isPending ? (
        <LoadingBlocks rows={3} label="Counting the funnel" />
      ) : report.isError ? (
        <LoadError what="The funnel" message={messageOf(report.error)} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <Panel title="Per day" description={`${report.data.from} to ${report.data.to}.`}>
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <Table aria-label="Funnel per day">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Day</TableHead>
                    <StepHeads />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.days.map((d) => (
                    <TableRow key={d.day}>
                      <TableCell className="font-mono text-xs text-secondary">{d.day}</TableCell>
                      <CountCells c={d} />
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-hairline font-semibold" data-testid="funnel-total">
                    <TableCell className="text-sm text-primary">Total</TableCell>
                    <CountCells c={report.data.total} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Panel>

          <Panel title="By source" description="Each visit by the referrer and campaign (utm_campaign) of its first page view. A form sent without script has no visit and shows with no source.">
            {report.data.bySource.length === 0 ? (
              <EmptyState>No visits in this range.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-hairline">
                <Table aria-label="Funnel by source">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Referrer</TableHead>
                      <TableHead>Campaign</TableHead>
                      <StepHeads />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.bySource.map((s) => (
                      <TableRow key={`${s.referrer}|${s.campaign}`}>
                        <TableCell className="text-sm wrap-anywhere">{s.referrer || <span className="text-muted">Direct or unknown</span>}</TableCell>
                        <TableCell className="text-sm wrap-anywhere">{s.campaign || <span className="text-muted">None</span>}</TableCell>
                        <CountCells c={s} />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>

          <RetentionForm days={report.data.retentionDays} />
        </>
      )}
    </div>
  );
}

function RetentionForm({ days }: { days: number }) {
  const save = useSaveRetention();
  const [text, setText] = useState(String(days));
  const [error, setError] = useState("");
  const [saved, markSaved] = useFlag();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d+$/.test(text.trim()) || Number(text) < 1 || Number(text) > 3650) {
      setError("Enter a whole number of days from 1 to 3650.");
      return;
    }
    try {
      await save.mutateAsync(Number(text));
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setError(m);
      toast.error(m);
    }
  };
  return (
    <Panel title="Keep events" description="Events older than this are deleted. Default 180 days.">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-wrap items-end gap-3" aria-label="How long events are kept">
        <Field id="funnel-retention" label="Days" error={error || undefined}>
          <Input id="funnel-retention" inputMode="numeric" className="w-28" value={text} onChange={(e) => setText(e.target.value)} {...describe("funnel-retention", { error: error || undefined })} />
        </Field>
        <Button type="submit" size="sm" disabled={save.isPending} className={error ? "mb-5" : undefined}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <SavedNote show={saved} />
      </form>
    </Panel>
  );
}
