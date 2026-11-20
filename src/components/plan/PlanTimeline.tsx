"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import type { Plan, PlanNode } from "@/lib/types";
import { fmtMinutes } from "./format";

/** The plan as an ordered list grouped by wave, each step with a bar from its start to its finish. */
export function PlanTimeline({ plan, selectedId, onSelect }: { plan: Plan; selectedId: string | null; onSelect: (id: string) => void }) {
  const total = Math.max(plan.totalMinutes, 1);
  const orderIdx = new Map(plan.order.map((id, i) => [id, i]));
  const waves = new Map<number, PlanNode[]>();
  for (const n of plan.nodes) waves.set(n.wave, [...(waves.get(n.wave) ?? []), n]);
  const keys = [...waves.keys()].sort((a, b) => (a < 0 ? 1 : b < 0 ? -1 : a - b));

  return (
    <ol className="space-y-5">
      {keys.map((w) => {
        const list = waves.get(w)!.sort((a, b) => (orderIdx.get(a.id) ?? 1e9) - (orderIdx.get(b.id) ?? 1e9));
        return (
          <li key={w}>
            <p className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              <span className="text-link">{w < 0 ? "Not scheduled" : `Wave ${w + 1}`}</span>
              {w >= 0 && list.length > 1 && <span>Can run in parallel</span>}
              {w < 0 && <span>Waiting on a loop</span>}
            </p>
            <ul className="mt-1.5 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
              {list.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(n.id)}
                    className={`grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-subtle md:grid-cols-[3.5rem_minmax(0,16rem)_minmax(0,1fr)_auto] ${
                      selectedId === n.id ? "bg-subtle" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] text-link">{n.id}</span>
                    <span className="truncate text-sm text-primary">{n.title}</span>
                    <span className="col-span-3 row-start-2 md:col-span-1 md:row-start-auto">
                      <span className="relative block h-2 rounded-full bg-subtle" aria-hidden>
                        {n.wave >= 0 && (
                          <span
                            className={`absolute inset-y-0 rounded-full ${n.critical ? "bg-dutchOrange" : "bg-dutchOrange/30"}`}
                            style={{ left: `${(n.start / total) * 100}%`, width: `${Math.max((n.minutes / total) * 100, 0.6)}%` }}
                          />
                        )}
                      </span>
                      <span className="sr-only">
                        {n.wave >= 0 ? `From minute ${n.start} to minute ${n.finish}` : "Not scheduled"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="hidden font-mono text-[10px] text-muted sm:inline">
                        {n.wave >= 0 ? `${n.start} to ${n.finish}` : ""} · {fmtMinutes(n.minutes)}
                      </span>
                      <StatusBadge tone={statusTone(n.status)}>{n.status}</StatusBadge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
