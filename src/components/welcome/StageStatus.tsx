// Where the worked example stands: one row of the seven stages, each with the count of its gate's checks that are
// met, worked out by the app's own gate rules on the example's rows (exampleData.ts, the data the status board
// used). What is still open is behind a disclosure, stage by stage, each open check with what the rule found.
// Nothing here is typed: a stage with every check met says so, and none does today.
import { ChevronRight } from "lucide-react";
import type { ExampleGate } from "./exampleData";
import { GATES_NOTE, PROOF, STAGES } from "./content";

export function StageStatus({ gates }: { gates: Record<string, ExampleGate> }) {
  const rows = STAGES.map((s) => ({ ...s, gate: gates[s.name.toLowerCase()] ?? { met: 0, total: 0, checks: [] } }));
  const open = rows.reduce((n, r) => n + (r.gate.total - r.gate.met), 0);
  return (
    <div>
      <ol aria-label={PROOF.status.label} className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-[var(--border-hairline)] sm:grid-cols-4 lg:grid-cols-7">
        {rows.map((r) => (
          <li key={r.n} className="bg-surface px-3.5 py-3 last:col-span-2 lg:last:col-span-1">
            <p className="font-mono text-[11px] text-link">{r.n}</p>
            <p className="mt-0.5 text-sm font-semibold text-primary">{r.name}</p>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-secondary">{PROOF.status.count(r.gate.met, r.gate.total)}</p>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-subtle" aria-hidden>
              <span className="block h-full rounded-full bg-dutchOrange" style={{ width: `${r.gate.total ? Math.round((r.gate.met / r.gate.total) * 100) : 0}%` }} />
            </span>
          </li>
        ))}
      </ol>

      {open === 0 ? (
        <p className="mt-3 text-sm text-secondary">{PROOF.status.none}</p>
      ) : (
        <details className="group mt-3 rounded-xl border border-hairline bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
            {PROOF.status.open(open)}
          </summary>
          <div className="border-t border-hairline px-4 pb-4 pt-3">
            <p className="max-w-[80ch] text-[13px] leading-relaxed text-muted">{GATES_NOTE}</p>
            <dl className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2">
              {rows
                .filter((r) => r.gate.met < r.gate.total)
                .map((r) => (
                  <div key={r.n}>
                    <dt className="text-sm font-semibold text-primary">
                      <span className="font-mono text-[11px] font-normal text-link">{r.n}</span> {r.name}
                    </dt>
                    <dd className="mt-1.5">
                      <ul className="space-y-1.5">
                        {r.gate.checks
                          .filter((c) => !c.met)
                          .map((c) => (
                            <li key={c.id} className="text-[13px] leading-snug text-secondary">
                              <span className="text-primary">{c.label}.</span> {c.detail}
                            </li>
                          ))}
                      </ul>
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </details>
      )}
    </div>
  );
}
