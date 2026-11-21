"use client";

import type { Consumables, PartLite } from "./derive";

export function Joints({ k, wireCount, parts }: { k: Consumables; wireCount: number; parts: Map<string, PartLite> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-hairline bg-surface p-4 print:break-inside-avoid">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Solder joints</p>
        <p className="mt-2 font-mono text-lg text-primary">{k.joints}</p>
        <p className="mt-1 text-xs text-secondary">
          2 per wire ({wireCount} wires). A part in series is its own part with a wire to each of its pins, so it is counted with the wires.
        </p>
      </div>
      <div className="rounded-xl border border-hairline bg-surface p-4 print:break-inside-avoid">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Header pins</p>
        <p className="mt-1 text-xs text-muted">Parts with 3 or more pins in use.</p>
        {k.headers.length === 0 ? (
          <p className="mt-2 text-sm text-secondary">No part has 3 or more pins.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {k.headers.map((h) => (
              <li key={h.ref} className="flex items-baseline justify-between gap-3 text-[13px] text-secondary">
                <span><span className="font-mono text-primary">{h.ref}</span> {parts.get(h.ref)?.title ?? "not in the bill of materials"}</span>
                <span className="font-mono text-primary">{h.pins} pins</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
