"use client";

import { useState } from "react";
import { Check, ChevronDown, ArrowRight, Undo2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { messageOf } from "@/lib/queries";
import { useMoveStage, type ProcessView, type StageView } from "@/lib/process/client";
import { fmtTime } from "@/components/plan/format";
import { CheckList } from "./CheckList";
import { OverrideDialog } from "./OverrideDialog";
import { gateBadge } from "./gateBadge";

/**
 * The seven stages as a vertical stepper. shadcn/ui has no stepper component (its registry
 * answers 404 for one), so this is an ordered list of shadcn Collapsibles, one per stage.
 * The current stage is open; each stage lists its gate's checks with what fixes them.
 */
export function ProcessStepper({ projectId, view }: { projectId: string; view: ProcessView }) {
  const [overriding, setOverriding] = useState<StageView | null>(null);
  const move = useMoveStage(projectId);

  const goTo = async (stage: StageView, verb: string) => {
    try {
      await move.mutateAsync(stage.key);
      toast.success(`${verb} ${stage.label}.`);
    } catch (e) {
      toast.error(messageOf(e) || "The stage was not changed.");
    }
  };

  const nextOf = (i: number) => view.stages[i + 1];

  return (
    <>
      <ol aria-label="Stages and their gates" className="relative">
        {view.stages.map((s, i) => (
          <StageRow
            // Remounts when the stage changes position, so the new current stage opens and the old one closes.
            key={`${s.key}:${s.position}`}
            stage={s}
            last={i === view.stages.length - 1}
            next={nextOf(i)}
            busy={move.isPending}
            onAdvance={() => nextOf(i) && goTo(nextOf(i)!, "Moved to")}
            onBack={() => goTo(s, "Moved back to")}
            onOverride={() => setOverriding(s)}
          />
        ))}
      </ol>
      {overriding && <OverrideDialog projectId={projectId} stage={overriding} onClosed={() => setOverriding(null)} />}
    </>
  );
}

function StageRow({
  stage, last, next, busy, onAdvance, onBack, onOverride,
}: {
  stage: StageView; last: boolean; next?: StageView; busy: boolean;
  onAdvance: () => void; onBack: () => void; onOverride: () => void;
}) {
  const [open, setOpen] = useState(stage.position === "current");
  const badge = gateBadge(stage);
  const current = stage.position === "current";
  const headId = `stage-${stage.key}-h`;
  const blockedId = `stage-${stage.key}-blocked`;
  const marker =
    stage.position === "done"
      ? "border-dutchOrange bg-dutchOrange text-white"
      : current
        ? "border-dutchOrange bg-surface text-link ring-4 ring-dutchOrange/15"
        : "border-hairline bg-surface text-muted";
  const positionWord = stage.position === "done" ? "Completed stage" : current ? "Current stage" : "Upcoming stage";

  return (
    <li
      className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 pb-6"
      aria-current={current ? "step" : undefined}
      data-position={stage.position}
      data-testid={`stage-${stage.key}`}
    >
      {!last && <span aria-hidden className={`absolute bottom-0 left-5 top-10 w-px -translate-x-1/2 ${stage.position === "done" ? "bg-dutchOrange" : "bg-hairline"}`} />}
      <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border font-mono text-xs ${marker}`}>
        {stage.position === "done" ? <Check className="h-4 w-4" aria-hidden /> : String(stage.n).padStart(2, "0")}
        <span className="sr-only">{positionWord}</span>
      </span>
      <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 pt-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id={headId} className="text-base font-semibold tracking-tight text-primary">{stage.label}</h2>
          {current && <StatusBadge tone="info">Current</StatusBadge>}
          <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
          {stage.position === "done" && (
            <Button size="xs" variant="ghost" onClick={onBack} disabled={busy}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden /> Move back to {stage.label}
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary hover:text-link focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            >
              {open ? "Hide checks" : "Show checks"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
              <span className="sr-only"> for {stage.label}</span>
            </button>
          </CollapsibleTrigger>
        </div>
        <p className="mt-0.5 text-sm text-secondary">{stage.goal}</p>
        {stage.overridden && stage.record && (
          <p className="mt-2 flex items-start gap-2 rounded-md border border-hairline bg-subtle px-3 py-2 text-xs text-secondary">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              Overridden{stage.record.decidedBy ? ` by ${stage.record.decidedBy}` : ""}
              {stage.record.decidedAt ? ` on ${fmtTime(stage.record.decidedAt)}` : ""}. Reason: {stage.record.note}
            </span>
          </p>
        )}
        <CollapsibleContent className="mt-3 space-y-3">
          <CheckList checks={stage.result.checks} labelledBy={headId} />
          <div className="flex flex-wrap items-center gap-2">
            {current && next && (
              <Button size="sm" onClick={onAdvance} disabled={busy || !stage.passed} aria-describedby={stage.passed ? undefined : blockedId}>
                Advance to {next.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
            {current && !stage.result.met && !stage.overridden && (
              <Button size="sm" variant="outline" onClick={onOverride} disabled={busy}>
                Override with a reason
              </Button>
            )}
            {current && next && !stage.passed && (
              <p id={blockedId} className="text-xs text-muted">Meet every check, or override the gate with a reason, to advance.</p>
            )}
            {current && !next && stage.passed && <p className="text-xs text-muted">This is the last stage, and its gate is passed.</p>}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
