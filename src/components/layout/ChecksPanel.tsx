"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { fmtMm, type CheckResult } from "./geom";
import { Card } from "@/components/ui/Card";

const eyebrow = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

export type NoGeometry = { id: number; label: string };

function Line({ id, onSelect, children, tone }: { id: number; onSelect: (id: number) => void; children: React.ReactNode; tone: "danger" | "warning" | "info" | "muted" }) {
  const Icon = tone === "info" || tone === "muted" ? Info : AlertTriangle;
  const cls = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "info" ? "text-info" : "text-muted";
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(id)}
        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm text-primary transition-colors duration-150 hover:bg-subtle"
      >
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cls}`} aria-hidden />
        <span>{children}</span>
      </button>
    </li>
  );
}

export function ChecksPanel({ checks, noGeometry, onSelect, hasParts }: { checks: CheckResult; noGeometry: NoGeometry[]; onSelect: (id: number) => void; hasParts: boolean }) {
  const problems = checks.overlaps.length + checks.outside.length;
  return (
    <Card variant="flat" as="section" aria-label="Checks" className="p-3">
      <p className={eyebrow}>Checks</p>
      <p className="mt-1 text-xs text-muted">Checks use bounding boxes, so a round or odd-shaped part counts as the full box around it.</p>

      {hasParts && problems === 0 && (
        <p className="mt-3 flex items-start gap-2 px-1.5 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {checks.hasEnvelope ? "No parts overlap and nothing sticks out of the enclosure." : "No parts overlap."}
        </p>
      )}
      {!checks.hasEnvelope && hasParts && (
        <p className="mt-2 px-1.5 text-sm text-muted">There is no enclosure yet, so the outside check and the floor are not applied. Create one under Envelope.</p>
      )}

      <ul className="mt-2 flex flex-col gap-0.5">
        {checks.overlaps.map((o) => (
          <Line key={`o${o.a.id}-${o.b.id}`} id={o.a.id} onSelect={onSelect} tone="danger">
            {o.a.label} and {o.b.label} overlap by {fmtMm(o.depth[0])} x {fmtMm(o.depth[1])} x {fmtMm(o.depth[2])} mm (x, y, z).
          </Line>
        ))}
        {checks.outside.map((o) => (
          <Line key={`s${o.part.id}`} id={o.part.id} onSelect={onSelect} tone="warning">
            {o.part.label} sticks out of the enclosure: {o.amounts.map((a) => `${fmtMm(Number(a.mm.toFixed(2)))} mm ${a.side}`).join(", ")}.
          </Line>
        ))}
        {checks.floating.map((f) => (
          <Line key={`f${f.part.id}`} id={f.part.id} onSelect={onSelect} tone="info">
            Note: {f.part.label} sits {fmtMm(Number(f.gap.toFixed(2)))} mm above the floor with nothing under it.
          </Line>
        ))}
        {noGeometry.map((n) => (
          <Line key={`n${n.id}`} id={n.id} onSelect={onSelect} tone="muted">
            {n.label} has no geometry, so it is not drawn or checked.
          </Line>
        ))}
      </ul>
    </Card>
  );
}
