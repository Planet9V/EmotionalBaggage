"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { Check } from "./model";

const ICON = {
  danger: <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />,
  warning: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />,
  neutral: <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />,
};
const WORD = { danger: "Error", warning: "Check", neutral: "Note" };

export const rowProblems = (checks: Check[]) => checks.filter((c) => c.tone !== "neutral").length;

/**
 * Problems found in the rows themselves, as the first part of the one checks panel (ErcPanel). Each one names
 * the refs; clicking selects the wire or part.
 */
export function ChecksPanel({ checks, wireCount, partCount, onPick }: { checks: Check[]; wireCount: number; partCount: number; onPick: (c: Check) => void }) {
  return (
    <div className="mt-3" aria-labelledby="schematic-checks" role="group">
      <p id="schematic-checks" className="text-xs font-medium uppercase tracking-wider text-muted">Wiring rows</p>
      <p className="mt-0.5 text-xs text-muted">
        Worked out from {wireCount} {wireCount === 1 ? "wire" : "wires"} and {partCount} {partCount === 1 ? "part" : "parts"} each time they change.
      </p>
      {checks.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Every pin has a wire, every ref is in the bill of materials, no wire is doubled and every net has one class.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {checks.map((c) => {
            const clickable = c.wireIds.length > 0 || c.refs.length === 1;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => onPick(c)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm text-secondary transition-colors duration-150 enabled:hover:bg-subtle disabled:cursor-default"
                >
                  {ICON[c.tone]}
                  <span>
                    <span className="sr-only">{WORD[c.tone]}: </span>
                    {c.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
