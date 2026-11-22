"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { NET_COLOR } from "@/lib/domain";
import { CHECK_TEXT, type PartLite, type Step } from "./derive";
import { StatusControl } from "./StatusControl";
import { Card } from "@/components/ui/Card";

function End({ refId, pin, parts }: { refId: string; pin: string; parts: Map<string, PartLite> }) {
  const p = parts.get(refId);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-mono text-primary">{refId}</span>
      <span className="text-muted">pin</span>
      <span className="font-mono text-primary">{pin || "none set"}</span>
      <span className="text-muted">({p ? p.title : "not in the bill of materials"})</span>
    </span>
  );
}

export function StepCard({ step, parts, onStatus, readOnly = false }: { step: Step; parts: Map<string, PartLite>; onStatus: (s: string) => void; /** shows the status as words, with no controls: the public welcome page */ readOnly?: boolean }) {
  const w = step.wire;
  return (
    <Card variant="flat" as="li" className="p-4 print:break-inside-avoid"
 data-step={step.n}>
      <div className="flex items-start gap-4">
        <span aria-hidden className="hidden h-4 w-4 shrink-0 border border-black print:mt-1 print:inline-block" />
        <span className="w-8 shrink-0 pt-0.5 font-mono text-sm text-link">
          <span aria-hidden>{String(step.n).padStart(2, "0")}</span>
          <span className="sr-only">Step {step.n}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold tracking-tight text-primary">{w.name}</h4>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
                <span className="bs-dot inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NET_COLOR[w.netClass] }} aria-hidden />
                <span>{w.net || "no net"}</span>
                <span aria-hidden>·</span>
                <span>{w.netClass}</span>
              </p>
            </div>
            {readOnly ? (
              <span className="font-mono text-xs text-secondary">{w.status}</span>
            ) : (
              <>
                <span className="no-print flex items-center gap-1">
                  <RowActions item={w.item} label={`joint ${w.name}`} />
                  <StatusControl status={w.status} name={w.name} onChange={onStatus} />
                </span>
                <span className="hidden font-mono text-xs print:inline">{w.status}</span>
              </>
            )}
          </div>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-secondary">
            <End refId={w.from} pin={w.fromPin} parts={parts} />
            <span aria-hidden className="text-muted">→</span><span className="sr-only">to</span>
            <End refId={w.to} pin={w.toPin} parts={parts} />
          </p>
          {w.note && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-primary">{w.note}</p>}
          <div className="mt-3 border-t border-hairline pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Check</p>
            <p className="mt-0.5 text-[13px] text-secondary">{CHECK_TEXT[w.netClass]}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
