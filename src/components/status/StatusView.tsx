"use client";

// The status page (/status): where the open concept stands between idea and sale, what is done, what is blocking
// and what to do next, on one screen. Everything on it is worked out by derive.ts from the Process page's own
// gate view and the concept's rows (the same queries, so a saved row changes it at once); it holds no figure of
// its own. The open concept is the sidebar's choice, kept in the browser, so the page reads in the browser as its
// neighbours (Overview, Process, Report) do.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, CircleAlert, GitFork, ListChecks, LockOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CheckList } from "@/components/process/CheckList";
import { focusHash } from "@/components/process/DeepLinkFocus";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LoadError, LoadingShape, NoConcept } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/lib/client";
import { useProcess } from "@/lib/process/client";
import { queries } from "@/lib/queries";
import { fmtDateTime, plural } from "@/lib/format";
import type { StatusTone } from "@/lib/statusTones";
import type { EventRow, Item, Project } from "@/lib/types";
import { StageRail } from "./StageRail";
import { STATUS_WORD, statusModel, type Action, type Figure, type OpenDecision, type StageCard, type StageStatus } from "./derive";

const TONE: Record<StageStatus, StatusTone> = { passed: "success", blocked: "danger", "in-progress": "info", "not-started": "neutral" };
const H2 = "text-base font-semibold tracking-tight text-primary";
const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
const NO_ROWS: Item[] = [];

export function StatusView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Whole concept" title="Status" nextStep={false} />
        <div className="px-4 py-6 sm:px-8">
          <NoConcept loading={loading} />
        </div>
      </>
    );
  }
  return <Body key={project.id} project={project} />;
}

function Body({ project }: { project: Project }) {
  const { view, loading, error, retry } = useProcess(project.id);
  const rowsQ = useQuery(queries.items(project.id, null));
  const eventsQ = useQuery(queries.events(project.id));
  const rows = rowsQ.data ?? NO_ROWS;
  const model = useMemo(() => (view ? statusModel(view, rows) : null), [view, rows]);

  return (
    <>
      <PageHeader
        eyebrow={`Whole concept · ${project.name}`}
        title="Status"
        blurb="Where the concept stands between idea and sale: each stage's gate as the Process page checks it, what is blocking, and what to do next."
        nextStep={false}
      >
        <Link href="/process" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-link">
          <ListChecks className="h-4 w-4" aria-hidden /> Process
        </Link>
        <Link href="/plan" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-link">
          <GitFork className="h-4 w-4" aria-hidden /> Order of operations
        </Link>
      </PageHeader>

      <div className="space-y-8 px-4 py-6 sm:px-8">
        {loading ? (
          <LoadingShape label="Working out the status" className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </LoadingShape>
        ) : error || !view || !model ? (
          <LoadError what="The status" message={error || "no answer"} onRetry={retry} />
        ) : (
          <>
            <Position model={model} />
            <Figures figures={model.figures} />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <NextActions actions={model.actions} />
              <Decisions decisions={model.decisions} />
            </div>
            <Gates stages={model.stages} />
            <Activity events={eventsQ.data} loading={eventsQ.isPending} error={!!eventsQ.error} />
          </>
        )}
      </div>
    </>
  );
}

/** Where it is: the headline, the rail and the one thing to do now. */
function Position({ model }: { model: ReturnType<typeof statusModel> }) {
  const first = model.actions[0];
  return (
    <section aria-labelledby="position-h" className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-subtle px-4 py-2 sm:px-5">
        <span className={EYEBROW}>Idea to sale</span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {model.passedCount} of {plural(model.stages.length, "gate")} passed
        </span>
      </div>
      <div className="grid gap-5 px-4 pb-5 pt-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">
            Stage {String(model.current.n).padStart(2, "0")} of {String(model.stages.length).padStart(2, "0")}
          </p>
          <h2 id="position-h" className="mt-1 text-2xl font-semibold tracking-tight text-primary sm:text-[28px]">
            {model.headline}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-secondary">{model.subline}</p>
        </div>
        {first && (
          <div className="min-w-0 lg:max-w-sm">
            <p className={EYEBROW}>Do next</p>
            <Link
              href={first.href}
              onClick={() => window.setTimeout(() => focusHash(new URL(first.href, window.location.href).hash), 50)}
              className="mt-1.5 inline-flex max-w-full items-start gap-1.5 rounded-md text-left bg-action px-3 py-2 text-sm font-medium text-white transition hover:bg-action-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange focus-visible:ring-offset-2"
            >
              <span className="min-w-0 wrap-anywhere">{first.label}</span> <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          </div>
        )}
      </div>
      <div className="border-t border-hairline px-3 py-4 sm:px-5 md:py-5">
        <StageRail stages={model.stages} currentKey={model.current.key} />
      </div>
    </section>
  );
}

function NextActions({ actions }: { actions: Action[] }) {
  return (
    <section aria-labelledby="actions-h">
      <h2 id="actions-h" className={H2}>Next actions</h2>
      <p className="mt-0.5 text-sm text-secondary">The current gate first, then the action that unblocks the most.</p>
      {actions.length ? (
        <ol className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {actions.map((a, i) => (
            <li key={a.label} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 px-4 py-3">
              <span className="pt-0.5 font-mono text-sm tabular-nums text-link" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <Link
                  href={a.href}
                  onClick={() => window.setTimeout(() => focusHash(new URL(a.href, window.location.href).hash), 50)}
                  className="text-sm font-medium text-primary underline-offset-2 hover:text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange wrap-anywhere"
                >
                  {a.label}
                </Link>
                <p className="mt-0.5 text-xs text-secondary">{a.why}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing is left to do: every gate is passed.</p>
      )}
    </section>
  );
}

function Gates({ stages }: { stages: StageCard[] }) {
  return (
    <section aria-labelledby="gates-h" className="space-y-3">
      <div>
        <h2 id="gates-h" className={H2}>Gate by gate</h2>
        <p className="mt-0.5 text-sm text-secondary">Each stage&apos;s checks, met and not met. A check not met links to the page that fixes it.</p>
      </div>
      <ol className="space-y-3">
        {stages.map((s) => (
          <GateRow key={s.key} stage={s} />
        ))}
      </ol>
    </section>
  );
}

function GateRow({ stage }: { stage: StageCard }) {
  const [open, setOpen] = useState(stage.position === "current" || stage.status === "blocked");
  const li = useRef<HTMLLIElement>(null);
  // a station of the rail links here: opening the address opens the stage and brings it into view
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash !== `#stage-${stage.key}`) return;
      setOpen(true);
      li.current?.querySelector<HTMLElement>("h3")?.focus();
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [stage.key]);
  const headId = `stage-${stage.key}-h`;
  const left = stage.total - stage.met;
  return (
    <li ref={li} id={`stage-${stage.key}`} className="scroll-mt-20 rounded-xl border border-hairline bg-surface" data-status={stage.status}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
          <span className="font-mono text-xs text-link" aria-hidden>{String(stage.n).padStart(2, "0")}</span>
          <h3 id={headId} tabIndex={-1} className="text-sm font-semibold text-primary focus:outline-hidden">{stage.label}</h3>
          <StatusBadge tone={TONE[stage.status]}>{STATUS_WORD[stage.status]}{stage.byOverride ? " by override" : ""}</StatusBadge>
          {stage.position === "current" && <StatusBadge tone="info" className="bg-transparent! border-info!">Current</StatusBadge>}
          <span className="font-mono text-[11px] tabular-nums text-muted">
            {stage.met} of {plural(stage.total, "check")} met
          </span>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            >
              {open ? "Hide checks" : left ? `Show checks (${left} not met)` : "Show checks"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
              <span className="sr-only"> for {stage.label}</span>
            </button>
          </CollapsibleTrigger>
        </div>
        {(stage.blockers.length > 0 || stage.waitsOn.length > 0) && (
          <div className="space-y-1.5 px-4 pb-3">
            {stage.blockers.map((b, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-danger">
                <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                <Link href={b.href} className="font-medium underline-offset-2 hover:underline wrap-anywhere">{b.text}</Link>
              </p>
            ))}
            {stage.waitsOn.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-secondary">
                <LockOpen className="mt-px h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  {stage.waitsOn.length === 1 ? "A decision that opens part of this stage is not made: " : `${stage.waitsOn.length} decisions that open parts of this stage are not made: `}
                  {stage.waitsOn.map((d, i) => (
                    <span key={d.key}>
                      {i > 0 && "; "}
                      <Link href={`/s/concept/decisions?item=${d.item.id}`} className="text-link hover:underline">{d.question}</Link>
                    </span>
                  ))}
                  .
                </span>
              </p>
            )}
          </div>
        )}
        <CollapsibleContent className="px-4 pb-4">
          <p className="mb-2 text-xs text-muted">{stage.goal}</p>
          <CheckList checks={stage.checks} labelledBy={headId} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function Figures({ figures }: { figures: Figure[] }) {
  return (
    <section aria-labelledby="figures-h">
      <h2 id="figures-h" className={H2}>Key figures</h2>
      {figures.length ? (
        <ul className="mt-3 flex flex-wrap gap-px overflow-hidden rounded-xl border border-hairline bg-[var(--border-hairline)]">
          {figures.map((f) => (
            <li key={f.key} className="min-w-[8rem] flex-1 basis-[8rem] bg-surface">
              <Link href={f.href} className="group block h-full px-3.5 py-3 transition-colors duration-150 hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dutchOrange">
                <span className={`${EYEBROW} block`}>{f.label}</span>
                <span className="mt-1 block font-mono text-lg font-semibold tabular-nums tracking-tight text-primary group-hover:text-link">{f.value}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-secondary">{f.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No figure yet: the unit cost, parts, claims and the rest appear here once there are rows to work them out from.</p>
      )}
    </section>
  );
}

function Decisions({ decisions }: { decisions: OpenDecision[] }) {
  return (
    <section aria-labelledby="decisions-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="decisions-h" className={H2}>Open decisions</h2>
        <Link href="/s/concept/decisions" className="text-xs text-secondary hover:text-link">Decision tree</Link>
      </div>
      {decisions.length ? (
        <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {decisions.map((d) => (
            <li key={d.key} className="px-3.5 py-2.5">
              <Link href={d.href} className="text-sm font-medium text-primary hover:text-link hover:underline">{d.question}</Link>
              <p className="mt-0.5 text-[11px] leading-snug text-secondary">
                {d.opens.length ? `Opens ${d.opens.join(", ")}.` : "Opens no section."}
                {d.ready ? "" : ` Waits for: ${d.waitsFor.join("; ")}${/[?.!]$/.test(d.waitsFor[d.waitsFor.length - 1] ?? "") ? "" : "."}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No decision is waiting.</p>
      )}
    </section>
  );
}

function Activity({ events, loading, error }: { events: EventRow[] | undefined; loading: boolean; error: boolean }) {
  const shown = (events ?? []).slice(0, 6);
  return (
    <section aria-labelledby="activity-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="activity-h" className={H2}>Recent activity</h2>
        <Link href="/activity" className="text-xs text-secondary hover:text-link">All activity</Link>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : error ? (
        <p className="mt-2 text-sm text-danger">The activity could not be loaded.</p>
      ) : shown.length ? (
        <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {shown.map((e) => (
            <li key={e.id} className="grid gap-x-4 px-3.5 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <p className="font-mono text-[10px] leading-5 text-muted">{fmtDateTime(e.createdAt)}</p>
              <p className="text-xs leading-snug text-secondary">{e.summary}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No activity recorded yet.</p>
      )}
    </section>
  );
}
