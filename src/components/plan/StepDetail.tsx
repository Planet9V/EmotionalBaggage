"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Item, PlanNode } from "@/lib/types";
import { statusesFor, storeHref, storeLabel } from "./format";
import { WaitsOnPicker } from "./WaitsOnPicker";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtMinutes } from "@/lib/format";

export type ItemChange = { status?: string; data?: Record<string, unknown> };

/**
 * The selected step: what it is, and the three things that change the plan (status, minutes, what it waits on).
 * Mount it with a key per step so its local edits start from the saved values.
 */
export function StepDetail({
  step,
  item,
  steps,
  onSave,
  onClose,
}: {
  step: PlanNode;
  item: Item | undefined;
  steps: PlanNode[];
  onSave: (itemId: number, change: ItemChange) => Promise<void>;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(String(step.minutes));
  const [after, setAfter] = useState<string[]>(step.after);
  const [busy, setBusy] = useState("");
  const href = storeHref(step.section);
  const minutesValue = Number(minutes);
  const minutesValid = minutes.trim() !== "" && Number.isFinite(minutesValue) && minutesValue >= 0;
  const afterChanged = after.slice().sort().join(",") !== step.after.slice().sort().join(",");

  const run = async (what: string, change: ItemChange) => {
    setBusy(what);
    try {
      await onSave(step.itemId, change);
    } finally {
      setBusy("");
    }
  };

  return (
    <aside className="rounded-xl border border-hairline bg-surface p-5" aria-label={`Step ${step.title}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">
            Step {step.id}
            {step.critical && <span className="ml-2 text-link">critical path</span>}
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-primary">{step.title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close step detail">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {item?.body ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-secondary">{item.body}</p>
      ) : (
        <p className="mt-3 text-sm text-muted">No description recorded.</p>
      )}

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Section</dt>
        <dd>
          {href ? (
            <Link href={href} className="text-link hover:underline">{storeLabel(step.section)}</Link>
          ) : (
            <span className="text-secondary">{step.section}</span>
          )}
        </dd>
        <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Window</dt>
        <dd className="font-mono text-xs text-secondary">
          {step.wave < 0 ? (step.blocked ? "not scheduled (in a loop)" : "not worked out (the planner is not answering)") : `starts at ${step.start} min, finishes at ${step.finish} min`}
        </dd>
      </dl>

      <div className="mt-5 space-y-4 border-t border-hairline pt-4">
        <div>
          <label htmlFor="step-status" className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Status</label>
          <div className="mt-1 flex items-center gap-2">
            <NativeSelect
              id="step-status"
              value={step.status}
              disabled={!!busy}
              onChange={(e) => void run("status", { status: e.target.value })}
              className="flex-1"
            >
              {statusesFor(step.section, step.status).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </NativeSelect>
            <StatusBadge tone={statusTone(step.status)}>{step.status}</StatusBadge>
          </div>
        </div>

        <div>
          <label htmlFor="step-minutes" className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Minutes</label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="step-minutes"
              type="number"
              min={0}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-28 font-mono"
            />
            <span className="font-mono text-xs text-muted">{minutesValid ? fmtMinutes(minutesValue) : "not a number"}</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={!minutesValid || minutesValue === step.minutes || !!busy}
              onClick={() => void run("minutes", { data: { minutes: minutesValue } })}
            >
              {busy === "minutes" ? "Saving" : "Save minutes"}
            </Button>
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Waits on</p>
          <WaitsOnPicker steps={steps.filter((s) => s.id !== step.id)} value={after} onChange={setAfter} />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!afterChanged || !!busy}
              onClick={() => void run("after", { data: { after } })}
            >
              {busy === "after" ? "Saving" : "Save waits on"}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
