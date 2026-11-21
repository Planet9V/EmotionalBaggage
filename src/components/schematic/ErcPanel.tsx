"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SEVERITY_LABEL, type Finding, type Severity } from "@/lib/parts/erc";
import { EYEBROW } from "@/components/ui/field";
import { Card } from "@/components/ui/Card";

const ICON: Record<Severity, React.ReactNode> = {
  error: <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />,
  warning: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />,
  info: <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />,
};
const TONE = { error: "danger", warning: "warning", info: "neutral" } as const;

type Props = {
  findings: Finding[];
  /** the pins could not be read: the checks would be incomplete */
  error?: string;
  loading?: boolean;
  onRetry?: () => void;
  onPick: (f: Finding) => void;
  /** the wired parts with no kind or library entry, named in the partial state */
  undescribed: string[];
  /** the checks on the rows themselves (refs, doubled wires, net classes), shown in the same panel */
  rowChecks?: React.ReactNode;
  rowProblems?: number;
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** Electrical checks beside the schematic (plan 5.4). Each finding names the rows; pressing one selects them. */
export function ErcPanel({ findings, error, loading, onRetry, onPick, undescribed, rowChecks, rowProblems = 0 }: Props) {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length + rowProblems;
  return (
    <Card variant="flat" as="section" aria-labelledby="erc-title" className="p-4" data-testid="erc-panel">
      <p className={EYEBROW}>Checks</p>
      <h3 id="erc-title" className="mt-1 text-base font-semibold tracking-tight text-primary">
        {loading ? "Reading the pins" : error ? "Checks not run" : errors ? `${errors} ${errors === 1 ? "error" : "errors"}${warnings ? `, ${warnings} to look at` : ""}` : warnings ? `${warnings} to look at` : "Nothing to fix"}
      </h3>
      <p className="mt-0.5 text-xs text-muted">
        The wiring rows, then the electrical checks: supply voltage against each pin, supply and ground left open, outputs tied together, pull-ups on shared buses, current drawn against what a supply gives. They catch what a checklist can catch; they do not prove a circuit works.
      </p>
      {error ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-danger">
          {error}
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : loading ? null : (
        <>
          {rowChecks}
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">Electrical</p>
          {undescribed.length > 0 && (
            <p className="mt-1 text-xs text-secondary" data-testid="undescribed-parts">
              {list(undescribed)} {undescribed.length === 1 ? "has" : "have"} no kind or library entry yet, so {undescribed.length === 1 ? "its pins are" : "their pins are"} only the names the wires use and fewer checks apply. Set {undescribed.length === 1 ? "it" : "them"} in the bill of materials.
            </p>
          )}
          {findings.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing the electrical checks look for.
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {findings.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => onPick(f)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm text-secondary transition-colors duration-150 hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
                    {ICON[f.severity]}
                    <span className="min-w-0">
                      <StatusBadge tone={TONE[f.severity]} className="mr-1.5 align-middle">
                        {SEVERITY_LABEL[f.severity]}
                      </StatusBadge>
                      {f.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
