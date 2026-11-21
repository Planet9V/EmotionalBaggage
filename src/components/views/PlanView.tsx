"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { AddStepForm } from "@/components/plan/AddStepForm";
import { PlanGraph } from "@/components/plan/PlanGraph";
import { PlanTimeline } from "@/components/plan/PlanTimeline";
import { StepDetail, type ItemChange } from "@/components/plan/StepDetail";
import { usePlan } from "@/components/plan/usePlan";
import { useItems, useProject } from "@/lib/client";
import type { Project } from "@/lib/types";
import { fmtMinutes } from "@/lib/format";
import { NoConcept } from "@/components/ui/states";
import { Card } from "@/components/ui/Card";

export function PlanView() {
  const { project, loading } = useProject();
  if (!project) {
    return (
      <>
        <PageHeader eyebrow="Order of operations" title="Order of operations" />
        <NoConcept loading={loading} />
      </>
    );
  }
  return <PlanBody key={project.id} project={project} />;
}

function PlanBody({ project }: { project: Project }) {
  const { plan, error: planError, loading: planLoading, reload: reloadPlan } = usePlan(project.id);
  const { items, error: itemsError, reload: reloadItems, patch, add: addItem } = useItems(project.id, null);
  const [selected, setSelected] = useState<string | null>(null);
  const [writeError, setWriteError] = useState("");

  const refresh = async () => {
    await Promise.all([reloadItems(), reloadPlan()]);
  };

  // Each write refreshes the rows and the plan when it settles (see useItems).
  const save = async (itemId: number, change: ItemChange) => {
    setWriteError("");
    try {
      await patch(itemId, change);
    } catch (e) {
      setWriteError((e as Error).message);
    }
  };

  const add = async (it: { section: string; title: string; data: Record<string, unknown> }) => {
    await addItem(it);
  };

  const convert = async (itemId: number, data: Record<string, unknown>) => {
    await patch(itemId, { data });
  };

  const byKey = new Map(plan?.nodes.map((n) => [n.id, n]) ?? []);
  const step = selected ? byKey.get(selected) ?? null : null;
  const stepItem = step ? items.find((i) => i.id === step.itemId) : undefined;
  const hasSteps = !!plan && plan.nodes.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={project.name}
        title="Order of operations"
        blurb="Every row with a step key, in the order it can be done. Steps in the same wave can run in parallel; the critical path sets the total time."
      >
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Recompute
        </Button>
      </PageHeader>

      <div className="space-y-6 px-8 py-6">
        {(planError || itemsError || writeError) && (
          <div className="rounded-xl border border-hairline bg-danger-soft p-4 text-sm text-danger" role="alert">
            {planError && <p>The plan could not be loaded: {planError}</p>}
            {itemsError && <p>The rows could not be loaded: {itemsError}</p>}
            {writeError && <p>The change was not saved: {writeError}</p>}
          </div>
        )}

        {planLoading && !plan && <p className="text-sm text-secondary">Computing the order.</p>}

        {plan && (
          <p className="font-mono text-[11px] text-muted">
            {plan.engine === "networkx" ? (
              <span className="text-link">Computed by NetworkX</span>
            ) : (
              <>
                <span className="text-warning">No order worked out.</span> {plan.note ?? "The planner service did not answer."}
              </>
            )}
          </p>
        )}

        {plan && plan.cycles.length > 0 && (
          <div className="rounded-xl border border-danger bg-danger-soft p-5 text-danger" role="alert">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden /> These steps wait on each other in a loop, so no order exists for them.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {plan.cycles.map((cyc, i) => (
                <li key={i}>
                  {cyc.map((id) => `${byKey.get(id)?.title ?? id} (${id})`).join(", then ")}
                  {cyc.length > 1 && `, then back to ${byKey.get(cyc[0])?.title ?? cyc[0]}`}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">Open one of them and change what it waits on to break the loop.</p>
          </div>
        )}

        {plan && !hasSteps && (
          <Card variant="flat" className="p-6">
            <h2 className="text-base font-semibold tracking-tight text-primary">No steps yet</h2>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              A step is any row with a key, a duration in minutes and the steps it waits on. Add one below, or turn a row you
              already have, such as an assembly phase, into a step.
            </p>
          </Card>
        )}

        {plan && hasSteps && (
          <section className="animate-enter grid gap-6">
            <div className="min-w-0 space-y-3">
              <PlanGraph plan={plan} selectedId={selected} onSelect={setSelected} />
              <p className="font-mono text-[10px] text-muted">
                Click a step to edit it. <span className="text-link">Orange</span> marks the critical path.
              </p>
            </div>
            {step ? (
              <StepDetail
                key={`${step.id}:${step.minutes}:${step.after.join(",")}:${step.status}`}
                step={step}
                item={stepItem}
                steps={plan.nodes}
                onSave={save}
                onClose={() => setSelected(null)}
              />
            ) : (
              <aside className="rounded-xl border border-dashed border-hairline p-5 text-sm text-muted">
                Select a step in the graph or the list to see its detail, change its status, minutes or what it waits on.
              </aside>
            )}
          </section>
        )}

        {plan && hasSteps && (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold tracking-tight text-primary">Steps by wave</h2>
                <p className="font-mono text-xs text-secondary">
                  Total <span className="text-primary">{fmtMinutes(plan.totalMinutes)}</span>
                  <span className="text-muted"> ({plan.totalMinutes} min, {plan.nodes.length} steps)</span>
                </p>
              </div>
              <PlanTimeline plan={plan} selectedId={selected} onSelect={setSelected} />
            </div>
            <div className="space-y-6">
              <Card variant="flat" className="p-5">
                <h2 className="text-sm font-semibold tracking-tight text-primary">Critical path</h2>
                {plan.criticalPath.length ? (
                  <ol className="mt-3 space-y-2">
                    {plan.criticalPath.map((id, i) => {
                      const n = byKey.get(id);
                      return (
                        <li key={id} className="flex items-baseline gap-2 text-sm">
                          <span className="w-5 shrink-0 font-mono text-[10px] text-link">{i + 1}</span>
                          <button type="button" onClick={() => setSelected(id)} className="min-w-0 text-left text-secondary hover:text-link">
                            {n?.title ?? id}
                          </button>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">{n ? fmtMinutes(n.minutes) : ""}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-muted">No critical path: nothing could be scheduled.</p>
                )}
                <p className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
                  A delay to any of these steps delays the finish. Other steps have slack.
                </p>
              </Card>
            </div>
          </section>
        )}

        {plan && (
          <AddStepForm items={items} steps={plan.nodes} onAdd={add} onConvert={convert} />
        )}
      </div>
    </>
  );
}
