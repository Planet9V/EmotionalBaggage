"use client";

import { useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { skippedSentence, type SkippedGate } from "@/lib/process/evaluate";
import { useMoveStage } from "@/lib/process/client";
import { ReasonDialog } from "./ReasonDialog";

/** Opens a stage's checks on the Process page (the page listens; from another page the address does it). */
export const REVEAL_EVENT = "process:reveal";

/**
 * A gate behind the stage the concept is in that is neither passed nor overridden: say so, show what is missing,
 * and offer the way back to that stage. A warning, never a stop.
 */
export function SkippedGates({ projectId, skipped, compact = false }: { projectId: string; skipped: SkippedGate[]; compact?: boolean }) {
  const [asking, setAsking] = useState<SkippedGate | null>(null);
  const move = useMoveStage(projectId);
  if (!skipped.length) return null;
  return (
    <>
      <ul aria-label="Gates that were skipped" className={compact ? "space-y-1" : "space-y-2"}>
        {skipped.map((s) => (
          <li key={s.stage} data-testid={`skipped-${s.stage}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? "text-[13px]" : "rounded-md border border-hairline bg-subtle px-3 py-2 text-sm"}`}>
            <span className="flex min-w-0 items-start gap-2 text-primary">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              <span>{skippedSentence(s)}</span>
            </span>
            <Link
              href={`/process#gate-${s.stage}`}
              onClick={() => window.setTimeout(() => window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: s.stage })), 50)}
              className="font-medium text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            >
              Show what is missing
            </Link>
            <Button type="button" size="xs" variant="outline" onClick={() => setAsking(s)}>
              Move back to {s.label}
            </Button>
          </li>
        ))}
      </ul>
      {asking && (
        <ReasonDialog
          eyebrow={`Gate · ${asking.label}`}
          title={`Move back to ${asking.label}?`}
          description={`${skippedSentence(asking)} Moving back lets you meet its checks, or override it with a reason.`}
          confirm="Move back"
          busyLabel="Moving..."
          onConfirm={async (why) => {
            await move.mutateAsync({ stage: asking.stage, why });
            toast.success(`Moved back to ${asking.label}.`);
          }}
          onClosed={() => setAsking(null)}
        />
      )}
    </>
  );
}
