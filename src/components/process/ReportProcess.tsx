"use client";

// The process state on the Report page (and so in a print of it): the current stage, each stage's gate result,
// every override with its reason and who made it, and each build with the evidence it rests on.
import { useProcess } from "@/lib/process/client";
import { useItems } from "@/lib/client";
import { STORE } from "@/lib/domain/schemas";
import { buildProgress, PASSED } from "@/lib/trace/builds";
import { fmtDateTime } from "@/lib/format";
import { skippedSentence } from "@/lib/process/evaluate";
import { LoadError, LoadingShape } from "@/components/ui/states";

const H2 = "mt-10 scroll-mt-6 border-b border-hairline pb-2 text-xl font-semibold tracking-tight text-primary";
const H3 = "mt-6 text-sm font-semibold tracking-tight text-primary";

export function ReportProcess({ projectId }: { projectId: string }) {
  const { view, loading, error, retry } = useProcess(projectId);
  const builds = useItems(projectId, STORE.builds);
  const tests = useItems(projectId, STORE.tests);

  return (
    <section aria-labelledby="report-process-h" data-testid="report-process">
      <h2 id="report-process-h" className={H2}>
        <span className="mr-3 font-mono text-[11px] font-normal uppercase tracking-[0.2em] text-link">Process</span>
        Stages, gates and builds
      </h2>
      {loading || builds.loading || tests.loading ? (
        <LoadingShape className="mt-3 h-16 animate-pulse rounded-xl bg-subtle" label="Loading the process state">{null}</LoadingShape>
      ) : error || !view ? (
        <div className="mt-3"><LoadError what="The process state" message={error || "no answer"} onRetry={retry} /></div>
      ) : (
        <>
          <p className="mt-2 max-w-4xl text-sm text-secondary">
            Current stage: <span className="font-medium text-primary">{view.current.label}</span>. {view.current.goal}
          </p>
          {view.skipped.length > 0 && (
            <p className="mt-2 max-w-4xl text-sm text-warning" role="status">
              {view.skipped.map((s) => skippedSentence(s)).join(" ")}
            </p>
          )}

          <h3 className={H3}>Gate by gate</h3>
          <ul className="mt-2 divide-y divide-hairline rounded-xl border border-hairline">
            {view.stages.map((s) => {
              const open = s.result.checks.filter((c) => !c.met);
              const outcome = s.overridden ? "Overridden" : s.passed ? "Passed" : s.position === "upcoming" ? "Not reached" : "Not passed";
              return (
                <li key={s.key} className="px-4 py-2.5 text-sm" data-testid={`report-gate-${s.key}`}>
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-primary">{s.n}. {s.label}{s.position === "current" ? " (current)" : ""}</span>
                    <span className="font-mono text-xs text-secondary">{outcome} · {s.result.checks.length - open.length} of {s.result.checks.length} checks met</span>
                  </p>
                  {!s.passed && open.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-secondary">
                      {open.map((c) => <li key={c.id}>{c.label}: {c.detail}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <h3 className={H3}>Overrides</h3>
          {view.stages.some((s) => s.overridden) ? (
            <ul className="mt-2 space-y-2 text-sm">
              {view.stages.filter((s) => s.overridden).map((s) => (
                <li key={s.key} className="rounded-xl border border-hairline px-4 py-2.5">
                  <p className="font-medium text-primary">{s.label} gate overridden</p>
                  <p className="mt-0.5 text-secondary wrap-anywhere"><span className="font-medium text-primary">Why:</span> {s.record?.note || "No reason recorded"}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {s.record?.decidedBy ? `by ${s.record.decidedBy}` : "by someone not recorded"}
                    {s.record?.decidedAt ? ` · ${fmtDateTime(s.record.decidedAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm italic text-muted">No gate has been overridden.</p>
          )}

          <h3 className={H3}>Builds and their evidence</h3>
          {builds.items.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {builds.items.map((b) => {
                const p = buildProgress(b, tests.items);
                const reverted = typeof b.data.revertedBecause === "string" ? b.data.revertedBecause : "";
                return (
                  <li key={b.id} className="rounded-xl border border-hairline px-4 py-2.5" data-testid={`report-build-${b.id}`}>
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-primary">{b.title}</span>
                      <span className="font-mono text-xs text-secondary">{b.status}</span>
                    </p>
                    <p className="mt-0.5 text-secondary">
                      {p.met} of {p.criteria.length} exit criteria met; {p.testsDone} of {p.linked.length} linked tests passed.
                      {b.status === PASSED && p.blockers.length > 0 ? " Marked passed, but the evidence no longer supports it." : ""}
                    </p>
                    {p.blockers.length > 0 && b.status !== PASSED && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-secondary">{p.blockers.map((x) => <li key={x}>{x}</li>)}</ul>
                    )}
                    {reverted && <p className="mt-1 text-xs text-warning wrap-anywhere">Sent back to testing: {reverted}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm italic text-muted">No builds recorded.</p>
          )}
        </>
      )}
    </section>
  );
}
