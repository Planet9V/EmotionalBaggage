"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { useItems } from "@/lib/client";
import { keys } from "@/lib/queries";
import { useProcess } from "@/lib/process/client";
import { isDay, formatDay } from "@/lib/campaigns/days";
import { byPhase, isLaunchRow, isStepRow, progress, schedule, toLaunch, toStep, type LaunchRow, type Scheduled } from "@/lib/campaigns/launch";
import { LAUNCH_STORE } from "@/lib/campaigns/schemas";
import { CHECK_PROMPT, TEMPLATES } from "@/lib/campaigns/templates";
import { statusTone } from "@/lib/statusTones";
import type { ViewProps } from "@/components/views/types";
import { startLaunch } from "./hooks";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { todayUtc } from "@/lib/format";

export function LaunchView({ project, section }: ViewProps) {
  const { items, loading, error, reload, patch, remove } = useItems(project.id, LAUNCH_STORE);
  const builds = useItems(project.id, "prototype/builds").items;
  const process = useProcess(project.id);
  const qc = useQueryClient();
  const [tpl, setTpl] = useState(TEMPLATES[0].id);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const statuses = section.statuses ?? [];

  const launches = useMemo(() => items.filter(isLaunchRow).map(toLaunch), [items]);
  const steps = useMemo(() => items.filter(isStepRow).map(toStep), [items]);
  const today = todayUtc();
  const ctx = useMemo(
    () => ({
      gate: (stage: string) => process.view?.stages.find((s) => s.key === stage)?.passed ?? null,
      buildStatus: (id: number) => builds.find((b) => b.id === id)?.status ?? null,
      buildName: (id: number) => builds.find((b) => b.id === id)?.title ?? `#${id}`,
      today,
    }),
    [process.view, builds, today]
  );

  if (loading) return <LoadingBlocks label="Loading the launch plan" />;
  if (error && !items.length) return <LoadError what="The launch plan" message={error} onRetry={() => void reload()} />;

  const chosen = TEMPLATES.find((t) => t.id === tpl) ?? TEMPLATES[0];
  const start = async () => {
    setErr("");
    if (!isDay(date)) return setErr("Pick the launch date first. Every step's due date is counted back from it.");
    setBusy(true);
    try {
      await startLaunch(project.id, { template: chosen.id, launchDate: date, title: title.trim() || undefined });
      setDate("");
      setTitle("");
      await qc.invalidateQueries({ queryKey: keys.itemsOf(project.id) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteLaunch = async (l: LaunchRow) => {
    if (!window.confirm(`Delete the launch "${l.title}" and its ${steps.filter((s) => s.launch === l.launchKey).length} steps?`)) return;
    setErr("");
    try {
      for (const s of steps.filter((x) => x.launch === l.launchKey)) await remove(s.id);
      await remove(l.id);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-4 p-4">
        <div>
          <h2 id="launch-template" tabIndex={-1} className="text-sm font-semibold text-primary">Start a launch from a template</h2>
          <p className="mt-1 text-sm text-secondary">
            A template is a dated checklist for one way of launching. Pick one and the date you want to launch, and every step gets a due date counted back from it. The steps are yours to change afterwards.
          </p>
        </div>
        <fieldset>
          <legend className="sr-only">Template</legend>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.map((t) => (
              <label key={t.id} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${tpl === t.id ? "border-dutchOrange bg-subtle" : "border-hairline"}`}>
                <input type="radio" name="template" value={t.id} checked={tpl === t.id} onChange={() => setTpl(t.id)} className="mt-1 accent-dutchOrange" />
                <span>
                  <span className="block font-medium text-primary">{t.label}</span>
                  <span className="block text-xs text-secondary">{t.steps.length} steps. {t.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void start(); }}>
          <Field label="Launch date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" /></Field>
          <Field label="Name (optional)" className="min-w-56 flex-1"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${chosen.label} launch`} /></Field>
          <Button type="submit" disabled={busy}>{busy ? "Starting" : `Start the ${chosen.label} launch`}</Button>
        </form>
        {err && <ErrorLine>{err}</ErrorLine>}
      </Card>

      {launches.length === 0 ? (
        <EmptyState title="No launch started yet">Pick a template and a launch date above. Nothing is posted or bought by a step: the steps are a checklist for you.</EmptyState>
      ) : (
        launches.map((l) => {
          const list = schedule(l, steps, ctx);
          const p = progress(list);
          return (
            <section key={l.id} aria-label={l.title} className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-primary">{l.title}</h2>
                  <p className="text-sm text-secondary" data-testid="launch-summary">
                    {l.launchDate ? `Launch day ${formatDay(l.launchDate)}.` : "No launch date."} {p.done} of {p.total} steps done.
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <Field label="Launch date">
                    <Input
                      type="date"
                      value={l.launchDate}
                      className="w-44"
                      onChange={(e) => { if (isDay(e.target.value)) void patch(l.id, { data: { launchDate: e.target.value } }).catch((x: Error) => setErr(x.message)); }}
                    />
                  </Field>
                  <Button variant="ghost" size="sm" onClick={() => void deleteLaunch(l)} aria-label={`Delete ${l.title}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</Button>
                </div>
              </div>
              {list.length === 0 && <p className="text-sm text-secondary">This launch has no steps.</p>}
              {byPhase(list).map((g) => (
                <div key={g.phase} className="space-y-2">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{g.phase}</h3>
                  <ul className="space-y-2">
                    {g.steps.map((s) => <StepCard key={s.id} s={s} projectId={project.id} statuses={statuses} onStatus={(status) => void patch(s.id, { status }).catch((x: Error) => setErr(x.message))} />)}
                  </ul>
                </div>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}

const work = (min: number) => {
  if (min < 60) return `${min} minutes`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${h} ${h === 1 ? "hour" : "hours"}`;
};

function StepCard({ s, projectId, statuses, onStatus }: { s: Scheduled; projectId: string; statuses: string[]; onStatus: (status: string) => void }) {
  const due = s.due ? formatDay(s.due) : "No date";
  const when = s.daysAway === null || s.closed ? "" : s.daysAway < 0 ? `${-s.daysAway} ${-s.daysAway === 1 ? "day" : "days"} overdue` : s.daysAway === 0 ? "due today" : `in ${s.daysAway} ${s.daysAway === 1 ? "day" : "days"}`;
  return (
    <li className={`rounded-lg border bg-surface p-3 text-sm ${s.blockers.length || s.conflicts.length ? "border-warning" : "border-hairline"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-medium wrap-anywhere ${s.closed ? "text-secondary line-through" : "text-primary"}`}>{s.title}</p>
          <p className="mt-0.5 text-xs text-secondary">
            {due}{when ? `, ${when}` : ""}
            {s.owner ? `. ${s.owner}` : ""}
            {s.minutes ? `. About ${work(s.minutes)} of work` : ""}
            {s.after.length ? `. After: ${s.after.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
          <RowActions item={{ id: s.id, projectId, section: "marketing/launch", title: s.title, body: s.why ?? "" }} />
          <label className="sr-only" htmlFor={`step-${s.id}`}>Status of {s.title}</label>
          <NativeSelect id={`step-${s.id}`} value={s.status} onChange={(e) => onStatus(e.target.value)} className="h-8 w-32 px-2 text-xs">
            {[...new Set([...statuses, s.status])].map((x) => <option key={x}>{x}</option>)}
          </NativeSelect>
        </div>
      </div>
      {s.blockers.map((b, i) => (
        <p key={i} role="status" className="mt-2 flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {b.text}</p>
      ))}
      {s.conflicts.length > 0 && (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> This is due before {s.conflicts.join(", ")}, which it waits on. Move one of the dates.</p>
      )}
      {(s.why || s.how) && (
        <details className="mt-2 text-xs text-secondary">
          <summary className="cursor-pointer font-medium">Why and how</summary>
          {s.why && <p className="mt-1"><strong className="text-primary">Why:</strong> {s.why}</p>}
          {s.how && <p className="mt-1"><strong className="text-primary">How:</strong> {s.how}</p>}
        </details>
      )}
      {s.source ? (
        <p className="mt-2 text-xs">
          <a href={s.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link underline">Platform rule source <ExternalLink className="h-3 w-3" aria-hidden /></a>
        </p>
      ) : s.check ? (
        <p className="mt-2 text-xs text-warning">{CHECK_PROMPT}</p>
      ) : null}
      <StatusBadge tone={statusTone(s.status)} className="sr-only">{s.status}</StatusBadge>
    </li>
  );
}
