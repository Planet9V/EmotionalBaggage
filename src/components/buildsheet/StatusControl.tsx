"use client";

import { useRef } from "react";
import { STATUS_FLOW } from "./derive";

const LABEL: Record<(typeof STATUS_FLOW)[number], string> = { "to solder": "To solder", soldered: "Soldered", tested: "Tested" };

/** to solder, soldered, tested. Tested stays locked until the wire is soldered. Arrow keys move between options. */
export function StatusControl({ status, name, onChange }: { status: string; name: string; onChange: (next: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const known = (STATUS_FLOW as readonly string[]).indexOf(status);
  const current = known < 0 ? 0 : known;
  const soldered = known >= 1;
  const allowed = (i: number) => i < 2 || soldered;

  const go = (i: number) => {
    if (i < 0 || i >= STATUS_FLOW.length || !allowed(i)) return;
    onChange(STATUS_FLOW[i]);
    refs.current[i]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={`Status of ${name}`}
      className="no-print inline-flex rounded-md border border-hairline bg-subtle p-0.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(current + 1); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(current - 1); }
      }}
    >
      {STATUS_FLOW.map((s, i) => {
        const on = known === i;
        const locked = !allowed(i);
        return (
          <button
            key={s}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={locked}
            tabIndex={i === current ? 0 : -1}
            title={locked ? "Solder this wire first" : undefined}
            onClick={() => { if (!locked) onChange(s); }}
            className={`h-7 rounded px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange ${
              on
                ? s === "tested" ? "bg-success-soft text-success" : s === "soldered" ? "bg-info-soft text-info" : "bg-warning-soft text-warning"
                : locked ? "cursor-not-allowed text-muted" : "text-secondary hover:text-primary"
            }`}
          >
            {LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}
