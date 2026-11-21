"use client";

import type { PlanNode } from "@/lib/types";

/** A multi-select of step keys as a checkbox list: what a step has to wait for. */
export function WaitsOnPicker({ steps, value, onChange }: { steps: PlanNode[]; value: string[]; onChange: (keys: string[]) => void }) {
  if (!steps.length) return <p className="mt-1 text-sm text-muted">There are no other steps to wait on.</p>;
  const chosen = new Set(value);
  const toggle = (id: string) => onChange(chosen.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-hairline bg-canvas p-1.5">
      {steps.map((s) => (
        <li key={s.id}>
          <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-sm text-secondary transition-colors duration-150 hover:bg-subtle">
            <input
              type="checkbox"
              checked={chosen.has(s.id)}
              onChange={() => toggle(s.id)}
              className="h-3.5 w-3.5 accent-dutchOrange"
            />
            <span className="font-mono text-[10px] text-link">{s.id}</span>
            <span className="truncate">{s.title}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
