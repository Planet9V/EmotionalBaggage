"use client";

import { useId } from "react";
import type { Criterion } from "@/lib/trace/builds";

/** Exit criteria as a checklist. `onToggle` is given the position in the list. */
export function CriteriaChecklist({ criteria, onToggle, disabled }: { criteria: Criterion[]; onToggle: (index: number, met: boolean) => void; disabled?: boolean }) {
  const id = useId();
  if (!criteria.length) return <p className="text-xs text-muted">No exit criteria yet.</p>;
  return (
    <ul className="space-y-1" aria-label="Exit criteria">
      {criteria.map((c, i) => (
        <li key={i} className="flex items-start gap-2">
          <input
            id={`${id}-${i}`}
            type="checkbox"
            checked={c.met}
            disabled={disabled}
            onChange={(e) => onToggle(i, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
          />
          <label htmlFor={`${id}-${i}`} className={`text-sm wrap-anywhere ${c.met ? "text-secondary" : "text-primary"}`}>
            {c.text}
          </label>
        </li>
      ))}
    </ul>
  );
}
