"use client";

import type { Counts } from "./derive";

/** A thin bar (soldered underneath, tested on top) with the counts as words. */
export function Progress({ c, label }: { c: Counts; label?: string }) {
  const pct = (n: number) => (c.total ? Math.round((n / c.total) * 100) : 0);
  return (
    <div className="min-w-0">
      <div
        role="progressbar"
        aria-label={label ?? "Build progress"}
        aria-valuemin={0}
        aria-valuemax={c.total}
        aria-valuenow={c.tested}
        aria-valuetext={`${c.soldered} soldered, ${c.tested} tested, of ${c.total}`}
        className="relative h-1 w-full overflow-hidden rounded-full bg-subtle print:border print:border-black"
      >
        <div className="absolute inset-y-0 left-0 bg-info transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct(c.soldered)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-success transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct(c.tested)}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-muted">
        {c.soldered} soldered · {c.tested} tested · of {c.total}
      </p>
    </div>
  );
}
